import { requirePagePermission } from '@/lib/page-guard'

// Server-side guard: the production report requires view_production_reports
// (the parent reports layout supplies the dashboard shell)
export default async function ProductionReportLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission('view_production_reports')
  return <>{children}</>
}
