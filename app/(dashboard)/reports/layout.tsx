import DashboardLayout from '@/components/DashboardLayout'

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
 *   upstream_callers:
 *     - app/(dashboard)/layout.tsx route group composition
 *   downstream_dependencies:
 *     - components/DashboardLayout.tsx
 *   related_tests:
 *     - tests/unit/api/dashboard.test.ts (permission conventions only)
 *   change_risk:
 *     - medium: missing this wrapper drops sidebar/header across all reports
 *   maintainer_notes:
 *     - Keep report pages as content-only; shell must stay centralized here.
 */
export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardLayout>{children}</DashboardLayout>
}
