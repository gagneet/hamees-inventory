import { requirePagePermission } from '@/lib/page-guard'

// Server-side guard: requires view_expenses
export default async function ExpensesLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission('view_expenses')
  return <>{children}</>
}
