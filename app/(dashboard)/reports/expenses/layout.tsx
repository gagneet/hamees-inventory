import { requirePagePermission } from '@/lib/page-guard'

// Server-side guard: matches GET /api/reports/expenses (the parent reports layout supplies the shell)
export default async function ExpenseReportLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission('view_expense_reports')
  return <>{children}</>
}
