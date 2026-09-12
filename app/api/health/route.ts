/**
 * GET /api/health — unauthenticated liveness/readiness probe for uptime monitors and deploy checks.
 * Reports only coarse status; never includes configuration or error details.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const startedAt = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json(
      { status: 'ok', database: 'ok', latencyMs: Date.now() - startedAt, timestamp: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json(
      { status: 'error', database: 'unreachable', timestamp: new Date().toISOString() },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
