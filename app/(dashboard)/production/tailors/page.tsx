/**
 * @featuretrace Tailor Workload page
 * @page /production/tailors
 * @description What each tailor is doing: capacity, work by stage, overdue items and the full
 *   list of current items, with an unassigned queue. Reassign / unassign for assign_tailors.
 * @access view_production (layout guard) — OWNER, ADMIN, MASTER_TAILOR
 * @reads loadProductionOverview() (OrderItem + Order + User + OrderHistory, BusinessSettings)
 */

import { Home, Users } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import DashboardLayout from '@/components/DashboardLayout'
import { auth } from '@/lib/auth'
import { hasPermission, type UserRole } from '@/lib/permissions'
import { loadProductionOverview } from '@/app/api/production/_lib/workload'
import { TailorWorkloadBoard } from '@/components/production/tailor-workload-board'

export const dynamic = 'force-dynamic'

export default async function TailorWorkloadPage() {
  const session = await auth()
  const role = session?.user?.role as UserRole
  const canAssign = hasPermission(role, 'assign_tailors')
  const overview = await loadProductionOverview()

  return (
    <DashboardLayout>
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">
              <Home className="h-4 w-4" />
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Tailor Workload</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-6">
        <h1 className="text-lg font-semibold md:text-2xl flex items-center gap-2">
          <Users className="h-6 w-6 text-slate-600" />
          Tailor Workload
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          What each tailor is working on, how loaded they are and what still needs a tailor.
        </p>
      </div>

      <TailorWorkloadBoard overview={overview} canAssign={canAssign} />
    </DashboardLayout>
  )
}
