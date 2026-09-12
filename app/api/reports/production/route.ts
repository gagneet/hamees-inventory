/**
 * @featuretrace Production Report API
 * GET /api/reports/production?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Permission: view_production_reports (OWNER, ADMIN, MASTER_TAILOR). No financial data.
 */

import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-permissions'
import { loadProductionReport, parseReportRange } from './_lib/report'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { error } = await requirePermission('view_production_reports')
  if (error) return error

  const parsed = parseReportRange(new URL(request.url).searchParams)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  try {
    return NextResponse.json(await loadProductionReport(parsed.range))
  } catch (err) {
    console.error('Error building production report:', err)
    return NextResponse.json({ error: 'Failed to build production report' }, { status: 500 })
  }
}
