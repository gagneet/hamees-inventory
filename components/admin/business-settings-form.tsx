'use client'

/**
 * @featuretrace Admin → Business, Localization, Tax & Production settings
 * @description Edits the singleton BusinessSettings row via PUT /api/settings (manage_settings).
 *   Currency / locale / time zone drive every amount and date in the app (lib/locale.ts);
 *   tax mode + rate drive tax on new orders (lib/tax.ts); production limits drive the Master Tailor views.
 *   All tabs share one form state (SettingsFormProvider), so a preset applied on one tab is visible
 *   on the others and saving from any tab never overwrites edits made on another.
 *   After saving, router.refresh() re-renders the server layout so SettingsProvider picks up changes.
 */

import { createContext, useContext, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Globe2, Receipt, Scissors, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppSettings } from '@/components/providers/settings-provider'
import { CountryPicker, PhoneInput } from '@/components/ui/phone-input'
import { taxConfigFrom, type AppSettings } from '@/lib/app-settings'
import { regionName } from '@/lib/phone'
import { formatCurrency, isValidCurrency, isValidLocale, isValidTimeZone } from '@/lib/locale'
import { computeTax, taxLines, type TaxMode } from '@/lib/tax'

export type SettingsSection = 'business' | 'localization' | 'tax' | 'production'

type FormState = Omit<AppSettings, 'taxRate' | 'maxActiveItemsPerTailor' | 'tailorDailyTarget'> & {
  taxRate: string
  maxActiveItemsPerTailor: string
  tailorDailyTarget: string
}

type Preset = {
  label: string
  values: Partial<FormState>
}

// Regional presets fill localization + tax defaults; every field stays editable afterwards
const PRESETS: Preset[] = [
  {
    label: 'India',
    values: {
      country: 'India', currency: 'INR', locale: 'en-IN', timeZone: 'Asia/Kolkata', phoneRegion: 'IN',
      postalCodeLabel: 'Pincode', taxMode: 'SPLIT', taxName: 'GST', taxIdLabel: 'GSTIN', taxRate: '12',
    },
  },
  {
    label: 'United Kingdom',
    values: {
      country: 'United Kingdom', currency: 'GBP', locale: 'en-GB', timeZone: 'Europe/London', phoneRegion: 'GB',
      postalCodeLabel: 'Postcode', taxMode: 'SINGLE', taxName: 'VAT', taxIdLabel: 'VAT Reg. No.', taxRate: '20',
    },
  },
  {
    label: 'United States',
    values: {
      country: 'United States', currency: 'USD', locale: 'en-US', timeZone: 'America/New_York', phoneRegion: 'US',
      postalCodeLabel: 'ZIP code', taxMode: 'SINGLE', taxName: 'Sales Tax', taxIdLabel: 'Tax ID', taxRate: '0',
    },
  },
  {
    label: 'UAE',
    values: {
      country: 'United Arab Emirates', currency: 'AED', locale: 'en-AE', timeZone: 'Asia/Dubai', phoneRegion: 'AE',
      postalCodeLabel: 'P.O. Box', taxMode: 'SINGLE', taxName: 'VAT', taxIdLabel: 'TRN', taxRate: '5',
    },
  },
  {
    label: 'Australia',
    values: {
      country: 'Australia', currency: 'AUD', locale: 'en-AU', timeZone: 'Australia/Sydney', phoneRegion: 'AU',
      postalCodeLabel: 'Postcode', taxMode: 'SINGLE', taxName: 'GST', taxIdLabel: 'ABN', taxRate: '10',
    },
  },
  {
    label: 'Canada',
    values: {
      country: 'Canada', currency: 'CAD', locale: 'en-CA', timeZone: 'America/Toronto', phoneRegion: 'CA',
      postalCodeLabel: 'Postal code', taxMode: 'SINGLE', taxName: 'HST', taxIdLabel: 'BN', taxRate: '13',
    },
  },
]

const COMMON_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'AUD', 'CAD', 'SGD', 'NZD', 'PKR', 'BDT', 'LKR', 'NPR', 'MYR', 'ZAR', 'KES', 'JPY']
const COMMON_LOCALES = ['en-IN', 'hi-IN', 'pa-IN', 'en-US', 'en-GB', 'en-AE', 'ar-AE', 'en-AU', 'en-CA', 'fr-CA', 'en-SG', 'en-NZ', 'de-DE', 'fr-FR', 'ur-PK', 'en-ZA']

const TAX_MODE_HELP: Record<TaxMode, string> = {
  SPLIT: 'Two equal halves for local sales (e.g. CGST + SGST), one integrated line when the customer is in another state/region (IGST).',
  SINGLE: 'One tax line (e.g. VAT, GST or Sales Tax).',
  NONE: 'No tax is charged on new orders.',
}

function toForm(s: AppSettings): FormState {
  return {
    ...s,
    taxRate: String(s.taxRate),
    maxActiveItemsPerTailor: String(s.maxActiveItemsPerTailor),
    tailorDailyTarget: String(s.tailorDailyTarget),
  }
}

function timeZoneOptions(): string[] {
  try {
    const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }
    return intl.supportedValuesOf?.('timeZone') ?? []
  } catch {
    return []
  }
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

type CurrencyWarning = { recordCount: number; from: string; to: string }

interface SettingsFormContextValue {
  form: FormState
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  saving: boolean
  save: (acknowledgeNoConversion?: boolean) => Promise<void>
  applyPreset: (preset: Preset) => void
  currencyWarning: CurrencyWarning | null
  dismissCurrencyWarning: (keepCurrency: string) => void
}

const SettingsFormContext = createContext<SettingsFormContextValue | null>(null)

function useSettingsForm(): SettingsFormContextValue {
  const ctx = useContext(SettingsFormContext)
  if (!ctx) throw new Error('BusinessSettingsForm must be rendered inside SettingsFormProvider')
  return ctx
}

/** Holds the settings form state for every settings tab. */
export function SettingsFormProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const current = useAppSettings()
  const [form, setForm] = useState<FormState>(() => toForm(current))
  const [saving, setSaving] = useState(false)
  // Set when the API refuses a currency change because existing amounts would be relabelled
  const [currencyWarning, setCurrencyWarning] = useState<CurrencyWarning | null>(null)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const applyPreset = (preset: Preset) => {
    setForm((f) => ({ ...f, ...preset.values }))
    toast.info(`${preset.label} defaults applied — review the Tax tab, then save`)
  }

  const dismissCurrencyWarning = (keepCurrency: string) => {
    set('currency', keepCurrency)
    setCurrencyWarning(null)
  }

  const save = async (acknowledgeNoConversion = false) => {
    setSaving(true)
    try {
      const payload = {
        ...form,
        acknowledgeNoConversion,
        currency: form.currency.toUpperCase(),
        taxRate: Number(form.taxRate),
        maxActiveItemsPerTailor: Number(form.maxActiveItemsPerTailor),
        tailorDailyTarget: Number(form.tailorDailyTarget),
      }
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (response.status === 409 && data.code === 'CURRENCY_CHANGE_NEEDS_CONFIRMATION') {
        setCurrencyWarning({ recordCount: data.recordCount, from: data.from, to: data.to })
        toast.warning('Changing the currency does not convert existing amounts — review the warning on the Currency & Locale tab.')
        return
      }
      if (!response.ok) {
        const issue = Array.isArray(data.details) ? data.details[0] : null
        toast.error(issue ? `${issue.path?.join('.') || 'Field'}: ${issue.message}` : data.error || 'Failed to save settings')
        return
      }
      setForm(toForm(data.settings))
      setCurrencyWarning(null)
      toast.success('Settings saved')
      router.refresh()
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsFormContext.Provider value={{ form, set, saving, save, applyPreset, currencyWarning, dismissCurrencyWarning }}>
      {children}
    </SettingsFormContext.Provider>
  )
}

export function BusinessSettingsForm({ section }: { section: SettingsSection }) {
  const { form, set, saving, save, applyPreset, currencyWarning, dismissCurrencyWarning } = useSettingsForm()
  const timeZones = useMemo(() => timeZoneOptions(), [])

  const text = (key: keyof FormState) => ({
    id: key,
    value: (form[key] as string | null) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key, e.target.value as never),
  })

  const localeValid = isValidCurrency(form.currency.toUpperCase()) && isValidLocale(form.locale) && isValidTimeZone(form.timeZone)

  const currencyPreview = useMemo(() => {
    if (!localeValid) return null
    const config = { currency: form.currency.toUpperCase(), locale: form.locale, timeZone: form.timeZone }
    let date = ''
    try {
      date = new Intl.DateTimeFormat(form.locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: form.timeZone }).format(new Date())
    } catch {
      date = ''
    }
    return { amount: formatCurrency(1234567.891, { config }), date }
  }, [form.currency, form.locale, form.timeZone, localeValid])

  const taxPreview = useMemo(() => {
    const rate = Number(form.taxRate)
    if (!Number.isFinite(rate)) return null
    const cfg = taxConfigFrom({ taxMode: form.taxMode, taxRate: rate, taxName: form.taxName || 'Tax', region: form.region })
    const local = computeTax(10000, cfg)
    const interRegion = form.taxMode === 'SPLIT' ? computeTax(10000, cfg, { customerRegion: '__other_region__' }) : null
    return { cfg, local, interRegion }
  }, [form.taxMode, form.taxRate, form.taxName, form.region])

  const saveBar = (
    <div className="flex justify-end">
      <Button onClick={() => save()} disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</Button>
    </div>
  )

  if (section === 'business') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Store className="h-5 w-5" /> Business profile</CardTitle>
          <CardDescription>Shown in the app header, login page, invoices and customer messages.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Field id="businessName" label="Business name"><Input {...text('businessName')} maxLength={120} /></Field>
            <Field id="tagline" label="Tagline" hint="Optional; shown under the name on the login page and invoices."><Input {...text('tagline')} maxLength={160} /></Field>
            <Field id="phone" label="Phone">
              <PhoneInput id="phone" value={form.phone} onChange={(v) => set('phone', v || null)} defaultRegion={form.phoneRegion} />
            </Field>
            <Field id="email" label="Email"><Input {...text('email')} type="email" maxLength={254} /></Field>
            <Field id="website" label="Website" hint="Printed on invoices."><Input {...text('website')} placeholder="https://" maxLength={200} /></Field>
            <Field id="country" label="Country"><Input {...text('country')} maxLength={80} /></Field>
          </div>
          <Field id="address" label="Address"><Textarea {...text('address')} rows={2} maxLength={300} /></Field>
          <div className="grid gap-4 md:grid-cols-3">
            <Field id="city" label="City"><Input {...text('city')} maxLength={80} /></Field>
            <Field id="region" label="State / region" hint="Printed on invoices; decides local vs. inter-region tax in split mode.">
              <Input {...text('region')} maxLength={80} />
            </Field>
            <Field id="postalCode" label={form.postalCodeLabel || 'Postal code'}><Input {...text('postalCode')} maxLength={20} /></Field>
          </div>
          {saveBar}
        </CardContent>
      </Card>
    )
  }

  if (section === 'localization') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Globe2 className="h-5 w-5" /> Currency &amp; localization</CardTitle>
          <CardDescription>Every amount and date in the app is formatted with these settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Regional presets</Label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button key={p.label} type="button" variant="outline" size="sm" onClick={() => applyPreset(p)}>
                  {p.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-slate-500">Presets fill currency, locale, time zone, phone country and tax defaults. Review the Tax tab before saving.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Field
              id="currency"
              label="Currency (ISO 4217)"
              hint={
                isValidCurrency(form.currency.toUpperCase())
                  ? 'Existing amounts are not converted when this changes.'
                  : 'Unknown currency code'
              }
            >
              <Input {...text('currency')} list="currency-options" maxLength={3} className="uppercase" />
              <datalist id="currency-options">{COMMON_CURRENCIES.map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
            <Field id="locale" label="Number & date format (locale)" hint={isValidLocale(form.locale) ? undefined : 'Unsupported locale'}>
              <Input {...text('locale')} list="locale-options" maxLength={35} />
              <datalist id="locale-options">{COMMON_LOCALES.map((l) => <option key={l} value={l} />)}</datalist>
            </Field>
            <Field id="timeZone" label="Time zone" hint={isValidTimeZone(form.timeZone) ? undefined : 'Unknown time zone'}>
              <Input {...text('timeZone')} list="tz-options" maxLength={64} />
              <datalist id="tz-options">{timeZones.map((tz) => <option key={tz} value={tz} />)}</datalist>
            </Field>
            <Field
              id="phoneRegion"
              label="Phone number country"
              hint={`Numbers typed without + are read as ${regionName(form.phoneRegion, form.locale)} numbers, including for WhatsApp.`}
            >
              <CountryPicker
                id="phoneRegion"
                value={form.phoneRegion}
                onChange={(code) => set('phoneRegion', code)}
                locale={form.locale}
                showName
                className="w-full"
                aria-label="Phone number country"
              />
            </Field>
            <Field id="postalCodeLabel" label="Postal code label" hint="Used on customer forms."><Input {...text('postalCodeLabel')} maxLength={30} /></Field>
          </div>

          {currencyWarning && (
            <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 space-y-3">
              <p className="font-semibold">Existing amounts will not be converted</p>
              <p>
                Amounts are stored as plain numbers without a currency. Your {currencyWarning.recordCount} existing
                records (orders, purchase orders, expenses and inventory prices) would be relabelled, so{' '}
                <span className="font-mono">{formatCurrency(5000, { config: { currency: currencyWarning.from, locale: form.locale, timeZone: form.timeZone } })}</span>{' '}
                would show as{' '}
                <span className="font-mono">{formatCurrency(5000, { config: { currency: currencyWarning.to, locale: form.locale, timeZone: form.timeZone } })}</span>.
              </p>
              <p>Only continue if those amounts were actually entered in {currencyWarning.to}. There is no exchange-rate conversion.</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => dismissCurrencyWarning(currencyWarning.from)}>
                  Keep {currencyWarning.from}
                </Button>
                <Button type="button" variant="destructive" disabled={saving} onClick={() => save(true)}>
                  Relabel amounts as {currencyWarning.to}
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-lg border bg-slate-50 p-4 text-sm">
            <p className="font-medium text-slate-700">Preview</p>
            {currencyPreview ? (
              <p className="mt-1 text-slate-600">
                <span className="font-mono">{currencyPreview.amount}</span>
                {currencyPreview.date && <> · <span className="font-mono">{currencyPreview.date}</span></>}
              </p>
            ) : (
              <p className="mt-1 text-red-600">Fix the highlighted fields to see a preview.</p>
            )}
          </div>
          {saveBar}
        </CardContent>
      </Card>
    )
  }

  if (section === 'tax') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Tax &amp; invoicing</CardTitle>
          <CardDescription>
            Applied to new orders. Existing orders keep the rate and tax lines they were created with, including when their items are edited.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Field id="taxMode" label="Tax mode" hint={TAX_MODE_HELP[form.taxMode]}>
              <Select value={form.taxMode} onValueChange={(v) => set('taxMode', v as TaxMode)}>
                <SelectTrigger id="taxMode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SPLIT">Split (e.g. India GST)</SelectItem>
                  <SelectItem value="SINGLE">Single rate (VAT / GST / Sales tax)</SelectItem>
                  <SelectItem value="NONE">No tax</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field id="taxName" label="Tax name" hint="e.g. GST, VAT, Sales Tax"><Input {...text('taxName')} maxLength={20} /></Field>
            <Field id="taxRate" label="Tax rate (%)">
              <Input {...text('taxRate')} type="number" min={0} max={100} step="0.01" />
            </Field>
            <Field id="taxIdLabel" label="Tax registration label" hint="e.g. GSTIN, VAT Reg. No., TRN, ABN"><Input {...text('taxIdLabel')} maxLength={30} /></Field>
            <Field id="taxId" label="Tax registration number" hint="Printed on invoices."><Input {...text('taxId')} maxLength={30} /></Field>
          </div>
          <Field id="invoiceFooter" label="Invoice footer" hint="Terms, bank details or a thank-you note printed at the bottom of invoices.">
            <Textarea {...text('invoiceFooter')} rows={3} maxLength={500} />
          </Field>

          {taxPreview && (
            <div className="rounded-lg border bg-slate-50 p-4 text-sm">
              <p className="font-medium text-slate-700">Preview on a {formatCurrency(10000)} order</p>
              {form.taxMode === 'NONE' ? (
                <p className="mt-1 text-slate-600">No tax charged.</p>
              ) : (
                <ul className="mt-1 space-y-0.5 text-slate-600">
                  {taxLines(taxPreview.local, taxPreview.cfg).map((l) => (
                    <li key={l.label}>{l.label}: <span className="font-mono">{formatCurrency(l.amount)}</span></li>
                  ))}
                  {taxPreview.interRegion && (
                    <li className="text-slate-500">
                      Customer in another region:{' '}
                      {taxLines(taxPreview.interRegion, taxPreview.cfg).map((l) => `${l.label} ${formatCurrency(l.amount)}`).join(', ')}
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
          {saveBar}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Scissors className="h-5 w-5" /> Production</CardTitle>
        <CardDescription>Capacity limits used by the Master Tailor dashboard, Tailor Workload page and production reports.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="maxActiveItemsPerTailor" label="Maximum active items per tailor" hint="Tailors above this are flagged as over capacity.">
            <Input {...text('maxActiveItemsPerTailor')} type="number" min={1} max={100} step={1} />
          </Field>
          <Field id="tailorDailyTarget" label="Daily completion target per tailor" hint="Shown on tailor dashboards.">
            <Input {...text('tailorDailyTarget')} type="number" min={0} max={100} step={1} />
          </Field>
        </div>
        {saveBar}
      </CardContent>
    </Card>
  )
}
