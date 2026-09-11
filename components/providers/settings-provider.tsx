'use client'

/**
 * @featuretrace Settings Provider
 * @description Makes the shop's BusinessSettings available to client components and applies
 *   the configured currency / locale / time zone to lib/locale formatters (formatCurrency,
 *   formatDate, currencySymbol …). Mounted by app/(dashboard)/layout.tsx with settings
 *   loaded on the server, so SSR and hydration format identically.
 */

import { createContext, useContext } from 'react'
import { setActiveLocaleConfig } from '@/lib/locale'
import { DEFAULT_APP_SETTINGS, type AppSettings } from '@/lib/app-settings'

const SettingsContext = createContext<AppSettings | null>(null)

export function SettingsProvider({
  settings,
  children,
}: {
  settings: AppSettings
  children: React.ReactNode
}) {
  // Applied during render (not in an effect) so children format with the shop's
  // currency on the very first render, both on the server and in the browser.
  setActiveLocaleConfig({
    currency: settings.currency,
    locale: settings.locale,
    timeZone: settings.timeZone,
    secondaryCurrency: settings.secondaryCurrency,
    exchangeRate: settings.exchangeRate,
    exchangeRateUpdatedAt: settings.exchangeRateUpdatedAt,
  })
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>
}

export function useAppSettings(): AppSettings {
  return useContext(SettingsContext) ?? DEFAULT_APP_SETTINGS
}
