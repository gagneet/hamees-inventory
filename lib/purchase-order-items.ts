/**
 * FEATURETRACE: Purchase-order lines linked to inventory
 *
 * Every PO line restocks exactly one inventory item (POItem.clothInventoryId for CLOTH lines,
 * accessoryInventoryId for ACCESSORY lines). The line's name and unit are derived from the item on
 * the server — never taken from the client — so receipts, on-order totals and reorder checks can
 * rely on the link. Shared by POST /api/purchase-orders and the automatic reorder check (lib/reorder.ts).
 */

import type { TransactionClient } from '@/lib/prisma-client'

export type POItemType = 'CLOTH' | 'ACCESSORY'

/** Statuses whose outstanding quantities count as "on order". */
export const OPEN_PO_STATUSES = ['PENDING_APPROVAL', 'PENDING', 'APPROVED', 'PARTIAL'] as const

/** Open statuses still waiting for approval (legacy PENDING included): they don't settle a reorder yet. */
export const UNAPPROVED_PO_STATUSES = ['PENDING_APPROVAL', 'PENDING'] as const

export const PO_LINE_UNIT: Record<POItemType, 'meters' | 'pieces'> = {
  CLOTH: 'meters',
  ACCESSORY: 'pieces',
}

/** Linked inventory item shown on PO lines (identity only, no prices). */
export const poItemInventoryInclude = {
  clothInventory: { select: { id: true, sku: true, name: true, color: true, active: true } },
  accessoryInventory: { select: { id: true, sku: true, name: true, color: true, active: true } },
} as const

/** "Premium Cotton — Raymond, Navy Blue (CLT-COT-RAY-001)" */
export function clothLineName(cloth: { name: string; brand?: string | null; color?: string | null; sku: string }): string {
  const details = [cloth.brand, cloth.color].filter((part) => part && part.trim()).join(', ')
  return `${cloth.name}${details ? ` — ${details}` : ''} (${cloth.sku})`
}

/** "Shell Buttons — Ivory (ACC-BUT-001)" */
export function accessoryLineName(accessory: { name: string; color?: string | null; sku: string }): string {
  return `${accessory.name}${accessory.color?.trim() ? ` — ${accessory.color}` : ''} (${accessory.sku})`
}

/** Outstanding quantity of one item on open purchase orders, with the POs it is on. */
export async function onOrderFor(
  client: Pick<TransactionClient, 'pOItem'>,
  kind: 'cloth' | 'accessory',
  itemId: string
): Promise<{
  onOrder: number
  /** The part of onOrder on purchase orders not yet approved */
  awaitingApproval: number
  openPurchaseOrders: Array<{ id: string; poNumber: string; status: string; outstanding: number }>
}> {
  const lines = await client.pOItem.findMany({
    where: {
      ...(kind === 'cloth' ? { clothInventoryId: itemId } : { accessoryInventoryId: itemId }),
      purchaseOrder: { active: true, status: { in: [...OPEN_PO_STATUSES] } },
    },
    select: {
      orderedQuantity: true,
      receivedQuantity: true,
      purchaseOrder: { select: { id: true, poNumber: true, status: true } },
    },
  })
  const openPurchaseOrders = (lines ?? [])
    .map((line) => ({
      id: line.purchaseOrder.id,
      poNumber: line.purchaseOrder.poNumber,
      status: line.purchaseOrder.status,
      outstanding: Math.round(Math.max(0, line.orderedQuantity - line.receivedQuantity) * 1000) / 1000,
    }))
    .filter((po) => po.outstanding > 0)
  const total = (pos: typeof openPurchaseOrders) => Math.round(pos.reduce((sum, po) => sum + po.outstanding, 0) * 1000) / 1000
  const unapproved = new Set<string>(UNAPPROVED_PO_STATUSES)
  return {
    onOrder: total(openPurchaseOrders),
    awaitingApproval: total(openPurchaseOrders.filter((po) => unapproved.has(po.status))),
    openPurchaseOrders,
  }
}

/**
 * Next PO number for the year: PO-YYYY-NNNN. Takes the larger of the highest number already used this
 * year and the overall PO count, so gaps or cancelled POs never produce a duplicate.
 */
export async function nextPoNumber(
  client: Pick<TransactionClient, 'purchaseOrder'>,
  now: Date = new Date()
): Promise<string> {
  const prefix = `PO-${now.getFullYear()}-`
  // Sequential: may run inside an interactive transaction
  const count = await client.purchaseOrder.count()
  const recent = await client.purchaseOrder.findMany({
    where: { poNumber: { startsWith: prefix } },
    select: { poNumber: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  let highest = 0
  for (const { poNumber } of recent ?? []) {
    const n = Number.parseInt(poNumber.slice(prefix.length), 10)
    if (Number.isFinite(n) && n > highest) highest = n
  }
  return `${prefix}${String(Math.max(highest, count ?? 0) + 1).padStart(4, '0')}`
}
