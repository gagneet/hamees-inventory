/**
 * Isomorphic shop-settings types and helpers (safe to import from client components).
 * The server-side loader lives in lib/settings.ts.
 */

import { getCountryCallingCode, isSupportedCountry, type CountryCode } from '@/lib/phone'
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

  /** ISO 4217 code amounts are recorded in. Amounts are never converted when it changes. */
  currency: string
  locale: string
  timeZone: string
  /** ISO 3166-1 alpha-2 country assumed for phone numbers entered without a +country code */
  phoneRegion: string
  /** Calling code of phoneRegion, e.g. "91" (derived, read-only) */
  phoneCountryCode: string
  postalCodeLabel: string

  /** Optional second currency shown next to amounts (display only), e.g. "GBP" */
  secondaryCurrency: string | null
  /** Units of `currency` per 1 unit of `secondaryCurrency`, e.g. 112.5 (INR per GBP) */
  exchangeRate: number | null
  /** When the secondary currency or rate last changed (ISO timestamp) */
  exchangeRateUpdatedAt: string | null
  /** Also print the indicative secondary amount on invoices */
  showSecondaryOnInvoice: boolean

  taxMode: TaxMode
  taxName: string
  taxIdLabel: string
  taxRate: number

  invoiceFooter: string | null

  maxActiveItemsPerTailor: number
  tailorDailyTarget: number

  /** Draft purchase orders automatically when stock reaches its minimum (alerts are always raised) */
  autoReorderEnabled: boolean
}

export const DEFAULT_PHONE_REGION = 'IN'

/** Calling code for an ISO country ("IN" → "91"); unknown countries fall back to the default region. */
export function callingCodeForRegion(region: string | null | undefined): string {
  const code = (region ?? '').toUpperCase()
  return getCountryCallingCode((isSupportedCountry(code) ? code : DEFAULT_PHONE_REGION) as CountryCode)
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
  phoneRegion: DEFAULT_PHONE_REGION,
  phoneCountryCode: callingCodeForRegion(DEFAULT_PHONE_REGION),
  postalCodeLabel: 'Pincode',

  secondaryCurrency: null,
  exchangeRate: null,
  exchangeRateUpdatedAt: null,
  showSecondaryOnInvoice: false,

  taxMode: 'SPLIT',
  taxName: 'GST',
  taxIdLabel: 'GSTIN',
  taxRate: 12,

  invoiceFooter: null,

  maxActiveItemsPerTailor: 8,
  tailorDailyTarget: 5,

  autoReorderEnabled: false,
}

export function taxConfigFrom(settings: Pick<AppSettings, 'taxMode' | 'taxRate' | 'taxName' | 'region'>): TaxConfig {
  return {
    mode: settings.taxMode,
    rate: settings.taxRate,
    name: settings.taxName,
    businessRegion: settings.region,
  }
}
