import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.alert.updateMany({
      where: {
        isRead: false,
        isDismissed: false,
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
