import { NextResponse, after } from 'next/server'
import { prisma } from '@/lib/db'
import { getAppSettings } from '@/lib/settings'
import { normalizePhone, toRegion } from '@/lib/phone'
import { DEFAULT_PHONE_REGION } from '@/lib/app-settings'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { signTrackingToken, trackingUrl } from '@/lib/order-tracking'
import { whatsappService } from '@/lib/whatsapp/whatsapp-service'
import { z } from 'zod'

/**
 * @featuretrace Public order tracking request
 * @route POST /api/public/track-request
 * @permission none — public, but it never answers the caller with order data
 * @writes nothing directly (the WhatsApp service logs the message it sends)
 *
 * A customer asks for a link to their order's progress. The order number alone is guessable and
 * the phone number is not a secret, so neither is treated as proof: this endpoint sends a
 * short-lived signed link (lib/order-tracking.ts) to the number **already on the customer's
 * record**, over WhatsApp. Whoever holds that phone gets the link; the caller here is told
 * nothing.
 *
 * That is why every path returns the same 202 and the same sentence. A different status, message
 * or response time for "no such order" would turn this into an oracle for enumerating order
 * numbers and phone numbers. The lookup and the send therefore happen in `after()`, once the
 * response has already been decided.
 *
 * Abuse controls: fixed-window rate limit per IP and per phone number, a hidden honeypot field,
 * and a link that expires in 30 minutes.
 */

const MAX_PER_IP = 5
const MAX_PER_PHONE = 3
const WINDOW_MS = 60 * 60 * 1000 // 1 hour

const trackSchema = z.object({
  orderNumber: z.string().trim().min(3, 'Please enter your order number').max(40),
  phone: z.string().trim().min(6).max(24),
  /** Honeypot: hidden from people, irresistible to bots. Must be empty. */
  company: z.string().max(200).optional(),
})

/**
 * One answer for every outcome — found, not found, wrong phone, WhatsApp down. The customer is
 * told to check their phone; nobody learns whether the order exists.
 */
function acknowledged() {
  return NextResponse.json(
    {
      ok: true,
      message:
        'If that order number matches the phone number we have on file, we have sent a tracking link to it on WhatsApp. The link is valid for 30 minutes.',
    },
    { status: 202 }
  )
}

export async function POST(request: Request) {
  const ip = clientIp(request.headers)

  const byIp = rateLimit(`track:ip:${ip}`, MAX_PER_IP, WINDOW_MS)
  if (!byIp.ok) {
    return NextResponse.json(
      { error: 'Too many requests from this connection. Please call the shop instead.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(byIp.retryAfterMs / 1000)) } }
    )
  }

  let data: z.infer<typeof trackSchema>
  try {
    data = trackSchema.parse(await request.json())
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Please check the form', details: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Could not read the form' }, { status: 400 })
  }

  // A bot filled the hidden field: acknowledge silently so it has nothing to tune against.
  if (data.company && data.company.trim().length > 0) return acknowledged()

  const settings = await getAppSettings()
  const region = toRegion(settings.phoneRegion) ?? DEFAULT_PHONE_REGION
  const phone = normalizePhone(data.phone, region)
  if (!phone.ok) {
    // A number that cannot be dialled is a form error, not an existence signal.
    return NextResponse.json(
      { error: 'That phone number does not look right. Please include the country code.' },
      { status: 400 }
    )
  }

  const byPhone = rateLimit(`track:phone:${phone.e164}`, MAX_PER_PHONE, WINDOW_MS)
  if (!byPhone.ok) {
    return NextResponse.json(
      { error: 'We have already sent a link to that number. Please check WhatsApp.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(byPhone.retryAfterMs / 1000)) } }
    )
  }

  const orderNumber = data.orderNumber
  const e164 = phone.e164
  const origin = new URL(request.url).origin

  // Decided already: the answer below does not depend on anything this does.
  after(async () => {
    try {
      const order = await prisma.order.findFirst({
        where: {
          orderNumber: { equals: orderNumber, mode: 'insensitive' },
          customer: { phone: e164 },
        },
        select: { id: true, orderNumber: true, customerId: true },
      })
      if (!order) return

      const token = signTrackingToken(order.id)
      const link = trackingUrl(token, origin)

      await whatsappService.sendTemplateMessage({
        to: e164,
        type: 'CUSTOM',
        customerId: order.customerId,
        orderId: order.id,
        body:
          `${settings.businessName}\n\n` +
          `Here is the progress of order ${order.orderNumber}:\n${link}\n\n` +
          `The link works for the next 30 minutes. If you did not ask for it, please ignore this message.`,
      })
    } catch (error) {
      // Never surfaced to the caller — it would leak whether the order exists.
      console.error('Error sending tracking link:', error)
    }
  })

  return acknowledged()
}
