/**
 * Serializable production-workload types shared by the production APIs, the Master Tailor
 * dashboard and the /production/tailors page. No runtime imports — safe for client components.
 */

/** Item stages that count toward a tailor's active workload (READY is finished work). */
export const ACTIVE_PRODUCTION_STATUSES = ['NEW', 'MATERIAL_SELECTED', 'CUTTING', 'STITCHING', 'FINISHING'] as const
export type ActiveProductionStatus = (typeof ACTIVE_PRODUCTION_STATUSES)[number]

export function isActiveProductionStatus(status: string): status is ActiveProductionStatus {
  return (ACTIVE_PRODUCTION_STATUSES as readonly string[]).includes(status)
}

export interface WorkloadItem {
  id: string
  orderId: string
  orderNumber: string
  /** The item's own production stage. */
  status: string
  /** The parent order's (derived) status. */
  orderStatus: string
  priority: string
  deliveryDate: string
  garmentName: string
  customerName: string
  notes: string | null
  quantity: number
  assignedTailorId: string | null
  assignedTailorName: string | null
  /** Calendar days until delivery (negative when overdue). */
  daysLeft: number
  isOverdue: boolean
}

export interface TailorWorkload {
  id: string
  name: string
  role: string
  /** Items in active production statuses (counts toward capacity). */
  activeCount: number
  /** Items finished and waiting for pickup (READY). */
  readyCount: number
  byStatus: Record<ActiveProductionStatus, number>
  overdueCount: number
  dueTodayCount: number
  completedToday: number
  capacity: number
  /** activeCount / capacity, in percent (can exceed 100). */
  utilisation: number
  overCapacity: boolean
  items: WorkloadItem[]
}

export interface ProductionOverview {
  generatedAt: string
  maxActiveItemsPerTailor: number
  dailyTarget: number
  tailors: TailorWorkload[]
  /** Active items with no (or an inactive / non-tailor) assignee. */
  unassigned: WorkloadItem[]
  /** Active items past their delivery date, assigned or not. */
  overdue: WorkloadItem[]
  totals: {
    tailorCount: number
    activeItems: number
    assignedItems: number
    unassignedItems: number
    overdueItems: number
    readyItems: number
    completedToday: number
    tailorsOverCapacity: number
  }
}

export interface AssignableTailor {
  id: string
  name: string
  role: string
}
