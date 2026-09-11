'use client'

/**
 * @featuretrace Create PO dialog (inventory manager dashboard)
 * @description Same inventory-linked lines as /purchase-orders/new (components/purchase-orders/po-line-editor.tsx).
 *   Critical fabrics open pre-filled (about three months of usage, at least 50 m each); when no supplier is
 *   chosen, the first pre-filled fabric's usual supplier is suggested.
 */

import { formatCurrency } from '@/lib/utils'
import { useState } from 'react'
import { useFieldVisibility } from '@/hooks/use-field-visibility'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ShoppingCart, Plus, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
  POLineEditor,
  lineProblem,
  linesToPayload,
  linesTotal,
  newLineDraft,
  resolveLine,
  takenKeysExcept,
  useInventoryOptions,
  type POLineDraft,
} from '@/components/purchase-orders/po-line-editor'

interface Supplier {
  id: string
  name: string
  phone: string | null
  email: string | null
}

interface CriticalFabric {
  id: string
  name: string
  availableStock: number
  usageRate: number
  daysRemaining: number
}

interface CreatePODialogProps {
  trigger: React.ReactNode
  criticalFabrics?: CriticalFabric[]
}

export function CreatePODialog({ trigger, criticalFabrics = [] }: CreatePODialogProps) {
  const router = useRouter()
  const { role, isLoading } = useFieldVisibility()
  const canEnterPOPricesOnCreate = role === 'OWNER'
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  // Form state
  const [supplierId, setSupplierId] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<POLineDraft[]>([])

  const { options, loading: optionsLoading } = useInventoryOptions(supplierId)
  // Suggest the usual supplier of the first pre-filled item until one is chosen
  const suggestedSupplierId = supplierId
    ? ''
    : (lines.map((line) => resolveLine(line, options).option?.supplierId).find(Boolean) ?? '')
  const effectiveSupplierId = supplierId || suggestedSupplierId

  async function fetchSuppliers() {
    try {
      const response = await fetch('/api/suppliers')
      const data = await response.json()
      if (response.ok && data.suppliers) {
        setSuppliers(data.suppliers)
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) return
    fetchSuppliers()
    // Pre-populate lines with critical fabrics (about 3 months of usage, 50 m minimum)
    if (criticalFabrics.length > 0 && lines.length === 0) {
      setLines(
        criticalFabrics.map((fabric) =>
          newLineDraft({ itemType: 'CLOTH', itemId: fabric.id, quantity: Math.ceil(Math.max(fabric.usageRate * 3, 50)) })
        )
      )
    }
  }

  const updateLine = (line: POLineDraft) => setLines((current) => current.map((l) => (l.key === line.key ? line : l)))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!effectiveSupplierId) {
      toast.error('Please select a supplier')
      return
    }
    if (lines.length === 0) {
      toast.error('Please add at least one item')
      return
    }
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
          supplierId: effectiveSupplierId,
          expectedDate: expectedDate || null,
          items: linesToPayload(lines, options, canEnterPOPricesOnCreate),
          notes: notes || null,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (response.ok) {
        for (const warning of data.warnings ?? []) toast.warning(warning)
        toast.success('Purchase order created successfully')
        setOpen(false)
        // Reset form
        setSupplierId('')
        setExpectedDate('')
        setNotes('')
        setLines([])
        router.push(`/purchase-orders/${data.purchaseOrder.id}`)
      } else {
        toast.error(data.error || 'Failed to create purchase order')
      }
    } catch (error) {
      console.error('Error creating PO:', error)
      toast.error('Failed to create purchase order')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-blue-600" />
            Create Purchase Order
          </DialogTitle>
          <DialogDescription>
            {criticalFabrics.length > 0 ? (
              <span className="text-red-600 font-medium flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                Creating PO for {criticalFabrics.length} critical stock item(s)
              </span>
            ) : (
              'Create a new purchase order for restocking inventory'
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Supplier Selection */}
          <div className="space-y-2">
            <Label htmlFor="supplier">Supplier *</Label>
            <Select value={effectiveSupplierId} onValueChange={setSupplierId}>
              <SelectTrigger id="supplier">
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                    {supplier.phone && ` • ${supplier.phone}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {suggestedSupplierId && (
              <p className="text-xs text-slate-500">Suggested from the items&apos; usual supplier — change it if needed.</p>
            )}
          </div>

          {/* Expected Date */}
          <div className="space-y-2">
            <Label htmlFor="expectedDate">Expected Delivery Date</Label>
            <Input
              id="expectedDate"
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
            />
          </div>

          {/* Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Items *</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setLines((current) => [...current, newLineDraft()])}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>

            {lines.length === 0 ? (
              <div className="p-8 text-center text-slate-500 border-2 border-dashed rounded-lg">
                <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>No items added yet</p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2"
                  onClick={() => setLines([newLineDraft()])}
                >
                  Add First Item
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {lines.map((line, index) => (
                  <POLineEditor
                    key={line.key}
                    index={index}
                    line={line}
                    options={options}
                    optionsLoading={optionsLoading}
                    supplierId={effectiveSupplierId}
                    canEnterPrices={canEnterPOPricesOnCreate}
                    takenKeys={takenKeysExcept(lines, line.key)}
                    onChange={updateLine}
                    onRemove={() => setLines((current) => current.filter((l) => l.key !== line.key))}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes or instructions"
              rows={3}
            />
          </div>

          {/* Total Amount */}
          {lines.length > 0 && canEnterPOPricesOnCreate && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-blue-900">
                  Total PO Amount:
                </span>
                <span className="text-2xl font-bold text-blue-900">
                  {formatCurrency(linesTotal(lines, options))}
                </span>
              </div>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || isLoading || optionsLoading}>
              {loading ? 'Creating...' : 'Create Purchase Order'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
