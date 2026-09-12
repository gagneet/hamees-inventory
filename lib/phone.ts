/**
 * FEATURETRACE: International phone numbers
 *
 * Phone numbers are stored in E.164 ("+919876543210"). Input may be typed in any common form —
 * national ("098765 43210", "07911 123456"), international ("+44 7911 123456", "0044 …") or
 * digits-only with the country code ("919876543210"). Numbers without a country code are read in
 * the shop's phone region (BusinessSettings.phoneRegion). Validation uses libphonenumber-js
 * "max" metadata, so a number must be valid for its country (mobile or landline), not merely
 * the right length.
 *
 * Isomorphic: used by API routes (validation/normalisation), the PhoneInput component, display
 * helpers and scripts. Zod helpers: lib/phone-schema.ts; database lookups: lib/phone-lookup.ts.
 */

import {
  AsYouType,
  getCountries as coreGetCountries,
  getCountryCallingCode as coreGetCountryCallingCode,
  isSupportedCountry as coreIsSupportedCountry,
  parsePhoneNumberFromString as coreParsePhoneNumber,
  type CountryCode,
  type MetadataJson,
} from 'libphonenumber-js/core'
import maxMetadata from 'libphonenumber-js/metadata.max.json'

export type { CountryCode }

// Loaded through /core because tsx (scripts) cannot load the CommonJS build of
// 'libphonenumber-js/max'; some CommonJS loaders also wrap JSON in { default }.
const metadata: MetadataJson =
  'countries' in maxMetadata ? maxMetadata : (maxMetadata as unknown as { default: MetadataJson }).default

export interface ParsedPhone {
  /** "+919876543210" */
  e164: string
  /** "98765 43210", "07911 123456": national format of the number's own country, without the
   *  trunk prefix where that country writes numbers without it */
  national: string
  /** "+91 98765 43210" */
  international: string
  /** ISO country of the number, when it can be determined */
  region: CountryCode | null
  /** Digits after the country code, e.g. "9876543210" */
  nationalNumber: string
  callingCode: string
  valid: boolean
}

export type PhoneResult = { ok: true; e164: string } | { ok: false; error: string }

export function isSupportedCountry(code: string): code is CountryCode {
  return coreIsSupportedCountry(code as CountryCode, metadata)
}

export function getCountryCallingCode(code: CountryCode): string {
  return coreGetCountryCallingCode(code, metadata)
}

/** ISO alpha-2 code when supported by libphonenumber, otherwise undefined. */
export function toRegion(region: string | null | undefined): CountryCode | undefined {
  const code = (region ?? '').trim().toUpperCase()
  return isSupportedCountry(code) ? code : undefined
}

const displayNamesByLocale = new Map<string, Intl.DisplayNames | null>()

function displayNames(locale: string): Intl.DisplayNames | null {
  if (!displayNamesByLocale.has(locale)) {
    let names: Intl.DisplayNames | null = null
    for (const locales of [[locale, 'en'], ['en']]) {
      try {
        names = new Intl.DisplayNames(locales, { type: 'region' })
        break
      } catch {
        // unsupported or half-typed locale: fall back to English names
      }
    }
    displayNamesByLocale.set(locale, names)
  }
  return displayNamesByLocale.get(locale) ?? null
}

/** Display name of a country, e.g. "India" (falls back to the code). */
export function regionName(region: string | null | undefined, locale = 'en'): string {
  const code = (region ?? '').trim().toUpperCase()
  if (!code) return ''
  try {
    return displayNames(locale)?.of(code) ?? code
  } catch {
    return code
  }
}

/** Flag emoji for an ISO country, e.g. "IN" → 🇮🇳 */
export function regionFlag(region: string): string {
  const code = region.toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return ''
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

export function callingCode(region: string | null | undefined): string | null {
  const code = toRegion(region)
  return code ? getCountryCallingCode(code) : null
}

export interface CountryOption {
  code: CountryCode
  name: string
  callingCode: string
  flag: string
}

/** Every supported country, sorted by display name in the given locale. */
export function countryOptions(locale = 'en'): CountryOption[] {
  let collator: Intl.Collator
  try {
    collator = new Intl.Collator(locale)
  } catch {
    collator = new Intl.Collator('en')
  }
  return coreGetCountries(metadata)
    .map((code) => ({ code, name: regionName(code, locale), callingCode: getCountryCallingCode(code), flag: regionFlag(code) }))
    .sort((a, b) => collator.compare(a.name, b.name))
}

const SEPARATORS = /[\s().\-/]/g

/** "00 44 …" → "+44…": libphonenumber only understands the default region's own exit code. */
function prepare(input: string): string {
  const compact = input.trim().replace(SEPARATORS, '')
  if (/^00[1-9]/.test(compact)) return `+${compact.slice(2)}`
  return input.trim()
}

/** Parse a phone number; numbers without a country code are read in `defaultRegion`. */
export function parsePhone(input: string | null | undefined, defaultRegion?: string | null): ParsedPhone | null {
  if (!input || !input.trim()) return null
  const text = prepare(input)
  if (/[a-z]/i.test(text)) return null // letters (vanity numbers, "ext.") are not accepted

  const region = toRegion(defaultRegion)
  let phone = coreParsePhoneNumber(text, { defaultCountry: region }, metadata)

  // Digits-only numbers that already carry a country code ("447911123456" typed in an Indian shop)
  if ((!phone || !phone.isValid()) && !text.startsWith('+')) {
    const digits = text.replace(/\D/g, '')
    if (digits.length > 10) {
      const international = coreParsePhoneNumber(`+${digits}`, metadata)
      if (international?.isValid()) phone = international
    }
  }
  if (!phone) return null

  return {
    e164: phone.number,
    national: phone.format('NATIONAL', { nationalPrefix: false }),
    international: phone.formatInternational(),
    region: phone.country ?? null,
    nationalNumber: phone.nationalNumber,
    callingCode: phone.countryCallingCode,
    valid: phone.isValid(),
  }
}

/** Validate and convert to E.164, with a message suitable for the user when invalid. */
export function normalizePhone(input: string | null | undefined, defaultRegion?: string | null): PhoneResult {
  if (!input || !input.trim()) return { ok: false, error: 'Phone number is required' }
  const parsed = parsePhone(input, defaultRegion)
  if (parsed?.valid) return { ok: true, e164: parsed.e164 }

  const where = toRegion(defaultRegion)
  const hint = where
    ? ` Numbers without a country code are read as ${regionName(where)} numbers; add + and the country code for other countries.`
    : ' Include + and the country code.'
  return { ok: false, error: `"${input.trim()}" is not a valid phone number.${hint}` }
}

export interface FormatPhoneOptions {
  /** The shop's phone region: numbers with its calling code are shown in national format */
  defaultRegion?: string | null
  /**
   * auto (default): national for numbers sharing the shop's calling code, international otherwise.
   * Calling codes rather than countries are compared because some countries share a numbering
   * plan: a UK shop writes a +44 Guernsey mobile as 07911 …, a US shop a +1 Canadian number as (416) ….
   */
  style?: 'auto' | 'national' | 'international' | 'e164'
}

/** Human-readable phone number. Never throws; unparseable values are returned unchanged. */
export function formatPhone(stored: string | null | undefined, options: FormatPhoneOptions = {}): string {
  if (!stored) return ''
  try {
    const parsed = parsePhone(stored, options.defaultRegion)
    if (!parsed || !parsed.valid) return stored
    switch (options.style ?? 'auto') {
      case 'e164':
        return parsed.e164
      case 'international':
        return parsed.international
      case 'national':
        return parsed.national
      default:
        return parsed.callingCode === callingCode(options.defaultRegion) ? parsed.national : parsed.international
    }
  } catch {
    return stored
  }
}

/** tel: link in E.164, or null when the stored value cannot be parsed. */
export function phoneHref(stored: string | null | undefined, defaultRegion?: string | null): string | null {
  const parsed = parsePhone(stored, defaultRegion)
  return parsed?.valid ? `tel:${parsed.e164}` : null
}

/** International digits without '+', as the WhatsApp Business API expects; null when invalid. */
export function whatsappDigits(stored: string | null | undefined, defaultRegion?: string | null): string | null {
  const parsed = parsePhone(stored, defaultRegion)
  return parsed?.valid ? parsed.e164.slice(1) : null
}

/**
 * Substrings to match against stored numbers when searching by phone, so "98765 43210",
 * "098765…", "+91 98765 43210" and "919876…" all find "+919876543210". Returns [] for queries
 * that are not phone-like (fewer than 3 digits, or containing words).
 */
export function phoneSearchVariants(query: string | null | undefined, defaultRegion?: string | null): string[] {
  const text = (query ?? '').trim()
  const digits = text.replace(/\D/g, '')
  if (digits.length < 3 || /[a-z]{2,}/i.test(text)) return []

  const variants = new Set<string>([digits, digits.replace(/^0+/, '')])
  if (digits.startsWith('00')) variants.add(digits.slice(2))

  const parsed = parsePhone(text, defaultRegion)
  if (parsed?.valid) {
    variants.add(parsed.e164)
    variants.add(parsed.nationalNumber)
  }
  return [...variants].filter((v) => v.replace(/\D/g, '').length >= 3)
}

/** Format a number while it is typed, e.g. "9876543210" → "98765 43210" for India. */
export function formatAsYouType(input: string, region: string): string {
  const code = toRegion(region)
  if (!code) return input
  return new AsYouType(code, metadata).input(input)
}
