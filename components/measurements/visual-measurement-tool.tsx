'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Ruler, Save, X, CheckCircle2, AlertCircle, Info, History } from 'lucide-react'
import { toast } from 'sonner'
import { useState as useHistoryState } from 'react'

interface VisualMeasurementToolProps {
  customerId: string
  customerName: string
  existingMeasurements?: any[]
  onSave?: () => void
  onClose?: () => void
}

interface MeasurementPoint {
  id: string
  label: string
  labelPunjabi?: string
  x: number // Position on SVG diagram
  y: number
  value: number | null
  unit: 'cm' | 'inch'
  required: boolean
  helpText: string
}

export function VisualMeasurementTool({
  customerId,
  customerName,
  existingMeasurements = [],
  onSave,
  onClose,
}: VisualMeasurementToolProps) {
  const [selectedGarment, setSelectedGarment] = useState<'Shirt' | 'Trouser' | 'Suit' | 'Sherwani'>('Shirt')
  const [bodyType, setBodyType] = useState<'SLIM' | 'REGULAR' | 'LARGE' | 'XL'>('REGULAR')
  const [measurements, setMeasurements] = useState<Record<string, MeasurementPoint>>({})
  const [saving, setSaving] = useState(false)
  const [activePoint, setActivePoint] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [measurementHistory, setMeasurementHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Initialize measurements from existing data
  useEffect(() => {
    const existing = existingMeasurements.find(m => m.garmentType === selectedGarment)
    if (existing) {
      setBodyType(existing.bodyType || 'REGULAR')
      setNotes(existing.notes || '')

      // Populate measurements
      const measurementConfig = getMeasurementConfig(selectedGarment)
      const populated: Record<string, MeasurementPoint> = {}

      Object.entries(measurementConfig).forEach(([key, config]) => {
        populated[key] = {
          ...config,
          value: existing[config.id] || null,
        }
      })

      setMeasurements(populated)
    } else {
      // Initialize with empty measurements
      const measurementConfig = getMeasurementConfig(selectedGarment)
      const initialized: Record<string, MeasurementPoint> = {}

      Object.entries(measurementConfig).forEach(([key, config]) => {
        initialized[key] = {
          ...config,
          value: null,
        }
      })

      setMeasurements(initialized)
    }
  }, [selectedGarment, existingMeasurements])

  const handleMeasurementChange = (pointId: string, value: string) => {
    const numValue = value === '' ? null : parseFloat(value)

    setMeasurements(prev => ({
      ...prev,
      [pointId]: {
        ...prev[pointId],
        value: numValue,
      },
    }))
  }

  const handleSave = async () => {
    setSaving(true)

    try {
      // Validate required fields
      const missingRequired = Object.values(measurements).filter(
        m => m.required && (m.value === null || m.value === 0)
      )

      if (missingRequired.length > 0) {
        toast.error(`Please fill in all required measurements: ${missingRequired.map(m => m.label).join(', ')}`)
        setSaving(false)
        return
      }

      // Prepare data for API
      const measurementData: any = {
        customerId,
        garmentType: selectedGarment,
        bodyType,
        notes,
        isActive: true,
      }

      // Map measurements to schema fields
      Object.entries(measurements).forEach(([key, point]) => {
        if (point.value !== null) {
          measurementData[point.id] = point.value
        }
      })

      // Save to API
      const response = await fetch(`/api/customers/${customerId}/measurements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(measurementData),
      })

      if (!response.ok) {
        throw new Error('Failed to save measurements')
      }

      toast.success(`${selectedGarment} measurements saved successfully!`)

      if (onSave) {
        onSave()
      }
    } catch (error) {
      console.error('Error saving measurements:', error)
      toast.error('Failed to save measurements. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const fetchMeasurementHistory = async () => {
    setLoadingHistory(true)
    setHistoryDialogOpen(true)

    try {
      const response = await fetch(`/api/customers/${customerId}/measurements?garmentType=${selectedGarment}`)
      const data = await response.json()

      // Filter only for the selected garment type and sort by date
      const history = data.measurements
        ?.filter((m: any) => m.garmentType === selectedGarment)
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) || []

      setMeasurementHistory(history)
    } catch (error) {
      console.error('Error fetching measurement history:', error)
      toast.error('Failed to load measurement history')
    } finally {
      setLoadingHistory(false)
    }
  }

  const calculateChanges = (current: any, previous: any) => {
    if (!current || !previous) return []

    const changes: string[] = []
    const fields = ['neck', 'chest', 'waist', 'hip', 'shoulder', 'sleeveLength', 'shirtLength', 'inseam', 'outseam', 'thigh', 'knee', 'bottomOpening', 'jacketLength', 'lapelWidth']

    fields.forEach(field => {
      if (current[field] !== null && previous[field] !== null && current[field] !== previous[field]) {
        const diff = current[field] - previous[field]
        changes.push(`${field}: ${previous[field]}cm → ${current[field]}cm (${diff > 0 ? '+' : ''}${diff.toFixed(1)}cm)`)
      }
    })

    if (current.bodyType !== previous.bodyType) {
      changes.push(`Body Type: ${previous.bodyType} → ${current.bodyType}`)
    }

    return changes
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Ruler className="h-6 w-6 text-blue-600" />
            Visual Measurement Tool
          </h2>
          <p className="text-slate-600 mt-1">
            For <span className="font-semibold">{customerName}</span> - Click on measurement points to enter values
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Garment Type Selector */}
      <Tabs value={selectedGarment} onValueChange={(v) => setSelectedGarment(v as any)}>
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="Shirt">Shirt / ਕਮੀਜ਼</TabsTrigger>
          <TabsTrigger value="Trouser">Trouser / ਪੈਂਟ</TabsTrigger>
          <TabsTrigger value="Suit">Suit / ਸੂਟ</TabsTrigger>
          <TabsTrigger value="Sherwani">Sherwani / ਸ਼ੇਰਵਾਨੀ</TabsTrigger>
        </TabsList>

        {/* Shirt Tab */}
        <TabsContent value="Shirt" className="space-y-6">
          <ShirtMeasurementDiagram
            measurements={measurements}
            activePoint={activePoint}
            onPointClick={setActivePoint}
            onMeasurementChange={handleMeasurementChange}
            bodyType={bodyType}
            onBodyTypeChange={setBodyType}
            notes={notes}
            onNotesChange={setNotes}
          />
        </TabsContent>

        {/* Trouser Tab */}
        <TabsContent value="Trouser" className="space-y-6">
          <TrouserMeasurementDiagram
            measurements={measurements}
            activePoint={activePoint}
            onPointClick={setActivePoint}
            onMeasurementChange={handleMeasurementChange}
            bodyType={bodyType}
            onBodyTypeChange={setBodyType}
            notes={notes}
            onNotesChange={setNotes}
          />
        </TabsContent>

        {/* Suit Tab */}
        <TabsContent value="Suit" className="space-y-6">
          <SuitMeasurementDiagram
            measurements={measurements}
            activePoint={activePoint}
            onPointClick={setActivePoint}
            onMeasurementChange={handleMeasurementChange}
            bodyType={bodyType}
            onBodyTypeChange={setBodyType}
            notes={notes}
            onNotesChange={setNotes}
          />
        </TabsContent>

        {/* Sherwani Tab */}
        <TabsContent value="Sherwani" className="space-y-6">
          <SherwaniMeasurementDiagram
            measurements={measurements}
            activePoint={activePoint}
            onPointClick={setActivePoint}
            onMeasurementChange={handleMeasurementChange}
            bodyType={bodyType}
            onBodyTypeChange={setBodyType}
            notes={notes}
            onNotesChange={setNotes}
          />
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-6 border-t">
        <Alert className="flex-1 mr-4">
          <Info className="h-4 w-4" />
          <AlertDescription>
            All measurements are in <strong>centimeters (cm)</strong>. Click on the diagram points to enter values.
          </AlertDescription>
        </Alert>
        <div className="flex gap-3">
          {existingMeasurements && existingMeasurements.filter(m => m.garmentType === selectedGarment).length > 0 && (
            <Button variant="outline" onClick={fetchMeasurementHistory}>
              <History className="h-4 w-4 mr-2" />
              View History
            </Button>
          )}
          {onClose && (
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving} className="min-w-32">
            {saving ? (
              <>Saving...</>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Measurements
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Measurement History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              {selectedGarment} Measurement History - {customerName}
            </DialogTitle>
            <DialogDescription>
              View all previous measurements and changes for this garment type
            </DialogDescription>
          </DialogHeader>

          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-slate-500">Loading history...</p>
            </div>
          ) : measurementHistory.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-slate-500">No measurement history available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {measurementHistory.map((measurement, index) => {
                const isActive = measurement.isActive
                const previous = measurementHistory[index + 1]
                const changes = previous ? calculateChanges(measurement, previous) : []

                return (
                  <div
                    key={measurement.id}
                    className={`p-4 rounded-lg border ${
                      isActive ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900">
                            {new Date(measurement.createdAt).toLocaleDateString('en-IN', {
                              dateStyle: 'long',
                            })}
                          </p>
                          {isActive && (
                            <Badge className="bg-blue-600 text-white">Current</Badge>
                          )}
                        </div>
                        {measurement.createdBy && (
                          <p className="text-xs text-slate-500 mt-1">
                            Measured by {measurement.createdBy.name}
                          </p>
                        )}
                      </div>
                      {measurement.bodyType && (
                        <Badge variant="outline">{measurement.bodyType}</Badge>
                      )}
                    </div>

                    {/* Show changes if not the first measurement */}
                    {changes.length > 0 && (
                      <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded">
                        <p className="text-sm font-medium text-amber-900 mb-2">
                          Changes from previous measurement:
                        </p>
                        <ul className="text-xs text-amber-800 space-y-1">
                          {changes.map((change, idx) => (
                            <li key={idx}>• {change}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Measurement values grid */}
                    <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
                      {measurement.neck && (
                        <div>
                          <span className="text-slate-500">Neck:</span>{' '}
                          <span className="font-medium">{measurement.neck} cm</span>
                        </div>
                      )}
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
                      {measurement.hip && (
                        <div>
                          <span className="text-slate-500">Hip:</span>{' '}
                          <span className="font-medium">{measurement.hip} cm</span>
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
                      {measurement.shirtLength && (
                        <div>
                          <span className="text-slate-500">Shirt Length:</span>{' '}
                          <span className="font-medium">{measurement.shirtLength} cm</span>
                        </div>
                      )}
                      {measurement.inseam && (
                        <div>
                          <span className="text-slate-500">Inseam:</span>{' '}
                          <span className="font-medium">{measurement.inseam} cm</span>
                        </div>
                      )}
                      {measurement.outseam && (
                        <div>
                          <span className="text-slate-500">Outseam:</span>{' '}
                          <span className="font-medium">{measurement.outseam} cm</span>
                        </div>
                      )}
                      {measurement.jacketLength && (
                        <div>
                          <span className="text-slate-500">Jacket Length:</span>{' '}
                          <span className="font-medium">{measurement.jacketLength} cm</span>
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    {measurement.notes && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs font-medium text-slate-600 mb-1">Notes:</p>
                        <p className="text-xs text-slate-600">{measurement.notes}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setHistoryDialogOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Measurement configuration helper
function getMeasurementConfig(garmentType: string): Record<string, Omit<MeasurementPoint, 'value'>> {
  const configs: Record<string, Record<string, Omit<MeasurementPoint, 'value'>>> = {
    Shirt: {
      neck: {
        id: 'neck',
        label: 'Neck',
        labelPunjabi: 'ਗਰਦਨ',
        x: 50,
        y: 15,
        unit: 'cm',
        required: true,
        helpText: 'Measure around the neck at collar height, below Adam\'s apple',
      },
      chest: {
        id: 'chest',
        label: 'Chest',
        labelPunjabi: 'ਛਾਤੀ',
        x: 50,
        y: 30,
        unit: 'cm',
        required: true,
        helpText: 'Measure around the fullest part of the chest, under armpits',
      },
      waist: {
        id: 'waist',
        label: 'Waist',
        labelPunjabi: 'ਕਮਰ',
        x: 50,
        y: 45,
        unit: 'cm',
        required: true,
        helpText: 'Measure around the natural waistline',
      },
      shoulder: {
        id: 'shoulder',
        label: 'Shoulder Width',
        labelPunjabi: 'ਮੋਢਾ',
        x: 30,
        y: 20,
        unit: 'cm',
        required: true,
        helpText: 'Measure from shoulder edge to shoulder edge across the back',
      },
      sleeveLength: {
        id: 'sleeveLength',
        label: 'Sleeve Length',
        labelPunjabi: 'ਆਸਤੀਨ ਲੰਬਾਈ',
        x: 20,
        y: 40,
        unit: 'cm',
        required: true,
        helpText: 'Measure from shoulder edge to wrist with arm slightly bent',
      },
      shirtLength: {
        id: 'shirtLength',
        label: 'Shirt Length',
        labelPunjabi: 'ਕਮੀਜ਼ ਲੰਬਾਈ',
        x: 50,
        y: 70,
        unit: 'cm',
        required: true,
        helpText: 'Measure from neck to desired shirt hem length',
      },
    },
    Trouser: {
      waist: {
        id: 'waist',
        label: 'Waist',
        labelPunjabi: 'ਕਮਰ',
        x: 50,
        y: 20,
        unit: 'cm',
        required: true,
        helpText: 'Measure around waist where trousers will sit',
      },
      hip: {
        id: 'hip',
        label: 'Hip',
        labelPunjabi: 'ਕੁੱਲ੍ਹੇ',
        x: 50,
        y: 35,
        unit: 'cm',
        required: true,
        helpText: 'Measure around the fullest part of hips',
      },
      inseam: {
        id: 'inseam',
        label: 'Inseam',
        labelPunjabi: 'ਅੰਦਰਲੀ ਸੀਵਨ',
        x: 40,
        y: 60,
        unit: 'cm',
        required: true,
        helpText: 'Measure from crotch to ankle along inner leg',
      },
      outseam: {
        id: 'outseam',
        label: 'Outseam',
        labelPunjabi: 'ਬਾਹਰੀ ਸੀਵਨ',
        x: 60,
        y: 50,
        unit: 'cm',
        required: true,
        helpText: 'Measure from waistband to ankle along outer leg',
      },
      thigh: {
        id: 'thigh',
        label: 'Thigh',
        labelPunjabi: 'ਪੱਟ',
        x: 50,
        y: 45,
        unit: 'cm',
        required: false,
        helpText: 'Measure around the fullest part of thigh',
      },
      knee: {
        id: 'knee',
        label: 'Knee',
        labelPunjabi: 'ਗੋਡਾ',
        x: 50,
        y: 65,
        unit: 'cm',
        required: false,
        helpText: 'Measure around the knee',
      },
      bottomOpening: {
        id: 'bottomOpening',
        label: 'Bottom Opening',
        labelPunjabi: 'ਹੇਠਾਂ',
        x: 50,
        y: 85,
        unit: 'cm',
        required: false,
        helpText: 'Measure around the ankle opening',
      },
    },
    Suit: {
      neck: {
        id: 'neck',
        label: 'Neck',
        labelPunjabi: 'ਗਰਦਨ',
        x: 50,
        y: 15,
        unit: 'cm',
        required: true,
        helpText: 'Measure around the neck at collar height',
      },
      chest: {
        id: 'chest',
        label: 'Chest',
        labelPunjabi: 'ਛਾਤੀ',
        x: 50,
        y: 30,
        unit: 'cm',
        required: true,
        helpText: 'Measure around the fullest part of the chest',
      },
      waist: {
        id: 'waist',
        label: 'Waist',
        labelPunjabi: 'ਕਮਰ',
        x: 50,
        y: 45,
        unit: 'cm',
        required: true,
        helpText: 'Measure around the natural waistline',
      },
      shoulder: {
        id: 'shoulder',
        label: 'Shoulder Width',
        labelPunjabi: 'ਮੋਢਾ',
        x: 30,
        y: 20,
        unit: 'cm',
        required: true,
        helpText: 'Measure from shoulder edge to shoulder edge',
      },
      sleeveLength: {
        id: 'sleeveLength',
        label: 'Sleeve Length',
        labelPunjabi: 'ਆਸਤੀਨ',
        x: 20,
        y: 40,
        unit: 'cm',
        required: true,
        helpText: 'Measure from shoulder to wrist',
      },
      jacketLength: {
        id: 'jacketLength',
        label: 'Jacket Length',
        labelPunjabi: 'ਜੈਕਟ ਲੰਬਾਈ',
        x: 50,
        y: 65,
        unit: 'cm',
        required: true,
        helpText: 'Measure from neck to desired jacket hem',
      },
      lapelWidth: {
        id: 'lapelWidth',
        label: 'Lapel Width',
        labelPunjabi: 'ਲੈਪਲ ਚੌੜਾਈ',
        x: 40,
        y: 25,
        unit: 'cm',
        required: false,
        helpText: 'Measure the desired width of the lapel',
      },
    },
    Sherwani: {
      neck: {
        id: 'neck',
        label: 'Neck',
        labelPunjabi: 'ਗਰਦਨ',
        x: 50,
        y: 15,
        unit: 'cm',
        required: true,
        helpText: 'Measure around the neck at collar height',
      },
      chest: {
        id: 'chest',
        label: 'Chest',
        labelPunjabi: 'ਛਾਤੀ',
        x: 50,
        y: 30,
        unit: 'cm',
        required: true,
        helpText: 'Measure around the fullest part of the chest',
      },
      waist: {
        id: 'waist',
        label: 'Waist',
        labelPunjabi: 'ਕਮਰ',
        x: 50,
        y: 45,
        unit: 'cm',
        required: true,
        helpText: 'Measure around the natural waistline',
      },
      shoulder: {
        id: 'shoulder',
        label: 'Shoulder Width',
        labelPunjabi: 'ਮੋਢਾ',
        x: 30,
        y: 20,
        unit: 'cm',
        required: true,
        helpText: 'Measure from shoulder edge to shoulder edge',
      },
      sleeveLength: {
        id: 'sleeveLength',
        label: 'Sleeve Length',
        labelPunjabi: 'ਆਸਤੀਨ',
        x: 20,
        y: 40,
        unit: 'cm',
        required: true,
        helpText: 'Measure from shoulder to wrist',
      },
      jacketLength: {
        id: 'jacketLength',
        label: 'Sherwani Length',
        labelPunjabi: 'ਸ਼ੇਰਵਾਨੀ ਲੰਬਾਈ',
        x: 50,
        y: 75,
        unit: 'cm',
        required: true,
        helpText: 'Measure from neck to desired sherwani hem (usually knee-length)',
      },
    },
  }

  return configs[garmentType] || {}
}

// Individual diagram components will be created next
function ShirtMeasurementDiagram(props: any) {
  return <MeasurementDiagramBase {...props} garmentType="Shirt" />
}

function TrouserMeasurementDiagram(props: any) {
  return <MeasurementDiagramBase {...props} garmentType="Trouser" />
}

function SuitMeasurementDiagram(props: any) {
  return <MeasurementDiagramBase {...props} garmentType="Suit" />
}

function SherwaniMeasurementDiagram(props: any) {
  return <MeasurementDiagramBase {...props} garmentType="Sherwani" />
}

// Base diagram component
function MeasurementDiagramBase({
  measurements,
  activePoint,
  onPointClick,
  onMeasurementChange,
  bodyType,
  onBodyTypeChange,
  notes,
  onNotesChange,
  garmentType,
}: any) {
  const measurementList = Object.entries(measurements) as [string, MeasurementPoint][]
  const filled = measurementList.filter(([_, m]) => m.value !== null).length
  const total = measurementList.length
  const required = measurementList.filter(([_, m]) => m.required).length
  const requiredFilled = measurementList.filter(([_, m]) => m.required && m.value !== null).length

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Left: Visual Diagram */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Interactive Diagram</CardTitle>
          <CardDescription>Click on the highlighted points to enter measurements</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {garmentType === 'Shirt' && <ShirtDiagramSVG measurements={measurements} activePoint={activePoint} onPointClick={onPointClick} />}
            {garmentType === 'Trouser' && <TrouserDiagramSVG measurements={measurements} activePoint={activePoint} onPointClick={onPointClick} />}
            {garmentType === 'Suit' && <SuitDiagramSVG measurements={measurements} activePoint={activePoint} onPointClick={onPointClick} />}
            {garmentType === 'Sherwani' && <SherwaniDiagramSVG measurements={measurements} activePoint={activePoint} onPointClick={onPointClick} />}
          </div>

          {/* Progress */}
          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Progress</span>
              <span className="font-medium">
                {filled}/{total} measurements
              </span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${(filled / total) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Required: {requiredFilled}/{required}</span>
              {requiredFilled === required && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  All required filled
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Right: Measurement Inputs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Measurements</CardTitle>
          <CardDescription>Enter values in centimeters (cm)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Body Type Selector */}
          <div className="space-y-2">
            <Label>Body Type / ਸਰੀਰ ਦੀ ਕਿਸਮ</Label>
            <Select value={bodyType} onValueChange={onBodyTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SLIM">Slim / ਪਤਲਾ</SelectItem>
                <SelectItem value="REGULAR">Regular / ਨਿਯਮਤ</SelectItem>
                <SelectItem value="LARGE">Large / ਵੱਡਾ</SelectItem>
                <SelectItem value="XL">Extra Large / ਬਹੁਤ ਵੱਡਾ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Measurement Inputs */}
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {measurementList.map(([key, point]) => (
              <div
                key={key}
                className={`p-3 rounded-lg border-2 transition-all ${
                  activePoint === key
                    ? 'border-blue-500 bg-blue-50'
                    : point.value !== null
                    ? 'border-green-200 bg-green-50'
                    : point.required
                    ? 'border-orange-200 bg-orange-50'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    {point.label}
                    {point.labelPunjabi && (
                      <span className="text-orange-600 font-semibold">/ {point.labelPunjabi}</span>
                    )}
                    {point.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                  </Label>
                  {point.value !== null && (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="0.0"
                    value={point.value ?? ''}
                    onChange={(e) => onMeasurementChange(key, e.target.value)}
                    onFocus={() => onPointClick(key)}
                    className="text-lg font-semibold"
                  />
                  <div className="flex items-center justify-center w-12 bg-slate-100 rounded-md text-sm font-medium text-slate-600">
                    cm
                  </div>
                </div>
                <p className="text-xs text-slate-600 mt-1">{point.helpText}</p>
              </div>
            ))}
          </div>

          {/* Notes */}
          <div className="space-y-2 pt-4 border-t">
            <Label>Notes (Optional)</Label>
            <textarea
              className="w-full min-h-20 p-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add any special notes or preferences..."
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// SVG Diagrams (simplified - will be more detailed in production)
function ShirtDiagramSVG({ measurements, activePoint, onPointClick }: any) {
  return (
    <svg viewBox="0 0 200 300" className="w-full h-auto max-h-[500px]">
      {/* Shirt outline */}
      <path
        d="M 100 30 L 80 40 L 60 50 L 50 70 L 50 120 L 60 180 L 80 220 L 120 220 L 140 180 L 150 120 L 150 70 L 140 50 L 120 40 Z"
        fill="#f0f9ff"
        stroke="#3b82f6"
        strokeWidth="2"
      />

      {/* Sleeves */}
      <path d="M 60 50 L 20 80 L 25 120 L 50 100 Z" fill="#dbeafe" stroke="#3b82f6" strokeWidth="2" />
      <path d="M 140 50 L 180 80 L 175 120 L 150 100 Z" fill="#dbeafe" stroke="#3b82f6" strokeWidth="2" />

      {/* Measurement points */}
      {Object.entries(measurements).map(([key, point]: [string, any]) => (
        <g key={key}>
          <circle
            cx={point.x + 100}
            cy={point.y + 20}
            r="6"
            fill={activePoint === key ? '#f59e0b' : point.value !== null ? '#10b981' : '#ef4444'}
            stroke="white"
            strokeWidth="2"
            className="cursor-pointer hover:r-8 transition-all"
            onClick={() => onPointClick(key)}
          />
          <text
            x={point.x + 110}
            y={point.y + 25}
            className="text-xs font-semibold fill-slate-900"
            pointerEvents="none"
          >
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

function TrouserDiagramSVG({ measurements, activePoint, onPointClick }: any) {
  return (
    <svg viewBox="0 0 200 300" className="w-full h-auto max-h-[500px]">
      {/* Trouser outline */}
      <path
        d="M 80 50 L 80 100 L 75 150 L 70 200 L 65 270 M 120 50 L 120 100 L 125 150 L 130 200 L 135 270 M 80 50 L 120 50"
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2"
      />
      <path
        d="M 85 100 L 80 270 M 115 100 L 120 270"
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2"
      />

      {/* Measurement points */}
      {Object.entries(measurements).map(([key, point]: [string, any]) => (
        <g key={key}>
          <circle
            cx={point.x + 50}
            cy={point.y + 30}
            r="6"
            fill={activePoint === key ? '#f59e0b' : point.value !== null ? '#10b981' : '#ef4444'}
            stroke="white"
            strokeWidth="2"
            className="cursor-pointer hover:r-8 transition-all"
            onClick={() => onPointClick(key)}
          />
          <text
            x={point.x + 60}
            y={point.y + 35}
            className="text-xs font-semibold fill-slate-900"
            pointerEvents="none"
          >
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

function SuitDiagramSVG({ measurements, activePoint, onPointClick }: any) {
  return (
    <svg viewBox="0 0 200 300" className="w-full h-auto max-h-[500px]">
      {/* Suit jacket outline (similar to shirt but longer) */}
      <path
        d="M 100 30 L 80 40 L 60 50 L 50 70 L 50 150 L 60 200 L 80 240 L 120 240 L 140 200 L 150 150 L 150 70 L 140 50 L 120 40 Z"
        fill="#f0f9ff"
        stroke="#3b82f6"
        strokeWidth="2"
      />

      {/* Lapels */}
      <path d="M 100 40 L 85 60 L 80 80" fill="none" stroke="#1e3a8a" strokeWidth="2" />
      <path d="M 100 40 L 115 60 L 120 80" fill="none" stroke="#1e3a8a" strokeWidth="2" />

      {/* Sleeves */}
      <path d="M 60 50 L 20 80 L 25 140 L 50 120 Z" fill="#dbeafe" stroke="#3b82f6" strokeWidth="2" />
      <path d="M 140 50 L 180 80 L 175 140 L 150 120 Z" fill="#dbeafe" stroke="#3b82f6" strokeWidth="2" />

      {/* Measurement points */}
      {Object.entries(measurements).map(([key, point]: [string, any]) => (
        <g key={key}>
          <circle
            cx={point.x + 100}
            cy={point.y + 20}
            r="6"
            fill={activePoint === key ? '#f59e0b' : point.value !== null ? '#10b981' : '#ef4444'}
            stroke="white"
            strokeWidth="2"
            className="cursor-pointer hover:r-8 transition-all"
            onClick={() => onPointClick(key)}
          />
          <text
            x={point.x + 110}
            y={point.y + 25}
            className="text-xs font-semibold fill-slate-900"
            pointerEvents="none"
          >
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

function SherwaniDiagramSVG({ measurements, activePoint, onPointClick }: any) {
  return (
    <svg viewBox="0 0 200 350" className="w-full h-auto max-h-[500px]">
      {/* Sherwani outline (longer than suit, traditional collar) */}
      <path
        d="M 100 30 L 95 35 L 90 40 L 80 45 L 70 55 L 60 65 L 55 80 L 52 120 L 50 180 L 55 240 L 65 280 L 80 310 L 120 310 L 135 280 L 145 240 L 148 180 L 145 120 L 140 80 L 130 65 L 120 55 L 110 45 L 105 40 L 100 35 Z"
        fill="#fef3c7"
        stroke="#f59e0b"
        strokeWidth="2"
      />

      {/* Traditional collar */}
      <path d="M 100 30 L 95 35 L 100 45 L 105 35 Z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" />

      {/* Sleeves */}
      <path d="M 70 55 L 25 85 L 30 150 L 55 130 Z" fill="#fde68a" stroke="#f59e0b" strokeWidth="2" />
      <path d="M 130 55 L 175 85 L 170 150 L 145 130 Z" fill="#fde68a" stroke="#f59e0b" strokeWidth="2" />

      {/* Decorative buttons */}
      <circle cx="100" cy="80" r="3" fill="#78350f" />
      <circle cx="100" cy="120" r="3" fill="#78350f" />
      <circle cx="100" cy="160" r="3" fill="#78350f" />
      <circle cx="100" cy="200" r="3" fill="#78350f" />

      {/* Measurement points */}
      {Object.entries(measurements).map(([key, point]: [string, any]) => (
        <g key={key}>
          <circle
            cx={point.x + 100}
            cy={point.y + 20}
            r="6"
            fill={activePoint === key ? '#dc2626' : point.value !== null ? '#10b981' : '#ef4444'}
            stroke="white"
            strokeWidth="2"
            className="cursor-pointer hover:r-8 transition-all"
            onClick={() => onPointClick(key)}
          />
          <text
            x={point.x + 110}
            y={point.y + 25}
            className="text-xs font-semibold fill-slate-900"
            pointerEvents="none"
          >
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  )
}
