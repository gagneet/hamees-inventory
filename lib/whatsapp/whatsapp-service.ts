import { prisma } from '@/lib/db'

export interface WhatsAppMessagePayload {
  to: string
  templateName?: string
  variables?: Record<string, string>
  body?: string
  type?: 'ORDER_CONFIRMATION' | 'ORDER_READY' | 'PAYMENT_REMINDER' | 'CUSTOM'
  customerId?: string
  orderId?: string
}

export class WhatsAppService {
  private apiKey: string
  private phoneNumberId: string
  private baseUrl: string
  private isEnabled: boolean

  constructor() {
    this.apiKey = process.env.WHATSAPP_API_KEY || ''
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || ''
    this.baseUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v17.0'
    this.isEnabled = !!(this.apiKey && this.phoneNumberId)
  }

  /**
   * Send a templated WhatsApp message
   */
  async sendTemplateMessage(payload: WhatsAppMessagePayload): Promise<string> {
    try {
      // Normalize phone number (remove +, spaces, etc.)
      const to = this.normalizePhoneNumber(payload.to)

      // Get template if specified
      const template = payload.templateName
        ? await prisma.whatsAppTemplate.findUnique({
            where: { name: payload.templateName },
          })
        : null

      if (payload.templateName && !template) {
        throw new Error(`Template ${payload.templateName} not found`)
      }

      // Replace variables in template
      let messageContent = payload.body || template?.content || ''
      if (template && payload.variables) {
        Object.entries(payload.variables).forEach(([key, value]) => {
          messageContent = messageContent.replace(`{{${key}}}`, value)
        })
      }

      // Save to database
      const message = await prisma.whatsAppMessage.create({
        data: {
          recipient: to,
          customerId: payload.customerId,
          orderId: payload.orderId,
          messageType: payload.type || 'CUSTOM',
          templateName: payload.templateName,
          content: messageContent,
          status: 'PENDING',
        },
      })

      // Send via WhatsApp API (if enabled)
      let sent = false
      if (this.isEnabled) {
        sent = await this.sendViaAPI(to, messageContent, template?.name)
      } else {
        // Development mode: just log the message
        console.log('[WhatsApp] DEV MODE - Message would be sent:')
        console.log(`  To: ${to}`)
        console.log(`  Type: ${payload.type}`)
        console.log(`  Content: ${messageContent}`)
        sent = true // Simulate success in dev mode
      }

      // Update status
      await prisma.whatsAppMessage.update({
        where: { id: message.id },
        data: {
          status: sent ? 'SENT' : 'FAILED',
          sentAt: sent ? new Date() : null,
          failureReason: sent ? null : 'API call failed',
        },
      })

      return message.id
    } catch (error) {
      console.error('WhatsApp send error:', error)
      throw error
    }
  }

  /**
   * Send message via WhatsApp Business API
   */
  private async sendViaAPI(
    to: string,
    message: string,
    templateName?: string
  ): Promise<boolean> {
    try {
      // For Official WhatsApp Business API
      const response = await fetch(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: to,
            type: 'text',
            text: {
              body: message,
            },
          }),
        }
      )

      return response.ok
    } catch (error) {
      console.error('WhatsApp API error:', error)
      return false
    }
  }

  /**
   * Normalize phone number to E.164 format
   */
  private normalizePhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '')

    // Add country code if missing (assuming India +91)
    if (!cleaned.startsWith('91') && cleaned.length === 10) {
      cleaned = '91' + cleaned
    }

    return cleaned
  }

  /**
   * Send order confirmation
   */
  async sendOrderConfirmation(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: {
          include: {
            garmentPattern: true,
          },
        },
      },
    })

    if (!order) throw new Error('Order not found')

    const itemsList = order.items
      .map((item) => `- ${item.garmentPattern.name} (${item.quantityOrdered})`)
      .join('\n')

    await this.sendTemplateMessage({
      to: order.customer.phone,
      templateName: 'order_confirmation',
      variables: {
        customer_name: order.customer.name,
        order_number: order.orderNumber,
        delivery_date: order.deliveryDate.toLocaleDateString('en-IN'),
        total_amount: `₹${order.totalAmount.toLocaleString('en-IN')}`,
        advance_paid: `₹${order.advancePaid.toLocaleString('en-IN')}`,
        balance: `₹${order.balanceAmount.toLocaleString('en-IN')}`,
        items: itemsList,
      },
      type: 'ORDER_CONFIRMATION',
      customerId: order.customerId,
      orderId: order.id,
    })
  }

  /**
   * Send order ready notification
   */
  async sendOrderReady(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
      },
    })

    if (!order) throw new Error('Order not found')

    await this.sendTemplateMessage({
      to: order.customer.phone,
      templateName: 'order_ready',
      variables: {
        customer_name: order.customer.name,
        order_number: order.orderNumber,
        balance: `₹${order.balanceAmount.toLocaleString('en-IN')}`,
      },
      type: 'ORDER_READY',
      customerId: order.customerId,
      orderId: order.id,
    })
  }

  /**
   * Send payment reminder
   */
  async sendPaymentReminder(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
      },
    })

    if (!order) throw new Error('Order not found')

    await this.sendTemplateMessage({
      to: order.customer.phone,
      templateName: 'payment_reminder',
      variables: {
        customer_name: order.customer.name,
        order_number: order.orderNumber,
        balance: `₹${order.balanceAmount.toLocaleString('en-IN')}`,
        delivery_date: order.deliveryDate.toLocaleDateString('en-IN'),
      },
      type: 'PAYMENT_REMINDER',
      customerId: order.customerId,
      orderId: order.id,
    })
  }

  /**
   * Send low stock alert to owner
   */
  async sendLowStockAlert(clothId: string): Promise<void> {
    const cloth = await prisma.clothInventory.findUnique({
      where: { id: clothId },
    })

    if (!cloth) throw new Error('Cloth not found')

    const owner = await prisma.user.findFirst({
      where: { role: 'OWNER' },
    })

    if (!owner?.phone) return

    const available = cloth.currentStock - cloth.reserved

    await this.sendTemplateMessage({
      to: owner.phone,
      templateName: 'low_stock_alert',
      variables: {
        item_name: cloth.name,
        available_stock: `${available.toFixed(2)}m`,
        minimum_stock: `${cloth.minimumStockMeters.toFixed(2)}m`,
      },
      type: 'CUSTOM',
    })
  }
}

// Export singleton instance
export const whatsappService = new WhatsAppService()
