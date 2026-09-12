/**
 * FEATURETRACE: BusinessSettings row → AppSettings (pure)
 *
 * No Prisma client, no cache, no I/O — importable from scripts and tests that bring their own
 * database connection. lib/settings.ts re-exports this alongside the cached server loader.
 */

import type { BusinessSettings } from '@prisma/client'
import { isSupportedCountry } from '@/lib/phone'
import { isValidCurrency, normalizeLocaleConfig } from '@/lib/locale'
import { TAX_MODES, type TaxMode } from '@/lib/tax'
import { callingCodeForRegion, DEFAULT_PHONE_REGION, type AppSettings } from '@/lib/app-settings'

export { taxConfigFrom } from '@/lib/app-settings'

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
