/**
 * Isomorphic shop-settings types and helpers (safe to import from client components).
 * The server-side loader lives in lib/settings.ts.
 */

import { DEFAULT_LOCALE_CONFIG } from '@/lib/locale'
import type { TaxConfig, TaxMode } from '@/lib/tax'

export interface AppSettings {
  businessName: string
  tagline: string | null
  taxId: string | null
  region: string | null
  address: string | null
  city: string | null
  postalCode: string | null
  country: string
  phone: string | null
  email: string | null
  website: string | null

  currency: string
  locale: string
  timeZone: string
  phoneCountryCode: string
  postalCodeLabel: string

  taxMode: TaxMode
  taxName: string
  taxIdLabel: string
  taxRate: number

  invoiceFooter: string | null

  maxActiveItemsPerTailor: number
  tailorDailyTarget: number
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  businessName: process.env.NEXT_PUBLIC_DEFAULT_BUSINESS_NAME || 'My Tailor Shop',
  tagline: null,
  taxId: null,
  region: null,
  address: null,
  city: null,
  postalCode: null,
  country: 'India',
  phone: null,
  email: null,
  website: null,

  currency: DEFAULT_LOCALE_CONFIG.currency,
  locale: DEFAULT_LOCALE_CONFIG.locale,
  timeZone: DEFAULT_LOCALE_CONFIG.timeZone,
  phoneCountryCode: '91',
  postalCodeLabel: 'Pincode',

  taxMode: 'SPLIT',
  taxName: 'GST',
  taxIdLabel: 'GSTIN',
  taxRate: 12,

  invoiceFooter: null,

  maxActiveItemsPerTailor: 8,
  tailorDailyTarget: 5,
}

export function taxConfigFrom(settings: Pick<AppSettings, 'taxMode' | 'taxRate' | 'taxName' | 'region'>): TaxConfig {
  return {
    mode: settings.taxMode,
    rate: settings.taxRate,
    name: settings.taxName,
    businessRegion: settings.region,
  }
}

/**
 * Normalise a phone number to international digits (no '+') using the shop's country code.
 * A number is treated as already international only when it has a '+' or '00' prefix, or when it
 * starts with the country code and is longer than a national number (national numbers are at most
 * 10 digits in the supported regions) — so an Indian mobile such as 9123456789 still gets 91.
 */
export function toInternationalPhone(phone: string, countryCode: string): string {
  const trimmed = phone.trim()
  if (trimmed.startsWith('+')) return trimmed.replace(/\D/g, '')
  let digits = trimmed.replace(/\D/g, '')
  if (digits.startsWith('00')) return digits.slice(2)
  const cc = countryCode.replace(/\D/g, '')
  if (cc && digits.startsWith(cc) && digits.length > 10) return digits
  digits = digits.replace(/^0+/, '') // national trunk prefix
  return cc ? `${cc}${digits}` : digits
}
