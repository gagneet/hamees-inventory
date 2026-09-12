'use client'

/**
 * @featuretrace Tailor Workload board (/production/tailors)
 * What every tailor is doing: capacity, work by stage, overdue / due-today counts and the list
 * of current items, with inline reassign / unassign for roles with assign_tailors.
 * Receives a ProductionOverview from the server page. No financial data.
 */

import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock, Inbox, Scissors, Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  ACTIVE_PRODUCTION_STATUSES,
  type AssignableTailor,
  type ProductionOverview,
  type TailorWorkload,
} from '@/app/api/production/_lib/types'
import { CapacityBar } from './capacity-bar'
import { ItemAssignSelect } from './item-assign-select'
import { UnassignedQueue } from './unassigned-queue'
import { STATUS_LABELS, WorkloadItemRow } from './workload-item-row'

type SortKey = 'load' | 'name' | 'overdue'

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: number | string; icon: React.ElementType; tone: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className={cn('text-2xl font-bold tabular-nums', tone)}>{value}</p>
        </div>
        <Icon className={cn('h-5 w-5', tone)} />
      </CardContent>
    </Card>
  )
}

function TailorCard({
  tailor,
  assignable,
  canAssign,
  onAssigned,
}: {
  tailor: TailorWorkload
  assignable: AssignableTailor[]
  canAssign: boolean
  onAssigned?: () => void
}) {
  const [open, setOpen] = useState(tailor.overdueCount > 0 || tailor.overCapacity)

  return (
    <Card className={cn(tailor.overCapacity && 'border-red-300')}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {tailor.name}
              {tailor.role === 'MASTER_TAILOR' && <Badge variant="secondary" className="text-[10px]">Master Tailor</Badge>}
            </CardTitle>
            <CardDescription className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              <span>{tailor.activeCount} active</span>
              {tailor.readyCount > 0 && <span className="text-green-700">{tailor.readyCount} ready</span>}
              {tailor.dueTodayCount > 0 && <span className="text-amber-700">{tailor.dueTodayCount} due today</span>}
              {tailor.overdueCount > 0 && <span className="text-red-700 font-medium">{tailor.overdueCount} overdue</span>}
              <span>{tailor.completedToday} completed today</span>
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span className="ml-1 text-xs">{tailor.items.length} items</span>
          </Button>
        </div>
        <CapacityBar active={tailor.activeCount} capacity={tailor.capacity} className="mt-3" />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ACTIVE_PRODUCTION_STATUSES.map((s) =>
            tailor.byStatus[s] > 0 ? (
              <span key={s} className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                {STATUS_LABELS[s]}: <span className="font-semibold">{tailor.byStatus[s]}</span>
              </span>
            ) : null
          )}
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {tailor.items.length === 0 ? (
            <p className="text-sm text-slate-500 py-2">No work assigned.</p>
          ) : (
            tailor.items.map((item) => (
              <WorkloadItemRow
                key={item.id}
                item={item}
                action={
                  canAssign ? (
                    <ItemAssignSelect
                      itemId={item.id}
                      currentTailorId={item.assignedTailorId}
                      tailors={assignable}
                      onAssigned={onAssigned}
                      placeholder="Reassign…"
                    />
                  ) : undefined
                }
              />
            ))
          )}
        </CardContent>
      )}
    </Card>
  )
}

export function TailorWorkloadBoard({
  overview,
  canAssign,
  onAssigned,
}: {
  overview: ProductionOverview
  canAssign: boolean
  onAssigned?: () => void
}) {
  const [sort, setSort] = useState<SortKey>('load')
  const assignable: AssignableTailor[] = useMemo(
    () => overview.tailors.map((t) => ({ id: t.id, name: t.name, role: t.role })),
    [overview.tailors]
  )
  const tailors = useMemo(() => {
    const list = [...overview.tailors]
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'overdue') list.sort((a, b) => b.overdueCount - a.overdueCount || b.activeCount - a.activeCount)
    else list.sort((a, b) => b.utilisation - a.utilisation)
    return list
  }, [overview.tailors, sort])

  const { totals } = overview

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Kpi label="Active items" value={totals.activeItems} icon={Scissors} tone="text-blue-600" />
        <Kpi label="Unassigned" value={totals.unassignedItems} icon={Inbox} tone={totals.unassignedItems > 0 ? 'text-amber-600' : 'text-slate-600'} />
        <Kpi label="Overdue" value={totals.overdueItems} icon={AlertTriangle} tone={totals.overdueItems > 0 ? 'text-red-600' : 'text-slate-600'} />
        <Kpi label="Over capacity" value={`${totals.tailorsOverCapacity} / ${totals.tailorCount}`} icon={Users} tone={totals.tailorsOverCapacity > 0 ? 'text-red-600' : 'text-slate-600'} />
        <Kpi label="Completed today" value={totals.completedToday} icon={CheckCircle2} tone="text-green-600" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Inbox className="h-4 w-4 text-amber-600" />
            Unassigned queue
          </CardTitle>
          <CardDescription>
            Active items without a tailor (or assigned to someone who is no longer active)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UnassignedQueue items={overview.unassigned} tailors={overview.tailors} canAssign={canAssign} onAssigned={onAssigned} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-500" />
          Tailors ({overview.tailors.length}) · capacity {overview.maxActiveItemsPerTailor} active items each
        </h2>
        <div className="flex gap-1" role="group" aria-label="Sort tailors">
          {(
            [
              ['load', 'Busiest'],
              ['overdue', 'Most overdue'],
              ['name', 'Name'],
            ] as const
          ).map(([key, label]) => (
            <Button key={key} size="sm" variant={sort === key ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setSort(key)}>
              {label}
            </Button>
          ))}
        </div>
      </div>

      {tailors.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-slate-500">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No active tailors. Add users with the Tailor or Master Tailor role in Admin Settings.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {tailors.map((t) => (
            <TailorCard key={t.id} tailor={t} assignable={assignable} canAssign={canAssign} onAssigned={onAssigned} />
          ))}
        </div>
      )}
    </div>
  )
}
