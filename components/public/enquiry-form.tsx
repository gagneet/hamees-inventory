'use client'

/**
 * @featuretrace Public order enquiry form
 * @calls POST /api/public/enquiries
 *
 * Used by the unauthenticated /order page. It collects contact details and what the customer
 * wants made — never a price, a fabric price or a quantity of stock. The hidden "company" field
 * is a honeypot: people never see it, so anything filled in is a bot.
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PhoneInput } from '@/components/ui/phone-input'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, AlertCircle } from 'lucide-react'

interface EnquiryFormProps {
  /** Garment names offered by the shop; free text is still allowed */
  garmentTypes: string[]
  /** Country used for numbers typed without a +code */
  phoneRegion: string
}

const EMPTY = {
  name: '',
  phone: '',
  email: '',
  city: '',
  garmentType: '',
  fabricNotes: '',
  quantity: 1,
  preferredDate: '',
  notes: '',
  company: '', // honeypot
}

export function EnquiryForm({ garmentTypes, phoneRegion }: EnquiryFormProps) {
  const [form, setForm] = useState(EMPTY)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (form.name.trim().length < 2) return setError('Please enter your name.')
    if (form.phone.trim().length < 6) return setError('Please enter a phone number we can call.')
    if (!form.garmentType.trim()) return setError('Please tell us what you would like made.')

    setSending(true)
    try {
      const response = await fetch('/api/public/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, quantity: Number(form.quantity) || 1 }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(body.error || 'Something went wrong. Please call the shop instead.')
        return
      }
      setSent(true)
    } catch {
      setError('We could not reach the shop. Please check your connection and try again.')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="py-10 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
          <h3 className="mt-4 text-lg font-semibold text-green-900">Thank you — we have your enquiry</h3>
          <p className="mt-2 text-green-800">
            Someone from the shop will call you on the number you gave to agree the fabric, take your
            measurements and give you a price.
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => {
              setForm(EMPTY)
              setSent(false)
            }}
          >
            Send another enquiry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="py-6">
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Your name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                maxLength={200}
                autoComplete="name"
                required
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone *</Label>
              <PhoneInput
                id="phone"
                value={form.phone}
                onChange={(value) => set('phone', value)}
                defaultRegion={phoneRegion}
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                maxLength={200}
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="city">City (optional)</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
                maxLength={120}
                autoComplete="address-level2"
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="garmentType">What would you like made? *</Label>
              <Input
                id="garmentType"
                list="garment-types"
                value={form.garmentType}
                onChange={(e) => set('garmentType', e.target.value)}
                maxLength={120}
                placeholder={garmentTypes[0] ? `e.g. ${garmentTypes[0]}` : 'e.g. Sherwani'}
                required
              />
              <datalist id="garment-types">
                {garmentTypes.map((type) => (
                  <option key={type} value={type} />
                ))}
              </datalist>
            </div>
            <div>
              <Label htmlFor="quantity">How many?</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                max={50}
                step={1}
                value={form.quantity}
                onChange={(e) => set('quantity', Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="fabricNotes">Fabric or colour you have in mind (optional)</Label>
            <Input
              id="fabricNotes"
              value={form.fabricNotes}
              onChange={(e) => set('fabricNotes', e.target.value)}
              maxLength={500}
              placeholder="e.g. navy linen, or bringing my own cloth"
            />
          </div>

          <div>
            <Label htmlFor="preferredDate">When do you need it? (optional)</Label>
            <Input
              id="preferredDate"
              type="date"
              value={form.preferredDate}
              onChange={(e) => set('preferredDate', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="notes">Anything else we should know? (optional)</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Occasion, fit you prefer, a reference you have seen…"
            />
          </div>

          {/* Honeypot — hidden from people, so anything here came from a bot */}
          <div className="hidden" aria-hidden="true">
            <label htmlFor="company">Company</label>
            <input
              id="company"
              name="company"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={form.company}
              onChange={(e) => set('company', e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between gap-4 pt-2">
            <p className="text-xs text-slate-500">
              No payment is taken and nothing is ordered from this page.
            </p>
            <Button type="submit" disabled={sending}>
              {sending ? 'Sending…' : 'Send enquiry'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
