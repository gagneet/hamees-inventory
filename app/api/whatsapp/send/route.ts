import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { actorFromSession, requireCustomerAccess, requireOrderAccess } from '@/lib/authz'
import { whatsappService } from '@/lib/whatsapp/whatsapp-service'
import { z } from 'zod'

const sendMessageSchema = z.object({
  // Ignored when orderId/customerId is given: the recipient is always the customer's phone on file
  to: z.string().min(6).max(30).optional(),
  templateName: z.string().max(100).optional(),
  variables: z.record(z.string(), z.string().max(500)).optional(),
  body: z.string().max(2000).optional(),
  customerId: z.string().optional(),
  orderId: z.string().optional(),
  type: z.enum(['ORDER_CONFIRMATION', 'ORDER_READY', 'PAYMENT_REMINDER', 'CUSTOM']).optional(),
})

/**
 * POST /api/whatsapp/send
 * Sends a message to a customer about an order. Messages can only go to a customer (or the
 * customer of an order) the caller can access — never to an arbitrary number.
 */
export async function POST(request: Request) {
  const { session, error } = await requireAnyPermission(['manage_customers', 'create_order'])
  if (error) return error
  const actor = actorFromSession(session)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const data = sendMessageSchema.parse(body)

    if (!data.orderId && !data.customerId) {
      return NextResponse.json({ error: 'orderId or customerId is required' }, { status: 400 })
    }

    let customerId = data.customerId
    let phone: string | null = null

    if (data.orderId) {
      const denied = await requireOrderAccess(actor, data.orderId)
      if (denied) return denied
      const order = await prisma.order.findUnique({
        where: { id: data.orderId },
        select: { customerId: true, customer: { select: { phone: true } } },
      })
      if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      if (customerId && customerId !== order.customerId) {
        return NextResponse.json({ error: 'Order does not belong to this customer' }, { status: 400 })
      }
      customerId = order.customerId
      phone = order.customer.phone
    } else if (customerId) {
      const denied = await requireCustomerAccess(actor, customerId)
      if (denied) return denied
      const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { phone: true } })
      if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
      phone = customer.phone
    }

    if (!phone) {
      return NextResponse.json({ error: 'Customer has no phone number on file' }, { status: 400 })
    }

    const messageId = await whatsappService.sendTemplateMessage({
      to: phone,
      templateName: data.templateName,
      variables: data.variables,
      body: data.body,
      type: data.type,
      customerId,
      orderId: data.orderId,
    })

    return NextResponse.json({
      success: true,
      messageId,
      message: 'WhatsApp message queued successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error sending WhatsApp message:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
