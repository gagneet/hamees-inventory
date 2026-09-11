/**
 * @featuretrace Dashboard route-group layout
 * @description Server gate for every page under app/(dashboard): requires a session, loads the
 *   shop's BusinessSettings and provides them (currency, locale, tax, branding) to client
 *   components via SettingsProvider. Section layouts add per-permission guards.
 */

import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getAppSettings } from '@/lib/settings'
import { SettingsProvider } from '@/components/providers/settings-provider'

export default async function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/')

  const settings = await getAppSettings()
  return <SettingsProvider settings={settings}>{children}</SettingsProvider>
}
