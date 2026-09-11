/**
 * Production workload aggregation (Master Tailor dashboard, /production/tailors).
 */
import { describe, it, expect } from 'vitest'
import { addDays } from 'date-fns'
import { buildProductionOverview, type RawWorkloadItem } from '@/app/api/production/_lib/workload'

const now = new Date('2026-09-11T10:00:00')

let seq = 0
/** `status` is the item's own stage; the order's defaults to the same (as for single-item orders). */
function rawItem(opts: {
  tailor?: string | null
  tailorName?: string
  status?: string
  orderStatus?: string
  orderId?: string
  dueInDays?: number
  priority?: string
}): RawWorkloadItem {
  seq++
  return {
    id: `item-${seq}`,
    orderId: opts.orderId ?? `order-${seq}`,
    status: opts.status ?? 'STITCHING',
    quantityOrdered: 1,
    notes: null,
    assignedTailorId: opts.tailor ?? null,
    assignedTailor: opts.tailor ? { name: opts.tailorName ?? opts.tailor } : null,
    garmentPattern: { name: 'Shirt' },
    order: {
      orderNumber: `ORD-${seq}`,
      status: opts.orderStatus ?? opts.status ?? 'STITCHING',
      priority: opts.priority ?? 'NORMAL',
      deliveryDate: addDays(now, opts.dueInDays ?? 5),
      customer: { name: 'Customer' },
    },
  }
}

const tailors = [
  { id: 'ravi', name: 'Ravi', role: 'TAILOR' },
  { id: 'meena', name: 'Meena', role: 'MASTER_TAILOR' },
]

describe('buildProductionOverview', () => {
  it('counts active work per tailor against capacity', () => {
    const items = [
      rawItem({ tailor: 'ravi', status: 'CUTTING' }),
      rawItem({ tailor: 'ravi', status: 'STITCHING' }),
      rawItem({ tailor: 'ravi', status: 'STITCHING' }),
      rawItem({ tailor: 'ravi', status: 'READY' }),
      rawItem({ tailor: 'meena', status: 'FINISHING' }),
    ]
    const o = buildProductionOverview({ tailors, items, completedByTailor: { ravi: 2 }, now, maxActiveItemsPerTailor: 2, dailyTarget: 5 })
    const ravi = o.tailors.find((t) => t.id === 'ravi')!
    expect(ravi.activeCount).toBe(3)
    expect(ravi.readyCount).toBe(1)
    expect(ravi.byStatus.STITCHING).toBe(2)
    expect(ravi.byStatus.CUTTING).toBe(1)
    expect(ravi.utilisation).toBe(150)
    expect(ravi.overCapacity).toBe(true)
    expect(ravi.completedToday).toBe(2)
    expect(o.totals).toMatchObject({ activeItems: 4, readyItems: 1, assignedItems: 4, tailorsOverCapacity: 1, completedToday: 2 })
  })

  it('queues unassigned items and items held by users who can no longer take work', () => {
    const items = [
      rawItem({ tailor: null, status: 'NEW' }),
      rawItem({ tailor: 'former', tailorName: 'Former Tailor', status: 'CUTTING' }),
      rawItem({ tailor: null, status: 'READY' }), // finished work never needs assigning
    ]
    const o = buildProductionOverview({ tailors, items, completedByTailor: {}, now, maxActiveItemsPerTailor: 8, dailyTarget: 5 })
    expect(o.unassigned).toHaveLength(2)
    expect(o.unassigned.find((i) => i.assignedTailorId === 'former')?.assignedTailorName).toBe('Former Tailor')
    expect(o.totals.unassignedItems).toBe(2)
  })

  it('flags overdue active items (not finished ones) and sorts urgent work first', () => {
    const items = [
      rawItem({ tailor: 'meena', dueInDays: 3 }),
      rawItem({ tailor: 'meena', dueInDays: 5, priority: 'URGENT' }),
      rawItem({ tailor: 'meena', dueInDays: -2 }),
      rawItem({ tailor: 'meena', dueInDays: 0 }),
      rawItem({ tailor: 'meena', dueInDays: -4, status: 'READY' }),
    ]
    const o = buildProductionOverview({ tailors, items, completedByTailor: {}, now, maxActiveItemsPerTailor: 8, dailyTarget: 5 })
    const meena = o.tailors.find((t) => t.id === 'meena')!
    expect(meena.overdueCount).toBe(1)
    expect(meena.dueTodayCount).toBe(1)
    expect(o.overdue.map((i) => i.daysLeft)).toEqual([-2])
    expect(meena.items[0].priority).toBe('URGENT')
    expect(meena.items[1].daysLeft).toBe(-4)
  })

  it('counts each item by its own stage, not the order status', () => {
    // One order, derived status CUTTING (its least advanced item); garments at different stages
    const items = [
      rawItem({ tailor: 'ravi', orderId: 'o-multi', status: 'CUTTING', orderStatus: 'CUTTING' }),
      rawItem({ tailor: 'meena', orderId: 'o-multi', status: 'FINISHING', orderStatus: 'CUTTING' }),
      rawItem({ tailor: 'meena', orderId: 'o-multi', status: 'READY', orderStatus: 'CUTTING' }),
    ]
    const o = buildProductionOverview({ tailors, items, completedByTailor: {}, now, maxActiveItemsPerTailor: 8, dailyTarget: 5 })
    const ravi = o.tailors.find((t) => t.id === 'ravi')!
    const meena = o.tailors.find((t) => t.id === 'meena')!
    expect(ravi.byStatus.CUTTING).toBe(1)
    expect(meena.byStatus.FINISHING).toBe(1)
    expect(meena.byStatus.CUTTING).toBe(0)
    expect(meena.activeCount).toBe(1)
    expect(meena.readyCount).toBe(1)
    expect(o.totals).toMatchObject({ activeItems: 2, readyItems: 1 })
    expect(meena.items.find((i) => i.status === 'READY')?.orderStatus).toBe('CUTTING')
  })

  it('does not flag a finished item as overdue even when its order is late', () => {
    const items = [rawItem({ tailor: 'ravi', status: 'READY', orderStatus: 'STITCHING', dueInDays: -3 })]
    const o = buildProductionOverview({ tailors, items, completedByTailor: {}, now, maxActiveItemsPerTailor: 8, dailyTarget: 5 })
    expect(o.overdue).toHaveLength(0)
  })

  it('ignores items on delivered or cancelled orders', () => {
    const items = [rawItem({ tailor: 'ravi', status: 'DELIVERED' }), rawItem({ tailor: null, status: 'CANCELLED' })]
    const o = buildProductionOverview({ tailors, items, completedByTailor: {}, now, maxActiveItemsPerTailor: 8, dailyTarget: 5 })
    expect(o.totals.activeItems).toBe(0)
    expect(o.unassigned).toHaveLength(0)
    expect(o.tailors.every((t) => t.items.length === 0)).toBe(true)
  })

  it('never returns price fields', () => {
    const o = buildProductionOverview({
      tailors,
      items: [rawItem({ tailor: 'ravi' })],
      completedByTailor: {},
      now,
      maxActiveItemsPerTailor: 8,
      dailyTarget: 5,
    })
    expect(JSON.stringify(o)).not.toMatch(/amount|price|cost/i)
  })
})
