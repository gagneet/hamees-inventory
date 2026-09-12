/**
 * @featuretrace Role-shaped dashboard statistics
 * GET /api/dashboard/enhanced-stats?range=day|week|month
 *
 * Permission: view_dashboard. Each role receives only its sections (shape.ts):
 *   TAILOR          → tailor (own assigned work only)
 *   MASTER_TAILOR   → tailor + production (shop-wide workload, no amounts)
 *   INVENTORY_MGR   → inventory + generalStats (stock value visible)
 *   SALES_MANAGER   → sales (amounts stripped, no revenue forecast)
 *   VIEWER          → sales/inventory/general counts (no amounts)
 *   OWNER / ADMIN   → everything including financial
 * Sections a role doesn't receive are never computed. All order queries are scoped (lib/authz.ts).
 */

import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-permissions'
import { actorFromSession } from '@/lib/authz'
import { getAppSettings } from '@/lib/settings'
import { generateStockAlerts } from '@/lib/generate-alerts'
import { loadProductionOverview } from '@/app/api/production/_lib/workload'
import { dashboardSectionsFor, shapeGeneralStats, shapeOrderList, shapeSalesSection } from './shape'
import {
  buildAlerts,
  buildFinancialSection,
  buildGeneralStats,
  buildInventorySection,
  buildOrderStatus,
  buildSalesSection,
  buildTailorSection,
  deliveredRevenue,
  monthWindows,
} from './sections'

export const dynamic = 'force-dynamic'

const RANGES = ['day', 'week', 'month'] as const

export async function GET(request: Request) {
  const { session, error } = await requirePermission('view_dashboard')
  if (error) return error

  const actor = actorFromSession(session)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const rangeParam = new URL(request.url).searchParams.get('range')
    const dateRange = (RANGES as readonly string[]).includes(rangeParam ?? '') ? rangeParam! : 'month'

    const sections = dashboardSectionsFor(actor.role)
    const now = new Date()
    const settings = await getAppSettings()

    if (sections.inventory) {
      // Refresh stock alerts in the background (non-blocking)
      generateStockAlerts().catch((err) => console.error('Background alert generation failed:', err))
    }

    const lastMonthRevenue = sections.financial ? await deliveredRevenue(monthWindows(now).lastMonth) : 0

    const [tailor, production, inventory, sales, financial, generalStats, alerts, orderStatus] = await Promise.all([
      sections.tailor ? buildTailorSection(actor, now, settings.tailorDailyTarget) : null,
      sections.production ? loadProductionOverview(now) : null,
      sections.inventory ? buildInventorySection(now) : null,
      sections.sales ? buildSalesSection(actor, now, sections.financial ? { lastMonthRevenue } : null) : null,
      sections.financial ? buildFinancialSection(now) : null,
      buildGeneralStats(actor, now, { includeRevenue: sections.financial, includeInventory: sections.inventory }),
      sections.alerts ? buildAlerts(actor) : null,
      sections.orderStatus ? buildOrderStatus(actor) : null,
    ])

    return NextResponse.json({
      userRole: actor.role,
      dateRange,
      sections,
      ...(tailor && {
        tailor: {
          ...tailor,
          inProgressList: shapeOrderList(tailor.inProgressList, actor.role),
          dueTodayList: shapeOrderList(tailor.dueTodayList, actor.role),
          overdueList: shapeOrderList(tailor.overdueList, actor.role),
          upcomingDeadlines: shapeOrderList(tailor.upcomingDeadlines, actor.role),
        },
      }),
      ...(production && { production }),
      ...(inventory && { inventory }),
      ...(sales && { sales: shapeSalesSection(sales, actor.role) }),
      ...(financial && { financial }),
      generalStats: shapeGeneralStats(generalStats, actor.role),
      ...(alerts && { alerts }),
      ...(orderStatus && { orderStatus }),
    })
  } catch (err) {
    console.error('Error fetching enhanced dashboard stats:', err)
    return NextResponse.json({ error: 'Failed to fetch dashboard statistics' }, { status: 500 })
  }
}
