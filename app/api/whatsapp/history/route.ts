import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'

// GET - Message history with filters
export async function GET(request: Request) {
  const { error } = await requireAnyPermission(['view_customers'])
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')
    const orderId = searchParams.get('orderId')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: any = {}
    if (customerId) where.customerId = customerId
    if (orderId) where.orderId = orderId
    if (status) where.status = status

    const messages = await prisma.whatsAppMessage.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const summary = await prisma.whatsAppMessage.groupBy({
      by: ['status'],
      _count: true,
      where: customerId || orderId ? where : undefined,
    })

    return NextResponse.json({
      messages,
      summary,
      total: messages.length,
    })
  } catch (error) {
    console.error('Error fetching message history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch message history' },
      { status: 500 }
    )
  }
}
