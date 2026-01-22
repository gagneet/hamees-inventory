'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bell, AlertTriangle, Info, X, Clock } from 'lucide-react'

interface AlertCardProps {
  alert: {
    id: string
    type: string
    severity: string
    title: string
    message: string
    isRead: boolean
    relatedType: string | null
    relatedId: string | null
    createdAt: Date
  }
}

const severityConfig = {
  LOW: {
    icon: Info,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  MEDIUM: {
    icon: Bell,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
  },
  HIGH: {
    icon: AlertTriangle,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
  },
  CRITICAL: {
    icon: AlertTriangle,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
}

const typeLabels: Record<string, string> = {
  LOW_STOCK: 'Low Stock',
  CRITICAL_STOCK: 'Critical Stock',
  ORDER_DELAYED: 'Order Delayed',
  REORDER_REMINDER: 'Payment Reminder',
}

export function AlertCard({ alert }: AlertCardProps) {
  const router = useRouter()
  const [isDismissing, setIsDismissing] = useState(false)
  const config = severityConfig[alert.severity as keyof typeof severityConfig]
  const Icon = config.icon

  const handleCardClick = async () => {
    // Mark as read
    if (!alert.isRead) {
      await fetch(`/api/alerts/${alert.id}/read`, {
        method: 'PATCH',
      })
    }

    // Navigate to related item
    if (alert.relatedType === 'order' && alert.relatedId) {
      router.push(`/orders/${alert.relatedId}`)
    } else if (alert.relatedType === 'cloth' && alert.relatedId) {
      router.push('/inventory')
    } else if (alert.relatedType === 'accessory' && alert.relatedId) {
      router.push('/inventory')
    }
  }

  const handleDismiss = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click
    setIsDismissing(true)

    try {
      await fetch(`/api/alerts/${alert.id}/dismiss`, {
        method: 'POST',
      })
      router.refresh()
    } catch (error) {
      console.error('Error dismissing alert:', error)
      setIsDismissing(false)
    }
  }

  const handleMarkAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click

    try {
      await fetch(`/api/alerts/${alert.id}/read`, {
        method: 'PATCH',
      })
      router.refresh()
    } catch (error) {
      console.error('Error marking alert as read:', error)
    }
  }

  return (
    <Card
      onClick={handleCardClick}
      className={`border-l-4 ${config.border} ${
        !alert.isRead ? 'bg-white' : 'bg-slate-50'
      } cursor-pointer hover:shadow-md transition-shadow`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className={`p-2 rounded-full ${config.bg}`}>
              <Icon className={`h-5 w-5 ${config.color}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-base md:text-lg">
                  {alert.title}
                </CardTitle>
                {!alert.isRead && (
                  <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                )}
              </div>
              <CardDescription className="text-sm">
                {typeLabels[alert.type] || alert.type}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            disabled={isDismissing}
            title="Dismiss for 24 hours"
          >
            {isDismissing ? (
              <Clock className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-700 mb-3">{alert.message}</p>
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {new Date(alert.createdAt).toLocaleString('en-IN', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
          <div className="flex gap-2">
            {!alert.isRead && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAsRead}
              >
                Mark as Read
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
