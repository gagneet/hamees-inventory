import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

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
