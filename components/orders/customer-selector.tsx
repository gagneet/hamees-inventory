'use client'

/**
 * @featuretrace Order Creation — Customer Selection
 * @component CustomerSelector
 * @description Replaces the plain <select> in the new-order form Step 1.
 *   - Searchable combobox (by name or phone) using the Combobox primitive
 *   - Shows a customer profile card with last order + saved measurements after selection
 *   - "Repeat Last Order" button pre-fills all order items from the customer's last order
 *   - Inline new-customer form so staff never navigate away mid-order
 *
 * @props customers       — Customer[] fetched from GET /api/customers
 * @props value           — currently selected customer ID
 * @props onSelect        — callback when a customer is chosen
 * @props onRepeatOrder   — callback with repeat-order data (items, stitchingTier, premiums)
 * @props onNewCustomer   — callback when inline mini-form is submitted (adds new customer to list)
 */

import React, { useState, useEffect } from 'react'
import { Combobox } from '@/components/ui/combobox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  User,
  Phone,
  Mail,
  ShoppingBag,
  Ruler,
  RefreshCw,
  Plus,
  X,
  Loader2,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────

export type CustomerSummary = {
  id: string
  name: string
  phone: string
  email?: string | null
  city?: string | null
}

export type RepeatOrderData = {
  items: Array<{
    garmentPatternId: string
    clothInventoryId: string
    bodyType: 'SLIM' | 'REGULAR' | 'LARGE' | 'XL'
    accessories: Array<{ accessoryId: string; quantity: number }>
  }>
  stitchingTier: 'BASIC' | 'PREMIUM' | 'LUXURY'
  isHandStitched: boolean
  isFullCanvas: boolean
  isRushOrder: boolean
  hasComplexDesign: boolean
  additionalFittings: number
  hasPremiumLining: boolean
  fabricWastagePercent: number
  designerConsultationFee: number
  sourceOrderNumber: string
}

interface CustomerSelectorProps {
  customers: CustomerSummary[]
  value: string
  onSelect: (customerId: string) => void
  onRepeatOrder: (data: RepeatOrderData) => void
  /** Optional — if not provided, the "Add new customer" action is hidden (use when
   *  the current user lacks the `manage_customers` permission). */
  onNewCustomer?: (customer: CustomerSummary) => void
}

// ── Inline mini-form for creating a new customer ──────────────────

function InlineNewCustomerForm({
  onSave,
  onCancel,
}: {
  onSave: (customer: CustomerSummary) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) {
      setError('Name and phone are required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), city: city.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create customer')
        return
      }
      onSave(data.customer)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="mt-3 border-blue-200 bg-blue-50/40">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Plus className="h-4 w-4 text-blue-600" />
            New Customer
          </p>
          <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Full name"
                className="h-8 text-sm"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Phone <span className="text-red-500">*</span>
              </label>
              <Input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 98XXX XXXXX"
                type="tel"
                className="h-8 text-sm"
                required
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">City (Optional)</label>
            <Input
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="Amritsar, Delhi…"
              className="h-8 text-sm"
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Full customer details can be completed from the Customers section later.
          </p>
          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" disabled={saving} className="h-8">
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              {saving ? 'Saving…' : 'Save & Select'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onCancel} className="h-8">
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ── Customer profile card shown after selection ───────────────────

function CustomerCard({
  customer,
  onRepeatOrder,
}: {
  customer: CustomerSummary & {
    lastOrder?: { orderNumber: string; garmentTypes: string[]; deliveryDate: string } | null
    measurementTypes?: string[]
  }
  onRepeatOrder: () => void
}) {
  return (
    <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
      {/* Customer identity */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="font-semibold text-slate-900 flex items-center gap-2">
            <User className="h-4 w-4 text-blue-600" />
            {customer.name}
          </p>
          <p className="text-sm text-slate-600 flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {customer.phone}
          </p>
          {customer.email && (
            <p className="text-sm text-slate-600 flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {customer.email}
            </p>
          )}
          {customer.city && (
            <p className="text-xs text-slate-500">{customer.city}</p>
          )}
        </div>
      </div>

      {/* Last order summary */}
      {customer.lastOrder ? (
        <div className="border-t border-blue-200 pt-3">
          <p className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
            <ShoppingBag className="h-3 w-3" />
            Last order: {customer.lastOrder.orderNumber}
          </p>
          <div className="flex flex-wrap gap-1">
            {customer.lastOrder.garmentTypes.map(g => (
              <Badge key={g} variant="outline" className="text-[10px] py-0 border-blue-300 text-blue-700">
                {g}
              </Badge>
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRepeatOrder}
            className="mt-2 h-7 text-xs border-blue-400 text-blue-700 hover:bg-blue-100 gap-1.5"
          >
            <RefreshCw className="h-3 w-3" />
            Repeat this order
          </Button>
        </div>
      ) : (
        <p className="text-xs text-slate-400 border-t border-blue-200 pt-2 flex items-center gap-1">
          <ShoppingBag className="h-3 w-3" />
          No previous orders — this is a new customer
        </p>
      )}

      {/* Saved measurements */}
      {customer.measurementTypes && customer.measurementTypes.length > 0 && (
        <div className="border-t border-blue-200 pt-2">
          <p className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
            <Ruler className="h-3 w-3" />
            Measurements on file
          </p>
          <div className="flex flex-wrap gap-1">
            {customer.measurementTypes.map(t => (
              <Badge key={t} variant="outline" className="text-[10px] py-0 border-green-300 text-green-700">
                {t} ✓
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main CustomerSelector component ──────────────────────────────

export function CustomerSelector({
  customers,
  value,
  onSelect,
  onRepeatOrder,
  onNewCustomer,
}: CustomerSelectorProps) {
  const [showNewForm, setShowNewForm] = useState(false)
  const [customerDetail, setCustomerDetail] = useState<any>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [repeatLoading, setRepeatLoading] = useState(false)

  // Build combobox options
  const options = customers.map(c => ({
    value: c.id,
    label: c.name,
    sublabel: c.phone,
  }))

  // Load customer details whenever value changes (handles both user selection and
  // external pre-population e.g. /orders/new?customerId=...)
  useEffect(() => {
    if (!value) {
      setCustomerDetail(null)
      return
    }
    // Skip if we already have up-to-date details for this customer
    if (customerDetail?.id === value) return

    let cancelled = false
    setLoadingDetail(true)
    setCustomerDetail(null)

    fetch(`/api/customers/${value}`, { credentials: 'include' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data) return
        const customer = data.customer
        const lastOrder = customer.orders?.[0]
          ? {
              orderNumber: customer.orders[0].orderNumber,
              garmentTypes: customer.orders[0].items?.map((i: any) => i.garmentPattern?.name).filter(Boolean) ?? [],
              deliveryDate: customer.orders[0].deliveryDate,
            }
          : null
        const measurementTypes = customer.measurements?.map((m: any) => m.garmentType) ?? []
        setCustomerDetail({ ...customer, lastOrder, measurementTypes })
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingDetail(false) })

    return () => { cancelled = true }
  // customerDetail intentionally excluded to avoid a feedback loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const handleSelect = (customerId: string) => {
    onSelect(customerId)
    // Detail loading is handled by the useEffect above
  }

  // Fetch the full last-order data and pass it back to the parent form
  const handleRepeatOrder = async () => {
    if (!customerDetail?.orders?.[0]) return
    const lastOrderId = customerDetail.orders[0].id
    setRepeatLoading(true)
    try {
      const res = await fetch(`/api/orders/${lastOrderId}`, { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      const order = data.order
      // Build repeat data from the last order
      const repeatData: RepeatOrderData = {
        sourceOrderNumber: order.orderNumber,
        stitchingTier: order.stitchingTier ?? 'BASIC',
        isHandStitched: order.isHandStitched ?? false,
        isFullCanvas: order.isFullCanvas ?? false,
        isRushOrder: false, // never repeat rush order automatically
        hasComplexDesign: order.hasComplexDesign ?? false,
        additionalFittings: order.additionalFittings ?? 0,
        hasPremiumLining: order.hasPremiumLining ?? false,
        fabricWastagePercent: order.fabricWastagePercent ?? 0,
        designerConsultationFee: order.designerConsultationFee ?? 0,
        items: (order.items ?? []).map((item: any) => ({
          garmentPatternId: item.garmentPattern?.id ?? item.garmentPatternId,
          clothInventoryId: item.clothInventory?.id ?? item.clothInventoryId,
          bodyType: item.bodyType ?? 'REGULAR',
          accessories: [], // accessories re-load from pattern defaults
        })),
      }
      onRepeatOrder(repeatData)
    } catch { /* ignore */ }
    finally { setRepeatLoading(false) }
  }

  return (
    <div>
      {/* Combobox (replaces <select>) */}
      <Combobox
        options={options}
        value={value}
        onSelect={handleSelect}
        placeholder="Search by name or phone…"
        emptyMessage="No matching customers"
        onAddNew={onNewCustomer ? () => setShowNewForm(true) : undefined}
        onAddNewLabel="Add new customer"
      />

      {/* Inline new-customer mini-form — only shown when onNewCustomer is provided */}
      {showNewForm && onNewCustomer && (
        <InlineNewCustomerForm
          onSave={(newCustomer) => {
            onNewCustomer(newCustomer)
            setShowNewForm(false)
            handleSelect(newCustomer.id)
          }}
          onCancel={() => setShowNewForm(false)}
        />
      )}

      {/* Customer profile card (shown after selection) */}
      {value && !showNewForm && (
        loadingDetail
          ? (
            <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading customer details…
            </div>
          )
          : customerDetail && (
            <CustomerCard
              customer={customerDetail}
              onRepeatOrder={repeatLoading ? () => {} : handleRepeatOrder}
            />
          )
      )}
    </div>
  )
}
