import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-permissions'
import { generateStockAlerts, cleanupOldAlerts } from '@/lib/generate-alerts'

/**
 * POST /api/alerts/generate
 * Manually trigger alert generation for low/critical stock and pending payments
 * Permission: manage_alerts
 */
export async function POST() {
  try {
    const { error } = await requireAnyPermission(['manage_alerts'])
    if (error) {
      return error
    }

    // Generate alerts
    const result = await generateStockAlerts()

    // Also cleanup old alerts
    const cleanupResult = await cleanupOldAlerts()

    return NextResponse.json({
      success: result.success,
      alertsCreated: result.alertsCreated,
      alertsResolved: result.alertsResolved,
      oldAlertsDeleted: cleanupResult.deletedCount,
      message: `Generated ${result.alertsCreated} new alerts, resolved ${result.alertsResolved} alerts, and cleaned up ${cleanupResult.deletedCount} old alerts`,
    })
  } catch (error) {
    console.error('Error in alert generation API:', error)
    return NextResponse.json(
      { error: 'Failed to generate alerts' },
      { status: 500 }
    )
  }
}
