/**
 * Customer phone numbers in POST/GET /api/customers and PATCH /api/customers/[id]:
 * stored in E.164, invalid numbers refused with a readable 400, duplicates detected by the
 * normalised number. The shop phone region defaults to IN (no settings row in the mock).
 * All numbers are synthetic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { GET, POST } from '@/app/api/customers/route'
import { PATCH } from '@/app/api/customers/[id]/route'
import { invalidateAppSettings } from '@/lib/settings'

type Mocked = ReturnType<typeof vi.fn>
const m = (fn: unknown) => fn as Mocked

function request(method: string, body: unknown, url = 'http://localhost/api/customers') {
  return new Request(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

const post = (body: unknown) => POST(request('POST', body))
const patch = (id: string, body: unknown) =>
  PATCH(request('PATCH', body, `http://localhost/api/customers/${id}`), { params: Promise.resolve({ id }) })

beforeEach(() => {
  vi.clearAllMocks()
  invalidateAppSettings()
  m(prisma.businessSettings.findFirst).mockResolvedValue(null)
  m(prisma.customer.findMany).mockResolvedValue([])
  m(prisma.customer.count).mockResolvedValue(0)
  m(prisma.customer.create).mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'new-1', ...data }))
  m(prisma.customer.update).mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'c1', ...data }))
})

describe('POST /api/customers — phone', () => {
  it('stores a national number in E.164 using the shop region', async () => {
    const res = await post({ name: 'Test Customer', phone: '098765 43210' })
    expect(res.status).toBe(201)
    const data = m(prisma.customer.create).mock.calls[0][0].data
    expect(data.phone).toBe('+919876543210')
    expect(data).not.toHaveProperty('allowDuplicatePhone')
  })

  it('keeps numbers from other countries in their own country', async () => {
    const res = await post({ name: 'Visitor', phone: '+44 7911 123456' })
    expect(res.status).toBe(201)
    expect(m(prisma.customer.create).mock.calls[0][0].data.phone).toBe('+447911123456')
  })

  it('refuses an invalid number with a readable 400', async () => {
    const res = await post({ name: 'Test Customer', phone: '12345' })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('is not a valid phone number')
    expect(body.error).toContain('India')
    expect(prisma.customer.create).not.toHaveBeenCalled()
  })

  it('detects a duplicate by the normalised number, even when stored formatted', async () => {
    m(prisma.customer.findMany).mockResolvedValue([{ id: 'c9', name: 'Existing Customer', phone: '+91 98765 43210' }])
    const res = await post({ name: 'Test Customer', phone: '9876543210' })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body).toMatchObject({ code: 'DUPLICATE_PHONE', existingCustomer: { id: 'c9', name: 'Existing Customer' } })
    // Candidates are narrowed in SQL by the last digits; the match is decided on the E.164 value
    expect(m(prisma.customer.findMany).mock.calls[0][0].where).toMatchObject({ phone: { contains: '3210' } })
    expect(prisma.customer.create).not.toHaveBeenCalled()
  })

  it('does not treat a different number with the same last digits as a duplicate', async () => {
    m(prisma.customer.findMany).mockResolvedValue([{ id: 'c9', name: 'Someone Else', phone: '+447700903210' }])
    const res = await post({ name: 'Test Customer', phone: '9876543210' })
    expect(res.status).toBe(201)
  })

  it('creates a second customer with the same number when confirmed', async () => {
    m(prisma.customer.findMany).mockResolvedValue([{ id: 'c9', name: 'Existing Customer', phone: '+919876543210' }])
    const res = await post({ name: 'Family Member', phone: '9876543210', allowDuplicatePhone: true })
    expect(res.status).toBe(201)
    expect(prisma.customer.findMany).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/customers/[id] — phone', () => {
  beforeEach(() => {
    m(prisma.customer.findFirst).mockResolvedValue({ id: 'c1' })
    m(prisma.customer.findUnique).mockResolvedValue({ id: 'c1', phone: '+91 98765 43210' })
  })

  it('stores E.164 and skips the duplicate check when the number is unchanged', async () => {
    const res = await patch('c1', { name: 'Renamed', phone: '098765 43210' })
    expect(res.status).toBe(200)
    expect(m(prisma.customer.update).mock.calls[0][0].data.phone).toBe('+919876543210')
    expect(prisma.customer.findMany).not.toHaveBeenCalled()
  })

  it("refuses another customer's number unless confirmed", async () => {
    m(prisma.customer.findMany).mockResolvedValue([{ id: 'c2', name: 'Other Customer', phone: '+447911123456' }])
    const res = await patch('c1', { phone: '+44 7911 123456' })
    expect(res.status).toBe(409)
    expect(m(prisma.customer.findMany).mock.calls[0][0].where).toMatchObject({ id: { not: 'c1' } })
    expect(prisma.customer.update).not.toHaveBeenCalled()

    const confirmed = await patch('c1', { phone: '+44 7911 123456', allowDuplicatePhone: true })
    expect(confirmed.status).toBe(200)
    expect(m(prisma.customer.update).mock.calls[0][0].data.phone).toBe('+447911123456')
  })

  it('refuses an invalid number with a readable 400', async () => {
    const res = await patch('c1', { phone: '5555555555' })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('is not a valid phone number')
    expect(prisma.customer.update).not.toHaveBeenCalled()
  })
})

describe('GET /api/customers — phone search', () => {
  it('matches stored E.164 numbers from a national search', async () => {
    const res = await GET(new Request('http://localhost/api/customers?search=098765%2043210'))
    expect(res.status).toBe(200)
    const where = JSON.stringify(m(prisma.customer.findMany).mock.calls[0][0].where)
    expect(where).toContain('"+919876543210"')
    expect(where).toContain('"9876543210"')
  })

  it('does not add phone variants for a name search', async () => {
    await GET(new Request('http://localhost/api/customers?search=Rajinder'))
    const where = m(prisma.customer.findMany).mock.calls[0][0].where
    expect(JSON.stringify(where).match(/"phone"/g)).toHaveLength(1)
  })
})
