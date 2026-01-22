'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { VisualMeasurementTool } from '@/components/measurements/visual-measurement-tool'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Home, ArrowLeft, User } from 'lucide-react'

interface VisualMeasurementClientProps {
  customerId: string
  customerName: string
  customerPhone: string
  existingMeasurements: any[]
  session: any
}

export function VisualMeasurementClient({
  customerId,
  customerName,
  customerPhone,
  existingMeasurements,
  session,
}: VisualMeasurementClientProps) {
  const router = useRouter()

  const handleSave = () => {
    // Refresh and redirect back to customer detail page
    router.push(`/customers/${customerId}?highlight=measurements`)
    router.refresh()
  }

  const handleClose = () => {
    router.push(`/customers/${customerId}`)
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
            <BreadcrumbLink href="/customers">Customers</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/customers/${customerId}`}>{customerName}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Visual Measurements</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href={`/customers/${customerId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Customer
            </Button>
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <VisualMeasurementTool
          customerId={customerId}
          customerName={customerName}
          existingMeasurements={existingMeasurements}
          onSave={handleSave}
          onClose={handleClose}
        />
      </div>

      {/* User Info Footer */}
      <div className="mt-6 text-sm text-slate-500 flex items-center gap-2">
        <User className="h-4 w-4" />
        Logged in as {session.user.name} ({session.user.role})
      </div>
    </DashboardLayout>
  )
}
