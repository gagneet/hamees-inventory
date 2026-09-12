/**
 * @featuretrace Production workload API
 * GET /api/production/workload — per-tailor workload, unassigned queue and overdue items.
 * Permission: view_production (OWNER, ADMIN, MASTER_TAILOR). No financial data.
 */

import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-permissions'
import { loadProductionOverview } from '../_lib/workload'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { error } = await requirePermission('view_production')
  if (error) return error

  try {
    return NextResponse.json(await loadProductionOverview())
  } catch (err) {
    console.error('Error loading production workload:', err)
    return NextResponse.json({ error: 'Failed to load production workload' }, { status: 500 })
  }
}
