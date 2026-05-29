'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MessageCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface SendWhatsAppButtonProps {
  orderId: string
  orderNumber: string
  customerPhone: string
  customerName: string
  orderStatus: string
}

export function SendWhatsAppButton({
  orderId,
  orderNumber,
  customerPhone,
  customerName,
  orderStatus,
}: SendWhatsAppButtonProps) {
  const [isSending, setIsSending] = useState(false)

  const handleSendUpdate = async () => {
    setIsSending(true)

    try {
      // Determine which template to use based on order status
      let templateName = 'order_ready'
      let type: 'ORDER_READY' | 'ORDER_CONFIRMATION' | 'PAYMENT_REMINDER' = 'ORDER_READY'

      if (orderStatus === 'READY') {
        templateName = 'order_ready'
        type = 'ORDER_READY'
      } else if (orderStatus === 'NEW' || orderStatus === 'MATERIAL_SELECTED') {
        templateName = 'order_confirmation'
        type = 'ORDER_CONFIRMATION'
      } else {
        // For other statuses, send a custom status update
        templateName = 'order_confirmation' // Fallback
        type = 'ORDER_CONFIRMATION'
      }

      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: customerPhone,
          templateName,
          type,
          orderId,
          variables: {
            customer_name: customerName,
            order_number: orderNumber,
            status: orderStatus,
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send WhatsApp update')
      }

      toast.success(`Order update sent to ${customerName} (${customerPhone})`)
    } catch (error) {
      console.error('Error sending WhatsApp update:', error)
      toast.error(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Button
      className="w-full"
      variant="outline"
      size="sm"
      onClick={handleSendUpdate}
      disabled={isSending || !customerPhone}
    >
      {isSending ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Sending...
        </>
      ) : (
        <>
          <MessageCircle className="h-4 w-4 mr-2" />
          Send WhatsApp Update
        </>
      )}
    </Button>
  )
}
