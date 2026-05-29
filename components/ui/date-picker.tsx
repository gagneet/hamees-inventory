"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"

interface DatePickerProps {
  value?: Date | undefined
  onChange: (date: Date | undefined) => void
  placeholder?: string
  /** Minimum selectable date */
  fromDate?: Date
  /** Maximum selectable date */
  toDate?: Date
  disabled?: boolean
  className?: string
  /** Display format (date-fns). Default: dd/MM/yyyy (Indian convention) */
  displayFormat?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  fromDate,
  toDate,
  disabled,
  className,
  displayFormat = "dd/MM/yyyy",
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-slate-400",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {value ? format(value, displayFormat) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange(date)
            setOpen(false)
          }}
          fromDate={fromDate}
          toDate={toDate}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
