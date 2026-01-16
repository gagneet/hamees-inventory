'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Package } from 'lucide-react'

interface WorkloadItem {
  name: string
  count: number
}

interface WorkloadDetailsDialogProps {
  workload: WorkloadItem[]
  trigger: React.ReactNode
}

export function WorkloadDetailsDialog({ workload, trigger }: WorkloadDetailsDialogProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const totalItems = workload.reduce((sum, item) => sum + item.count, 0)

  const handleViewOrders = (garmentType: string) => {
    setOpen(false)
    // Navigate to orders page filtered by status and garment type
    router.push(`/orders?status=CUTTING,STITCHING,FINISHING&garmentType=${encodeURIComponent(garmentType)}`)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle className="text-slate-900">Workload Breakdown by Garment Type</DialogTitle>
          <DialogDescription className="text-slate-600">
            Current in-progress items (Cutting, Stitching, Finishing)
          </DialogDescription>
        </DialogHeader>

        {workload.length === 0 ? (
          <div className="py-8 text-center text-slate-500">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No active orders in production</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900">Total Items in Progress</span>
                <span className="text-2xl font-bold text-blue-600">{totalItems}</span>
              </div>
            </div>

            {workload.map((item, index) => {
              const percentage = totalItems > 0 ? (item.count / totalItems) * 100 : 0

              return (
                <div
                  key={index}
                  className="border rounded-lg p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-medium text-slate-900">{item.name}</h4>
                      <p className="text-sm text-slate-500 mt-1">
                        {item.count} item{item.count > 1 ? 's' : ''} ({percentage.toFixed(1)}% of
                        workload)
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-2xl font-bold text-slate-900">{item.count}</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-200 rounded-full h-2 mb-3">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewOrders(item.name)}
                    className="w-full"
                  >
                    View {item.name} Orders
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
