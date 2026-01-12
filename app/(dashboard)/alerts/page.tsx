import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Bell, AlertTriangle, Info, CheckCircle, Home, X } from 'lucide-react'
import DashboardLayout from '@/components/DashboardLayout'

async function getAlerts() {
  try {
    const alerts = await prisma.alert.findMany({
      where: { isDismissed: false },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return alerts
  } catch (error) {
    console.error('Error fetching alerts:', error)
    return []
  }
}

export default async function AlertsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/')
  }

  const alerts = await getAlerts()
  const unreadCount = alerts.filter((a) => !a.isRead).length

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
    REORDER_REMINDER: 'Reorder Reminder',
  }

  return (
    <DashboardLayout>
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">
              <Home className="h-4 w-4" />
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Alerts</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Alerts</h1>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300">
            {unreadCount} unread alert{unreadCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <form action="/api/alerts/mark-all-read" method="POST">
              <Button variant="outline" size="sm">
                Mark All Read
              </Button>
            </form>
          )}
        </div>
      </div>

      {/* Main Content */}
        {alerts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">All Clear!</h3>
              <p className="text-slate-600">No alerts at the moment</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => {
              const config = severityConfig[alert.severity as keyof typeof severityConfig]
              const Icon = config.icon

              return (
                <Card
                  key={alert.id}
                  className={`border-l-4 ${config.border} ${!alert.isRead ? 'bg-white' : 'bg-slate-50'}`}
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
                      <Button variant="ghost" size="sm">
                        <X className="h-4 w-4" />
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
                          <Button variant="outline" size="sm">
                            Mark as Read
                          </Button>
                        )}
                        {alert.relatedType === 'INVENTORY' && alert.relatedId && (
                          <Button variant="default" size="sm" asChild>
                            <a href={`/inventory/${alert.relatedId}`}>View Item</a>
                          </Button>
                        )}
                        {alert.relatedType === 'ORDER' && alert.relatedId && (
                          <Button variant="default" size="sm" asChild>
                            <a href={`/orders/${alert.relatedId}`}>View Order</a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
    </DashboardLayout>
  )
}
