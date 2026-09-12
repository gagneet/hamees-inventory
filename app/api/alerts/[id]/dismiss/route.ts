import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'
import { alertVisibilityScope } from '@/lib/alert-scope'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requirePermission('manage_alerts')
    if (error) return error

    const { id } = await params

    // Alerts the role can't see (payment reminders for non-financial roles) are 404
    const existing = await prisma.alert.findFirst({
      where: { AND: [{ id }, alertVisibilityScope(session.user.role)] },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    // Dismiss for 24 hours
    const dismissedUntil = new Date()
    dismissedUntil.setHours(dismissedUntil.getHours() + 24)

    const alert = await prisma.alert.update({
      where: { id },
      data: {
        isDismissed: true,
        dismissedUntil,
      },
    })

    return NextResponse.json({ alert })
  } catch (error) {
    console.error('Error dismissing alert:', error)
    return NextResponse.json(
      { error: 'Failed to dismiss alert' },
      { status: 500 }
    )
  }
}
