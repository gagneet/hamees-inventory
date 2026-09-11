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

  it('suggests the secondary currency when refusing a relabel', async () => {
    setRecordCounts(26)
    const body = await (await put({ currency: 'GBP' })).json()
    expect(body.error).toContain('set GBP as the secondary currency with an exchange rate')
  })
})

describe('PUT /api/settings — secondary currency', () => {
  const RATE_SET_AT = new Date('2026-09-01T10:00:00Z')

  /** A shop already showing GBP next to INR at 112.5 */
  function withSecondary() {
    m(prisma.businessSettings.findFirst).mockResolvedValue({
      id: 'default',
      currencyCode: 'INR',
      secondaryCurrencyCode: 'GBP',
      exchangeRate: 112.5,
      exchangeRateUpdatedAt: RATE_SET_AT,
      showSecondaryOnInvoice: true,
    })
  }

  const updateData = () => m(prisma.businessSettings.update).mock.calls[0][0].data

  it('rejects a secondary currency equal to the main currency', async () => {
    const res = await put({ secondaryCurrency: 'INR', exchangeRate: 1 })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/must differ from the main currency/)
    expect(prisma.businessSettings.update).not.toHaveBeenCalled()
  })

  it('rejects a secondary currency that would equal a new main currency', async () => {
    withSecondary()
    const res = await put({ currency: 'GBP', acknowledgeNoConversion: true })
    expect(res.status).toBe(400)
    expect(prisma.businessSettings.update).not.toHaveBeenCalled()
  })

  it('rejects a secondary currency without an exchange rate', async () => {
    const res = await put({ secondaryCurrency: 'GBP' })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Enter how many INR one GBP is worth')

    const resNull = await put({ secondaryCurrency: 'GBP', exchangeRate: null })
    expect(resNull.status).toBe(400)
    expect(prisma.businessSettings.update).not.toHaveBeenCalled()
  })

  it('saves a secondary currency with its rate and stamps the rate date', async () => {
    const res = await put({ secondaryCurrency: 'gbp', exchangeRate: 112.5 })
    expect(res.status).toBe(200)
    expect(updateData()).toMatchObject({ secondaryCurrencyCode: 'GBP', exchangeRate: 112.5, exchangeRateUpdatedAt: expect.any(Date) })
  })

  it('clearing the secondary currency clears the rate and its date', async () => {
    withSecondary()
    const res = await put({ secondaryCurrency: null })
    expect(res.status).toBe(200)
    expect(updateData()).toMatchObject({ secondaryCurrencyCode: null, exchangeRate: null, exchangeRateUpdatedAt: null })
  })

  it('clears the rate even if a stale rate is sent with the cleared currency', async () => {
    withSecondary()
    await put({ secondaryCurrency: null, exchangeRate: 110 })
    expect(updateData()).toMatchObject({ secondaryCurrencyCode: null, exchangeRate: null, exchangeRateUpdatedAt: null })
  })

  it('a rate change sets exchangeRateUpdatedAt', async () => {
    withSecondary()
    const res = await put({ exchangeRate: 110 })
    expect(res.status).toBe(200)
    const data = updateData()
    expect(data.exchangeRate).toBe(110)
    expect(data.exchangeRateUpdatedAt).toBeInstanceOf(Date)
    expect(data.exchangeRateUpdatedAt.getTime()).toBeGreaterThan(RATE_SET_AT.getTime())
  })

  it('saving the form with an unchanged rate keeps the original rate date', async () => {
    withSecondary()
    const res = await put({ secondaryCurrency: 'GBP', exchangeRate: 112.5, businessName: 'Hamees' })
    expect(res.status).toBe(200)
    expect(updateData()).not.toHaveProperty('exchangeRateUpdatedAt')
  })
})
