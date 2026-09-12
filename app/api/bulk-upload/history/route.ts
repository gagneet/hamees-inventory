import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-permissions'
import { prisma } from '@/lib/db'

/**
 * GET /api/bulk-upload/history
 * Get upload history for current user (or all if admin)
 */
export async function GET(req: NextRequest) {
  try {
    const { session, error } = await requirePermission('bulk_upload')
    if (error) return error

    const { searchParams } = new URL(req.url)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20))
    const uploadId = searchParams.get('uploadId')

    // Get specific upload if uploadId provided
    if (uploadId) {
      const upload = await prisma.uploadHistory.findUnique({
        where: { id: uploadId },
        include: { user: { select: { name: true, email: true } } }
      })

      if (!upload) {
        return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
      }

      // Check permissions
      if (upload.userId !== session.user.id && session.user.role !== 'OWNER' && session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      return NextResponse.json(upload)
    }

    // Get upload history list
    const whereClause = session.user.role === 'OWNER' || session.user.role === 'ADMIN'
      ? {} // Admin can see all
      : { userId: session.user.id } // Users see only their own

    const uploads = await prisma.uploadHistory.findMany({
      where: whereClause,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    return NextResponse.json(uploads)
  } catch (error) {
    console.error('History fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch upload history' },
      { status: 500 }
    )
  }
}
