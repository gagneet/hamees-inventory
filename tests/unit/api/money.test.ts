/**
 * Money rules: legacy duplicate-advance detection, stored-tax recomputation, and the balance caps
 * on payments, installments and order edits (each under a row lock).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isLegacyAdvanceInstallment, safeInstallmentNote, sumInstallmentPayments } from '@/lib/order-finance'
import { recomputeOrderTax, type TaxConfig } from '@/lib/tax'
import { PATCH as patchInstallment } from '@/app/api/installments/[id]/route'
import { POST as postPayment } from '@/app/api/orders/[id]/payments/route'
import { PATCH as patchOrder } from '@/app/api/orders/[id]/route'

type Mocked = ReturnType<typeof vi.fn>
const m = (fn: unknown) => fn as Mocked

const json = (url: string, method: string, body: unknown) =>
  new Request(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

describe('legacy duplicate-advance installments', () => {
  it('excludes only a note-marked installment #1 that equals the advance', () => {
    const legacy = { installmentNumber: 1, paidAmount: 5000, notes: 'Advance payment on order creation' }
    const realFirstPayment = { installmentNumber: 1, paidAmount: 5000, notes: 'Payment recorded via CASH' }
    expect(isLegacyAdvanceInstallment(legacy, 5000)).toBe(true)
    expect(isLegacyAdvanceInstallment(realFirstPayment, 5000)).toBe(false)
    expect(isLegacyAdvanceInstallment({ ...legacy, installmentNumber: 2 }, 5000)).toBe(false)
    expect(isLegacyAdvanceInstallment(legacy, 4000)).toBe(false)

    // Advance 5000 and a real first payment of 5000: both count
    expect(sumInstallmentPayments([realFirstPayment], 5000)).toBe(5000)
    expect(sumInstallmentPayments([legacy, { installmentNumber: 2, paidAmount: 300, notes: null }], 5000)).toBe(300)
  })

  it('never lets a user-entered note look like a legacy row', () => {
    expect(safeInstallmentNote('Advance payment again')).toBe('Note: Advance payment again')
    expect(safeInstallmentNote('Paid by UPI')).toBe('Paid by UPI')
  })
})

describe('recomputeOrderTax keeps the order’s own tax structure', () => {
  const single: TaxConfig = { mode: 'SINGLE', rate: 20, name: 'VAT' }
  const none: TaxConfig = { mode: 'NONE', rate: 0, name: 'Tax' }

  it('keeps CGST+SGST at the stored rate after the shop switches to single-rate VAT', () => {
    const t = recomputeOrderTax(10000, { gstRate: 12, cgst: 600, sgst: 600, igst: 0, gstAmount: 1200 }, single)
    expect(t).toMatchObject({ gstRate: 12, cgst: 600, sgst: 600, igst: 0, gstAmount: 1200, totalAmount: 11200 })
  })

  it('keeps IGST, and does not drop tax when the shop switches to no tax', () => {
    expect(recomputeOrderTax(10000, { gstRate: 12, igst: 1200, gstAmount: 1200 }, none)).toMatchObject({ igst: 1200, gstAmount: 1200 })
    expect(recomputeOrderTax(10000, { gstRate: 12, cgst: 600, sgst: 600, gstAmount: 1200 }, none).gstAmount).toBe(1200)
  })

  it('keeps an untaxed order untaxed', () => {
    expect(recomputeOrderTax(10000, { gstRate: 0, gstAmount: 0 }, single)).toMatchObject({ gstAmount: 0, totalAmount: 10000 })
  })
})

describe('payment caps', () => {
  const order = {
    id: 'o1',
    orderNumber: 'ORD-1',
    status: 'NEW',
    // Untaxed order, so total = subTotal − discount and the arithmetic stays readable
    subTotal: 10000,
    gstRate: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    gstAmount: 0,
    taxableAmount: 10000,
    totalAmount: 10000,
    advancePaid: 5000,
    discount: 0,
    balanceAmount: 3000,
    deliveryDate: new Date('2026-10-01T00:00:00Z'),
    discountReason: null,
    notes: null,
    tailorNotes: null,
    priority: 'NORMAL',
    customer: { state: null },
  }
  const installment = {
    id: 'i1',
    orderId: 'o1',
    installmentNumber: 1,
    installmentAmount: 5000,
    paidAmount: 2000,
    notes: 'Payment recorded via CASH',
    dueDate: new Date('2026-10-01T00:00:00Z'),
    status: 'PARTIAL',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    m(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } })
    m(prisma.$transaction).mockImplementation(async (fn: unknown) =>
      typeof fn === 'function' ? (fn as (tx: typeof prisma) => unknown)(prisma) : Promise.all(fn as unknown[])
    )
    m(prisma.$queryRaw).mockResolvedValue([])
    m(prisma.order.findFirst).mockResolvedValue(order)
    m(prisma.order.findUnique).mockResolvedValue(order)
    m(prisma.order.count).mockResolvedValue(1)
    m(prisma.order.update).mockResolvedValue(order)
    m(prisma.paymentInstallment.findUnique).mockResolvedValue(installment)
    m(prisma.paymentInstallment.findFirst).mockResolvedValue(installment)
    m(prisma.paymentInstallment.findMany).mockResolvedValue([installment])
    m(prisma.paymentInstallment.update).mockResolvedValue(installment)
    m(prisma.paymentInstallment.create).mockResolvedValue({ ...installment, id: 'i2' })
    m(prisma.orderHistory.create).mockResolvedValue({})
  })

  it('installment payments cannot exceed the outstanding balance (row locked first)', async () => {
    // balance 3000 + this installment's current 2000 = 5000 available
    const over = await patchInstallment(json('http://x/api/installments/i1', 'PATCH', { paidAmount: 6000 }), {
      params: Promise.resolve({ id: 'i1' }),
    })
    expect(over.status).toBe(400)
    expect(prisma.paymentInstallment.update).not.toHaveBeenCalled()
    expect(prisma.$queryRaw).toHaveBeenCalled()

    const ok = await patchInstallment(json('http://x/api/installments/i1', 'PATCH', { paidAmount: 5000 }), {
      params: Promise.resolve({ id: 'i1' }),
    })
    expect(ok.status).toBe(200)
    expect(prisma.paymentInstallment.update).toHaveBeenCalled()
  })

  it('a legacy advance row cannot be edited as a payment', async () => {
    m(prisma.paymentInstallment.findUnique).mockResolvedValue({
      ...installment,
      paidAmount: 5000,
      notes: 'Advance payment on order creation',
    })
    const res = await patchInstallment(json('http://x/api/installments/i1', 'PATCH', { paidAmount: 5000 }), {
      params: Promise.resolve({ id: 'i1' }),
    })
    expect(res.status).toBe(400)
    expect(prisma.paymentInstallment.update).not.toHaveBeenCalled()
  })

  it('a payment larger than the balance is refused', async () => {
    const res = await postPayment(json('http://x/api/orders/o1/payments', 'POST', { amount: 3500, paymentMode: 'CASH' }), {
      params: Promise.resolve({ id: 'o1' }),
    })
    expect(res.status).toBe(400)
    expect(prisma.paymentInstallment.create).not.toHaveBeenCalled()
  })

  it('a discount cannot push the re-priced total below the money already received', async () => {
    // A discount reduces the invoice total; it is not a payment. 10000 − 3100 = 6900, but
    // 5000 advance + 2000 already paid = 7000 has been received, so the edit is refused.
    const over = await patchOrder(json('http://x/api/orders/o1', 'PATCH', { discount: 3100 }), {
      params: Promise.resolve({ id: 'o1' }),
    })
    expect(over.status).toBe(400)
    expect(prisma.order.update).not.toHaveBeenCalled()

    // 10000 − 3000 = 7000 exactly covers the 7000 received, so the balance clears
    const ok = await patchOrder(json('http://x/api/orders/o1', 'PATCH', { discount: 3000 }), {
      params: Promise.resolve({ id: 'o1' }),
    })
    expect(ok.status).toBe(200)
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          discount: 3000,
          taxableAmount: 7000,
          totalAmount: 7000,
          balanceAmount: 0,
        }),
      })
    )
  })

  it('a discount larger than the pre-tax value is refused', async () => {
    const res = await patchOrder(json('http://x/api/orders/o1', 'PATCH', { discount: 10001 }), {
      params: Promise.resolve({ id: 'o1' }),
    })
    expect(res.status).toBe(400)
    expect(prisma.order.update).not.toHaveBeenCalled()
  })
})
