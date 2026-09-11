'use client'

/**
 * @featuretrace Admin Settings
 * @description Tabs: Users (manage_users) · Business · Currency & Locale · Tax · Production (manage_settings).
 *   The admin/layout.tsx server guard already requires manage_users or manage_settings.
 */

import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UsersManager } from '@/components/admin/users-manager'
import { BusinessSettingsForm, SettingsFormProvider, type SettingsSection } from '@/components/admin/business-settings-form'
import { hasPermission, type UserRole } from '@/lib/permissions'

const SETTINGS_TABS: { value: SettingsSection; label: string }[] = [
  { value: 'business', label: 'Business' },
  { value: 'localization', label: 'Currency & Locale' },
  { value: 'tax', label: 'Tax & Invoices' },
  { value: 'production', label: 'Production' },
]

export default function AdminSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const userRole = session?.user?.role as UserRole | undefined

  if (status === 'loading' || !userRole) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-slate-500">Loading…</p>
        </div>
      </DashboardLayout>
    )
  }

  const canManageUsers = hasPermission(userRole, 'manage_users')
  const canManageSettings = hasPermission(userRole, 'manage_settings')
  const available = [
    ...(canManageUsers ? ['users'] : []),
    ...(canManageSettings ? SETTINGS_TABS.map((t) => t.value) : []),
  ]
  const requested = searchParams.get('tab')
  const tab = requested && available.includes(requested) ? requested : available[0]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Settings</h1>
          <p className="text-muted-foreground mt-2">
            Users and roles, business profile, currency, tax and production settings
          </p>
        </div>

        {/* One form state for all settings tabs (inactive tabs unmount) */}
        <SettingsFormProvider>
        <Tabs value={tab} onValueChange={(value) => router.replace(`/admin/settings?tab=${value}`, { scroll: false })}>
          <div className="overflow-x-auto">
            <TabsList>
              {canManageUsers && <TabsTrigger value="users">Users</TabsTrigger>}
              {canManageSettings &&
                SETTINGS_TABS.map((t) => (
                  <TabsTrigger key={t.value} value={t.value}>
                    {t.label}
                  </TabsTrigger>
                ))}
            </TabsList>
          </div>

          {canManageUsers && (
            <TabsContent value="users" className="mt-4">
              <UsersManager />
            </TabsContent>
          )}
          {canManageSettings &&
            SETTINGS_TABS.map((t) => (
              <TabsContent key={t.value} value={t.value} className="mt-4">
                <BusinessSettingsForm section={t.value} />
              </TabsContent>
            ))}
        </Tabs>
        </SettingsFormProvider>
      </div>
    </DashboardLayout>
  )
}
