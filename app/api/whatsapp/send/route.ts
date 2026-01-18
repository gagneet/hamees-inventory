import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-permissions'
import { whatsappService } from '@/lib/whatsapp/whatsapp-service'
import { z } from 'zod'

const sendMessageSchema = z.object({
  to: z.string().min(10),
  templateName: z.string().optional(),
  variables: z.record(z.string(), z.string()).optional(),
  body: z.string().optional(),
  customerId: z.string().optional(),
  orderId: z.string().optional(),
  type: z.enum(['ORDER_CONFIRMATION', 'ORDER_READY', 'PAYMENT_REMINDER', 'CUSTOM']).optional(),
})

export async function POST(request: Request) {
  const { error } = await requireAnyPermission(['manage_customers', 'create_order'])
  if (error) return error

  try {
    const body = await request.json()
    const data = sendMessageSchema.parse(body)

    const messageId = await whatsappService.sendTemplateMessage(data)

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
