import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'

export async function GET(request: Request) {
  const { error } = await requireAnyPermission(['view_inventory'])
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')

    const alerts = await prisma.alert.findMany({
      where: unreadOnly ? { isRead: false, isDismissed: false } : {},
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

export async function PATCH(request: Request) {
  const { error } = await requireAnyPermission(['view_inventory'])
  if (error) return error

  try {
    const body = await request.json()
    const { id, isRead, isDismissed } = body

    const alert = await prisma.alert.update({
      where: { id },
      data: {
        ...(typeof isRead !== 'undefined' && { isRead }),
        ...(typeof isDismissed !== 'undefined' && { isDismissed }),
      },
    })

    return NextResponse.json({ alert })
  } catch (error) {
    console.error('Error updating alert:', error)
    return NextResponse.json(
      { error: 'Failed to update alert' },
      { status: 500 }
    )
  }
}
