/**
 * Public order-tracking requests.
 *
 * The endpoint's whole job is to give the caller nothing. These tests concentrate on that: the
 * response must be identical whether the order exists, belongs to a different phone number, or
 * does not exist at all — otherwise it becomes an oracle for enumerating order numbers.
 *
 * All numbers and order numbers here are synthetic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { POST as requestTracking } from '@/app/api/public/track-request/route'
import { whatsappService } from '@/lib/whatsapp/whatsapp-service'
import { invalidateAppSettings } from '@/lib/settings'
import { resetRateLimit } from '@/lib/rate-limit'
import { verifyTrackingToken } from '@/lib/order-tracking'

type Mocked = ReturnType<typeof vi.fn>
const m = (fn: unknown) => fn as Mocked

const PHONE = '098765 43210'
const E164 = '+919876543210'
const ORDER_NUMBER = 'HA-2026-0148'

let ipCounter = 0

/** Each call gets its own IP so the per-IP limiter does not leak between tests. */
function trackRequest(body: unknown, ip?: string) {
  return new Request('http://localhost:3009/api/public/track-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-real-ip': ip ?? `10.1.0.${++ipCounter}` },
    body: JSON.stringify(body),
  })
}

/**
 * The global `after()` stub in vitest.setup.ts fires its callback immediately. Here it only
 * captures, so the tests can assert what the route had NOT yet done at the moment it answered —
 * which is the whole security property — and then run the deferred work deliberately.
 */
const deferred: Array<() => Promise<void> | void> = []

async function runAfterCallbacks() {
  const pending = deferred.splice(0)
  for (const callback of pending) await callback()
}

beforeEach(async () => {
  vi.clearAllMocks()
  deferred.length = 0
  const { after } = await import('next/server')
  m(after).mockImplementation((callback: () => Promise<void> | void) => {
    deferred.push(callback)
  })
  invalidateAppSettings()
  resetRateLimit(`track:phone:${E164}`)
  process.env.NEXTAUTH_SECRET = 'test-secret-for-tracking-links'
  m(prisma.businessSettings.findFirst).mockResolvedValue(null) // shop region defaults to IN
  m(prisma.order.findFirst).mockResolvedValue(null)
  m(whatsappService.sendTemplateMessage).mockResolvedValue('msg-1')
})

describe('POST /api/public/track-request — telling the caller nothing', () => {
  it('answers a real order and a made-up one with byte-identical responses', async () => {
    m(prisma.order.findFirst).mockResolvedValue({
      id: 'order-1',
      orderNumber: ORDER_NUMBER,
      customerId: 'cust-1',
    })
    const found = await requestTracking(trackRequest({ orderNumber: ORDER_NUMBER, phone: PHONE }))
    const foundBody = await found.text()

    resetRateLimit(`track:phone:${E164}`)
    m(prisma.order.findFirst).mockResolvedValue(null)
    const missing = await requestTracking(trackRequest({ orderNumber: 'HA-9999-0001', phone: PHONE }))
    const missingBody = await missing.text()

    expect(found.status).toBe(missing.status)
    expect(foundBody).toBe(missingBody)
  })

  it('never puts order data in the response body', async () => {
    m(prisma.order.findFirst).mockResolvedValue({
      id: 'order-1',
      orderNumber: ORDER_NUMBER,
      customerId: 'cust-1',
    })
    const response = await requestTracking(trackRequest({ orderNumber: ORDER_NUMBER, phone: PHONE }))
    const body = await response.text()

    expect(body).not.toContain('order-1')
    expect(body).not.toContain('cust-1')
    expect(body).not.toContain(ORDER_NUMBER)
    expect(body).not.toContain(E164)
  })

  it('does not look the order up before answering', async () => {
    await requestTracking(trackRequest({ orderNumber: ORDER_NUMBER, phone: PHONE }))
    // The lookup is scheduled in after(), so it has not run at the point the response is returned.
    expect(prisma.order.findFirst).not.toHaveBeenCalled()
  })
})

describe('POST /api/public/track-request — sending the link', () => {
  it('matches the order number against the phone number on the customer record', async () => {
    await requestTracking(trackRequest({ orderNumber: ORDER_NUMBER, phone: PHONE }))
    await runAfterCallbacks()

    expect(prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          orderNumber: { equals: ORDER_NUMBER, mode: 'insensitive' },
          customer: { phone: E164 },
        },
      })
    )
  })

  it('sends a valid, order-scoped link to the number on file', async () => {
    m(prisma.order.findFirst).mockResolvedValue({
      id: 'order-1',
      orderNumber: ORDER_NUMBER,
      customerId: 'cust-1',
    })
    await requestTracking(trackRequest({ orderNumber: ORDER_NUMBER, phone: PHONE }))
    await runAfterCallbacks()

    expect(whatsappService.sendTemplateMessage).toHaveBeenCalledTimes(1)
    const payload = m(whatsappService.sendTemplateMessage).mock.calls[0][0]
    expect(payload.to).toBe(E164)

    const token = String(payload.body).match(/\/track\/([A-Za-z0-9_.-]+)/)?.[1]
    expect(token).toBeTruthy()
    const verified = verifyTrackingToken(token!)
    expect(verified).toMatchObject({ ok: true, orderId: 'order-1' })
  })

  it('sends nothing when the order number does not match that phone number', async () => {
    m(prisma.order.findFirst).mockResolvedValue(null)
    await requestTracking(trackRequest({ orderNumber: ORDER_NUMBER, phone: PHONE }))
    await runAfterCallbacks()

    expect(whatsappService.sendTemplateMessage).not.toHaveBeenCalled()
  })

  it('still answers normally when WhatsApp fails', async () => {
    m(prisma.order.findFirst).mockResolvedValue({ id: 'order-1', orderNumber: ORDER_NUMBER, customerId: 'c1' })
    m(whatsappService.sendTemplateMessage).mockRejectedValue(new Error('WhatsApp is down'))

    const response = await requestTracking(trackRequest({ orderNumber: ORDER_NUMBER, phone: PHONE }))
    expect(response.status).toBe(202)
    await expect(runAfterCallbacks()).resolves.not.toThrow()
  })
})

describe('POST /api/public/track-request — abuse controls', () => {
  it('discards a submission that filled the honeypot, without looking anything up', async () => {
    const response = await requestTracking(
      trackRequest({ orderNumber: ORDER_NUMBER, phone: PHONE, company: 'Acme Bots Ltd' })
    )
    await runAfterCallbacks()

    expect(response.status).toBe(202)
    expect(prisma.order.findFirst).not.toHaveBeenCalled()
    expect(whatsappService.sendTemplateMessage).not.toHaveBeenCalled()
  })

  it('rate limits repeated requests for the same phone number', async () => {
    const ip = '10.9.9.9'
    const statuses: number[] = []
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await requestTracking(trackRequest({ orderNumber: ORDER_NUMBER, phone: PHONE }), ip)
      statuses.push(response.status)
    }
    expect(statuses.slice(0, 3)).toEqual([202, 202, 202])
    expect(statuses.at(-1)).toBe(429)
  })

  it('refuses a number that cannot be dialled', async () => {
    const response = await requestTracking(trackRequest({ orderNumber: ORDER_NUMBER, phone: '12' }))
    expect(response.status).toBe(400)
    expect(prisma.order.findFirst).not.toHaveBeenCalled()
  })

  it('rejects a missing order number', async () => {
    const response = await requestTracking(trackRequest({ phone: PHONE }))
    expect(response.status).toBe(400)
  })
})
