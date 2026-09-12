import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { prisma } from '@/lib/db'
import { getAppSettings } from '@/lib/settings'
import { normalizePhone, toRegion } from '@/lib/phone'
import { DEFAULT_PHONE_REGION } from '@/lib/app-settings'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

/**
 * @featuretrace Public order enquiry
 * @route POST /api/public/enquiries
 * @permission none — this is the only unauthenticated write in the application
 * @writes CustomerEnquiry
 *
 * A visitor on /order or the public site asks the shop to get in touch — either about something
 * they would like made (ORDER_ENQUIRY) or to come in and be measured (FITTING). This deliberately
 * creates a CustomerEnquiry and NOTHING else: no Customer, no Order, no pricing, no tax and no
 * stock reservation. An anonymous request must never be able to move inventory or create a financial
 * record — staff convert an enquiry into a real order from the dashboard, and that is where
 * pricing and stock reservation happen.
 *
 * Abuse controls:
 *   - fixed-window rate limit per IP and per phone number (lib/rate-limit.ts, in memory: this
 *     deployment is a single PM2 fork — see the note in that file if it is ever scaled out)
 *   - a hidden "company" honeypot field that a real form never fills in
 *   - the submitter's IP is stored only as a salted hash, never the address itself
 *   - every field is length-capped, and the response never reveals whether a customer exists
 */

const MAX_PER_IP = 5
const MAX_PER_PHONE = 3
const WINDOW_MS = 60 * 60 * 1000 // 1 hour

const enquirySchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(200),
  phone: z.string().trim().min(6).max(24),
  email: z.string().trim().email().max(200).optional().or(z.literal('')),
  city: z.string().trim().max(120).optional(),
  /**
   * A fitting is the same conversation with no garment decided yet, so it shares this table and
   * its abuse controls rather than duplicating both. Staff see the two apart in the inbox.
   */
  kind: z.enum(['ORDER_ENQUIRY', 'FITTING']).default('ORDER_ENQUIRY'),
  // Optional for a fitting: someone booking a measurement appointment has not chosen a garment.
  garmentType: z.string().trim().max(120).optional(),
  fabricNotes: z.string().trim().max(500).optional(),
  quantity: z.number().int().min(1).max(50).default(1),
  preferredDate: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(2000).optional(),
  /** Honeypot: hidden from people, irresistible to bots. Must be empty. */
  company: z.string().max(200).optional(),
})

/** Salted so a stored hash cannot be reversed against the small space of IPv4 addresses. */
function hashIp(ip: string): string | null {
  if (!ip || ip === 'unknown') return null
  const salt = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? 'hamees-enquiry'
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)
}

/** One shape for every rejection, so the endpoint leaks nothing about the shop's data. */
function accepted() {
  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function POST(request: Request) {
  const ip = clientIp(request.headers)

  const byIp = rateLimit(`enquiry:ip:${ip}`, MAX_PER_IP, WINDOW_MS)
  if (!byIp.ok) {
    return NextResponse.json(
      { error: 'Too many enquiries from this connection. Please call the shop instead.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(byIp.retryAfterMs / 1000)) } }
    )
  }

  let data: z.infer<typeof enquirySchema>
  try {
    data = enquirySchema.parse(await request.json())
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Please check the form', details: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Could not read the form' }, { status: 400 })
  }

  // A bot filled the hidden field: accept it silently so it has nothing to tune against.
  if (data.company && data.company.trim().length > 0) return accepted()

  // An order enquiry has to say what it is for; a fitting does not, and is labelled for the inbox.
  const garmentType = data.garmentType?.trim() || ''
  if (data.kind === 'ORDER_ENQUIRY' && !garmentType) {
    return NextResponse.json({ error: 'Please tell us what you would like made.' }, { status: 400 })
  }

  const settings = await getAppSettings()
  const region = toRegion(settings.phoneRegion) ?? DEFAULT_PHONE_REGION
  const phone = normalizePhone(data.phone, region)
  if (!phone.ok) {
    return NextResponse.json(
      { error: 'That phone number does not look right. Please include the country code.' },
      { status: 400 }
    )
  }

  const byPhone = rateLimit(`enquiry:phone:${phone.e164}`, MAX_PER_PHONE, WINDOW_MS)
  if (!byPhone.ok) {
    return NextResponse.json(
      { error: 'We already have your enquiry — someone from the shop will call you.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(byPhone.retryAfterMs / 1000)) } }
    )
  }

  // A date the visitor asked for; ignored if it is unparseable or in the past
  let preferredDate: Date | null = null
  if (data.preferredDate) {
    const parsed = new Date(data.preferredDate)
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() > Date.now() - 24 * 60 * 60 * 1000) {
      preferredDate = parsed
    }
  }

  try {
    await prisma.customerEnquiry.create({
      data: {
        name: data.name,
        phone: phone.e164,
        email: data.email || null,
        city: data.city || null,
        kind: data.kind,
        garmentType: garmentType || 'Fitting appointment',
        fabricNotes: data.fabricNotes || null,
        quantity: data.quantity,
        preferredDate,
        notes: data.notes || null,
        sourceIpHash: hashIp(ip),
        userAgent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
      },
      select: { id: true },
    })
  } catch (error) {
    console.error('Error saving enquiry:', error)
    return NextResponse.json({ error: 'Could not save your enquiry. Please call the shop.' }, { status: 500 })
  }

  return accepted()
}
