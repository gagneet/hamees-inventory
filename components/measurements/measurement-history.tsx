'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, Ruler, Eye, Edit, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface MeasurementHistoryProps {
  measurements: any[]
  customerId: string
}

export function MeasurementHistory({ measurements, customerId }: MeasurementHistoryProps) {
  const [selectedIds, setSelectedIds] = useState<[string, string] | null>(null)

  const handleCompare = async () => {
    if (!selectedIds || selectedIds.length !== 2) return

    const response = await fetch('/api/measurements/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        measurementId1: selectedIds[0],
        measurementId2: selectedIds[1],
      }),
    })

    if (response.ok) {
      const data = await response.json()
      // Show comparison modal or navigate to comparison page
      console.log('Comparison:', data)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this measurement?')) return

    const response = await fetch(`/api/measurements/${id}`, {
      method: 'DELETE',
    })

    if (response.ok) {
      window.location.reload()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Measurement History</h3>
        <Link href={`/customers/${customerId}/measurements/new`}>
          <Button size="sm">
            <Ruler className="h-4 w-4 mr-2" />
            New Measurement
          </Button>
        </Link>
      </div>

      {measurements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Ruler className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600">No measurements recorded yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {measurements.map((measurement) => (
            <Card key={measurement.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{measurement.garmentType}</CardTitle>
                    <CardDescription className="flex flex-col gap-1 mt-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {formatDate(measurement.createdAt)}
                      </div>
                      {measurement.createdBy && (
                        <div className="text-xs text-slate-500">
                          Created by: {measurement.createdBy.name}
                        </div>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/measurements/${measurement.id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href={`/measurements/${measurement.id}/edit`}>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(measurement.id)}
                    >
                      <Trash2 className="h-4 w-4 text-error" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  {measurement.chest && (
                    <div>
                      <span className="text-slate-500">Chest:</span>
                      <span className="ml-2 font-semibold">{measurement.chest} cm</span>
                    </div>
                  )}
                  {measurement.waist && (
                    <div>
                      <span className="text-slate-500">Waist:</span>
                      <span className="ml-2 font-semibold">{measurement.waist} cm</span>
                    </div>
                  )}
                  {measurement.shoulder && (
                    <div>
                      <span className="text-slate-500">Shoulder:</span>
                      <span className="ml-2 font-semibold">{measurement.shoulder} cm</span>
                    </div>
                  )}
                  {measurement.sleeveLength && (
                    <div>
                      <span className="text-slate-500">Sleeve:</span>
                      <span className="ml-2 font-semibold">{measurement.sleeveLength} cm</span>
                    </div>
                  )}
                </div>
                {measurement.notes && (
                  <p className="text-sm text-slate-600 mt-3 italic">
                    Note: {measurement.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
