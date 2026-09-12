/**
 * FEATURETRACE: Signed order-tracking links
 *
 * A customer asks to track an order (POST /api/public/track-request). Rather than let anyone who
 * guesses an order number read its status, the shop sends a short-lived signed link to the phone
 * number already on the customer's record, over WhatsApp. Possession of the link is the proof.
 *
 * The token is stateless: an HMAC over `orderId.expiresAt` keyed on NEXTAUTH_SECRET. No table, no
 * cleanup job, and rotating the secret invalidates every outstanding link at once. The trade-off
 * is that a link cannot be revoked individually before it expires — acceptable for a read-only
 * status view that lives for half an hour.
 *
 * The token is NOT a session: /track/[token] shows one order's production status and never any
 * money, measurements or other customers.
 */

import { createHmac, timingSafeEqual } from 'crypto'

/** How long a tracking link stays usable. Long enough to open a WhatsApp message, no longer. */
export const TRACKING_TTL_MS = 30 * 60 * 1000

export type TrackingTokenFailure = 'malformed' | 'bad-signature' | 'expired'

export type TrackingTokenResult =
  | { ok: true; orderId: string; expiresAt: number }
  | { ok: false; reason: TrackingTokenFailure }

function signingSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET
  if (!secret) {
    // Failing loudly beats signing with a default that an attacker could also compute.
    throw new Error('NEXTAUTH_SECRET (or AUTH_SECRET) is required to sign order-tracking links')
  }
  return secret
}

function base64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url')
}

function sign(payload: string): string {
  return createHmac('sha256', signingSecret()).update(payload).digest('base64url')
}

/** `<base64url(orderId.expiresAt)>.<signature>` — URL-safe, no padding, no database row. */
export function signTrackingToken(orderId: string, ttlMs: number = TRACKING_TTL_MS): string {
  if (!orderId) throw new Error('signTrackingToken requires an order id')
  const payload = `${orderId}.${Date.now() + ttlMs}`
  const encoded = base64url(payload)
  return `${encoded}.${sign(encoded)}`
}

/**
 * Verify a token. The signature is checked before the expiry so that a tampered token always
 * reads as `bad-signature`, never as `expired` — the failure reason must not become an oracle
 * telling an attacker that their forged order id was otherwise well-formed.
 */
export function verifyTrackingToken(token: string): TrackingTokenResult {
  if (typeof token !== 'string' || token.length === 0 || token.length > 500) {
    return { ok: false, reason: 'malformed' }
  }

  const separator = token.lastIndexOf('.')
  if (separator <= 0 || separator === token.length - 1) return { ok: false, reason: 'malformed' }

  const encoded = token.slice(0, separator)
  const signature = token.slice(separator + 1)

  let expected: string
  try {
    expected = sign(encoded)
  } catch {
    return { ok: false, reason: 'bad-signature' }
  }

  const given = Buffer.from(signature)
  const want = Buffer.from(expected)
  if (given.length !== want.length || !timingSafeEqual(given, want)) {
    return { ok: false, reason: 'bad-signature' }
  }

  let payload: string
  try {
    payload = Buffer.from(encoded, 'base64url').toString('utf8')
  } catch {
    return { ok: false, reason: 'malformed' }
  }

  const split = payload.lastIndexOf('.')
  if (split <= 0) return { ok: false, reason: 'malformed' }

  const orderId = payload.slice(0, split)
  const expiresAt = Number(payload.slice(split + 1))
  if (!orderId || !Number.isFinite(expiresAt)) return { ok: false, reason: 'malformed' }

  if (Date.now() > expiresAt) return { ok: false, reason: 'expired' }

  return { ok: true, orderId, expiresAt }
}

/** Absolute URL for a tracking link. `origin` comes from the request when no site URL is set. */
export function trackingUrl(token: string, origin?: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || origin || '').replace(/\/+$/, '')
  return `${base}/track/${token}`
}
