'use client'

/**
 * @featuretrace Measurements Inline on Order Items
 * @component OrderItemMeasurements
 * @description Shows the measurement values for a garment item directly on the order detail page.
 *   Tailors no longer need to navigate away to the customer profile to find measurements.
 *
 * @props measurement — the Measurement record linked to this OrderItem (may be null)
 * @props garmentType — display name of the garment (e.g. "Sherwani"); shown in the panel header
 *
 * @reads Measurement (passed as props from the server-rendered order detail page)
 * @calls Nothing on its own — add/edit actions are rendered by the parent order page
 */

import React, { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Ruler, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Measurement field display labels ─────────────────────────────

const MEASUREMENT_FIELDS: { key: string; label: string; unit: string }[] = [
  // Upper body
  { key: 'neck',             label: 'Neck',            unit: 'cm' },
  { key: 'chest',            label: 'Chest',           unit: 'cm' },
  { key: 'crossChest',       label: 'Cross Chest',     unit: 'cm' },
  { key: 'shoulder',         label: 'Shoulder',        unit: 'cm' },
  { key: 'waist',            label: 'Waist',           unit: 'cm' },
  { key: 'hip',              label: 'Hip',             unit: 'cm' },
  // Arms
  { key: 'sleeveLength',     label: 'Sleeve Length',   unit: 'cm' },
  { key: 'bicep',            label: 'Bicep',           unit: 'cm' },
  { key: 'elbow',            label: 'Elbow',           unit: 'cm' },
  { key: 'armCircumference', label: 'Arm Circumference', unit: 'cm' },
  { key: 'cuff',             label: 'Cuff',            unit: 'cm' },
  // Lengths
  { key: 'shirtLength',      label: 'Shirt Length',    unit: 'cm' },
  { key: 'backLength',       label: 'Back Length',     unit: 'cm' },
  { key: 'jacketLength',     label: 'Jacket Length',   unit: 'cm' },
  { key: 'lapelWidth',       label: 'Lapel Width',     unit: 'cm' },
  // Lower body
  { key: 'inseam',           label: 'Inseam',          unit: 'cm' },
  { key: 'outseam',          label: 'Outseam',         unit: 'cm' },
  { key: 'rise',             label: 'Rise',            unit: 'cm' },
  { key: 'seat',             label: 'Seat',            unit: 'cm' },
  { key: 'thigh',            label: 'Thigh',           unit: 'cm' },
  { key: 'knee',             label: 'Knee',            unit: 'cm' },
  { key: 'bottomOpening',    label: 'Bottom Opening',  unit: 'cm' },
]

// Only show fields that have values — avoids a sea of "—" for garments
function getPopulatedFields(measurement: Record<string, any>) {
  return MEASUREMENT_FIELDS.filter(f => measurement[f.key] != null && measurement[f.key] !== '')
}

// ── Props ─────────────────────────────────────────────────────────

interface Measurement {
  id: string
  garmentType: string
  bodyType?: string | null
  // Original fields
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
  // Extended fields (from Excel template)
  bicep?: number | null
  cuff?: number | null
  armCircumference?: number | null
  crossChest?: number | null
  backLength?: number | null
  seat?: number | null
  rise?: number | null
  elbow?: number | null
  notes?: string | null
  /** Accepts Date (Prisma) or ISO string (serialised via props) */
  createdAt?: Date | string | null
  createdBy?: { id: string; name: string } | null
}

interface OrderItemMeasurementsProps {
  measurement: Measurement | null | undefined
  garmentType: string
  /** Set to true to start expanded (default: collapsed) */
  defaultExpanded?: boolean
}

export function OrderItemMeasurements({
  measurement,
  garmentType,
  defaultExpanded = false,
}: OrderItemMeasurementsProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  // ── Missing measurements warning ──────────────────────────────
  if (!measurement) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-sm">
        <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
        <span className="text-red-700 font-medium">
          {garmentType} — measurements missing
        </span>
        <span className="text-red-600 text-xs">
          — Add measurements before cutting.
        </span>
      </div>
    )
  }

  const populatedFields = getPopulatedFields(measurement as Record<string, any>)

  return (
    <div className="mt-3 border border-slate-200 rounded-lg overflow-hidden">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-left transition-colors',
          expanded ? 'bg-slate-100' : 'bg-slate-50 hover:bg-slate-100'
        )}
      >
        <span className="flex items-center gap-2 text-slate-700">
          <Ruler className="h-4 w-4 text-slate-500" />
          <span className="font-semibold">{garmentType}</span>
          <span className="text-slate-400">·</span>
          <span>Measurements</span>
          {measurement.bodyType && (
            <Badge variant="outline" className="text-[10px] py-0 border-slate-300 text-slate-500 ml-1">
              {measurement.bodyType}
            </Badge>
          )}
          <span className="text-xs text-slate-400 font-normal">
            ({populatedFields.length} fields)
          </span>
        </span>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-slate-400" />
          : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {/* Measurement values grid */}
      {expanded && (
        <div className="px-3 py-3 bg-white">
          {populatedFields.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No measurement values recorded yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-2">
              {populatedFields.map(field => (
                <div key={field.key}>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                    {field.label}
                  </p>
                  <p className="text-sm font-semibold text-slate-800">
                    {(measurement as any)[field.key]} {field.unit}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Tailor notes on the measurement */}
          {measurement.notes && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-xs text-slate-600">{measurement.notes}</p>
            </div>
          )}

          {/* Recorded by + date */}
          {(measurement.createdBy || measurement.createdAt) && (
            <p className="mt-2 text-[10px] text-slate-400">
              Recorded
              {measurement.createdBy ? ` by ${measurement.createdBy.name}` : ''}
              {measurement.createdAt
                ? ` on ${new Date(measurement.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
