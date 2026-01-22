'use client'

import { useEffect, useState } from 'react'
import { RoleDashboardRouter } from './role-dashboard-router'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

interface DashboardClientProps {
  userRole: string
}

export function DashboardClient({ userRole }: DashboardClientProps) {
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const response = await fetch('/api/dashboard/enhanced-stats')

        if (!response.ok) {
          throw new Error('Failed to fetch dashboard data')
        }

        const data = await response.json()
        setDashboardData(data)
      } catch (err) {
        console.error('Error fetching dashboard:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error || !dashboardData) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-900">Error Loading Dashboard</CardTitle>
          <CardDescription className="text-red-700">
            {error || 'Failed to load dashboard statistics'}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return <RoleDashboardRouter userRole={userRole} dashboardData={dashboardData} />
}
