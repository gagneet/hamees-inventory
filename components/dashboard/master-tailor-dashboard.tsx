'use client'

/**
 * @featuretrace Master Tailor Dashboard
 * @component MasterTailorDashboard
 * @description Production supervisor view (MASTER_TAILOR): per-tailor workload and capacity,
 *   unassigned queue with bulk assign, overdue items and today's completions vs the daily
 *   target. Capacity and target come from shop settings. No prices anywhere.
 * @reads dashboardData.production (ProductionOverview) — GET /api/dashboard/enhanced-stats
 * @links /production/tailors, /orders/production, /reports/production
 */

import Link from 'next/link'
import { AlertTriangle, ArrowRight, BarChart3, Inbox, KanbanSquare, Scissors, Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAppSettings } from '@/components/providers/settings-provider'
import type { ProductionOverview } from '@/app/api/production/_lib/types'
import { CapacityBar } from '@/components/production/capacity-bar'
import { UnassignedQueue } from '@/components/production/unassigned-queue'
import { WorkloadItemRow } from '@/components/production/workload-item-row'
import { RadialProgress } from './radial-progress'

export function MasterTailorDashboard({
  production,
  onRefresh,
}: {
  production: ProductionOverview
  onRefresh?: () => void
}) {
  const settings = useAppSettings()
  const capacity = settings.maxActiveItemsPerTailor || production.maxActiveItemsPerTailor
  const dailyTarget = settings.tailorDailyTarget || production.dailyTarget
  const { totals } = production
  const tailors = [...production.tailors].sort((a, b) => b.activeCount - a.activeCount)

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In production</CardTitle>
            <Scissors className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600 tabular-nums">{totals.activeItems}</div>
            <p className="text-xs text-muted-foreground mt-1">{totals.readyItems} ready for pickup</p>
          </CardContent>
        </Card>
        <Card className={cn('border-l-4', totals.unassignedItems > 0 ? 'border-l-amber-500' : 'border-l-slate-300')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unassigned</CardTitle>
            <Inbox className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600 tabular-nums">{totals.unassignedItems}</div>
            <p className="text-xs text-muted-foreground mt-1">Items waiting for a tailor</p>
          </CardContent>
        </Card>
        <Card className={cn('border-l-4', totals.overdueItems > 0 ? 'border-l-red-500' : 'border-l-slate-300')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600 tabular-nums">{totals.overdueItems}</div>
            <p className="text-xs text-muted-foreground mt-1">Past delivery date</p>
          </CardContent>
        </Card>
        <Card className={cn('border-l-4', totals.tailorsOverCapacity > 0 ? 'border-l-red-500' : 'border-l-emerald-500')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Over capacity</CardTitle>
            <Users className="h-4 w-4 text-slate-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">
              {totals.tailorsOverCapacity}
              <span className="text-base font-normal text-slate-500"> / {totals.tailorCount}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Tailors above {capacity} active items</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/production/tailors">
            <Users className="h-4 w-4 mr-1" /> Tailor workload
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/orders/production">
            <KanbanSquare className="h-4 w-4 mr-1" /> Production board
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/reports/production">
            <BarChart3 className="h-4 w-4 mr-1" /> Production report
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Workload per tailor */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Workload by tailor</CardTitle>
            <CardDescription>Active items against capacity ({capacity} per tailor)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {tailors.length === 0 && (
              <p className="text-sm text-slate-500">No active tailors. Add Tailor users in Admin Settings.</p>
            )}
            {tailors.map((t) => (
              <div key={t.id} className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-slate-900">
                    {t.name}
                    {t.role === 'MASTER_TAILOR' && <span className="ml-1 text-xs text-slate-500">(Master)</span>}
                  </span>
                  <span className="flex gap-3 text-xs text-slate-500">
                    {t.overdueCount > 0 && <span className="text-red-600 font-medium">{t.overdueCount} overdue</span>}
                    {t.dueTodayCount > 0 && <span className="text-amber-700">{t.dueTodayCount} due today</span>}
                    <span>{t.completedToday} done today</span>
                  </span>
                </div>
                <CapacityBar active={t.activeCount} capacity={capacity} showLabel={false} />
                <p className="text-[11px] text-slate-500 tabular-nums">
                  {t.activeCount} / {capacity} active
                  {t.overCapacity && <span className="text-red-600 font-medium"> · over capacity</span>}
                </p>
              </div>
            ))}
            {tailors.length > 0 && (
              <Link href="/production/tailors" className="inline-flex items-center text-sm text-blue-600 hover:underline">
                See every tailor&apos;s items <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Daily completions */}
        <Card>
          <CardHeader>
            <CardTitle>Completed today</CardTitle>
            <CardDescription>
              Items finished (moved to Ready) vs the shop target of {dailyTarget} per tailor
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-4">
            <RadialProgress
              current={totals.completedToday}
              target={Math.max(1, dailyTarget * Math.max(1, totals.tailorCount))}
              label="Shop total"
            />
          </CardContent>
        </Card>
      </div>

      {/* Unassigned queue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-amber-600" /> Unassigned queue
          </CardTitle>
          <CardDescription>Select items and assign them to a tailor</CardDescription>
        </CardHeader>
        <CardContent>
          <UnassignedQueue
            items={production.unassigned}
            tailors={production.tailors}
            canAssign
            onAssigned={onRefresh}
            limit={15}
          />
        </CardContent>
      </Card>

      {/* Overdue */}
      {production.overdue.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Overdue items
            </CardTitle>
            <CardDescription className="text-red-700">Past their delivery date and still in production</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {production.overdue.slice(0, 15).map((item) => (
              <WorkloadItemRow
                key={item.id}
                item={{ ...item, assignedTailorName: item.assignedTailorName }}
                action={
                  <span className="text-xs text-slate-600 min-w-[90px] text-right">
                    {item.assignedTailorName ?? <span className="text-amber-700">Unassigned</span>}
                  </span>
                }
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
