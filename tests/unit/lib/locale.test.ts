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
  convertToSecondary,
  formatSecondaryCurrency,
  formatCurrencyWithSecondary,
  formatExchangeRate,
  exchangeRateNote,
  indicativeTotalNote,
  formatMoneyParts,
  hasSecondaryCurrency,
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

describe('secondary (display-only) currency', () => {
  const INR_GBP = {
    currency: 'INR',
    locale: 'en-IN',
    timeZone: 'Asia/Kolkata',
    secondaryCurrency: 'GBP',
    exchangeRate: 112.5,
    exchangeRateUpdatedAt: '2026-09-10T20:00:00Z', // 11 Sept in India
  }

  describe('normalizeLocaleConfig', () => {
    it('keeps a valid secondary currency with a positive rate (upper-cased)', () => {
      const cfg = normalizeLocaleConfig({ ...INR_GBP, secondaryCurrency: 'gbp' })
      expect(cfg).toMatchObject({ secondaryCurrency: 'GBP', exchangeRate: 112.5, exchangeRateUpdatedAt: INR_GBP.exchangeRateUpdatedAt })
    })

    it.each([
      ['equal to the main currency', { secondaryCurrency: 'INR' }],
      ['equal to the main currency in another case', { secondaryCurrency: 'inr' }],
      ['not a real ISO code', { secondaryCurrency: 'XYZ' }],
      ['null', { secondaryCurrency: null }],
      ['without a rate', { exchangeRate: null }],
      ['with a zero rate', { exchangeRate: 0 }],
      ['with a negative rate', { exchangeRate: -5 }],
      ['with a NaN rate', { exchangeRate: Number.NaN }],
      ['with an infinite rate', { exchangeRate: Number.POSITIVE_INFINITY }],
    ])('drops the secondary currency when it is %s', (_label, override) => {
      const cfg = normalizeLocaleConfig({ ...INR_GBP, ...override })
      expect(cfg).toEqual({ currency: 'INR', locale: 'en-IN', timeZone: 'Asia/Kolkata' })
      expect(hasSecondaryCurrency(cfg)).toBe(false)
    })

    it('checks against the normalised main currency', () => {
      // An invalid main currency falls back to the default (INR), which the secondary then equals
      expect(normalizeLocaleConfig({ ...INR_GBP, currency: 'NOPE', secondaryCurrency: 'INR' }).secondaryCurrency).toBeUndefined()
    })

    it('ignores an unparseable rate date but keeps the rate', () => {
      const cfg = normalizeLocaleConfig({ ...INR_GBP, exchangeRateUpdatedAt: 'yesterday-ish' })
      expect(cfg.exchangeRate).toBe(112.5)
      expect(cfg.exchangeRateUpdatedAt).toBeNull()
    })

    it('is stored with the active configuration', () => {
      setActiveLocaleConfig(INR_GBP)
      expect(getActiveLocaleConfig()).toEqual(INR_GBP)
      expect(hasSecondaryCurrency()).toBe(true)
    })
  })

  describe('convertToSecondary', () => {
    it('divides by the rate (main units per secondary unit) and rounds to the secondary minor units', () => {
      setActiveLocaleConfig(INR_GBP)
      expect(convertToSecondary(5000)).toBe(44.44) // 44.444…
      expect(convertToSecondary(112.5)).toBe(1)
      expect(convertToSecondary(0)).toBe(0)
    })

    it('rounds half away from zero, for refunds and losses too', () => {
      const cfg = normalizeLocaleConfig({ ...INR_GBP, exchangeRate: 8 })
      expect(convertToSecondary(1, cfg)).toBe(0.13) // 0.125
      expect(convertToSecondary(-1, cfg)).toBe(-0.13)
      expect(Object.is(convertToSecondary(-0.01, cfg), -0)).toBe(false) // -0.00125 → 0, not -0
    })

    it('uses zero decimals for currencies without minor units (JPY)', () => {
      const cfg = normalizeLocaleConfig({ ...INR_GBP, secondaryCurrency: 'JPY', exchangeRate: 0.56 })
      expect(convertToSecondary(5000, cfg)).toBe(8929) // 8928.57…
    })

    it('returns null without a secondary currency or a usable amount', () => {
      expect(convertToSecondary(5000)).toBeNull() // default config has none
      setActiveLocaleConfig(INR_GBP)
      expect(convertToSecondary(null)).toBeNull()
      expect(convertToSecondary(undefined)).toBeNull()
      expect(convertToSecondary(Number.NaN)).toBeNull()
    })
  })

  describe('formatting', () => {
    it('formats the secondary amount with an approximation sign', () => {
      setActiveLocaleConfig(INR_GBP)
      expect(formatSecondaryCurrency(5000)).toBe('≈ £44.44')
      expect(formatCurrencyWithSecondary(5000)).toBe('₹5,000.00 (≈ £44.44)')
    })

    it('supports compact notation on both amounts', () => {
      setActiveLocaleConfig(INR_GBP)
      expect(formatSecondaryCurrency(5_000_000, { compact: true })).toBe('≈ £44.4K')
      expect(formatCurrencyWithSecondary(5_000_000, { compact: true })).toBe('₹50L (≈ £44.4K)')
    })

    it('formats the secondary amount in the shop locale', () => {
      const cfg = normalizeLocaleConfig({ currency: 'GBP', locale: 'en-GB', timeZone: 'Europe/London', secondaryCurrency: 'USD', exchangeRate: 0.79 })
      expect(formatCurrencyWithSecondary(1000, { config: cfg })).toBe('£1,000.00 (≈ US$1,265.82)')
    })

    it('shows only the main amount without a secondary currency', () => {
      expect(formatSecondaryCurrency(5000)).toBeNull()
      expect(formatCurrencyWithSecondary(5000)).toBe('₹5,000.00')
    })

    it('describes the rate, its inverse and when it was set', () => {
      setActiveLocaleConfig(INR_GBP)
      expect(formatExchangeRate()).toBe('1 GBP = 112.50 INR')
      expect(formatExchangeRate(getActiveLocaleConfig(), { inverse: true })).toBe('1 INR = 0.008889 GBP')
      expect(exchangeRateNote()).toBe('Indicative: 1 GBP = 112.50 INR (rate set 11 Sept 2026)')
      expect(exchangeRateNote(normalizeLocaleConfig({ ...INR_GBP, exchangeRateUpdatedAt: null }))).toBe('Indicative: 1 GBP = 112.50 INR')
    })

    it('builds the invoice line, naming the currency amounts are payable in', () => {
      const cfg = normalizeLocaleConfig(INR_GBP)
      expect(indicativeTotalNote(5000, cfg)).toBe(
        'Indicative total ≈ £44.44 at 1 GBP = 112.50 INR (rate as of 11 Sept 2026); amounts payable in INR'
      )
      expect(indicativeTotalNote(5000, DEFAULT_LOCALE_CONFIG)).toBeNull()
    })
  })

  describe('formatMoneyParts (what <Money> renders)', () => {
    it('returns the main amount, the secondary amount and the rate tooltip', () => {
      setActiveLocaleConfig(INR_GBP)
      expect(formatMoneyParts(5000)).toEqual({
        primary: '₹5,000.00',
        secondary: '≈ £44.44',
        note: 'Indicative: 1 GBP = 112.50 INR (rate set 11 Sept 2026)',
      })
    })

    it('can suppress the secondary amount, and has none without a rate', () => {
      setActiveLocaleConfig(INR_GBP)
      expect(formatMoneyParts(5000, { withSecondary: false })).toEqual({ primary: '₹5,000.00', secondary: null, note: null })
      setActiveLocaleConfig(DEFAULT_LOCALE_CONFIG)
      expect(formatMoneyParts(5000)).toEqual({ primary: '₹5,000.00', secondary: null, note: null })
    })

    it('passes compact and decimals to the main amount', () => {
      setActiveLocaleConfig(INR_GBP)
      expect(formatMoneyParts(5_000_000, { compact: true })).toMatchObject({ primary: '₹50L', secondary: '≈ £44.4K' })
      expect(formatMoneyParts(1234.56, { decimals: 0 })).toMatchObject({ primary: '₹1,235', secondary: '≈ £10.97' })
    })
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
