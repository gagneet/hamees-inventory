import { requirePagePermission } from '@/lib/page-guard'

// Server-side guard: requires manage_users or manage_settings
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission(['manage_users', 'manage_settings'])
  return <>{children}</>
}
