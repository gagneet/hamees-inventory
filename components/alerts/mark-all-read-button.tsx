'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function MarkAllReadButton() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

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
