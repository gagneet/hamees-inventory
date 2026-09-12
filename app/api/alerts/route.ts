import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'
import { alertVisibilityScope } from '@/lib/alert-scope'
import { z } from 'zod'

export async function GET(request: Request) {
  const { session, error } = await requirePermission('view_alerts')
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50') || 50))

    const alerts = await prisma.alert.findMany({
      where: {
        AND: [unreadOnly ? { isRead: false, isDismissed: false } : {}, alertVisibilityScope(session.user.role)],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ alerts })
  } catch (error) {
    console.error('Error fetching alerts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    )
  }
}

const alertUpdateSchema = z.object({
  id: z.string().min(1),
  isRead: z.boolean().optional(),
  isDismissed: z.boolean().optional(),
})

export async function PATCH(request: Request) {
  const { session, error } = await requirePermission('manage_alerts')
  if (error) return error

  try {
    const { id, isRead, isDismissed } = alertUpdateSchema.parse(await request.json())

    // Alerts the role can't see (payment reminders for non-financial roles) are 404
    const existing = await prisma.alert.findFirst({
      where: { AND: [{ id }, alertVisibilityScope(session.user.role)] },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    const alert = await prisma.alert.update({
      where: { id },
      data: {
        ...(isRead !== undefined && { isRead }),
        ...(isDismissed !== undefined && { isDismissed }),
      },
    })

    return NextResponse.json({ alert })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Error updating alert:', error)
    return NextResponse.json(
      { error: 'Failed to update alert' },
      { status: 500 }
    )
  }
}
