'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { hasPermission, type UserRole } from '@/lib/permissions'

export function MarkAllReadButton() {
  const router = useRouter()
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)

  // Marking alerts read changes shared state, so it needs manage_alerts (enforced by the API too)
  const canManageAlerts = !!session?.user?.role && hasPermission(session.user.role as UserRole, 'manage_alerts')
  if (!canManageAlerts) return null

  const handleMarkAllRead = async () => {
    setIsLoading(true)

    try {
      await fetch('/api/alerts/mark-all-read', {
        method: 'POST',
      })
      router.refresh()
    } catch (error) {
      console.error('Error marking all as read:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleMarkAllRead}
      disabled={isLoading}
    >
      {isLoading ? 'Marking...' : 'Mark All Read'}
    </Button>
  )
}
