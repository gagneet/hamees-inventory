/**
 * Signed order-tracking links (lib/order-tracking.ts).
 *
 * The token is the only credential guarding /track/[token], so the tests that matter are the ones
 * about forgery and expiry, not the happy path.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { signTrackingToken, verifyTrackingToken, trackingUrl, TRACKING_TTL_MS } from '@/lib/order-tracking'

const ORDER_ID = 'ckorder123456789'

describe('order tracking tokens', () => {
  const original = process.env.NEXTAUTH_SECRET
  beforeAll(() => {
    process.env.NEXTAUTH_SECRET = 'test-secret-for-tracking-links'
  })
  afterAll(() => {
    process.env.NEXTAUTH_SECRET = original
  })

  it('round-trips the order id', () => {
    const result = verifyTrackingToken(signTrackingToken(ORDER_ID))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.orderId).toBe(ORDER_ID)
  })

  it('produces a URL-safe token (no padding, no slashes)', () => {
    const token = signTrackingToken(ORDER_ID)
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    expect(encodeURIComponent(token)).toBe(token)
  })

  it('rejects a token whose payload was edited to point at another order', () => {
    const token = signTrackingToken(ORDER_ID)
    const signature = token.slice(token.lastIndexOf('.') + 1)
    const forgedPayload = Buffer.from(`someone-elses-order.${Date.now() + 60_000}`).toString('base64url')
    const result = verifyTrackingToken(`${forgedPayload}.${signature}`)
    expect(result).toEqual({ ok: false, reason: 'bad-signature' })
  })

  it('rejects a token signed with a different secret', () => {
    const token = signTrackingToken(ORDER_ID)
    process.env.NEXTAUTH_SECRET = 'a-different-secret'
    try {
      expect(verifyTrackingToken(token)).toEqual({ ok: false, reason: 'bad-signature' })
    } finally {
      process.env.NEXTAUTH_SECRET = 'test-secret-for-tracking-links'
    }
  })

  it('reports a tampered token as a bad signature, never as expired', () => {
    // The failure reason must not tell an attacker that their forged order id was well-formed.
    const expiredButForged = `${Buffer.from(`${ORDER_ID}.1`).toString('base64url')}.not-a-signature`
    expect(verifyTrackingToken(expiredButForged)).toEqual({ ok: false, reason: 'bad-signature' })
  })

  it('expires after the TTL', () => {
    vi.useFakeTimers()
    try {
      const token = signTrackingToken(ORDER_ID)
      vi.advanceTimersByTime(TRACKING_TTL_MS - 1000)
      expect(verifyTrackingToken(token).ok).toBe(true)

      vi.advanceTimersByTime(2000)
      expect(verifyTrackingToken(token)).toEqual({ ok: false, reason: 'expired' })
    } finally {
      vi.useRealTimers()
    }
  })

  it.each(['', '.', 'no-dot', 'a.', '.b', 'x'.repeat(600)])('rejects the malformed token %j', (token) => {
    expect(verifyTrackingToken(token).ok).toBe(false)
  })

  it('refuses to sign without a secret, rather than falling back to a guessable one', () => {
    const saved = process.env.NEXTAUTH_SECRET
    const savedAuth = process.env.AUTH_SECRET
    delete process.env.NEXTAUTH_SECRET
    delete process.env.AUTH_SECRET
    try {
      expect(() => signTrackingToken(ORDER_ID)).toThrow(/NEXTAUTH_SECRET/)
    } finally {
      process.env.NEXTAUTH_SECRET = saved
      if (savedAuth !== undefined) process.env.AUTH_SECRET = savedAuth
    }
  })

  it('builds the link from NEXT_PUBLIC_SITE_URL, falling back to the request origin', () => {
    const saved = process.env.NEXT_PUBLIC_SITE_URL
    try {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://hamees.gagneet.com/'
      expect(trackingUrl('abc', 'http://localhost:3009')).toBe('https://hamees.gagneet.com/track/abc')

      delete process.env.NEXT_PUBLIC_SITE_URL
      expect(trackingUrl('abc', 'http://localhost:3009')).toBe('http://localhost:3009/track/abc')
    } finally {
      if (saved === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
      else process.env.NEXT_PUBLIC_SITE_URL = saved
    }
  })
})
