import { describe, it, expect, afterEach } from 'vitest'
import {
  formatCurrency,
  formatCompactCurrency,
  currencySymbol,
  currencyDecimals,
  formatDate,
  shopStartOfDay,
  shopEndOfDay,
  isValidCurrency,
  normalizeLocaleConfig,
  setActiveLocaleConfig,
  getActiveLocaleConfig,
  DEFAULT_LOCALE_CONFIG,
} from '@/lib/locale'

afterEach(() => setActiveLocaleConfig(DEFAULT_LOCALE_CONFIG))

describe('default configuration (INR / en-IN)', () => {
  it('formats rupees with Indian grouping and two decimals', () => {
    expect(formatCurrency(123456.5)).toBe('₹1,23,456.50')
    expect(currencySymbol()).toBe('₹')
  })

  it('treats null / NaN as zero', () => {
    expect(formatCurrency(null)).toBe('₹0.00')
    expect(formatCurrency(Number.NaN)).toBe('₹0.00')
  })
})

describe('international currencies from settings', () => {
  it('formats US dollars for en-US', () => {
    setActiveLocaleConfig({ currency: 'USD', locale: 'en-US', timeZone: 'America/New_York' })
    expect(formatCurrency(1234.5)).toBe('$1,234.50')
    expect(currencySymbol()).toBe('$')
  })

  it('formats pounds for en-GB', () => {
    setActiveLocaleConfig({ currency: 'GBP', locale: 'en-GB', timeZone: 'Europe/London' })
    expect(formatCurrency(99)).toBe('£99.00')
  })

  it('uses the currency’s own minor units (JPY has none)', () => {
    setActiveLocaleConfig({ currency: 'JPY', locale: 'ja-JP', timeZone: 'Asia/Tokyo' })
    expect(currencyDecimals()).toBe(0)
    expect(formatCurrency(1500)).toMatch(/1,500$/)
  })

  it('supports compact notation for charts', () => {
    setActiveLocaleConfig({ currency: 'USD', locale: 'en-US', timeZone: 'UTC' })
    expect(formatCompactCurrency(12000)).toBe('$12K')
  })

  it('honours an explicit decimals override', () => {
    expect(formatCurrency(1234.567, { decimals: 0 })).toBe('₹1,235')
  })
})

describe('isValidCurrency', () => {
  it('accepts real ISO 4217 codes', () => {
    for (const code of ['INR', 'USD', 'GBP', 'EUR', 'AED', 'JPY']) expect(isValidCurrency(code), code).toBe(true)
  })

  it('rejects well-formed but non-existent codes that Intl would otherwise format', () => {
    expect(isValidCurrency('XYZ')).toBe(false)
    expect(isValidCurrency('ABC')).toBe(false)
  })

  it('rejects malformed codes', () => {
    expect(isValidCurrency('inr')).toBe(false)
    expect(isValidCurrency('RUPEE')).toBe(false)
    expect(isValidCurrency('')).toBe(false)
  })
})

describe('normalizeLocaleConfig', () => {
  it('falls back to defaults for invalid values', () => {
    const cfg = normalizeLocaleConfig({ currency: 'NOPE', locale: 'xx-invalid-locale-tag-!!', timeZone: 'Mars/Base' })
    expect(cfg).toEqual(DEFAULT_LOCALE_CONFIG)
  })

  it('upper-cases currency codes', () => {
    expect(normalizeLocaleConfig({ currency: 'eur' }).currency).toBe('EUR')
  })

  it('stores the active configuration globally', () => {
    setActiveLocaleConfig({ currency: 'AED', locale: 'en-AE', timeZone: 'Asia/Dubai' })
    expect(getActiveLocaleConfig()).toEqual({ currency: 'AED', locale: 'en-AE', timeZone: 'Asia/Dubai' })
  })
})

describe('formatDate', () => {
  it('renders in the configured time zone', () => {
    // 20:00 UTC on 31 Dec is already 1 Jan in India
    setActiveLocaleConfig({ currency: 'INR', locale: 'en-GB', timeZone: 'Asia/Kolkata' })
    expect(formatDate('2025-12-31T20:00:00Z')).toBe('1 Jan 2026')
    setActiveLocaleConfig({ currency: 'USD', locale: 'en-GB', timeZone: 'America/New_York' })
    expect(formatDate('2025-12-31T20:00:00Z')).toBe('31 Dec 2025')
  })

  it('returns an empty string for missing or invalid dates', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDate('not a date')).toBe('')
  })
})

describe('shop-local day boundaries', () => {
  it('computes "today" in the shop time zone, not the server time zone', () => {
    // 02:00 UTC on 1 Jan is 07:30 IST on 1 Jan → day starts 18:30 UTC on 31 Dec
    expect(shopStartOfDay('2026-01-01T02:00:00Z', 'Asia/Kolkata').toISOString()).toBe('2025-12-31T18:30:00.000Z')
    // 20:00 UTC on 31 Dec is already 1 Jan in India
    expect(shopStartOfDay('2025-12-31T20:00:00Z', 'Asia/Kolkata').toISOString()).toBe('2025-12-31T18:30:00.000Z')
    expect(shopEndOfDay('2026-01-01T02:00:00Z', 'Asia/Kolkata').toISOString()).toBe('2026-01-01T18:29:59.999Z')
  })

  it('handles daylight-saving transitions', () => {
    // US DST starts 8 Mar 2026: midnight is EST (UTC-5), the next midnight is EDT (UTC-4)
    expect(shopStartOfDay('2026-03-08T12:00:00Z', 'America/New_York').toISOString()).toBe('2026-03-08T05:00:00.000Z')
    expect(shopEndOfDay('2026-03-08T12:00:00Z', 'America/New_York').toISOString()).toBe('2026-03-09T03:59:59.999Z')
  })

  it('defaults to the active shop time zone', () => {
    setActiveLocaleConfig({ currency: 'GBP', locale: 'en-GB', timeZone: 'Europe/London' })
    expect(shopStartOfDay('2026-07-01T12:00:00Z').toISOString()).toBe('2026-06-30T23:00:00.000Z')
  })
})
