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

import { prisma } from '@/lib/db'
import { setActiveLocaleConfig } from '@/lib/locale'
import { DEFAULT_APP_SETTINGS, type AppSettings } from '@/lib/app-settings'
import { settingsFromRow } from '@/lib/settings-row'

export { DEFAULT_APP_SETTINGS, taxConfigFrom } from '@/lib/app-settings'
export type { AppSettings } from '@/lib/app-settings'

/** Fixed id of the singleton settings row (created by the release migration). */
export const SETTINGS_ROW_ID = 'default'

export { settingsFromRow } from '@/lib/settings-row'

const CACHE_KEY = Symbol.for('hamees.appSettings')
const CACHE_TTL_MS = 30_000

type CacheEntry = { at: number; value: AppSettings }
type GlobalWithSettings = typeof globalThis & { [CACHE_KEY]?: CacheEntry }

function prime(value: AppSettings): AppSettings {
  setActiveLocaleConfig({
    currency: value.currency,
    locale: value.locale,
    timeZone: value.timeZone,
    secondaryCurrency: value.secondaryCurrency,
    exchangeRate: value.exchangeRate,
    exchangeRateUpdatedAt: value.exchangeRateUpdatedAt,
  })
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
