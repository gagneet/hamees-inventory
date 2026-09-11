/**
 * FEATURETRACE: Business settings (shop identity, localization, tax, production)
 *
 * Server-side loader for the singleton BusinessSettings row. Results are cached per
 * process for a short TTL (one shop per deployment) and invalidated on update.
 * Loading settings also primes the isomorphic formatters in lib/locale.ts so
 * formatCurrency()/formatDate() use the shop's currency, locale and time zone.
 *
 * Consumers:
 *   - app/(dashboard)/layout.tsx → SettingsProvider (client formatting + useAppSettings())
 *   - API routes that compute tax or write currency into history/messages
 *   - app/api/settings (GET for any signed-in user, PUT for manage_settings)
 */

import type { BusinessSettings } from '@prisma/client'
import { isSupportedCountry } from 'libphonenumber-js'
import { prisma } from '@/lib/db'
import { isValidCurrency, normalizeLocaleConfig, setActiveLocaleConfig } from '@/lib/locale'
import { TAX_MODES, type TaxMode } from '@/lib/tax'
import { callingCodeForRegion, DEFAULT_APP_SETTINGS, DEFAULT_PHONE_REGION, type AppSettings } from '@/lib/app-settings'

export { DEFAULT_APP_SETTINGS, taxConfigFrom, toInternationalPhone } from '@/lib/app-settings'
export type { AppSettings } from '@/lib/app-settings'

/** Fixed id of the singleton settings row (created by the release migration). */
export const SETTINGS_ROW_ID = 'default'

export function settingsFromRow(row: BusinessSettings): AppSettings {
  const locale = normalizeLocaleConfig({ currency: row.currencyCode, locale: row.locale, timeZone: row.timeZone })
  const taxMode = (TAX_MODES as string[]).includes(row.taxMode) ? (row.taxMode as TaxMode) : 'SPLIT'
  const phoneRegion = isSupportedCountry(row.phoneRegion) ? row.phoneRegion : DEFAULT_PHONE_REGION
  // A secondary currency is only shown with a usable rate, and never the same as the main one
  const secondaryUsable =
    !!row.secondaryCurrencyCode &&
    row.secondaryCurrencyCode !== locale.currency &&
    isValidCurrency(row.secondaryCurrencyCode) &&
    typeof row.exchangeRate === 'number' &&
    Number.isFinite(row.exchangeRate) &&
    row.exchangeRate > 0
  return {
    businessName: row.businessName,
    tagline: row.tagline,
    taxId: row.gstin,
    region: row.state,
    address: row.address,
    city: row.city,
    postalCode: row.pincode,
    country: row.country,
    phone: row.phone,
    email: row.email,
    website: row.website,

    currency: locale.currency,
    locale: locale.locale,
    timeZone: locale.timeZone,
    phoneRegion,
    phoneCountryCode: callingCodeForRegion(phoneRegion),
    postalCodeLabel: row.postalCodeLabel,

    secondaryCurrency: secondaryUsable ? row.secondaryCurrencyCode : null,
    exchangeRate: secondaryUsable ? row.exchangeRate : null,
    exchangeRateUpdatedAt: secondaryUsable ? row.exchangeRateUpdatedAt?.toISOString() ?? null : null,
    showSecondaryOnInvoice: row.showSecondaryOnInvoice,

    taxMode,
    taxName: row.taxName,
    taxIdLabel: row.taxIdLabel,
    taxRate: row.garmentGstRate,

    invoiceFooter: row.invoiceFooter,

    maxActiveItemsPerTailor: row.maxActiveItemsPerTailor,
    tailorDailyTarget: row.tailorDailyTarget,

    autoReorderEnabled: row.autoReorderEnabled,
  }
}

const CACHE_KEY = Symbol.for('hamees.appSettings')
const CACHE_TTL_MS = 30_000

type CacheEntry = { at: number; value: AppSettings }
type GlobalWithSettings = typeof globalThis & { [CACHE_KEY]?: CacheEntry }

function prime(value: AppSettings): AppSettings {
  setActiveLocaleConfig({ currency: value.currency, locale: value.locale, timeZone: value.timeZone })
  return value
}

/** Load the shop settings (cached). Never throws — falls back to defaults. */
export async function getAppSettings(): Promise<AppSettings> {
  const g = globalThis as GlobalWithSettings
  const cached = g[CACHE_KEY]
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return prime(cached.value)

  let value = DEFAULT_APP_SETTINGS
  try {
    const row = await prisma.businessSettings.findFirst({ orderBy: { createdAt: 'asc' } })
    if (row) value = settingsFromRow(row)
  } catch (error) {
    console.error('Failed to load business settings; using defaults:', error)
  }

  g[CACHE_KEY] = { at: Date.now(), value }
  return prime(value)
}

export function invalidateAppSettings(): void {
  delete (globalThis as GlobalWithSettings)[CACHE_KEY]
}
