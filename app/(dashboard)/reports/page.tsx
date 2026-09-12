/**
 * @featuretrace Reports Landing Page
 * @route GET /reports
 * @permission any of view_reports / view_financial_reports / view_production_reports (matches reports/layout.tsx)
 * @renders Card links to the Financial, Expenses, Customer and Production reports the role may open
 * @calls lib/auth.ts:auth() — server-side session + permission check
 */

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { hasAnyPermission, hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/lib/permissions'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Activity, Home, TrendingUp, BarChart2, Users } from 'lucide-react'
import { getAppSettings } from '@/lib/settings'

export default async function ReportsPage() {
  const settings = await getAppSettings()
  const session = await auth()
  if (!session?.user) redirect('/login')

  const userRole = session.user.role as UserRole
  if (!hasAnyPermission(userRole, ['view_reports', 'view_financial_reports', 'view_production_reports'])) {
    redirect('/dashboard')
  }

  // Build the list of report cards this role can access
  const reports = [
    {
      href: '/reports/financial',
      icon: TrendingUp,
      title: 'Financial Report',
      description: 'Profit & loss, revenue trends, monthly cash flow, and profit margins.',
      permission: 'view_financial_reports' as const,
      colour: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      href: '/reports/expenses',
      icon: BarChart2,
      title: 'Expenses Report',
      description: 'Expense breakdown by category, vendor, and month with GST analysis.',
      permission: 'view_expense_reports' as const,
      colour: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      href: '/reports/customers',
      icon: Users,
      title: 'Customer Report',
      description: 'Top customers by revenue, retention rate, and city distribution.',
      permission: 'view_customer_reports' as const,
      colour: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      href: '/reports/production',
      icon: Activity,
      title: 'Production Report',
      description: 'Completions per tailor, daily throughput, time per stage, turnaround and on-time rate.',
      permission: 'view_production_reports' as const,
      colour: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ].filter(r => hasPermission(userRole, r.permission))

  return (
    <>
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">
              <Home className="h-4 w-4" />
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Reports</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Reports</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Business analytics and financial summaries for {settings.businessName}
        </p>
      </div>

      {reports.length === 0 && (
        <Card className="border border-slate-200">
          <CardContent className="py-10 text-center text-sm text-slate-600">
            No reports are available for your role.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <Link key={report.href} href={report.href}>
            <Card className="h-full hover:shadow-md transition-shadow cursor-pointer border border-slate-200">
              <CardHeader className="pb-3">
                <div className={`w-10 h-10 rounded-lg ${report.bg} flex items-center justify-center mb-3`}>
                  <report.icon className={`h-5 w-5 ${report.colour}`} />
                </div>
                <CardTitle className="text-base">{report.title}</CardTitle>
                <CardDescription className="text-sm">{report.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className={`text-sm font-medium ${report.colour}`}>
                  View report →
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  )
}
