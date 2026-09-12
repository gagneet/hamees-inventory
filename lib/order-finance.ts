/**
 * FEATURETRACE: Order money helpers shared by API routes
 *
 * The pricing and balance ARITHMETIC lives in lib/order-pricing.ts (pure, no Prisma — usable from
 * client components and scripts) and is re-exported here. This module adds the database-aware
 * wrappers:
 *
 * - computeOrderBalance(): reads the order's installments, then applies the one balance formula
 *     balance = totalAmount - advancePaid - Σ installment.paidAmount
 *   The discount is NOT subtracted here: it already reduced totalAmount when the order was priced.
 *   Before v0.28.4 the advance was stored twice: in Order.advancePaid and as installment #1
 *   (notes "Advance payment on order creation" / "Advance payment from split of …", paidAmount =
 *   advancePaid). That row is excluded so the advance is counted once (isLegacyAdvanceInstallment).
 *   New rows never get that prefix (safeInstallmentNote), and syncLegacyAdvanceInstallment() keeps
 *   a legacy row mirroring the advance when the advance is edited.
 * - lockOrder()/lockPurchaseOrder(): SELECT … FOR UPDATE at the start of a transaction so writers
 *   of the same balance run one after another (read → check → write under the lock).
 * - orderTax() / priceNewOrder(): tax for a NEW order using the shop's BusinessSettings. Existing
 *   orders are re-priced with repriceOrder(), which keeps their own rate and tax structure.
 * Stock reservation/consumption helpers are in lib/stock.ts.
 */

import { getAppSettings, taxConfigFrom } from '@/lib/settings'
import { computeTax, type TaxBreakdown } from '@/lib/tax'
import { moneyEquals, roundMoney, subtractMoney } from '@/lib/money'
import {
  clampDiscount,
  isLegacyAdvanceInstallment,
  orderBalance,
  pricingFrom,
  sumInstallmentPayments,
  type OrderPricing,
} from '@/lib/order-pricing'

// The pure arithmetic lives in lib/order-pricing.ts; re-exported so callers keep one import
export {
  LEGACY_ADVANCE_NOTE_PREFIX,
  clampDiscount,
  isLegacyAdvanceInstallment,
  orderBalance,
  repriceOrder,
  safeInstallmentNote,
  sumInstallmentPayments,
  type OrderPricing,
} from '@/lib/order-pricing'
import type { AppPrismaClient, TransactionClient } from '@/lib/prisma-client'

type Db = AppPrismaClient | TransactionClient

export { roundMoney }

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
  order: { id: string; totalAmount: number; advancePaid: number }
): Promise<number> {
  const paid = await installmentsPaid(db, order)
  return orderBalance(order.totalAmount, order.advancePaid, paid)
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

/**
 * Price a NEW order with the shop's current tax settings: the discount comes off the subtotal
 * first, tax is charged on what is left, and the total is the discounted value plus that tax.
 */
export async function priceNewOrder(
  subTotal: number,
  discount: number | null | undefined,
  opts: { customerRegion?: string | null; rateOverride?: number } = {}
): Promise<OrderPricing> {
  const applied = clampDiscount(discount, subTotal)
  const tax = await orderTax(subtractMoney(subTotal, applied), opts)
  return pricingFrom(subTotal, applied, tax)
}


// Stock reservation helpers live in lib/stock.ts
export { InsufficientStockError, reserveClothStock, reserveAccessoryStock } from '@/lib/stock'
