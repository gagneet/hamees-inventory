/**
 * PUT /api/settings — permission, validation and the currency-relabel guard.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { PUT } from '@/app/api/settings/route'
import { invalidateAppSettings } from '@/lib/settings'

type Mocked = ReturnType<typeof vi.fn>
const m = (fn: unknown) => fn as Mocked

function put(body: unknown) {
  return PUT(
    new Request('http://localhost/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  )
}

function setRecordCounts(n: number) {
  for (const model of ['order', 'purchaseOrder', 'expense', 'clothInventory', 'accessoryInventory'] as const) {
    m(prisma[model].count).mockResolvedValue(model === 'order' ? n : 0)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  invalidateAppSettings()
  m(auth).mockResolvedValue({ user: { id: 'admin-1', name: 'Admin', email: 'a@x.test', role: 'ADMIN' } })
  m(prisma.businessSettings.findFirst).mockResolvedValue({ id: 'default', currencyCode: 'INR' })
  m(prisma.businessSettings.update).mockResolvedValue({})
  m(prisma.auditLog.create).mockResolvedValue({})
  setRecordCounts(0)
})

describe('PUT /api/settings', () => {
  it('requires manage_settings (OWNER is refused)', async () => {
    m(auth).mockResolvedValue({ user: { id: 'owner-1', role: 'OWNER' } })
    const res = await put({ businessName: 'X' })
    expect(res.status).toBe(403)
    expect(prisma.businessSettings.update).not.toHaveBeenCalled()
  })

  it('rejects currency codes that are not real ISO 4217 currencies', async () => {
    const res = await put({ currency: 'XYZ' })
    expect(res.status).toBe(400)
  })

  it('refuses to relabel existing amounts without confirmation', async () => {
    setRecordCounts(26)
    const res = await put({ currency: 'GBP' })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body).toMatchObject({ code: 'CURRENCY_CHANGE_NEEDS_CONFIRMATION', recordCount: 26, from: 'INR', to: 'GBP' })
    expect(prisma.businessSettings.update).not.toHaveBeenCalled()
  })

  it('relabels when the admin confirms, and audits it', async () => {
    setRecordCounts(26)
    const res = await put({ currency: 'GBP', acknowledgeNoConversion: true })
    expect(res.status).toBe(200)
    expect(prisma.businessSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currencyCode: 'GBP' }) })
    )
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'SETTINGS_UPDATED',
          details: expect.objectContaining({ currencyFrom: 'INR', currencyTo: 'GBP', amountsRelabelled: true }),
        }),
      })
    )
  })

  it('allows a currency change on a shop with no amounts yet', async () => {
    const res = await put({ currency: 'EUR' })
    expect(res.status).toBe(200)
  })

  it('audits only fields whose value changes', async () => {
    m(prisma.businessSettings.findFirst).mockResolvedValue({ id: 'default', currencyCode: 'INR', businessName: 'Hamees' })
    await put({ businessName: 'Hamees' })
    expect(prisma.auditLog.create).not.toHaveBeenCalled()

    await put({ businessName: 'Hamees Attire' })
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          details: { changes: { businessName: { from: 'Hamees', to: 'Hamees Attire' } } },
        }),
      })
    )
  })

  it('does not ask for confirmation when the currency is unchanged', async () => {
    setRecordCounts(26)
    const res = await put({ currency: 'INR', locale: 'en-GB' })
    expect(res.status).toBe(200)
  })
})
