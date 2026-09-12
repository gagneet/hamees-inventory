/**
 * @featuretrace Alerts Page
 * @page /alerts
 * @permission view_alerts
 * @description Server-rendered list of all non-dismissed alerts. Alerts are fetched
 *   where isDismissed = false (with auto-reset of expired dismissals). Rendered as a
 *   flat list ordered by createdAt desc.
 *
 * @reads Alert model — prisma.alert.findMany (isDismissed: false, alertVisibilityScope(role))
 * @renders AlertCard per alert (flat list, no category grouping) + MarkAllReadButton
 * @actions Dismiss alert (mark isDismissed) | Mark read | Navigate to related inventory or order record
 */

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { CheckCircle, Home } from 'lucide-react'
import DashboardLayout from '@/components/DashboardLayout'
import { AlertCard } from '@/components/alerts/alert-card'
import { MarkAllReadButton } from '@/components/alerts/mark-all-read-button'
import { alertVisibilityScope } from '@/lib/alert-scope'
import type { UserRole } from '@/lib/permissions'

type Alert = Awaited<ReturnType<typeof getAlerts>>[number]

async function getAlerts(role: UserRole) {
  try {
    const now = new Date()

    // Expired 24h dismissals become active again. Kept as a write (not just a read filter) so the
    // unread counts in /api/alerts agree; it is a single UPDATE that normally matches no rows.
    await prisma.alert.updateMany({
      where: {
        isDismissed: true,
        dismissedUntil: {
          lte: now,
        },
      },
      data: {
        isDismissed: false,
        dismissedUntil: null,
      },
    })

    // Non-dismissed alerts this role may see (payment reminders quote balances → financial roles only)
    const alerts = await prisma.alert.findMany({
      where: {
        AND: [{ isDismissed: false }, alertVisibilityScope(role)],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return alerts
  } catch (error) {
    console.error('Error fetching alerts:', error)
    return []
  }
}

export default async function AlertsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/')
  }

  const alerts = await getAlerts(session.user.role as UserRole)
  const unreadCount = alerts.filter((a: Alert) => !a.isRead).length

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
            <BreadcrumbPage>Alerts</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Alerts</h1>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300">
            {unreadCount} unread alert{unreadCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && <MarkAllReadButton />}
        </div>
      </div>

      {/* Main Content */}
        {alerts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">All Clear!</h3>
              <p className="text-slate-600">No alerts at the moment</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert: Alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        )}
    </DashboardLayout>
  )
}
