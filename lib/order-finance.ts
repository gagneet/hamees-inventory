/**
 * FEATURETRACE: Order money helpers shared by API routes
 *
 * - computeOrderBalance(): the single balance formula
 *     balance = totalAmount - advancePaid - discount - Σ installment.paidAmount
 *   Before v0.28.4 the advance was stored twice: in Order.advancePaid and as installment #1
 *   (notes "Advance payment on order creation" / "Advance payment from split of …", paidAmount =
 *   advancePaid). That row is excluded so the advance is counted once. It is recognised by the
 *   note prefix AND the matching amount (isLegacyAdvanceInstallment) — never by amount alone,
 *   because a real first payment can equal the advance. New rows never get that prefix
 *   (safeInstallmentNote), and syncLegacyAdvanceInstallment() keeps a legacy row mirroring the
 *   advance when the advance is edited.
 * - lockOrder()/lockPurchaseOrder(): SELECT … FOR UPDATE at the start of a transaction so writers
 *   of the same balance run one after another (read → check → write under the lock).
 * - orderTax(): tax for a new subtotal using the shop's BusinessSettings (lib/tax.ts). Existing
 *   orders are re-taxed with recomputeOrderTax() from lib/tax.ts instead.
 * Stock reservation/consumption helpers are in lib/stock.ts.
 */

import { getAppSettings, taxConfigFrom } from '@/lib/settings'
import { computeTax, type TaxBreakdown } from '@/lib/tax'
import { moneyEquals, roundMoney, subtractMoney, sumMoney } from '@/lib/money'
import type { AppPrismaClient, TransactionClient } from '@/lib/prisma-client'

type Db = AppPrismaClient | TransactionClient

export { roundMoney }

/** Note prefix carried by the legacy duplicate-advance installments. */
export const LEGACY_ADVANCE_NOTE_PREFIX = 'Advance payment'

type InstallmentLike = { installmentNumber: number; paidAmount: number | null; notes?: string | null }

/** True for a pre-v0.28.4 installment #1 that duplicates Order.advancePaid. */
export function isLegacyAdvanceInstallment(installment: InstallmentLike, advancePaid: number): boolean {
  return (
    installment.installmentNumber === 1 &&
    advancePaid > 0 &&
    (installment.notes ?? '').trimStart().startsWith(LEGACY_ADVANCE_NOTE_PREFIX) &&
    moneyEquals(installment.paidAmount ?? 0, advancePaid)
  )
}

/** Keeps a user-entered installment note from ever looking like a legacy duplicate-advance row. */
export function safeInstallmentNote(note: string | null | undefined): string | null | undefined {
  if (!note) return note
  return note.trimStart().startsWith(LEGACY_ADVANCE_NOTE_PREFIX) ? `Note: ${note}` : note
}

/** Σ paidAmount of an order's installments, leaving out a legacy duplicate of the advance. */
export function sumInstallmentPayments(installments: InstallmentLike[], advancePaid: number): number {
  return sumMoney(
    installments
      .filter((installment) => !isLegacyAdvanceInstallment(installment, advancePaid))
      .map((installment) => installment.paidAmount ?? 0)
  )
}

/** Money received through installments for an order (legacy-safe). */
export async function installmentsPaid(db: Db, order: { id: string; advancePaid: number }): Promise<number> {
  const installments = await db.paymentInstallment.findMany({
    where: { orderId: order.id },
    select: { installmentNumber: true, paidAmount: true, notes: true },
  })
  return sumInstallmentPayments(installments ?? [], order.advancePaid)
}

export async function computeOrderBalance(
  db: Db,
  order: { id: string; totalAmount: number; advancePaid: number; discount: number }
): Promise<number> {
  const paid = await installmentsPaid(db, order)
  return subtractMoney(order.totalAmount, order.advancePaid, order.discount, paid)
}

/**
 * When the advance changes, keep a legacy duplicate-advance installment equal to it so it is
 * still recognised (and excluded) by computeOrderBalance with the new advance.
 */
export async function syncLegacyAdvanceInstallment(
  tx: TransactionClient,
  orderId: string,
  oldAdvance: number,
  newAdvance: number
): Promise<void> {
  if (moneyEquals(oldAdvance, newAdvance)) return
  const first = await tx.paymentInstallment.findFirst({
    where: { orderId, installmentNumber: 1 },
    select: { id: true, installmentNumber: true, paidAmount: true, notes: true },
  })
  if (!first || !isLegacyAdvanceInstallment(first, oldAdvance)) return
  await tx.paymentInstallment.update({ where: { id: first.id }, data: { paidAmount: roundMoney(newAdvance) } })
}

/** Row-lock an order until the transaction ends (serialises writers of its balance). */
export async function lockOrder(tx: TransactionClient, orderId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`
}

/** Row-lock a purchase order until the transaction ends (serialises payments and receipts). */
export async function lockPurchaseOrder(tx: TransactionClient, purchaseOrderId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "PurchaseOrder" WHERE "id" = ${purchaseOrderId} FOR UPDATE`
}

/** Tax for a new order subtotal using the configured tax mode and rate. */
export async function orderTax(
  subTotal: number,
  opts: { customerRegion?: string | null; rateOverride?: number } = {}
): Promise<TaxBreakdown> {
  const settings = await getAppSettings()
  return computeTax(subTotal, taxConfigFrom(settings), opts)
}

// Stock reservation helpers live in lib/stock.ts
export { InsufficientStockError, reserveClothStock, reserveAccessoryStock } from '@/lib/stock'
