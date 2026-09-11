import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'
import { alertVisibilityScope } from '@/lib/alert-scope'

export async function POST() {
  try {
    const { session, error } = await requirePermission('manage_alerts')
    if (error) return error

    // Only alerts this role can see are marked read
    await prisma.alert.updateMany({
      where: {
        AND: [{ isRead: false, isDismissed: false }, alertVisibilityScope(session.user.role)],
      },
      data: {
        isRead: true,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error marking all alerts as read:', error)
    return NextResponse.json(
      { error: 'Failed to mark all alerts as read' },
      { status: 500 }
    )
  }
}
