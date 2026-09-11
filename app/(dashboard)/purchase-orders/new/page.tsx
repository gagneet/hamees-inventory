'use client'

/**
 * @featuretrace Purchase Orders → New
 * @page /purchase-orders/new
 * @description Every line picks an active inventory item (components/purchase-orders/po-line-editor.tsx);
 *   the server derives the line name and unit. Pre-fill via ?supplierId=&itemType=CLOTH|ACCESSORY&itemId=&quantity=
 *   (used by reorder suggestions, alerts and the inventory detail pages). Only the owner enters prices at
 *   creation; other roles' POs wait for approval with prices.
 * @calls POST /api/purchase-orders — shows any supplier-mismatch warnings it returns
 */

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Home, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import DashboardLayout from '@/components/DashboardLayout'
import { formatCurrency } from '@/lib/utils'
import { useFieldVisibility } from '@/hooks/use-field-visibility'
import {
  POLineEditor,
  lineProblem,
  linesToPayload,
  linesTotal,
  newLineDraft,
  takenKeysExcept,
  useInventoryOptions,
  type POLineDraft,
} from '@/components/purchase-orders/po-line-editor'

interface Supplier {
  id: string
  name: string
  phone: string
  email: string | null
}

function NewPurchaseOrderContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { role, isLoading } = useFieldVisibility()
  const canEnterPOPricesOnCreate = role === 'OWNER'
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    supplierId: searchParams.get('supplierId') || '',
    expectedDate: '',
    notes: '',
  })

  const [lines, setLines] = useState<POLineDraft[]>(() => {
    const quantity = Number(searchParams.get('quantity'))
    return [
      newLineDraft({
        itemType: searchParams.get('itemType') === 'ACCESSORY' ? 'ACCESSORY' : 'CLOTH',
        itemId: searchParams.get('itemId') || '',
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : null,
      }),
    ]
  })

  const { options, loading: optionsLoading } = useInventoryOptions(formData.supplierId)

  useEffect(() => {
    fetch('/api/suppliers')
      .then((response) => response.json())
      .then((data) => setSuppliers(data.suppliers || []))
      .catch((error) => console.error('Error fetching suppliers:', error))
  }, [])

  const updateLine = (line: POLineDraft) => setLines((current) => current.map((l) => (l.key === line.key ? line : l)))
  const removeLine = (key: string) => setLines((current) => current.filter((l) => l.key !== key))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const problem = lines.map((line) => lineProblem(line, options)).find(Boolean)
    if (problem) {
      toast.error(problem)
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          expectedDate: formData.expectedDate || null,
          notes: formData.notes || null,
          items: linesToPayload(lines, options, canEnterPOPricesOnCreate),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Failed to create purchase order')

      for (const warning of data.warnings ?? []) toast.warning(warning)
      toast.success(`Purchase order ${data.purchaseOrder.poNumber} created`)
      router.push(`/purchase-orders/${data.purchaseOrder.id}`)
    } catch (error) {
      console.error('Error creating purchase order:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create purchase order')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">
              <Home className="h-4 w-4" />
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/purchase-orders">Purchase Orders</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>New Purchase Order</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold md:text-2xl">Create Purchase Order</h1>
        <Button variant="outline" asChild>
          <Link href="/purchase-orders">Cancel</Link>
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Supplier Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Supplier Information</CardTitle>
            <CardDescription>Select the supplier for this purchase order</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="supplier">Supplier *</Label>
              <Select
                value={formData.supplierId}
                onValueChange={(value) => setFormData({ ...formData, supplierId: value })}
                required
              >
                <SelectTrigger id="supplier">
                  <SelectValue placeholder="Select a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name} - {supplier.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="expectedDate">Expected Delivery Date</Label>
              <DatePicker
                value={formData.expectedDate ? new Date(formData.expectedDate + 'T00:00:00') : undefined}
                onChange={(d) =>
                  setFormData({
                    ...formData,
                    expectedDate: d
                      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                      : '',
                  })
                }
                placeholder="Select expected date"
                fromDate={new Date()}
              />
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Order Items</CardTitle>
                <CardDescription>
                  Pick the fabric or accessory each line restocks. Quantities default to the suggested reorder
                  quantity.
                </CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setLines((current) => [...current, newLineDraft()])}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {lines.map((line, index) => (
              <POLineEditor
                key={line.key}
                index={index}
                line={line}
                options={options}
                optionsLoading={optionsLoading}
                supplierId={formData.supplierId}
                canEnterPrices={canEnterPOPricesOnCreate}
                takenKeys={takenKeysExcept(lines, line.key)}
                onChange={updateLine}
                onRemove={lines.length > 1 ? () => removeLine(line.key) : undefined}
                onItemSelected={(option) => {
                  if (!formData.supplierId && option.supplierId) {
                    setFormData((current) => ({ ...current, supplierId: option.supplierId! }))
                  }
                }}
              />
            ))}
          </CardContent>
        </Card>

        {/* Additional Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Additional Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add any additional notes or instructions..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        {canEnterPOPricesOnCreate && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Items:</span>
                  <span className="font-semibold">{lines.length}</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span className="font-semibold">Total Amount:</span>
                  <span className="font-bold text-blue-600">{formatCurrency(linesTotal(lines, options))}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" asChild>
            <Link href="/purchase-orders">Cancel</Link>
          </Button>
          <Button type="submit" disabled={loading || isLoading || optionsLoading || !formData.supplierId}>
            {loading ? 'Creating...' : 'Create Purchase Order'}
          </Button>
        </div>
      </form>
    </DashboardLayout>
  )
}

export default function NewPurchaseOrderPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="flex items-center justify-center h-96">
            <p className="text-slate-500">Loading...</p>
          </div>
        </DashboardLayout>
      }
    >
      <NewPurchaseOrderContent />
    </Suspense>
  )
}
