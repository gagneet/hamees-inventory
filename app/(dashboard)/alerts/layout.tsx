import { requirePagePermission } from '@/lib/page-guard'

// Server-side guard: requires view_alerts
export default async function AlertsLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission('view_alerts')
  return <>{children}</>
}
