'use client'

/**
 * @featuretrace Production Report (client)
 * Date-range production analytics: completions per tailor, daily throughput, average stage
 * durations, turnaround and on-time rate. No financial data.
 * @calls GET /api/reports/production?from=YYYY-MM-DD&to=YYYY-MM-DD
 */

import { useCallback, useEffect, useState } from 'react'
import { format, subDays } from 'date-fns'
import { AlertCircle, CheckCircle2, Clock, Loader2, Scissors, Timer } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn, formatDateWith, formatNumber } from '@/lib/utils'
import type { ProductionReport as ReportData } from '@/app/api/reports/production/_lib/report'
import { STATUS_LABELS } from './workload-item-row'

const PRESETS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
]

const ymd = (d: Date) => format(d, 'yyyy-MM-dd')
const dayLabel = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return formatDateWith(new Date(y, m - 1, d), { day: 'numeric', month: 'short' })
}
const days = (v: number | null) => (v === null ? '—' : `${formatNumber(v, { maximumFractionDigits: 1 })} d`)
const pct = (v: number | null) => (v === null ? '—' : `${v}%`)

function Kpi({ label, value, hint, icon: Icon, tone = 'text-slate-900' }: { label: string; value: string | number; hint?: string; icon: React.ElementType; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <Icon className="h-4 w-4 text-slate-400" />
        </div>
        <p className={cn('mt-1 text-2xl font-bold tabular-nums', tone)}>{value}</p>
        {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  )
}

export function ProductionReport() {
  const today = new Date()
  const [from, setFrom] = useState(ymd(subDays(today, 29)))
  const [to, setTo] = useState(ymd(today))
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (f: string, t: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/reports/production?from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`, {
        cache: 'no-store',
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Failed to load report')
      setData(body)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(from, to)
    // Initial load only; later loads are triggered explicitly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  const applyPreset = (n: number) => {
    const f = ymd(subDays(new Date(), n - 1))
    const t = ymd(new Date())
    setFrom(f)
    setTo(t)
    load(f, t)
  }

  const tailorChart = (data?.tailors ?? [])
    .filter((t) => t.completedItems > 0 || t.backlog > 0)
    .map((t) => ({ name: t.name, completed: t.completedItems, backlog: t.backlog }))

  return (
    <div className="space-y-6">
      {/* Range picker */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1">
            <Label htmlFor="report-from" className="text-xs">From</Label>
            <Input id="report-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[160px]" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="report-to" className="text-xs">To</Label>
            <Input id="report-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-9 w-[160px]" />
          </div>
          <Button className="h-9" onClick={() => load(from, to)} disabled={loading || !from || !to}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Apply
          </Button>
          <div className="flex gap-1 ml-auto">
            {PRESETS.map((p) => (
              <Button key={p.days} variant="outline" size="sm" className="h-9" onClick={() => applyPreset(p.days)} disabled={loading}>
                {p.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-red-800">
            <AlertCircle className="h-4 w-4" /> {error}
          </CardContent>
        </Card>
      )}

      {!data && loading && (
        <div className="flex justify-center py-16 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}

      {data && (
        <div className={cn('space-y-6', loading && 'opacity-60')}>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
            <Kpi label="Items completed" value={data.summary.completedItems} hint={`${data.summary.completedGarments} garments`} icon={CheckCircle2} tone="text-green-600" />
            <Kpi label="Avg turnaround" value={days(data.summary.avgTurnaroundDays)} hint="Order date → ready" icon={Timer} />
            <Kpi label="On time" value={pct(data.summary.onTimeRate)} hint="Ready by delivery date" icon={Clock} tone={data.summary.onTimeRate !== null && data.summary.onTimeRate < 80 ? 'text-amber-600' : 'text-slate-900'} />
            <Kpi label="Current backlog" value={data.summary.backlog} hint={`${data.summary.unassignedBacklog} unassigned`} icon={Scissors} tone="text-blue-600" />
            <Kpi label="Overdue now" value={data.summary.overdue} icon={AlertCircle} tone={data.summary.overdue > 0 ? 'text-red-600' : 'text-slate-900'} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Daily completions</CardTitle>
                <CardDescription>Items that finished production each day</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="w-full h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.daily} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={dayLabel} tick={{ fontSize: 11 }} minTickGap={16} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip labelFormatter={(v) => dayLabel(String(v))} formatter={(v) => [v, 'Items completed']} />
                      <Bar dataKey="completed" fill="#10B981" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Completed vs backlog by tailor</CardTitle>
                <CardDescription>Completed in range; backlog is current</CardDescription>
              </CardHeader>
              <CardContent>
                {tailorChart.length === 0 ? (
                  <div className="h-[280px] flex items-center justify-center text-sm text-slate-500">No tailor activity in this range</div>
                ) : (
                  <div className="w-full h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={tailorChart} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="completed" name="Completed" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="backlog" name="Backlog" fill="#F59E0B" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tailor performance</CardTitle>
              <CardDescription>
                {dayLabel(data.range.from)} – {dayLabel(data.range.to)} · completed items are attributed to their current assignee
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tailor</TableHead>
                    <TableHead className="text-right">Completed</TableHead>
                    <TableHead className="text-right">Garments</TableHead>
                    <TableHead className="text-right">Avg turnaround</TableHead>
                    <TableHead className="text-right">On time</TableHead>
                    <TableHead className="text-right">Backlog</TableHead>
                    <TableHead className="text-right">Overdue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.tailors.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-slate-500">No tailors found</TableCell>
                    </TableRow>
                  )}
                  {data.tailors.map((t) => (
                    <TableRow key={t.id ?? 'unassigned'}>
                      <TableCell className="font-medium">
                        {t.name}
                        {t.role === 'MASTER_TAILOR' && <span className="ml-1 text-xs text-slate-500">(Master)</span>}
                        {t.id && !t.active && <span className="ml-1 text-xs text-slate-400">(inactive)</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{t.completedItems}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.completedGarments}</TableCell>
                      <TableCell className="text-right tabular-nums">{days(t.avgTurnaroundDays)}</TableCell>
                      <TableCell className={cn('text-right tabular-nums', t.onTimeRate !== null && t.onTimeRate < 80 && 'text-amber-700')}>
                        {pct(t.onTimeRate)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{t.backlog}</TableCell>
                      <TableCell className={cn('text-right tabular-nums', t.overdue > 0 && 'text-red-600 font-medium')}>{t.overdue}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Average time per stage</CardTitle>
              <CardDescription>For orders that finished production in this range</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
                {data.stages.map((s) => (
                  <div key={s.status} className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs text-slate-500">{STATUS_LABELS[s.status] ?? s.status}</p>
                    <p className="text-lg font-semibold tabular-nums">{days(s.avgDays)}</p>
                    <p className="text-[11px] text-slate-400">{s.samples} sample{s.samples === 1 ? '' : 's'}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
