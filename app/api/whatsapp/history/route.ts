import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { requireAnyPermission } from '@/lib/api-permissions'
import { hasFinancialAccess } from '@/lib/field-acl'
import { actorFromSession, canSeeAllOrders, orderScope, scopedWhere } from '@/lib/authz'

const MESSAGE_STATUSES = new Set(['PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED'])

// GET - Message history with filters
export async function GET(request: Request) {
  const { session, error } = await requireAnyPermission(['view_customers'])
  if (error) return error
  const actor = actorFromSession(session)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')
    const orderId = searchParams.get('orderId')
    const status = searchParams.get('status')
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50') || 50))

    const filter: Prisma.WhatsAppMessageWhereInput = {}
    if (customerId) filter.customerId = customerId
    if (orderId) filter.orderId = orderId
    if (status && MESSAGE_STATUSES.has(status)) filter.status = status as Prisma.WhatsAppMessageWhereInput['status']

    // ABAC: scoped roles (TAILOR) only see messages about orders in their scope — not other
    // orders of the same customer, and not customer-only messages
    const scope: Prisma.WhatsAppMessageWhereInput = canSeeAllOrders(actor) ? {} : { order: orderScope(actor) }
    const where = scopedWhere(filter, scope)

    const [messages, summary] = await Promise.all([
      prisma.whatsAppMessage.findMany({
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
      }),
      prisma.whatsAppMessage.groupBy({
        by: ['status'],
        _count: true,
        where,
      }),
    ])

    // Message bodies quote totals and balances: hide them from roles without order financials
    const showContent = hasFinancialAccess(actor.role, 'order')
    const visibleMessages = showContent ? messages : messages.map(({ content: _content, ...rest }) => rest)

    return NextResponse.json({
      messages: visibleMessages,
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
