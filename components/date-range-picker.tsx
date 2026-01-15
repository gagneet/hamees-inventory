'use client'

import * as React from 'react'
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subYears } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { DateRange } from 'react-day-picker'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export type DateRangePreset =
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'last_quarter'
  | 'this_fy'
  | 'last_fy'
  | 'ytd'
  | 'custom'

export interface DateRangeWithLabel extends DateRange {
  preset?: DateRangePreset
  label: string
}

interface DateRangePickerProps {
  value?: DateRangeWithLabel
  onChange?: (range: DateRangeWithLabel) => void
  className?: string
}

// Helper function to get financial year dates (April 1 to March 31)
function getFinancialYear(year: number): { start: Date; end: Date } {
  const start = new Date(year, 3, 1) // April 1
  const end = new Date(year + 1, 2, 31) // March 31
  return { start, end }
}

// Helper function to get current financial year
function getCurrentFinancialYear(): { start: Date; end: Date; label: string } {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  // If we're between Jan-Mar, we're in FY that started last year
  // If we're between Apr-Dec, we're in FY that started this year
  const fyStartYear = currentMonth < 3 ? currentYear - 1 : currentYear

  const { start, end } = getFinancialYear(fyStartYear)
  const label = `FY ${fyStartYear}-${(fyStartYear + 1).toString().slice(-2)}`

  return { start, end, label }
}

// Helper function to get quarter start and end dates
function getQuarter(date: Date): { start: Date; end: Date } {
  const month = date.getMonth()
  const year = date.getFullYear()
  const quarter = Math.floor(month / 3)

  const start = new Date(year, quarter * 3, 1)
  const end = new Date(year, quarter * 3 + 3, 0) // Last day of the quarter

  return { start, end }
}

const presetRanges: Record<DateRangePreset, () => DateRangeWithLabel> = {
  this_month: () => {
    const now = new Date()
    return {
      from: startOfMonth(now),
      to: endOfMonth(now),
      preset: 'this_month',
      label: format(now, 'MMM yyyy'),
    }
  },
  last_month: () => {
    const lastMonth = subMonths(new Date(), 1)
    return {
      from: startOfMonth(lastMonth),
      to: endOfMonth(lastMonth),
      preset: 'last_month',
      label: format(lastMonth, 'MMM yyyy'),
    }
  },
  this_quarter: () => {
    const now = new Date()
    const { start, end } = getQuarter(now)
    const quarter = Math.floor(now.getMonth() / 3) + 1
    return {
      from: start,
      to: end,
      preset: 'this_quarter',
      label: `Q${quarter} ${format(now, 'yyyy')}`,
    }
  },
  last_quarter: () => {
    const lastQuarter = subMonths(new Date(), 3)
    const { start, end } = getQuarter(lastQuarter)
    const quarter = Math.floor(lastQuarter.getMonth() / 3) + 1
    return {
      from: start,
      to: end,
      preset: 'last_quarter',
      label: `Q${quarter} ${format(lastQuarter, 'yyyy')}`,
    }
  },
  this_fy: () => {
    const { start, end, label } = getCurrentFinancialYear()
    return {
      from: start,
      to: end,
      preset: 'this_fy',
      label: `This ${label}`,
    }
  },
  last_fy: () => {
    const { start: currentStart } = getCurrentFinancialYear()
    const lastFyStartYear = currentStart.getFullYear() - 1
    const { start, end } = getFinancialYear(lastFyStartYear)
    const label = `FY ${lastFyStartYear}-${(lastFyStartYear + 1).toString().slice(-2)}`
    return {
      from: start,
      to: end,
      preset: 'last_fy',
      label,
    }
  },
  ytd: () => {
    const now = new Date()
    return {
      from: startOfYear(now),
      to: now,
      preset: 'ytd',
      label: `YTD ${format(now, 'yyyy')}`,
    }
  },
  custom: () => ({
    from: undefined,
    to: undefined,
    preset: 'custom',
    label: 'Custom Range',
  }),
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [date, setDate] = React.useState<DateRangeWithLabel>(
    value || presetRanges.this_month()
  )
  const [isOpen, setIsOpen] = React.useState(false)

  React.useEffect(() => {
    if (value) {
      setDate(value)
    }
  }, [value])

  const handlePresetClick = (preset: DateRangePreset) => {
    const range = presetRanges[preset]()
    setDate(range)
    if (onChange) {
      onChange(range)
    }
    if (preset !== 'custom') {
      setIsOpen(false)
    }
  }

  const handleDateSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      const newRange: DateRangeWithLabel = {
        from: range.from,
        to: range.to,
        preset: 'custom',
        label: `${format(range.from, 'MMM dd, yyyy')} - ${format(range.to, 'MMM dd, yyyy')}`,
      }
      setDate(newRange)
      if (onChange) {
        onChange(newRange)
      }
      setIsOpen(false)
    } else if (range?.from) {
      setDate({
        from: range.from,
        to: range.to,
        preset: 'custom',
        label: 'Select end date',
      })
    }
  }

  return (
    <div className={cn('grid gap-2', className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={'outline'}
            className={cn(
              'w-full md:w-[300px] justify-start text-left font-normal',
              !date && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.label || <span>Pick a date range</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            {/* Preset buttons sidebar */}
            <div className="flex flex-col gap-1 border-r p-3">
              <div className="text-xs font-semibold text-slate-500 mb-2">Quick Ranges</div>
              <Button
                variant={date?.preset === 'this_month' ? 'default' : 'ghost'}
                size="sm"
                className="justify-start"
                onClick={() => handlePresetClick('this_month')}
              >
                This Month
              </Button>
              <Button
                variant={date?.preset === 'last_month' ? 'default' : 'ghost'}
                size="sm"
                className="justify-start"
                onClick={() => handlePresetClick('last_month')}
              >
                Last Month
              </Button>
              <Button
                variant={date?.preset === 'this_quarter' ? 'default' : 'ghost'}
                size="sm"
                className="justify-start"
                onClick={() => handlePresetClick('this_quarter')}
              >
                This Quarter
              </Button>
              <Button
                variant={date?.preset === 'last_quarter' ? 'default' : 'ghost'}
                size="sm"
                className="justify-start"
                onClick={() => handlePresetClick('last_quarter')}
              >
                Last Quarter
              </Button>
              <div className="h-px bg-slate-200 my-1" />
              <Button
                variant={date?.preset === 'this_fy' ? 'default' : 'ghost'}
                size="sm"
                className="justify-start"
                onClick={() => handlePresetClick('this_fy')}
              >
                This FY
              </Button>
              <Button
                variant={date?.preset === 'last_fy' ? 'default' : 'ghost'}
                size="sm"
                className="justify-start"
                onClick={() => handlePresetClick('last_fy')}
              >
                Last FY
              </Button>
              <Button
                variant={date?.preset === 'ytd' ? 'default' : 'ghost'}
                size="sm"
                className="justify-start"
                onClick={() => handlePresetClick('ytd')}
              >
                Year to Date
              </Button>
              <div className="h-px bg-slate-200 my-1" />
              <Button
                variant={date?.preset === 'custom' ? 'default' : 'ghost'}
                size="sm"
                className="justify-start"
                onClick={() => handlePresetClick('custom')}
              >
                Custom Range
              </Button>
            </div>

            {/* Calendar */}
            <div className="p-3">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={handleDateSelect}
                numberOfMonths={2}
                disabled={(date) => {
                  // Disable dates more than 7 years ago
                  const sevenYearsAgo = subYears(new Date(), 7)
                  return date < sevenYearsAgo || date > new Date()
                }}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
