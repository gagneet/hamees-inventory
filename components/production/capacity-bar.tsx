'use client'

/**
 * @featuretrace Tailor capacity bar
 * Active items vs BusinessSettings.maxActiveItemsPerTailor. Amber from 80 %, red above capacity.
 */

import { cn } from '@/lib/utils'

export function capacityTone(active: number, capacity: number): 'ok' | 'high' | 'over' {
  if (active > capacity) return 'over'
  if (active >= Math.ceil(capacity * 0.8)) return 'high'
  return 'ok'
}

export function CapacityBar({
  active,
  capacity,
  className,
  showLabel = true,
}: {
  active: number
  capacity: number
  className?: string
  showLabel?: boolean
}) {
  const safeCapacity = Math.max(1, capacity)
  const pct = Math.min(100, Math.round((active / safeCapacity) * 100))
  const tone = capacityTone(active, safeCapacity)

  return (
    <div className={cn('space-y-1', className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Capacity</span>
          <span
            className={cn(
              'font-medium tabular-nums',
              tone === 'over' ? 'text-red-600' : tone === 'high' ? 'text-amber-600' : 'text-slate-700'
            )}
          >
            {active} / {safeCapacity}
            {tone === 'over' && ' · over capacity'}
          </span>
        </div>
      )}
      <div
        className="h-2 w-full rounded-full bg-slate-100 overflow-hidden"
        role="progressbar"
        aria-valuenow={active}
        aria-valuemin={0}
        aria-valuemax={safeCapacity}
        aria-label={`${active} of ${safeCapacity} active items`}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all',
            tone === 'over' ? 'bg-red-500' : tone === 'high' ? 'bg-amber-500' : 'bg-emerald-500'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
