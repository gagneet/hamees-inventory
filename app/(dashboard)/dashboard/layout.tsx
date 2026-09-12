import { requirePagePermission } from '@/lib/page-guard'

// Server-side guard: requires view_dashboard
export default async function DashboardSectionLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission('view_dashboard')
  return <>{children}</>
}
