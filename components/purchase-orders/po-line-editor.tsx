'use client'

/**
 * @featuretrace Purchase-order line editor (inventory-linked)
 * @description Every PO line picks an active inventory item of its type — there are no free-text lines.
 *   Options come from GET /api/inventory/reorder?scope=all&supplierId=… : available, minimum, on order,
 *   suggested reorder quantity, usual supplier and (for roles with inventory cost access) the default
 *   price — the supplier's current price for the fabric, otherwise the item's price.
 *   The server derives each line's name and unit from the item.
 *   Used by app/(dashboard)/purchase-orders/new/page.tsx and components/dashboard/create-po-dialog.tsx.
 */

import { useEffect, useState } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Combobox } from '@/components/ui/combobox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { multiplyMoney } from '@/lib/money'

export type POItemType = 'CLOTH' | 'ACCESSORY'

export interface InventoryOption {
  id: string
  itemType: POItemType
  sku: string
  name: string
  lineName: string
  unit: 'meters' | 'pieces'
  available: number
  onOrder: number
  minimum: number
  reorderQuantity: number | null
  needsReorder: boolean
  suggestedQuantity: number
  supplierId: string | null
  supplierName: string | null
  /** Absent for roles without inventory cost access */
  unitPrice?: number
}

/** quantity / pricePerUnit null = use the suggestion / default price for the chosen item */
export interface POLineDraft {
  key: string
  itemType: POItemType
  itemId: string
  quantity: number | null
  pricePerUnit: number | null
}

let lineCounter = 0
export function newLineDraft(partial: Partial<Omit<POLineDraft, 'key'>> = {}): POLineDraft {
  lineCounter += 1
  return { key: `po-line-${lineCounter}`, itemType: 'CLOTH', itemId: '', quantity: null, pricePerUnit: null, ...partial }
}

const optionKey = (itemType: POItemType, id: string) => `${itemType}:${id}`

/** Active inventory with stock positions, priced for the PO's supplier. */
export function useInventoryOptions(supplierId: string) {
  const key = supplierId || '-'
  const [loaded, setLoaded] = useState<{ key: string; items: InventoryOption[] } | null>(null)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ scope: 'all' })
    if (supplierId) params.set('supplierId', supplierId)
    fetch(`/api/inventory/reorder?${params}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        if (!cancelled) setLoaded({ key, items: data.items ?? [] })
      })
      .catch((error) => {
        console.error('Failed to load inventory items:', error)
        if (!cancelled) setLoaded({ key, items: [] })
      })
    return () => {
      cancelled = true
    }
  }, [key, supplierId])

  return { options: loaded?.items ?? [], loading: loaded?.key !== key }
}

export function resolveLine(line: POLineDraft, options: InventoryOption[]) {
  const option = options.find((o) => o.id === line.itemId && o.itemType === line.itemType)
  return {
    option,
    quantity: line.quantity ?? option?.suggestedQuantity ?? 0,
    pricePerUnit: line.pricePerUnit ?? option?.unitPrice ?? 0,
  }
}

/** Null when the line can be submitted, otherwise the problem. */
export function lineProblem(line: POLineDraft, options: InventoryOption[]): string | null {
  const { option, quantity } = resolveLine(line, options)
  if (!option) return 'Choose the inventory item for every line'
  if (!(quantity > 0)) return `Enter a quantity for ${option.name}`
  if (option.itemType === 'ACCESSORY' && !Number.isInteger(quantity)) return `${option.name}: accessory quantities must be whole units`
  return null
}

/** Request body lines for POST /api/purchase-orders. */
export function linesToPayload(lines: POLineDraft[], options: InventoryOption[], canEnterPrices: boolean) {
  return lines.map((line) => {
    const { quantity, pricePerUnit } = resolveLine(line, options)
    return {
      itemType: line.itemType,
      ...(line.itemType === 'CLOTH' ? { clothInventoryId: line.itemId } : { accessoryInventoryId: line.itemId }),
      quantity,
      ...(canEnterPrices && { pricePerUnit }),
    }
  })
}

export function linesTotal(lines: POLineDraft[], options: InventoryOption[]): number {
  return lines.reduce((sum, line) => {
    const { quantity, pricePerUnit } = resolveLine(line, options)
    return sum + multiplyMoney(pricePerUnit, quantity || 0)
  }, 0)
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))
const shortUnit = (unit: InventoryOption['unit']) => (unit === 'meters' ? 'm' : ' pcs')

export function describeStock(o: InventoryOption): string {
  const u = shortUnit(o.unit)
  return (
    `Available ${fmt(o.available)}${u} · Min ${fmt(o.minimum)}${u} · On order ${fmt(o.onOrder)}${u}` +
    (o.needsReorder ? ` · Reorder ${fmt(o.suggestedQuantity)}${u}` : '')
  )
}

interface POLineEditorProps {
  index: number
  line: POLineDraft
  options: InventoryOption[]
  optionsLoading: boolean
  /** The PO's supplier; lines whose item is usually bought elsewhere show a warning */
  supplierId: string
  canEnterPrices: boolean
  /** Items already chosen on other lines (`${itemType}:${id}`) */
  takenKeys: Set<string>
  onChange: (line: POLineDraft) => void
  onRemove?: () => void
  onItemSelected?: (option: InventoryOption) => void
}

export function POLineEditor({
  index,
  line,
  options,
  optionsLoading,
  supplierId,
  canEnterPrices,
  takenKeys,
  onChange,
  onRemove,
  onItemSelected,
}: POLineEditorProps) {
  const isCloth = line.itemType === 'CLOTH'
  const { option: selected, quantity, pricePerUnit } = resolveLine(line, options)
  const choices = options.filter(
    (o) => o.itemType === line.itemType && (o.id === line.itemId || !takenKeys.has(optionKey(o.itemType, o.id)))
  )
  const supplierMismatch = !!selected?.supplierId && !!supplierId && selected.supplierId !== supplierId
  const wholeUnitsProblem = !isCloth && quantity > 0 && !Number.isInteger(quantity)

  const selectItem = (id: string) => {
    const option = options.find((o) => o.id === id && o.itemType === line.itemType)
    if (!option) return
    onChange({ ...line, itemId: id, pricePerUnit: null })
    onItemSelected?.(option)
  }

  return (
    <div className="grid gap-3 p-4 border rounded-lg bg-slate-50">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-600">Item {index + 1}</span>
        {onRemove && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} aria-label={`Remove item ${index + 1}`}>
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-[170px_1fr]">
        <div className="grid gap-1.5">
          <Label className="text-xs">Type *</Label>
          <Select
            value={line.itemType}
            onValueChange={(value) =>
              onChange({ ...line, itemType: value as POItemType, itemId: '', quantity: null, pricePerUnit: null })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CLOTH">Fabric</SelectItem>
              <SelectItem value="ACCESSORY">Accessory</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5 min-w-0">
          <Label className="text-xs">Inventory item *</Label>
          <Combobox
            options={choices.map((o) => ({
              value: o.id,
              label: o.lineName,
              sublabel: [describeStock(o), o.supplierName].filter(Boolean).join(' · '),
            }))}
            value={line.itemId}
            onSelect={selectItem}
            placeholder={optionsLoading ? 'Loading inventory…' : `Search ${isCloth ? 'fabrics' : 'accessories'} by name or SKU…`}
            emptyMessage={`No active ${isCloth ? 'fabrics' : 'accessories'} found`}
            disabled={optionsLoading}
          />
        </div>
      </div>

      {selected && (
        <p className="text-xs text-slate-600">
          {describeStock(selected)}
          {selected.supplierName && <> · Usual supplier: {selected.supplierName}</>}
        </p>
      )}
      {supplierMismatch && (
        <p className="flex items-center gap-1 text-xs text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5" />
          Usually bought from {selected?.supplierName ?? 'another supplier'} — check the supplier before submitting.
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="grid gap-1.5">
          <Label className="text-xs">Quantity ({isCloth ? 'meters' : 'pieces'}) *</Label>
          <Input
            type="number"
            min="0"
            step={isCloth ? '0.01' : '1'}
            value={line.quantity ?? (selected?.suggestedQuantity || '')}
            onChange={(e) => onChange({ ...line, quantity: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </div>
        {canEnterPrices && (
          <>
            <div className="grid gap-1.5">
              <Label className="text-xs">Price per unit *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={line.pricePerUnit ?? (selected?.unitPrice ?? '')}
                onChange={(e) => onChange({ ...line, pricePerUnit: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Line total</Label>
              <div className="h-10 flex items-center px-3 rounded-md bg-slate-100 font-semibold text-sm">
                {formatCurrency(multiplyMoney(pricePerUnit, quantity || 0))}
              </div>
            </div>
          </>
        )}
      </div>
      {wholeUnitsProblem && <p className="text-xs text-red-600">Accessory quantities must be whole units.</p>}
    </div>
  )
}

/** Keys of items chosen on every line except `exceptKey`. */
export function takenKeysExcept(lines: POLineDraft[], exceptKey: string): Set<string> {
  return new Set(lines.filter((l) => l.key !== exceptKey && l.itemId).map((l) => optionKey(l.itemType, l.itemId)))
}
