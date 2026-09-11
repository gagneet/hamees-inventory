import { requirePagePermission } from '@/lib/page-guard'

// Server-side guard: matches GET /api/reports/customers (the parent reports layout supplies the shell)
export default async function CustomerReportLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission('view_customer_reports')
  return <>{children}</>
}
