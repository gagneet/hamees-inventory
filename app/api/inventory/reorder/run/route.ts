/**
 * @featuretrace Reorder check (manual run)
 * FEATURETRACE:
 *   feature: automated_reorder
 *   entry_points: POST /api/inventory/reorder/run (manage_inventory)
 *   upstream_callers: components/purchase-orders/reorder-suggestions.tsx
 *   downstream_dependencies: lib/reorder (runReorderCheck: alerts, auto-drafted POs, audit log)
 *   related_tests: tests/unit/api/reorder-routes.test.ts, tests/integration/reorder.test.ts
 *
 * Runs the reorder check now. 409 when another run holds the lock. The result lists alert counts and
 * the draft purchase orders touched (numbers only, no amounts).
 */
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-permissions'
import { runReorderCheck } from '@/lib/reorder'

export async function POST() {
  const { session, error } = await requirePermission('manage_inventory')
  if (error) return error

  try {
    const result = await runReorderCheck({ trigger: 'manual', userId: session.user.id })
    if (result.status === 'skipped') {
      return NextResponse.json(
        { error: 'A reorder check is already running. Try again in a moment.', result },
        { status: 409 }
      )
    }
    return NextResponse.json({ result })
  } catch (err) {
    console.error('Error running reorder check:', err)
    return NextResponse.json({ error: 'Failed to run the reorder check' }, { status: 500 })
  }
}
