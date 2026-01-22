'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { DateRangePreset } from '@/lib/dashboard-data'

interface DateRangeSelectorProps {
  currentRange: DateRangePreset
}

export function DateRangeSelector({ currentRange }: DateRangeSelectorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('range', value)
    router.push(`/dashboard?${params.toString()}`)
  }

  const rangeLabels: Record<DateRangePreset, string> = {
    today: 'Today',
    week: 'Last 7 Days',
    month: 'This Month',
    '3months': 'Last 3 Months',
    '6months': 'Last 6 Months',
    year: 'Last Year',
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="dateRange" className="text-sm font-medium">
        Time Period:
      </label>
      <select
        id="dateRange"
        name="range"
        value={currentRange}
        onChange={(e) => handleChange(e.target.value)}
        className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {Object.entries(rangeLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  )
}
