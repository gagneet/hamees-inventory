'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Clock, User, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

interface Measurement {
  id: string
  garmentType: string
  bodyType?: string | null
  neck?: number | null
  chest?: number | null
  waist?: number | null
  hip?: number | null
  shoulder?: number | null
  sleeveLength?: number | null
  shirtLength?: number | null
  inseam?: number | null
  outseam?: number | null
  thigh?: number | null
  knee?: number | null
  bottomOpening?: number | null
  jacketLength?: number | null
  lapelWidth?: number | null
  notes?: string | null
  isActive: boolean
  createdAt: string
  createdBy?: {
    id: string
    name: string
    email: string
  } | null
}

interface MeasurementHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: string
  measurementId: string
  currentMeasurement?: Measurement
}

export function MeasurementHistoryDialog({
  open,
  onOpenChange,
  customerId,
  measurementId,
  currentMeasurement,
}: MeasurementHistoryDialogProps) {
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState<Measurement[]>([])
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set([measurementId]))

  useEffect(() => {
    if (open) {
      fetchHistory()
    }
  }, [open, measurementId])

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/customers/${customerId}/measurements/${measurementId}/history`
      )
      const data = await response.json()

      if (response.ok) {
        setHistory(data.history || [])
      }
    } catch (error) {
      console.error('Error fetching measurement history:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedVersions((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const measurementFields = [
    { key: 'bodyType', label: 'Body Type' },
    { key: 'neck', label: 'Neck', unit: 'cm' },
    { key: 'chest', label: 'Chest', unit: 'cm' },
    { key: 'waist', label: 'Waist', unit: 'cm' },
    { key: 'hip', label: 'Hip', unit: 'cm' },
    { key: 'shoulder', label: 'Shoulder', unit: 'cm' },
    { key: 'sleeveLength', label: 'Sleeve Length', unit: 'cm' },
    { key: 'shirtLength', label: 'Shirt Length', unit: 'cm' },
    { key: 'inseam', label: 'Inseam', unit: 'cm' },
    { key: 'outseam', label: 'Outseam', unit: 'cm' },
    { key: 'thigh', label: 'Thigh', unit: 'cm' },
    { key: 'knee', label: 'Knee', unit: 'cm' },
    { key: 'bottomOpening', label: 'Bottom Opening', unit: 'cm' },
    { key: 'jacketLength', label: 'Jacket Length', unit: 'cm' },
    { key: 'lapelWidth', label: 'Lapel Width', unit: 'cm' },
  ]

  const renderMeasurementComparison = (current: Measurement, previous?: Measurement) => {
    const changedFields: string[] = []

    if (previous) {
      measurementFields.forEach(({ key }) => {
        const currentVal = (current as any)[key]
        const previousVal = (previous as any)[key]
        if (currentVal !== previousVal) {
          changedFields.push(key)
        }
      })
    }

    return (
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {measurementFields.map(({ key, label, unit }) => {
          const value = (current as any)[key]
          const isChanged = changedFields.includes(key)

          if (!value && value !== 0) return null

          return (
            <div
              key={key}
              className={`flex justify-between ${isChanged ? 'bg-yellow-50 -mx-2 px-2 py-1 rounded' : ''}`}
            >
              <span className="text-slate-600">{label}:</span>
              <span className={`font-medium ${isChanged ? 'text-orange-600' : 'text-slate-900'}`}>
                {value}
                {unit && ` ${unit}`}
                {isChanged && previous && (
                  <span className="ml-2 text-xs text-slate-500 line-through">
                    {(previous as any)[key]}
                    {unit && ` ${unit}`}
                  </span>
                )}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  const garmentTypeLabels: Record<string, string> = {
    SHIRT: 'Shirt',
    TROUSER: 'Trouser',
    SUIT: 'Suit',
    SHERWANI: 'Sherwani',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Measurement History</DialogTitle>
          <DialogDescription>
            View all versions of this measurement. Changed values are highlighted.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-400" />
            <p className="text-sm text-slate-600 mt-3">Loading history...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="py-12 text-center">
            <Clock className="h-12 w-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600">No history available</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Timeline */}
            <div className="relative space-y-4">
              {history.map((measurement, index) => {
                const isExpanded = expandedVersions.has(measurement.id)
                const previousMeasurement = history[index + 1]

                return (
                  <div key={measurement.id} className="relative">
                    {/* Timeline Line */}
                    {index < history.length - 1 && (
                      <div className="absolute left-[15px] top-[40px] bottom-[-16px] w-0.5 bg-slate-200" />
                    )}

                    {/* Timeline Node */}
                    <div className="flex gap-4">
                      <div
                        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          measurement.isActive
                            ? 'bg-primary text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        <Clock className="h-4 w-4" />
                      </div>

                      {/* Content Card */}
                      <div className="flex-1 border border-slate-200 rounded-lg">
                        {/* Header */}
                        <button
                          onClick={() => toggleExpand(measurement.id)}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors rounded-t-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-left">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-900">
                                  {garmentTypeLabels[measurement.garmentType]}
                                </span>
                                {measurement.isActive && (
                                  <Badge className="bg-green-100 text-green-700 border-green-200">
                                    Current
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 mt-1">
                                {new Date(measurement.createdAt).toLocaleString('en-IN', {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                })}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {measurement.createdBy && (
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <User className="h-4 w-4" />
                                {measurement.createdBy.name}
                              </div>
                            )}
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5 text-slate-400" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-slate-400" />
                            )}
                          </div>
                        </button>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="px-4 pb-4 border-t border-slate-100">
                            <div className="mt-4">
                              {renderMeasurementComparison(measurement, previousMeasurement)}
                            </div>

                            {measurement.notes && (
                              <div className="mt-4 pt-4 border-t border-slate-100">
                                <p className="text-xs text-slate-500 mb-1">Notes:</p>
                                <p className="text-sm text-slate-700">{measurement.notes}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {history.length > 1 && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Total Versions:</strong> {history.length}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Changed values are highlighted with the previous value shown as strikethrough.
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
