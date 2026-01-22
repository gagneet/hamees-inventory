'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Ruler, Edit, Trash2, History, Loader2, Camera } from 'lucide-react'
import { MeasurementEditDialog } from '@/components/measurement-edit-dialog'
import { MeasurementHistoryDialog } from '@/components/measurement-history-dialog'

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

interface CustomerMeasurementsSectionProps {
  customerId: string
  measurements: Measurement[]
  canManage: boolean
  highlight?: string
}

export function CustomerMeasurementsSection({
  customerId,
  measurements,
  canManage,
  highlight,
}: CustomerMeasurementsSectionProps) {
  const router = useRouter()
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedMeasurement, setSelectedMeasurement] = useState<Measurement | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleEdit = (measurement: Measurement) => {
    setSelectedMeasurement(measurement)
    setEditDialogOpen(true)
  }

  const handleViewHistory = (measurement: Measurement) => {
    setSelectedMeasurement(measurement)
    setHistoryDialogOpen(true)
  }

  const handleDeleteClick = (measurement: Measurement) => {
    setSelectedMeasurement(measurement)
    setDeleteError(null)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedMeasurement) return

    setDeleting(true)
    setDeleteError(null)

    try {
      const response = await fetch(
        `/api/customers/${customerId}/measurements/${selectedMeasurement.id}`,
        {
          method: 'DELETE',
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete measurement')
      }

      setDeleteDialogOpen(false)
      router.refresh()
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setDeleting(false)
    }
  }

  const garmentTypeLabels: Record<string, string> = {
    SHIRT: 'Shirt',
    TROUSER: 'Trouser',
    SUIT: 'Suit',
    SHERWANI: 'Sherwani',
  }

  return (
    <>
      <Card id="measurements" className={highlight === 'measurements' ? 'ring-2 ring-primary' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Ruler className="h-5 w-5" />
              Measurements
            </CardTitle>
            {canManage && (
              <div className="flex gap-2">
                <Link href={`/customers/${customerId}/visual-measurements`}>
                  <Button
                    size="sm"
                    variant="default"
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Visual Tool
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedMeasurement(null)
                    setEditDialogOpen(true)
                  }}
                >
                  Add
                </Button>
              </div>
            )}
          </div>
          <CardDescription>{measurements.length} measurement records</CardDescription>
        </CardHeader>
        <CardContent>
          {measurements.length === 0 ? (
            <div className="py-8 text-center">
              <Ruler className="h-12 w-12 text-slate-400 mx-auto mb-3" />
              <p className="text-sm text-slate-600 mb-4">No measurements yet</p>
              {canManage && (
                <div className="flex gap-2 justify-center">
                  <Link href={`/customers/${customerId}/visual-measurements`}>
                    <Button
                      size="sm"
                      variant="default"
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Use Visual Tool
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedMeasurement(null)
                      setEditDialogOpen(true)
                    }}
                  >
                    Add Manually
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {measurements.map((measurement) => (
                <div
                  key={measurement.id}
                  className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">
                          {garmentTypeLabels[measurement.garmentType]}
                        </p>
                        {measurement.isActive && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                            Active
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 mt-1">
                        <p className="text-xs text-slate-500">
                          {new Date(measurement.createdAt).toLocaleDateString('en-IN', {
                            dateStyle: 'medium',
                          })}
                        </p>
                        {measurement.createdBy && (
                          <p className="text-xs text-slate-500">
                            Created by {measurement.createdBy.name}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {measurement.bodyType && (
                        <Badge variant="outline" className="text-xs">
                          {measurement.bodyType}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Measurements Grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
                    {measurement.chest && (
                      <div>
                        <span className="text-slate-500">Chest:</span>{' '}
                        <span className="font-medium">{measurement.chest} cm</span>
                      </div>
                    )}
                    {measurement.waist && (
                      <div>
                        <span className="text-slate-500">Waist:</span>{' '}
                        <span className="font-medium">{measurement.waist} cm</span>
                      </div>
                    )}
                    {measurement.shoulder && (
                      <div>
                        <span className="text-slate-500">Shoulder:</span>{' '}
                        <span className="font-medium">{measurement.shoulder} cm</span>
                      </div>
                    )}
                    {measurement.sleeveLength && (
                      <div>
                        <span className="text-slate-500">Sleeve:</span>{' '}
                        <span className="font-medium">{measurement.sleeveLength} cm</span>
                      </div>
                    )}
                    {measurement.neck && (
                      <div>
                        <span className="text-slate-500">Neck:</span>{' '}
                        <span className="font-medium">{measurement.neck} cm</span>
                      </div>
                    )}
                    {measurement.hip && (
                      <div>
                        <span className="text-slate-500">Hip:</span>{' '}
                        <span className="font-medium">{measurement.hip} cm</span>
                      </div>
                    )}
                    {measurement.inseam && (
                      <div>
                        <span className="text-slate-500">Inseam:</span>{' '}
                        <span className="font-medium">{measurement.inseam} cm</span>
                      </div>
                    )}
                    {measurement.shirtLength && (
                      <div>
                        <span className="text-slate-500">Shirt Length:</span>{' '}
                        <span className="font-medium">{measurement.shirtLength} cm</span>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {measurement.notes && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-slate-600">{measurement.notes}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {canManage && (
                    <div className="mt-3 pt-3 border-t flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleViewHistory(measurement)}
                        className="text-xs"
                      >
                        <History className="h-3 w-3 mr-1" />
                        History
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(measurement)}
                        className="text-xs"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteClick(measurement)}
                        className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <MeasurementEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        customerId={customerId}
        measurement={selectedMeasurement}
        mode={selectedMeasurement ? 'edit' : 'create'}
      />

      {/* History Dialog */}
      {selectedMeasurement && (
        <MeasurementHistoryDialog
          open={historyDialogOpen}
          onOpenChange={setHistoryDialogOpen}
          customerId={customerId}
          measurementId={selectedMeasurement.id}
          currentMeasurement={selectedMeasurement}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Measurement?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this{' '}
              {selectedMeasurement && garmentTypeLabels[selectedMeasurement.garmentType]}{' '}
              measurement? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {deleteError}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDeleteConfirm()
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
