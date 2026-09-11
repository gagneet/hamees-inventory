/**
 * lib/phone.ts + lib/phone-schema.ts — international phone numbers stored in E.164.
 * All numbers below are synthetic examples (fictional/test ranges), not customer data.
 */
import { describe, it, expect } from 'vitest'
import {
  callingCode,
  countryOptions,
  formatPhone,
  normalizePhone,
  parsePhone,
  phoneHref,
  phoneSearchVariants,
  regionFlag,
  regionName,
  toRegion,
  whatsappDigits,
} from '@/lib/phone'
import { optionalPhoneSchema, phoneIssueMessage, phoneSchema } from '@/lib/phone-schema'

describe('normalizePhone', () => {
  it.each([
    // India: mobile, trunk 0, separators, landline, digits that already carry the code
    ['9876543210', 'IN', '+919876543210'],
    ['098765 43210', 'IN', '+919876543210'],
    ['+91 98765-43210', 'IN', '+919876543210'],
    ['(0) 98765.43210', 'IN', '+919876543210'],
    ['919876543210', 'IN', '+919876543210'],
    ['0172 274 0000', 'IN', '+911722740000'],
    // United Kingdom
    ['07911 123456', 'GB', '+447911123456'],
    ['020 7946 0958', 'GB', '+442079460958'],
    // United States
    ['(212) 555-1234', 'US', '+12125551234'],
    ['212-555-1234', 'US', '+12125551234'],
    // United Arab Emirates
    ['050 123 4567', 'AE', '+971501234567'],
    ['501234567', 'AE', '+971501234567'],
    // Australia: mobile and landline
    ['0412 345 678', 'AU', '+61412345678'],
    ['02 9374 4000', 'AU', '+61293744000'],
  ])('%s in %s → %s', (input, region, e164) => {
    expect(normalizePhone(input, region)).toEqual({ ok: true, e164 })
  })

  it('reads a 00 prefix as the international prefix, whatever the shop region', () => {
    expect(normalizePhone('0044 7911 123456', 'IN')).toEqual({ ok: true, e164: '+447911123456' })
    expect(normalizePhone('00447911123456', 'US')).toEqual({ ok: true, e164: '+447911123456' })
    expect(normalizePhone('00 971 50 123 4567', 'GB')).toEqual({ ok: true, e164: '+971501234567' })
  })

  it('keeps +country numbers in their own country', () => {
    expect(normalizePhone('+44 7911 123456', 'IN')).toEqual({ ok: true, e164: '+447911123456' })
    expect(normalizePhone('+61 412 345 678', 'AE')).toEqual({ ok: true, e164: '+61412345678' })
  })

  it.each([
    ['12345', 'IN'],
    ['5555555555', 'IN'], // right length, but not a number range India uses
    ['0401234567', 'AE'],
    ['+9111111111111', 'IN'],
    ['1112223333', 'US'],
    ['CALL-ME-NOW', 'US'],
    ['98765 43210 ext 12', 'IN'],
  ])('rejects %s in %s', (input, region) => {
    const result = normalizePhone(input, region)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('is not a valid phone number')
  })

  it('says which country numbers without a code were read in', () => {
    const result = normalizePhone('12345', 'GB')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('United Kingdom')
  })

  it('requires a number', () => {
    expect(normalizePhone('', 'IN')).toEqual({ ok: false, error: 'Phone number is required' })
    expect(normalizePhone('   ', 'IN')).toEqual({ ok: false, error: 'Phone number is required' })
    expect(normalizePhone(null, 'IN')).toEqual({ ok: false, error: 'Phone number is required' })
  })

  it('works without a known shop region for international numbers', () => {
    expect(normalizePhone('+447911123456', 'XX')).toEqual({ ok: true, e164: '+447911123456' })
    expect(normalizePhone('07911 123456', undefined).ok).toBe(false)
  })
})

describe('parsePhone', () => {
  it('returns the parts of a valid number', () => {
    expect(parsePhone('098765 43210', 'IN')).toEqual({
      e164: '+919876543210',
      national: '98765 43210',
      international: '+91 98765 43210',
      region: 'IN',
      nationalNumber: '9876543210',
      callingCode: '91',
      valid: true,
    })
  })

  it('marks parseable but invalid numbers', () => {
    expect(parsePhone('98765', 'IN')?.valid).toBe(false)
  })

  it('returns null for empty or non-numeric input', () => {
    expect(parsePhone('', 'IN')).toBeNull()
    expect(parsePhone('not a phone', 'IN')).toBeNull()
  })
})

describe('formatPhone', () => {
  it('shows numbers from the shop country in national format', () => {
    expect(formatPhone('+919876543210', { defaultRegion: 'IN' })).toBe('98765 43210')
    expect(formatPhone('+447911123456', { defaultRegion: 'GB' })).toBe('07911 123456')
    expect(formatPhone('+12125551234', { defaultRegion: 'US' })).toBe('(212) 555-1234')
    expect(formatPhone('+971501234567', { defaultRegion: 'AE' })).toBe('050 123 4567')
    expect(formatPhone('+61412345678', { defaultRegion: 'AU' })).toBe('0412 345 678')
  })

  it('shows other countries in international format', () => {
    expect(formatPhone('+447911123456', { defaultRegion: 'IN' })).toBe('+44 7911 123456')
    expect(formatPhone('+919876543210', { defaultRegion: 'GB' })).toBe('+91 98765 43210')
    expect(formatPhone('+971501234567')).toBe('+971 50 123 4567')
  })

  it('supports explicit styles', () => {
    expect(formatPhone('+919876543210', { defaultRegion: 'IN', style: 'international' })).toBe('+91 98765 43210')
    expect(formatPhone('+919876543210', { defaultRegion: 'GB', style: 'national' })).toBe('98765 43210')
    expect(formatPhone('+91 98765 43210', { style: 'e164' })).toBe('+919876543210')
  })

  it('formats legacy values that were stored without a country code', () => {
    expect(formatPhone('9876543210', { defaultRegion: 'IN' })).toBe('98765 43210')
  })

  it('never throws and returns unparseable values unchanged', () => {
    expect(formatPhone(null)).toBe('')
    expect(formatPhone(undefined, { defaultRegion: 'IN' })).toBe('')
    expect(formatPhone('12345', { defaultRegion: 'IN' })).toBe('12345')
    expect(formatPhone('ask at counter', { defaultRegion: 'IN' })).toBe('ask at counter')
    expect(formatPhone('+919876543210', { defaultRegion: 'not-a-region' })).toBe('+91 98765 43210')
  })
})

describe('phoneHref / whatsappDigits', () => {
  it('builds E.164 tel: links', () => {
    expect(phoneHref('+91 98765 43210')).toBe('tel:+919876543210')
    expect(phoneHref('07911 123456', 'GB')).toBe('tel:+447911123456')
    expect(phoneHref('12345', 'IN')).toBeNull()
  })

  it('gives WhatsApp digits without +', () => {
    expect(whatsappDigits('+447911123456', 'IN')).toBe('447911123456')
    expect(whatsappDigits('not a phone', 'IN')).toBeNull()
  })
})

describe('phoneSearchVariants', () => {
  it('matches stored E.164 numbers from national input', () => {
    const variants = phoneSearchVariants('098765 43210', 'IN')
    expect(variants).toContain('9876543210')
    expect(variants).toContain('+919876543210')
    expect(variants.some((v) => '+919876543210'.includes(v))).toBe(true)
  })

  it('handles partial numbers and international prefixes', () => {
    expect(phoneSearchVariants('98765', 'IN')).toContain('98765')
    expect(phoneSearchVariants('+91 98765 43210', 'IN')).toContain('9876543210')
    expect(phoneSearchVariants('0044 7911', 'IN')).toContain('447911')
  })

  it('ignores queries that are not phone numbers', () => {
    expect(phoneSearchVariants('Rajinder', 'IN')).toEqual([])
    expect(phoneSearchVariants('12', 'IN')).toEqual([])
    expect(phoneSearchVariants('', 'IN')).toEqual([])
    expect(phoneSearchVariants('Order 12345', 'IN')).toEqual([])
  })
})

describe('countries', () => {
  it('knows flags, names and calling codes', () => {
    expect(regionFlag('IN')).toBe('🇮🇳')
    expect(regionFlag('gb')).toBe('🇬🇧')
    expect(regionName('AE')).toBe('United Arab Emirates')
    expect(callingCode('ae')).toBe('971')
    expect(callingCode('XX')).toBeNull()
    expect(toRegion(' us ')).toBe('US')
    expect(toRegion('ZZ')).toBeUndefined()
  })

  it('lists every supported country sorted by name', () => {
    const options = countryOptions('en')
    expect(options.length).toBeGreaterThan(200)
    expect(options.find((o) => o.code === 'IN')).toMatchObject({ name: 'India', callingCode: '91', flag: '🇮🇳' })
    const names = options.map((o) => o.name)
    expect([...names].sort((a, b) => a.localeCompare(b, 'en'))).toEqual(names)
  })

  it('tolerates a half-typed locale', () => {
    expect(() => countryOptions('en-')).not.toThrow()
    expect(regionName('IN', 'en-')).toBe('India')
  })
})

describe('phoneSchema / optionalPhoneSchema', () => {
  it('stores E.164', () => {
    expect(phoneSchema('IN').parse(' 98765 43210 ')).toBe('+919876543210')
    expect(phoneSchema('GB').parse('07911 123456')).toBe('+447911123456')
  })

  it('reports a readable message for invalid numbers', () => {
    const result = phoneSchema('IN').safeParse('12345')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(phoneIssueMessage(result.error, '')).toBeNull() // path is empty for a bare field
      expect(result.error.issues[0].message).toContain('is not a valid phone number')
    }
  })

  it('optional numbers: undefined stays undefined, blank becomes null', () => {
    const schema = optionalPhoneSchema('GB')
    expect(schema.parse(undefined)).toBeUndefined()
    expect(schema.parse(null)).toBeNull()
    expect(schema.parse('  ')).toBeNull()
    expect(schema.parse('07911 123456')).toBe('+447911123456')
    expect(schema.safeParse('07911').success).toBe(false)
  })
})
