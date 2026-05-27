'use client'

/**
 * @featuretrace Customer Combobox
 * @component Combobox
 * @description Searchable dropdown built on Radix Popover — replaces plain <select> for large lists.
 * Built without cmdk to avoid adding a dependency: uses controlled Popover + filtered list.
 *
 * Usage:
 *   <Combobox
 *     options={customers.map(c => ({ value: c.id, label: c.name, sublabel: c.phone }))}
 *     value={customerId}
 *     onSelect={(val) => setCustomerId(val)}
 *     placeholder="Search customers…"
 *     emptyMessage="No customers found"
 *   />
 */

import * as React from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ComboboxOption = {
  /** The value stored / emitted */
  value: string
  /** Primary display label */
  label: string
  /** Optional secondary line shown in smaller text */
  sublabel?: string
  /** Optional colour swatch (hex string) */
  colorHex?: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: string
  onSelect: (value: string) => void
  placeholder?: string
  emptyMessage?: string
  /** Width of the trigger button — defaults to full width */
  className?: string
  disabled?: boolean
  /** If true, an "Add new…" row appears at the bottom of the list */
  onAddNew?: () => void
  onAddNewLabel?: string
}

export function Combobox({
  options,
  value,
  onSelect,
  placeholder = 'Select…',
  emptyMessage = 'No results found.',
  className,
  disabled,
  onAddNew,
  onAddNewLabel = 'Create new…',
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Focus search input when popover opens
  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setSearch('')
    }
  }, [open])

  const selected = options.find(o => o.value === value)

  // Filter by search — matches label OR sublabel (case-insensitive)
  const filtered = search.trim()
    ? options.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        o.sublabel?.toLowerCase().includes(search.toLowerCase())
      )
    : options

  const handleSelect = (optionValue: string) => {
    onSelect(optionValue)
    setOpen(false)
    setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal text-left',
            !selected && 'text-slate-500',
            className
          )}
        >
          <span className="truncate">
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="p-0 w-[var(--radix-popover-trigger-width)] max-w-sm"
        align="start"
        sideOffset={4}
      >
        {/* Search bar */}
        <div className="flex items-center border-b px-3 py-2 gap-2">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <Input
            ref={inputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="border-0 shadow-none focus-visible:ring-0 h-8 px-0 text-sm"
          />
        </div>

        {/* Options list */}
        <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li role="option" aria-selected={false} className="px-4 py-3 text-sm text-slate-500 text-center">{emptyMessage}</li>
          ) : (
            filtered.map(option => (
              <li key={option.value} role="option" aria-selected={value === option.value}>
                <button
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-slate-100 transition-colors',
                    value === option.value && 'bg-slate-50 font-medium'
                  )}
                >
                  {/* Colour swatch (for fabric selection) */}
                  {option.colorHex && (
                    <span
                      className="h-4 w-4 rounded shrink-0 border border-slate-200"
                      style={{ backgroundColor: option.colorHex }}
                      aria-hidden
                    />
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-slate-900">{option.label}</span>
                    {option.sublabel && (
                      <span className="block truncate text-xs text-slate-500">{option.sublabel}</span>
                    )}
                  </span>
                  {/* Checkmark for currently selected item */}
                  {value === option.value && (
                    <Check className="h-4 w-4 shrink-0 text-slate-700" />
                  )}
                </button>
              </li>
            ))
          )}
        </ul>

        {/* "Add new" row */}
        {onAddNew && (
          <div className="border-t">
            <button
              type="button"
              onClick={() => { onAddNew(); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-blue-600 hover:bg-blue-50 transition-colors font-medium"
            >
              <span>+ {onAddNewLabel}</span>
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
