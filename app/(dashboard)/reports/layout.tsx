import DashboardLayout from '@/components/DashboardLayout'
import { requirePagePermission } from '@/lib/page-guard'

/**
 * @featuretrace Reports Route Layout
 *
 * FEATURETRACE:
 *   feature: reports_shell_layout
 *   owner_area: reports navigation UX
 *   entry_points:
 *     - /reports
 *     - /reports/expenses
 *     - /reports/financial
 *     - /reports/customers
 *     - /reports/production
 *   upstream_callers:
 *     - app/(dashboard)/layout.tsx route group composition
 *   downstream_dependencies:
 *     - components/DashboardLayout.tsx
 *     - lib/page-guard.ts (server-side permission check)
 *   related_tests:
 *     - tests/unit/api/dashboard.test.ts (permission conventions only)
 *   change_risk:
 *     - medium: missing this wrapper drops sidebar/header across all reports
 *   maintainer_notes:
 *     - Keep report pages as content-only; shell must stay centralized here.
 *     - Individual report pages still check their own (e.g. financial) permission.
 */
export default async function ReportsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePagePermission(['view_reports', 'view_financial_reports', 'view_production_reports'])
  return <DashboardLayout>{children}</DashboardLayout>
}
