/**
 * Public order enquiries.
 *
 * The public endpoint is the only unauthenticated write in the application, so these tests
 * concentrate on what it must NEVER do: create a customer, an order or a stock movement, accept
 * an unbounded number of submissions, or store a raw IP address. All numbers are synthetic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { POST as submitEnquiry } from '@/app/api/public/enquiries/route'
import { GET as listEnquiries } from '@/app/api/enquiries/route'
import { PATCH as patchEnquiry } from '@/app/api/enquiries/[id]/route'
import { POST as convertEnquiry } from '@/app/api/enquiries/[id]/convert/route'
import { invalidateAppSettings } from '@/lib/settings'
import { resetRateLimit } from '@/lib/rate-limit'
import { auth } from '@/lib/auth'

type Mocked = ReturnType<typeof vi.fn>
const m = (fn: unknown) => fn as Mocked

const VALID = {
  name: 'Test Visitor',
  phone: '098765 43210',
  garmentType: 'Sherwani',
  quantity: 2,
}

let ipCounter = 0

/** Each call gets its own IP so the per-IP limiter does not leak between tests. */
function publicRequest(body: unknown, ip?: string) {
  return new Request('http://localhost/api/public/enquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-real-ip': ip ?? `10.0.0.${++ipCounter}` },
    body: JSON.stringify(body),
  })
}

function createdData(): Record<string, unknown> {
  return m(prisma.customerEnquiry.create).mock.calls[0][0].data
}

beforeEach(() => {
  vi.clearAllMocks()
  invalidateAppSettings()
  // The rate limiter is module-global and would otherwise leak between tests
  resetRateLimit(`enquiry:phone:+919876543210`)
  m(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } })
  m(prisma.businessSettings.findFirst).mockResolvedValue(null) // shop region defaults to IN
  m(prisma.customerEnquiry.create).mockResolvedValue({ id: 'enq-1' })
  m(prisma.customerEnquiry.findMany).mockResolvedValue([])
  m(prisma.customerEnquiry.groupBy).mockResolvedValue([])
  m(prisma.customerEnquiry.update).mockResolvedValue({ id: 'enq-1', status: 'CONTACTED', staffNotes: null })
  m(prisma.customer.findMany).mockResolvedValue([])
  m(prisma.customer.create).mockResolvedValue({ id: 'cust-new' })
})

describe('POST /api/public/enquiries — fitting requests', () => {
  it('records a fitting as the same enquiry, marked FITTING', async () => {
    const response = await submitEnquiry(
      publicRequest({ name: 'Test Visitor', phone: '098765 43210', kind: 'FITTING' })
    )
    expect(response.status).toBe(201)
    expect(createdData()).toMatchObject({ kind: 'FITTING', phone: '+919876543210' })
  })

  it('labels a fitting that named no garment, rather than storing an empty one', async () => {
    await submitEnquiry(publicRequest({ name: 'Test Visitor', phone: '098765 43210', kind: 'FITTING' }))
    expect(createdData().garmentType).toBe('Fitting appointment')
  })

  it('keeps the garment when a fitting request does name one', async () => {
    await submitEnquiry(
      publicRequest({ name: 'Test Visitor', phone: '098765 43210', kind: 'FITTING', garmentType: 'Sherwani' })
    )
    expect(createdData().garmentType).toBe('Sherwani')
  })

  it('defaults to an order enquiry when no kind is given, so old clients keep working', async () => {
    await submitEnquiry(publicRequest(VALID))
    expect(createdData().kind).toBe('ORDER_ENQUIRY')
  })

  it('still insists an order enquiry says what it is for', async () => {
    const response = await submitEnquiry(publicRequest({ name: 'Test Visitor', phone: '098765 43210' }))
    expect(response.status).toBe(400)
    expect(prisma.customerEnquiry.create).not.toHaveBeenCalled()
  })

  it('refuses a kind it does not know', async () => {
    const response = await submitEnquiry(
      publicRequest({ ...VALID, kind: 'REFUND_DEMAND' })
    )
    expect(response.status).toBe(400)
    expect(prisma.customerEnquiry.create).not.toHaveBeenCalled()
  })
})

describe('POST /api/public/enquiries — accepting an enquiry', () => {
  it('stores a national number in E.164 using the shop region', async () => {
    const response = await submitEnquiry(publicRequest(VALID))
    expect(response.status).toBe(201)
    expect(createdData().phone).toBe('+919876543210')
    expect(createdData().quantity).toBe(2)
  })

  it('creates NOTHING but the enquiry — no customer, order or stock movement', async () => {
    await submitEnquiry(publicRequest(VALID))
    expect(prisma.customerEnquiry.create).toHaveBeenCalledTimes(1)
    expect(prisma.customer.create).not.toHaveBeenCalled()
    expect(prisma.order.create).not.toHaveBeenCalled()
    expect(prisma.stockMovement.create).not.toHaveBeenCalled()
  })

  it('never stores the raw IP address, only a hash', async () => {
    await submitEnquiry(publicRequest(VALID, '203.0.113.42'))
    const data = createdData()
    expect(data.sourceIpHash).toMatch(/^[0-9a-f]{32}$/)
    expect(JSON.stringify(data)).not.toContain('203.0.113.42')
  })

  it('refuses a phone number it cannot dial', async () => {
    const response = await submitEnquiry(publicRequest({ ...VALID, phone: '12345' }))
    expect(response.status).toBe(400)
    expect(prisma.customerEnquiry.create).not.toHaveBeenCalled()
  })

  it('refuses a submission with no name or garment', async () => {
    expect((await submitEnquiry(publicRequest({ ...VALID, name: 'X' }))).status).toBe(400)
    expect((await submitEnquiry(publicRequest({ ...VALID, garmentType: '' }))).status).toBe(400)
    expect(prisma.customerEnquiry.create).not.toHaveBeenCalled()
  })

  it('ignores a preferred date in the past instead of storing it', async () => {
    await submitEnquiry(publicRequest({ ...VALID, preferredDate: '2020-01-01' }))
    expect(createdData().preferredDate).toBeNull()
  })
})

describe('POST /api/public/enquiries — abuse controls', () => {
  it('swallows a submission that filled the hidden honeypot field, without saying so', async () => {
    const response = await submitEnquiry(publicRequest({ ...VALID, company: 'Cheap SEO Ltd' }))
    expect(response.status).toBe(201) // a bot learns nothing from the response
    expect(prisma.customerEnquiry.create).not.toHaveBeenCalled()
  })

  it('rate-limits one IP after five enquiries in the window', async () => {
    const ip = '198.51.100.7'
    resetRateLimit(`enquiry:ip:${ip}`)
    for (let i = 0; i < 5; i++) {
      // A different phone each time, so only the IP limiter can trip
      const phone = `+9198765432${String(10 + i).padStart(2, '0')}`
      resetRateLimit(`enquiry:phone:${phone}`)
      const ok = await submitEnquiry(publicRequest({ ...VALID, phone }, ip))
      expect(ok.status).toBe(201)
    }
    const blocked = await submitEnquiry(publicRequest({ ...VALID, phone: '+919876543299' }, ip))
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('Retry-After')).toBeTruthy()
    expect(prisma.customerEnquiry.create).toHaveBeenCalledTimes(5)
  })

  it('rate-limits one phone number after three enquiries, whatever the IP', async () => {
    const phone = '+919876500001'
    resetRateLimit(`enquiry:phone:${phone}`)
    for (let i = 0; i < 3; i++) {
      expect((await submitEnquiry(publicRequest({ ...VALID, phone }))).status).toBe(201)
    }
    expect((await submitEnquiry(publicRequest({ ...VALID, phone }))).status).toBe(429)
    expect(prisma.customerEnquiry.create).toHaveBeenCalledTimes(3)
  })
})

describe('staff enquiry routes require the right permission', () => {
  const patch = (body: unknown) =>
    patchEnquiry(
      new Request('http://localhost/api/enquiries/enq-1', { method: 'PATCH', body: JSON.stringify(body) }),
      { params: Promise.resolve({ id: 'enq-1' }) }
    )

  it('a TAILOR cannot list or change enquiries', async () => {
    m(auth).mockResolvedValue({ user: { id: 't1', role: 'TAILOR' } })
    expect((await listEnquiries(new Request('http://localhost/api/enquiries'))).status).toBe(403)
    expect((await patch({ status: 'CLOSED' })).status).toBe(403)
    expect(prisma.customerEnquiry.update).not.toHaveBeenCalled()
  })

  it('a SALES_MANAGER can work through them', async () => {
    m(auth).mockResolvedValue({ user: { id: 's1', role: 'SALES_MANAGER' } })
    m(prisma.customerEnquiry.findUnique).mockResolvedValue({ status: 'NEW' })
    expect((await listEnquiries(new Request('http://localhost/api/enquiries'))).status).toBe(200)
    expect((await patch({ status: 'CONTACTED' })).status).toBe(200)
  })

  it('will not re-open an enquiry that already has an order', async () => {
    m(prisma.customerEnquiry.findUnique).mockResolvedValue({ status: 'CONVERTED' })
    expect((await patch({ status: 'CLOSED' })).status).toBe(400)
    expect(prisma.customerEnquiry.update).not.toHaveBeenCalled()
  })

  it('records who handled it', async () => {
    m(prisma.customerEnquiry.findUnique).mockResolvedValue({ status: 'NEW' })
    await patch({ status: 'CONTACTED' })
    expect(m(prisma.customerEnquiry.update).mock.calls[0][0].data.handledById).toBe('admin-1')
  })
})

describe('POST /api/enquiries/[id]/convert', () => {
  const convert = (body: unknown = {}) =>
    convertEnquiry(
      new Request('http://localhost/api/enquiries/enq-1/convert', { method: 'POST', body: JSON.stringify(body) }),
      { params: Promise.resolve({ id: 'enq-1' }) }
    )

  const enquiry = {
    id: 'enq-1',
    name: 'Test Visitor',
    phone: '+919876543210',
    email: null,
    city: 'Amritsar',
    status: 'NEW',
    customerId: null,
  }

  beforeEach(() => {
    m(prisma.customerEnquiry.findUnique).mockResolvedValue(enquiry)
  })

  it('creates a customer when the number is new, and does NOT create the order', async () => {
    const response = await convert()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ customerId: 'cust-new', enquiryId: 'enq-1' })
    expect(m(prisma.customer.create).mock.calls[0][0].data.phone).toBe('+919876543210')
    // Pricing and stock reservation stay in POST /api/orders
    expect(prisma.order.create).not.toHaveBeenCalled()
  })

  it('reuses the existing customer when exactly one has that number', async () => {
    m(prisma.customer.findMany).mockResolvedValue([{ id: 'cust-7', name: 'Test Visitor', phone: '+919876543210' }])
    const response = await convert()
    expect((await response.json()).customerId).toBe('cust-7')
    expect(prisma.customer.create).not.toHaveBeenCalled()
  })

  it('asks which customer when a family shares the number, instead of guessing', async () => {
    m(prisma.customer.findMany).mockResolvedValue([
      { id: 'cust-7', name: 'Test Visitor', phone: '+919876543210' },
      { id: 'cust-8', name: 'Second Visitor', phone: '+919876543210' },
    ])
    const response = await convert()
    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.code).toBe('MULTIPLE_CUSTOMERS')
    expect(body.candidates).toHaveLength(2)
    expect(prisma.customer.create).not.toHaveBeenCalled()
    expect(prisma.customerEnquiry.update).not.toHaveBeenCalled()
  })

  it('a role that cannot create orders cannot convert', async () => {
    m(auth).mockResolvedValue({ user: { id: 'i1', role: 'INVENTORY_MANAGER' } })
    expect((await convert()).status).toBe(403)
    expect(prisma.customer.create).not.toHaveBeenCalled()
  })
})
