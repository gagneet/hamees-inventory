'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RadialProgress } from './radial-progress'
import { WorkloadChart } from './workload-chart'
import { DeadlineList } from './deadline-list'
import { AlertCircle, Clock, CheckCircle, Scissors } from 'lucide-react'

interface TailorDashboardProps {
  stats: {
    inProgress: number
    dueToday: number
    overdue: number
    overdueList: any[]
    workloadByGarment: Array<{ name: string; count: number }>
    upcomingDeadlines: any[]
    dailyTarget: number
  }
}

export function TailorDashboard({ stats }: TailorDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Row 1: Focus Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Scissors className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats.inProgress}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently being worked on
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Due Today</CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{stats.dueToday}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Must be completed today
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.overdue}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Past delivery date
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Daily Target Progress & Workload */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily Target Progress</CardTitle>
            <CardDescription>Garments ready for pickup today</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center items-center py-4">
            <RadialProgress
              current={stats.dueToday}
              target={stats.dailyTarget}
              label="Ready Today"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workload by Garment Type</CardTitle>
            <CardDescription>Current in-progress items by type</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.workloadByGarment.length > 0 ? (
              <WorkloadChart data={stats.workloadByGarment} />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-500">
                <p>No active orders</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Upcoming Deadlines */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Deadlines (Next 7 Days)</CardTitle>
          <CardDescription>Orders sorted by priority and due date</CardDescription>
        </CardHeader>
        <CardContent>
          <DeadlineList orders={stats.upcomingDeadlines} />
        </CardContent>
      </Card>

      {/* Overdue Orders Alert */}
      {stats.overdueList.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-900 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Overdue Orders - Immediate Attention Required
            </CardTitle>
            <CardDescription className="text-red-700">
              These orders are past their delivery date
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeadlineList orders={stats.overdueList} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
