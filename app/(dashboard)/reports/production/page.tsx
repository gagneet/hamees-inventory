/**
 * @featuretrace Production Report page
 * @route /reports/production
 * @permission view_production_reports (layout guard)
 * @calls GET /api/reports/production?from=&to=
 * @layout DashboardLayout via app/(dashboard)/reports/layout.tsx
 */

import { Home } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { ProductionReport } from '@/components/production/production-report'

export default function ProductionReportPage() {
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
            <BreadcrumbLink href="/reports">Reports</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Production</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-6">
        <h1 className="text-lg font-semibold md:text-2xl">Production Report</h1>
        <p className="text-sm text-slate-500 mt-1">
          Throughput, turnaround and on-time delivery per tailor
        </p>
      </div>

      <ProductionReport />
    </>
  )
}
