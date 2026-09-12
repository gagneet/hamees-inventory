import { requirePagePermission } from '@/lib/page-guard'

// Server-side guard: matches GET /api/reports/financial (the parent reports layout supplies the shell)
export default async function FinancialReportLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission('view_financial_reports')
  return <>{children}</>
}
