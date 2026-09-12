import { describe, it, expect } from 'vitest'
import bcrypt from 'bcryptjs'
import { BCRYPT_COST, dummyPasswordHash, needsRehash, passwordFingerprint } from '@/lib/password'
import { toInternationalPhone } from '@/lib/app-settings'

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

describe('toInternationalPhone', () => {
  it('prefixes national numbers even when they start with the country code digits', () => {
    expect(toInternationalPhone('9123456789', '91')).toBe('919123456789')
    expect(toInternationalPhone('09876543210', '91')).toBe('919876543210')
    expect(toInternationalPhone('98765 43210', '91')).toBe('919876543210')
  })

  it('keeps numbers that are already international', () => {
    expect(toInternationalPhone('+91 98765 43210', '91')).toBe('919876543210')
    expect(toInternationalPhone('0044 7911 123456', '91')).toBe('447911123456')
    expect(toInternationalPhone('919876543210', '91')).toBe('919876543210')
    expect(toInternationalPhone('971501234567', '971')).toBe('971501234567')
  })

  it('handles other regions', () => {
    expect(toInternationalPhone('07911 123456', '44')).toBe('447911123456')
    expect(toInternationalPhone('501234567', '971')).toBe('971501234567')
    expect(toInternationalPhone('(212) 555-1234', '1')).toBe('12125551234')
  })
})
