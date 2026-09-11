'use client'

/**
 * @featuretrace International phone numbers
 * @component PhoneInput · CountryPicker · PhoneText
 * @description Phone entry with a searchable country selector (flag, name, calling code) and
 *   as-you-type national formatting. Defaults to the shop's phone region (Admin Settings →
 *   Currency & Locale). `value` / `onChange` carry E.164 ("+919876543210") once the number
 *   parses; validity is shown under the field and checked again by the API (lib/phone-schema.ts).
 *   PhoneText / usePhoneFormatter display stored numbers: national for the shop's country,
 *   international for everything else.
 */

import * as React from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppSettings } from '@/components/providers/settings-provider'
import { DEFAULT_PHONE_REGION } from '@/lib/app-settings'
import {
  callingCode,
  countryOptions,
  formatAsYouType,
  formatPhone,
  parsePhone,
  regionFlag,
  regionName,
  toRegion,
} from '@/lib/phone'
import { cn } from '@/lib/utils'

// ── Display ─────────────────────────────────────────────────────────

/** Formats stored numbers for the shop: national for its own country, international otherwise. */
export function usePhoneFormatter(): (stored: string | null | undefined) => string {
  const { phoneRegion } = useAppSettings()
  return React.useCallback((stored) => formatPhone(stored, { defaultRegion: phoneRegion }), [phoneRegion])
}

/** A stored phone number, formatted for display (see usePhoneFormatter). */
export function PhoneText({ value }: { value: string | null | undefined }) {
  const format = usePhoneFormatter()
  return <>{format(value)}</>
}

// ── Country picker ─────────────────────────────────────────────────

interface CountryPickerProps {
  id?: string
  /** ISO 3166-1 alpha-2 code */
  value: string
  onChange: (region: string) => void
  /** Locale for country names (default: the shop's locale) */
  locale?: string
  /** Show the country name on the trigger, not just the flag and calling code */
  showName?: boolean
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

export function CountryPicker({
  id,
  value,
  onChange,
  locale,
  showName = false,
  disabled,
  className,
  'aria-label': ariaLabel = 'Country calling code',
}: CountryPickerProps) {
  const settings = useAppSettings()
  const displayLocale = locale || settings.locale
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const options = React.useMemo(() => countryOptions(displayLocale), [displayLocale])
  const selected = toRegion(value)

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^\+/, '')
    if (!q) return options
    return options.filter(
      (o) => o.name.toLowerCase().includes(q) || o.code.toLowerCase() === q || o.callingCode.startsWith(q)
    )
  }, [options, search])

  const choose = (code: string) => {
    onChange(code)
    setOpen(false)
    setSearch('')
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSearch('')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn('justify-between gap-1 px-2.5 font-normal', className)}
        >
          <span className="truncate">
            {selected
              ? `${regionFlag(selected)} ${showName ? `${regionName(selected, displayLocale)} · ` : ''}+${callingCode(selected)}`
              : 'Country'}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 max-w-[calc(100vw-2rem)] p-0" align="start" sideOffset={4}>
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search country or code…"
            aria-label="Search countries"
            className="h-8 border-0 px-0 text-sm shadow-none focus-visible:ring-0"
          />
        </div>
        <ul role="listbox" aria-label="Countries" className="max-h-64 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li role="option" aria-selected={false} className="px-4 py-3 text-center text-sm text-slate-500">
              No matching country
            </li>
          ) : (
            filtered.map((o) => (
              <li key={o.code} role="option" aria-selected={o.code === selected}>
                <button
                  type="button"
                  onClick={() => choose(o.code)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-100',
                    o.code === selected && 'bg-slate-50 font-medium'
                  )}
                >
                  <span aria-hidden>{o.flag}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-900">{o.name}</span>
                  <span className="text-xs tabular-nums text-slate-500">+{o.callingCode}</span>
                  {o.code === selected && <Check className="h-4 w-4 shrink-0 text-slate-700" />}
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

// ── Phone input ────────────────────────────────────────────────────

interface PhoneInputProps {
  id?: string
  /** E.164 (or any stored/legacy form — it is parsed for display) */
  value: string | null | undefined
  /** Receives E.164 once the text parses, the trimmed text otherwise, '' when empty */
  onChange: (value: string) => void
  /** Country for numbers typed without +code (default: the shop's phone region) */
  defaultRegion?: string
  required?: boolean
  disabled?: boolean
  placeholder?: string
  size?: 'default' | 'sm'
  className?: string
}

type InputState = { region: string; text: string; emitted: string }

function stateFromValue(value: string | null | undefined, fallbackRegion: string): InputState {
  const stored = value ?? ''
  const parsed = parsePhone(stored, fallbackRegion)
  if (parsed?.valid && parsed.region) {
    // Numbers sharing the shop's calling code (e.g. +44 Guernsey in a UK shop) keep the shop's country
    const region = parsed.callingCode === callingCode(fallbackRegion) ? fallbackRegion : parsed.region
    return { region, text: formatAsYouType(parsed.nationalNumber, region), emitted: stored }
  }
  return { region: fallbackRegion, text: parsed?.valid ? parsed.international : stored, emitted: stored }
}

function valueFrom(text: string, region: string): string {
  if (!text.trim()) return ''
  return parsePhone(text, region)?.e164 ?? text.trim()
}

export function PhoneInput({
  id,
  value,
  onChange,
  defaultRegion,
  required,
  disabled,
  placeholder = 'Phone number',
  size = 'default',
  className,
}: PhoneInputProps) {
  const settings = useAppSettings()
  const fallbackRegion = toRegion(defaultRegion) ?? toRegion(settings.phoneRegion) ?? DEFAULT_PHONE_REGION
  const [state, setState] = React.useState<InputState>(() => stateFromValue(value, fallbackRegion))
  const [touched, setTouched] = React.useState(false)
  const statusId = React.useId()

  // The parent replaced the value (record loaded, form reset): show it again
  if ((value ?? '') !== state.emitted) {
    setState(stateFromValue(value, fallbackRegion))
  }

  const update = (next: Omit<InputState, 'emitted'>) => {
    const emitted = valueFrom(next.text, next.region)
    setState({ ...next, emitted })
    onChange(emitted)
  }

  const onText = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    // Reformat only while typing at the end, so edits in the middle keep the caret in place
    let text = e.target.selectionStart === raw.length ? formatAsYouType(raw, state.region) : raw
    let region = state.region
    // A typed or pasted international number selects its own country
    const parsed = parsePhone(text, region)
    if (parsed?.valid && parsed.region && /^\s*(\+|00)/.test(text)) {
      region = parsed.region
      text = formatAsYouType(parsed.nationalNumber, region)
    }
    update({ region, text })
  }

  const parsed = parsePhone(state.text, state.region)
  const hasDigits = /\d/.test(state.text)
  const valid = !!parsed?.valid
  const showInvalid = hasDigits && !valid && touched

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex gap-2">
        <CountryPicker
          value={state.region}
          onChange={(region) => update({ region, text: state.text })}
          disabled={disabled}
          className={cn('w-[6.75rem] shrink-0', size === 'sm' && 'h-8 text-sm')}
        />
        <Input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={state.text}
          onChange={onText}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          aria-invalid={showInvalid || undefined}
          aria-describedby={statusId}
          className={cn('min-w-0 flex-1', size === 'sm' && 'h-8 text-sm', showInvalid && 'border-red-400')}
        />
      </div>
      <p id={statusId} aria-live="polite" className={cn('text-xs', size === 'sm' && 'text-[11px]')}>
        {valid && parsed ? (
          <span className="text-green-700">✓ {parsed.international}</span>
        ) : showInvalid ? (
          <span className="text-red-600">Not a valid {regionName(state.region, settings.locale)} number — check the digits or the country.</span>
        ) : null}
      </p>
    </div>
  )
}
