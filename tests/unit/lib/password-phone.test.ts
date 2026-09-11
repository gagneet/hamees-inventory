import { describe, it, expect } from 'vitest'
import bcrypt from 'bcryptjs'
import { BCRYPT_COST, dummyPasswordHash, needsRehash, passwordFingerprint } from '@/lib/password'
import { whatsappDigits } from '@/lib/phone'

describe('lib/password', () => {
  it('uses one bcrypt cost for the dummy hash and flags cheaper hashes for upgrade', async () => {
    const dummy = await dummyPasswordHash()
    expect(bcrypt.getRounds(dummy)).toBe(BCRYPT_COST)
    expect(needsRehash(bcrypt.hashSync('x', 4))).toBe(true)
    expect(needsRehash(dummy)).toBe(false)
    expect(needsRehash('not-a-hash')).toBe(false)
  })

  it('fingerprint changes when the stored hash changes', () => {
    const a = passwordFingerprint('$2a$12$aaaaaaaaaaaaaaaaaaaaaa')
    expect(a).toHaveLength(16)
    expect(passwordFingerprint('$2a$12$aaaaaaaaaaaaaaaaaaaaaa')).toBe(a)
    expect(passwordFingerprint('$2a$12$bbbbbbbbbbbbbbbbbbbbbb')).not.toBe(a)
  })
})

// WhatsApp recipients (formerly toInternationalPhone): international digits without '+'
describe('whatsappDigits', () => {
  it('prefixes national numbers even when they start with the country code digits', () => {
    expect(whatsappDigits('9123456789', 'IN')).toBe('919123456789')
    expect(whatsappDigits('09876543210', 'IN')).toBe('919876543210')
    expect(whatsappDigits('98765 43210', 'IN')).toBe('919876543210')
  })

  it('keeps numbers that are already international', () => {
    expect(whatsappDigits('+91 98765 43210', 'IN')).toBe('919876543210')
    expect(whatsappDigits('0044 7911 123456', 'IN')).toBe('447911123456')
    expect(whatsappDigits('919876543210', 'IN')).toBe('919876543210')
    expect(whatsappDigits('971501234567', 'AE')).toBe('971501234567')
    expect(whatsappDigits('+447911123456', 'IN')).toBe('447911123456')
  })

  it('handles other regions', () => {
    expect(whatsappDigits('07911 123456', 'GB')).toBe('447911123456')
    expect(whatsappDigits('501234567', 'AE')).toBe('971501234567')
    expect(whatsappDigits('(212) 555-1234', 'US')).toBe('12125551234')
  })

  it('refuses invalid numbers instead of guessing a recipient', () => {
    expect(whatsappDigits('12345', 'IN')).toBeNull()
    expect(whatsappDigits('', 'IN')).toBeNull()
    expect(whatsappDigits(null, 'IN')).toBeNull()
  })
})
