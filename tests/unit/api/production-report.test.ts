/**
 * Production report — date-range validation and per-tailor aggregation.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { buildProductionReport, parseReportRange, MAX_REPORT_DAYS } from '@/app/api/reports/production/_lib/report'
import { setActiveLocaleConfig } from '@/lib/locale'

// Report days are shop-local days (Asia/Kolkata here), independent of the server time zone
beforeEach(() => setActiveLocaleConfig({ currency: 'INR', locale: 'en-IN', timeZone: 'Asia/Kolkata' }))

const now = new Date('2026-09-11T10:00:00')
const params = (q: Record<string, string>) => new URLSearchParams(q)

describe('parseReportRange', () => {
  it('defaults to the last 30 shop-local days', () => {
    // 10:00 UTC on 11 Sep is 15:30 IST → range is 13 Aug 00:00 IST … 11 Sep 23:59:59.999 IST
    const r = parseReportRange(params({}), new Date('2026-09-11T10:00:00Z'))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.range.from.toISOString()).toBe('2026-08-12T18:30:00.000Z')
      expect(r.range.to.toISOString()).toBe('2026-09-11T18:29:59.999Z')
    }
  })

  it('rejects malformed and impossible dates', () => {
    expect(parseReportRange(params({ from: '2026-13-01' }), now).ok).toBe(false)
    expect(parseReportRange(params({ from: '2026-02-31' }), now).ok).toBe(false)
    expect(parseReportRange(params({ to: 'yesterday' }), now).ok).toBe(false)
  })

  it('rejects reversed and over-long ranges', () => {
    expect(parseReportRange(params({ from: '2026-09-10', to: '2026-09-01' }), now).ok).toBe(false)
    const r = parseReportRange(params({ from: '2024-01-01', to: '2026-01-01' }), now)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain(String(MAX_REPORT_DAYS))
  })

  it('accepts an inclusive custom range', () => {
    const r = parseReportRange(params({ from: '2026-09-01', to: '2026-09-07' }), now)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.range.from.toISOString()).toBe('2026-08-31T18:30:00.000Z') // 1 Sep 00:00 IST
      expect(r.range.to.toISOString()).toBe('2026-09-07T18:29:59.999Z') // 7 Sep end of day IST
    }
  })
})

describe('buildProductionReport', () => {
  const range = { from: new Date('2026-09-01T00:00:00'), to: new Date('2026-09-07T23:59:59') }
  const tailors = [
    { id: 'ravi', name: 'Ravi', role: 'TAILOR', active: true },
    { id: 'meena', name: 'Meena', role: 'MASTER_TAILOR', active: true },
    { id: 'old', name: 'Old', role: 'TAILOR', active: false },
  ]

  const report = buildProductionReport({
    range,
    now,
    tailors,
    completed: [
      // 4 days, on time
      { assignedTailorId: 'ravi', quantity: 2, orderDate: new Date('2026-09-01T10:00:00'), deliveryDate: new Date('2026-09-06'), completedAt: new Date('2026-09-05T10:00:00') },
      // 6 days, late
      { assignedTailorId: 'ravi', quantity: 1, orderDate: new Date('2026-09-01T10:00:00'), deliveryDate: new Date('2026-09-05'), completedAt: new Date('2026-09-07T10:00:00') },
      { assignedTailorId: null, quantity: 1, orderDate: new Date('2026-09-02T10:00:00'), deliveryDate: new Date('2026-09-10'), completedAt: new Date('2026-09-03T10:00:00') },
    ],
    backlog: [
      { assignedTailorId: 'meena', orderStatus: 'STITCHING', deliveryDate: new Date('2026-09-01') }, // overdue
      { assignedTailorId: 'meena', orderStatus: 'CUTTING', deliveryDate: new Date('2026-09-20') },
      { assignedTailorId: 'meena', orderStatus: 'READY', deliveryDate: new Date('2026-09-01') }, // finished → not backlog
      { assignedTailorId: null, orderStatus: 'NEW', deliveryDate: new Date('2026-09-20') },
    ],
    statusEvents: [
      { orderId: 'o1', newValue: 'CUTTING', createdAt: new Date('2026-09-02T10:00:00') },
      { orderId: 'o1', newValue: 'STITCHING', createdAt: new Date('2026-09-03T10:00:00') },
      { orderId: 'o1', newValue: 'READY', createdAt: new Date('2026-09-05T10:00:00') },
    ],
    orderDates: { o1: new Date('2026-09-01T10:00:00') },
  })

  it('summarises throughput, turnaround and on-time rate', () => {
    expect(report.summary).toMatchObject({
      completedItems: 3,
      completedGarments: 4,
      onTimeRate: 67,
      backlog: 3,
      overdue: 1,
      unassignedBacklog: 1,
    })
    expect(report.summary.avgTurnaroundDays).toBeCloseTo((4 + 6 + 1) / 3, 1)
  })

  it('reports per tailor, hiding inactive staff with no activity', () => {
    const ravi = report.tailors.find((t) => t.id === 'ravi')!
    expect(ravi).toMatchObject({ completedItems: 2, completedGarments: 3, avgTurnaroundDays: 5, onTimeRate: 50, backlog: 0 })
    const meena = report.tailors.find((t) => t.id === 'meena')!
    expect(meena).toMatchObject({ completedItems: 0, backlog: 2, overdue: 1, onTimeRate: null })
    expect(report.tailors.find((t) => t.id === 'old')).toBeUndefined()
    expect(report.tailors[report.tailors.length - 1].name).toBe('Unassigned')
  })

  it('builds a daily series covering the whole range', () => {
    expect(report.daily).toHaveLength(7)
    expect(report.daily.find((d) => d.date === '2026-09-05')?.completed).toBe(1)
    expect(report.daily.find((d) => d.date === '2026-09-07')?.completed).toBe(1)
  })

  it('computes average days spent in each stage', () => {
    const stage = (s: string) => report.stages.find((x) => x.status === s)!
    expect(stage('NEW')).toMatchObject({ avgDays: 1, samples: 1 })
    expect(stage('CUTTING')).toMatchObject({ avgDays: 1, samples: 1 })
    expect(stage('STITCHING')).toMatchObject({ avgDays: 2, samples: 1 })
    expect(stage('FINISHING')).toMatchObject({ avgDays: null, samples: 0 })
  })
})
