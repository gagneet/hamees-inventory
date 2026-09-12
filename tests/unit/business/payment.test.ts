/**
 * Payment and pricing business-logic tests.
 *
 * These exercise the PRODUCTION helpers in lib/order-finance.ts and lib/money.ts rather than
 * re-implementing the formulas here — a test that copies the formula cannot catch a change to it.
 *
 * The model (v0.32.1):
 *   taxableAmount = subTotal − discount          the discount reduces the TAXABLE value
 *   totalAmount   = taxableAmount + tax          tax is charged on the discounted value
 *   balanceAmount = totalAmount − advancePaid − Σ installment payments
 *
 * The discount is therefore inside totalAmount and is NOT subtracted again from the balance.
 * The advance lives only in Order.advancePaid (the "single source of truth" fix from v0.28.4),
 * never also as installment #1.
 */
import { describe, it, expect } from 'vitest'
import {
  clampDiscount,
  orderBalance,
  repriceOrder,
  sumInstallmentPayments,
  isLegacyAdvanceInstallment,
} from '@/lib/order-finance'
import { allocateMoney, sumMoney, subtractMoney } from '@/lib/money'
import type { TaxConfig } from '@/lib/tax'

// India GST as the shop is configured out of the box: 12% split into CGST + SGST
const gst12: TaxConfig = { mode: 'SPLIT', rate: 12, name: 'GST', businessRegion: 'Punjab' }
const untaxed = { gstRate: 0, cgst: 0, sgst: 0, igst: 0, gstAmount: 0 }
const splitAt12 = { gstRate: 12, cgst: 1, sgst: 1, igst: 0, gstAmount: 2 }

// ── Basic balance calculation ──────────────────────────────────────────────

describe('balance = totalAmount − advancePaid − installments', () => {
  it('zero advance, zero installments: balance = total', () => {
    expect(orderBalance(10000, 0, 0)).toBe(10000)
  })

  it('full advance: balance = 0', () => {
    expect(orderBalance(10000, 10000, 0)).toBe(0)
  })

  it('partial advance only', () => {
    expect(orderBalance(10000, 3000, 0)).toBe(7000)
  })

  it('advance + one installment payment', () => {
    expect(orderBalance(10000, 3000, 4000)).toBe(3000)
  })

  it('multiple installments summed', () => {
    expect(orderBalance(10000, 0, sumMoney([2000, 3000]))).toBe(5000)
  })

  it('fully paid via advance + installment: balance = 0', () => {
    expect(orderBalance(10000, 5000, 5000)).toBe(0)
  })

  it('is exact to the minor unit, with no floating-point residue', () => {
    // 1333.33 − 500.11 − 333.33 = 499.89 exactly
    expect(orderBalance(1333.33, 500.11, 333.33)).toBe(499.89)
  })

  it('does NOT subtract the discount a second time', () => {
    // A 1,000 discount on a 10,000 order was already priced into totalAmount = 9,000.
    // Deducting it again here would hand the customer the discount twice.
    const priced = repriceOrder(10000, 1000, untaxed, gst12)
    expect(priced.totalAmount).toBe(9000)
    expect(orderBalance(priced.totalAmount, 0, 0)).toBe(9000)
  })
})

// ── The discount reduces the tax base ──────────────────────────────────────

describe('a discount is deducted before tax, not after', () => {
  it('tax-exclusive worked example: 1,000 list − 100 discount → 900 net, 90 tax, 990 due', () => {
    const cfg: TaxConfig = { mode: 'SINGLE', rate: 10, name: 'VAT' }
    const priced = repriceOrder(1000, 100, { gstRate: 10, gstAmount: 1 }, cfg)
    expect(priced.taxableAmount).toBe(900)
    expect(priced.gstAmount).toBe(90)
    expect(priced.totalAmount).toBe(990)
  })

  it('India GST 12% split: the discount shrinks CGST and SGST equally', () => {
    const priced = repriceOrder(10000, 1000, splitAt12, gst12)
    expect(priced.taxableAmount).toBe(9000)
    expect(priced.gstAmount).toBe(1080) // 12% of 9,000, not of 10,000
    expect(priced.cgst).toBe(540)
    expect(priced.sgst).toBe(540)
    expect(priced.totalAmount).toBe(10080)
  })

  it('the two halves of a split tax always add back to the total tax', () => {
    // 12% of 8,333.33 = 999.9996 → 1,000.00, which does not halve evenly
    const priced = repriceOrder(10000, 1666.67, splitAt12, gst12)
    expect(priced.cgst + priced.sgst).toBeCloseTo(priced.gstAmount, 10)
  })

  it('an untaxed order is unaffected by the tax step', () => {
    const priced = repriceOrder(10000, 1000, untaxed, { ...gst12, mode: 'NONE' })
    expect(priced.gstAmount).toBe(0)
    expect(priced.totalAmount).toBe(9000)
  })

  it('keeps the order’s own rate when the shop later changes its tax settings', () => {
    // Order charged 12% split; the shop has since moved to 20% single-rate VAT
    const nowVat: TaxConfig = { mode: 'SINGLE', rate: 20, name: 'VAT' }
    const priced = repriceOrder(10000, 1000, splitAt12, nowVat)
    expect(priced.gstRate).toBe(12)
    expect(priced.cgst).toBe(540)
    expect(priced.gstAmount).toBe(1080)
  })

  it('a full discount leaves nothing taxable and nothing to pay', () => {
    const priced = repriceOrder(10000, 10000, splitAt12, gst12)
    expect(priced.taxableAmount).toBe(0)
    expect(priced.gstAmount).toBe(0)
    expect(priced.totalAmount).toBe(0)
  })
})

// ── Discount bounds ────────────────────────────────────────────────────────

describe('a discount cannot exceed the value it reduces', () => {
  it('is capped at the pre-tax subtotal, never at the tax-inclusive total', () => {
    expect(clampDiscount(12000, 10000)).toBe(10000)
  })

  it('a negative discount is treated as none', () => {
    expect(clampDiscount(-500, 10000)).toBe(0)
  })

  it('a missing or non-numeric discount is treated as none', () => {
    expect(clampDiscount(null, 10000)).toBe(0)
    expect(clampDiscount(undefined, 10000)).toBe(0)
    expect(clampDiscount(Number.NaN, 10000)).toBe(0)
  })

  it('is rounded to the minor unit', () => {
    expect(clampDiscount(1000.005, 10000)).toBe(1000.01)
  })

  it('a shrinking order caps a discount that no longer fits', () => {
    // An item was removed, so the subtotal fell below the discount already granted
    const priced = repriceOrder(800, 1000, untaxed, gst12)
    expect(priced.discount).toBe(800)
    expect(priced.totalAmount).toBe(0)
  })
})

// ── Known bug scenario from v0.28.6 ────────────────────────────────────────

describe('known balance bug: double-counting the advance (v0.28.4 fix)', () => {
  /**
   * Real order ORD-1769338355430-738: the old formula subtracted advancePaid twice when it
   * was also stored as installment #1. sumInstallmentPayments excludes that legacy row, so
   * the advance is counted once.
   */
  it('excludes a legacy installment #1 that duplicates the advance', () => {
    const advancePaid = 75000.13
    const installments = [
      { installmentNumber: 1, paidAmount: 75000.13, notes: 'Advance payment on order creation' },
      { installmentNumber: 2, paidAmount: 2704.0, notes: 'Payment recorded via CASH' },
    ]
    expect(sumInstallmentPayments(installments, advancePaid)).toBe(2704.0)
    expect(orderBalance(177704.13, advancePaid, 2704.0)).toBe(100000)
  })

  it('a real first payment that happens to equal the advance is still counted', () => {
    const installment = { installmentNumber: 1, paidAmount: 5000, notes: 'Payment recorded via CASH' }
    expect(isLegacyAdvanceInstallment(installment, 5000)).toBe(false)
    expect(sumInstallmentPayments([installment], 5000)).toBe(5000)
  })
})

// ── Applying a discount to an existing order ──────────────────────────────

describe('applying a discount to an existing order', () => {
  it('reduces the balance by the discount plus the tax no longer charged on it', () => {
    // 10,000 + 12% = 11,200; advance 4,000 → balance 7,200.
    // A 1,000 discount removes 1,000 of value and 120 of tax → balance 6,080.
    const before = repriceOrder(10000, 0, splitAt12, gst12)
    expect(orderBalance(before.totalAmount, 4000, 0)).toBe(7200)

    const after = repriceOrder(10000, 1000, splitAt12, gst12)
    expect(orderBalance(after.totalAmount, 4000, 0)).toBe(6080)
  })

  it('replaces the previous discount rather than accumulating it', () => {
    const first = repriceOrder(10000, 500, untaxed, gst12)
    const second = repriceOrder(10000, 1000, untaxed, gst12)
    expect(first.totalAmount).toBe(9500)
    expect(second.totalAmount).toBe(9000)
  })

  it('a discount after a partial payment leaves the remaining balance', () => {
    const priced = repriceOrder(10000, 500, untaxed, gst12)
    expect(orderBalance(priced.totalAmount, 0, 4000)).toBe(5500)
  })
})

// ── Proportional distribution (print invoice & split order) ───────────────

describe('proportional cost distribution (multi-item orders)', () => {
  /**
   * Both the printed invoice and the split-order endpoint share order-level amounts by item
   * value with allocateMoney, which is exact: the parts always add back to the whole.
   */
  function distribute(items: number[], subTotal: number) {
    const orderLevelCosts = subtractMoney(subTotal, sumMoney(items))
    const shares = allocateMoney(orderLevelCosts, items)
    return items.map((price, i) => price + shares[i])
  }

  it('two-item order: the parts add up to subTotal exactly', () => {
    // Shirt ₹3,500, Suit ₹6,500, stitching ₹2,000 → subTotal ₹12,000
    expect(sumMoney(distribute([3500, 6500], 12000))).toBe(12000)
  })

  it('cheaper item gets proportionally less of the order-level cost', () => {
    const [shirt, suit] = distribute([3500, 6500], 12000)
    expect(shirt).toBe(4200) // 35% of ₹2,000 = ₹700
    expect(suit).toBe(7800) // 65% of ₹2,000 = ₹1,300
  })

  it('equal-price items get equal distribution', () => {
    const [a, b] = distribute([5000, 5000], 12000)
    expect(a).toBe(b)
    expect(a).toBe(6000)
  })

  it('single item gets 100% of order-level costs', () => {
    expect(distribute([8000], 10000)).toEqual([10000])
  })

  it('an indivisible remainder is handed out, never dropped', () => {
    // ₹0.01 cannot be split three ways; the parts must still total ₹0.01
    const parts = allocateMoney(0.01, [1, 1, 1])
    expect(sumMoney(parts)).toBe(0.01)
  })

  it('a discount split across items adds back to the order discount', () => {
    const parts = allocateMoney(1000, [3500, 6500])
    expect(sumMoney(parts)).toBe(1000)
  })
})

// ── Advance payment validation ─────────────────────────────────────────────

describe('advance payment validation', () => {
  it('an advance up to the total leaves a balance of zero or more', () => {
    expect(orderBalance(10000, 10000, 0)).toBe(0)
    expect(orderBalance(10000, 5000, 0)).toBe(5000)
  })

  it('an advance beyond the total shows as a negative balance (overpayment)', () => {
    expect(orderBalance(10000, 10001, 0)).toBe(-1)
  })

  it('a discount that drops the total below what was received leaves an overpayment', () => {
    // The API refuses this edit; the arithmetic still has to report it honestly.
    const priced = repriceOrder(10000, 4000, untaxed, gst12)
    expect(orderBalance(priced.totalAmount, 5000, 2000)).toBe(-1000)
  })
})
