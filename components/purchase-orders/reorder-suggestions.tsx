'use client'

/**
 * @featuretrace Reorder suggestions panel
 * @description Items whose available + on-order stock is at or below the minimum (lib/reorder.ts), with
 *   the suggested quantity and supplier, a link that opens a pre-filled purchase order, and — for
 *   manage_inventory — "Run reorder check" (POST /api/inventory/reorder/run), which refreshes reorder
 *   alerts and, when auto-reorder is on in Settings → Inventory, drafts purchase orders for approval.
 * @calls GET /api/inventory/reorder (view_inventory; estimated cost only for inventory-cost roles)
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { hasPermission, type UserRole } from '@/lib/permissions'
import { useFieldVisibility } from '@/hooks/use-field-visibility'

interface Suggestion {
  kind: 'cloth' | 'accessory'
  id: string
  sku: string
  name: string
  itemType: 'CLOTH' | 'ACCESSORY'
  unit: 'meters' | 'pieces'
  available: number
  onOrder: number
  minimum: number
  suggestedQuantity: number
  supplierId: string | null
  supplierName: string | null
  severity: string
  estimatedCost?: number
}

interface SuggestionsResponse {
  items: Suggestion[]
  autoReorderEnabled: boolean
  canRunReorderCheck: boolean
}

interface RunResult {
  needs: number
  alertsCreated: number
  alertsUpdated: number
  alertsResolved: number
  purchaseOrders: Array<{ id: string; poNumber: string; created: boolean; linesAdded: number }>
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))

function runSummary(result: RunResult): string {
  const parts = [`${result.needs} item${result.needs === 1 ? '' : 's'} need a reorder`]
  if (result.alertsCreated) parts.push(`${result.alertsCreated} alert${result.alertsCreated === 1 ? '' : 's'} raised`)
  if (result.alertsResolved) parts.push(`${result.alertsResolved} resolved`)
  if (result.purchaseOrders.length > 0) {
    parts.push(`draft PO${result.purchaseOrders.length === 1 ? '' : 's'} ${result.purchaseOrders.map((po) => po.poNumber).join(', ')}`)
  }
  return parts.join(' · ')
}

export function ReorderSuggestions({ onRan }: { onRan?: () => void }) {
  const { role } = useFieldVisibility()
  const canCreatePO =
    !!role && (hasPermission(role as UserRole, 'manage_purchase_orders') || hasPermission(role as UserRole, 'manage_inventory'))
  const [data, setData] = useState<SuggestionsResponse | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'hidden' | 'error'>('loading')
  const [running, setRunning] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch('/api/inventory/reorder')
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 403) return setState('hidden') // role cannot view inventory
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setData(await res.json())
        setState('ready')
      })
      .catch((error) => {
        console.error('Failed to load reorder suggestions:', error)
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const runCheck = async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/inventory/reorder/run', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (res.status === 409) {
        toast.info(body.error || 'A reorder check is already running')
        return
      }
      if (!res.ok) throw new Error(body.error || 'Failed to run the reorder check')
      toast.success(runSummary(body.result))
      setReloadKey((k) => k + 1)
      onRan?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to run the reorder check')
    } finally {
      setRunning(false)
    }
  }

  if (state === 'hidden') return null

  const items = data?.items ?? []
  const showCost = items.some((item) => typeof item.estimatedCost === 'number')

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Reorder suggestions
              {items.length > 0 && <Badge variant="destructive">{items.length}</Badge>}
            </CardTitle>
            <CardDescription>
              Items whose available plus on-order stock is at or below the minimum.{' '}
              {data?.autoReorderEnabled
                ? 'Auto-reorder is on: the check drafts purchase orders for approval.'
                : 'Auto-reorder is off: the check raises alerts only (Admin Settings → Inventory).'}
            </CardDescription>
          </div>
          {data?.canRunReorderCheck && (
            <Button variant="outline" size="sm" onClick={runCheck} disabled={running} className="shrink-0">
              <RefreshCw className={`mr-2 h-4 w-4 ${running ? 'animate-spin' : ''}`} />
              {running ? 'Checking…' : 'Run reorder check'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {state === 'loading' ? (
          <p className="text-sm text-slate-500">Loading suggestions…</p>
        ) : state === 'error' ? (
          <p className="text-sm text-red-600">Could not load reorder suggestions.</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">Every item is above its minimum, counting stock already on order.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-slate-500">
                <tr>
                  <th className="pb-2 pr-3">Item</th>
                  <th className="pb-2 pr-3 text-right">Available</th>
                  <th className="pb-2 pr-3 text-right">Minimum</th>
                  <th className="pb-2 pr-3 text-right">On order</th>
                  <th className="pb-2 pr-3 text-right">Suggested</th>
                  <th className="pb-2 pr-3">Supplier</th>
                  {showCost && <th className="pb-2 pr-3 text-right">Est. cost</th>}
                  {canCreatePO && <th className="pb-2" />}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const u = item.unit === 'meters' ? 'm' : ' pcs'
                  const href = `/inventory/${item.kind === 'cloth' ? 'cloth' : 'accessories'}/${item.id}`
                  const poHref =
                    `/purchase-orders/new?itemType=${item.itemType}&itemId=${item.id}&quantity=${item.suggestedQuantity}` +
                    (item.supplierId ? `&supplierId=${item.supplierId}` : '')
                  return (
                    <tr key={`${item.kind}:${item.id}`} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <Link href={href} className="font-medium hover:text-blue-600">
                          {item.name}
                        </Link>
                        <span className="block text-xs text-slate-500 font-mono">{item.sku}</span>
                      </td>
                      <td className={`py-2 pr-3 text-right ${item.available <= 0 ? 'text-red-600 font-semibold' : ''}`}>
                        {fmt(item.available)}{u}
                      </td>
                      <td className="py-2 pr-3 text-right">{fmt(item.minimum)}{u}</td>
                      <td className="py-2 pr-3 text-right">{fmt(item.onOrder)}{u}</td>
                      <td className="py-2 pr-3 text-right font-semibold">{fmt(item.suggestedQuantity)}{u}</td>
                      <td className="py-2 pr-3">
                        {item.supplierName ?? <span className="text-amber-700">No supplier linked</span>}
                      </td>
                      {showCost && (
                        <td className="py-2 pr-3 text-right">
                          {typeof item.estimatedCost === 'number' ? formatCurrency(item.estimatedCost) : '—'}
                        </td>
                      )}
                      {canCreatePO && (
                        <td className="py-2 text-right">
                          <Button size="sm" variant="outline" asChild>
                            <Link href={poHref}>Order</Link>
                          </Button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
