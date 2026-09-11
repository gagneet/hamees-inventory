/**
 * Role-based shaping for GET /api/dashboard/enhanced-stats.
 *
 * dashboardSectionsFor() decides which sections a role receives at all (sections a role
 * doesn't get are never computed). The shape* helpers strip financial values from what is
 * returned to roles without financial visibility (lib/field-acl.ts). Pure functions — unit tested.
 */

import { ASSIGNABLE_TAILOR_ROLES, hasPermission, type UserRole } from '@/lib/permissions'
import { filterArrayByRole, hasFinancialAccess } from '@/lib/field-acl'

export interface DashboardSections {
  /** Personal workbench (scoped to the user's assigned items). */
  tailor: boolean
  /** Shop-wide production workload (Master Tailor view). */
  production: boolean
  inventory: boolean
  sales: boolean
  /** Revenue, expenses, cash flow, profit — OWNER/ADMIN only. */
  financial: boolean
  alerts: boolean
  orderStatus: boolean
}

export function isProductionRole(role: UserRole): boolean {
  return ASSIGNABLE_TAILOR_ROLES.includes(role)
}

export function dashboardSectionsFor(role: UserRole): DashboardSections {
  const productionStaff = isProductionRole(role)
  return {
    tailor: productionStaff,
    production: hasPermission(role, 'view_production'),
    inventory: hasPermission(role, 'view_inventory') && !productionStaff,
    sales: hasPermission(role, 'view_all_orders') && hasPermission(role, 'view_customers') && !productionStaff,
    financial: hasPermission(role, 'view_financial_reports') && hasFinancialAccess(role, 'order'),
    alerts: hasPermission(role, 'view_alerts'),
    orderStatus: hasPermission(role, 'view_orders'),
  }
}

/** Order lists: amounts (totalAmount, balanceAmount, …) removed for non-financial roles. */
export function shapeOrderList<T extends Record<string, any>>(orders: T[], role: UserRole): Partial<T>[] {
  if (hasFinancialAccess(role, 'order')) return orders
  return filterArrayByRole(orders, role, 'order')
}

type TopCustomer = {
  totalOrders: number
  totalItems: number
  totalSpent?: number
  valueScore?: number
  [key: string]: unknown
}

/** Top customers: spend and spend-derived score removed, ranked by activity instead. */
export function shapeTopCustomers<T extends TopCustomer>(customers: T[], role: UserRole): T[] | Omit<T, 'totalSpent' | 'valueScore'>[] {
  if (hasFinancialAccess(role, 'customer')) return customers
  return [...customers]
    .sort((a, b) => b.totalOrders - a.totalOrders || b.totalItems - a.totalItems)
    .map(({ totalSpent: _spent, valueScore: _score, ...rest }) => rest)
}

export type GeneralStats = {
  revenue?: { thisMonth: number; lastMonth: number; growth: number }
  orders: Record<string, number>
  inventory?: {
    totalValue?: number
    accessories: { totalValue?: number; [key: string]: number | undefined }
    [key: string]: unknown
  }
}

/** General stats: revenue only for financial roles; stock value only with inventory cost access. */
export function shapeGeneralStats(stats: GeneralStats, role: UserRole): GeneralStats {
  const sections = dashboardSectionsFor(role)
  const out: GeneralStats = { orders: stats.orders }
  if (sections.financial && stats.revenue) out.revenue = stats.revenue
  if (sections.inventory && stats.inventory) {
    if (hasFinancialAccess(role, 'inventory')) {
      out.inventory = stats.inventory
    } else {
      const { totalValue: _value, accessories, ...rest } = stats.inventory
      const { totalValue: _accValue, ...accRest } = accessories
      out.inventory = { ...rest, accessories: accRest }
    }
  }
  return out
}

type SalesSection = {
  newOrdersTodayList: Record<string, any>[]
  readyForPickupList: Record<string, any>[]
  pendingOrdersList: Record<string, any>[]
  thisMonthOrdersList: Record<string, any>[]
  topCustomers: TopCustomer[]
  revenueForecast?: unknown
  [key: string]: unknown
}

export function shapeSalesSection(sales: SalesSection, role: UserRole): SalesSection {
  const financial = dashboardSectionsFor(role).financial
  const { revenueForecast, ...rest } = sales
  return {
    ...rest,
    newOrdersTodayList: shapeOrderList(sales.newOrdersTodayList, role),
    readyForPickupList: shapeOrderList(sales.readyForPickupList, role),
    pendingOrdersList: shapeOrderList(sales.pendingOrdersList, role),
    thisMonthOrdersList: shapeOrderList(sales.thisMonthOrdersList, role),
    topCustomers: shapeTopCustomers(sales.topCustomers, role) as TopCustomer[],
    ...(financial && revenueForecast !== undefined ? { revenueForecast } : {}),
  }
}
