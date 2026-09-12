/**
 * FEATURETRACE: Atomic stock mutations (fabric meters + accessory units)
 *
 * All reserve / release / consume / receive operations go through these helpers so that:
 *   - reservations only succeed when enough unreserved stock exists (single row-locked UPDATE,
 *     safe under concurrent orders);
 *   - values never go below zero;
 *   - fabric meters are rounded to 3 decimals, preventing float residue such as
 *     reserved = -1.78e-15 after many increment/decrement cycles.
 *
 * Every helper must be called with a transaction client and returns the row's new values.
 */

import { prisma } from '@/lib/db'

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export type StockLevels = { currentStock: number; reserved: number }

export class InsufficientStockError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InsufficientStockError'
  }
}

/** Round fabric meters to millimetre precision. */
export const roundMeters = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000

function first(rows: StockLevels[]): StockLevels | null {
  const row = rows[0]
  return row ? { currentStock: Number(row.currentStock), reserved: Number(row.reserved) } : null
}

// ── Fabric (ClothInventory, meters, double precision) ────────────────────────

/** Reserve fabric only if enough unreserved stock exists; throws InsufficientStockError otherwise. */
export async function reserveClothStock(
  tx: TransactionClient,
  clothInventoryId: string,
  meters: number,
  label: string
): Promise<StockLevels | null> {
  const qty = roundMeters(meters)
  if (qty <= 0) return null
  const rows = await tx.$queryRaw<StockLevels[]>`
    UPDATE "ClothInventory"
    SET "reserved" = ROUND(("reserved" + ${qty}::double precision)::numeric, 3)::double precision,
        "updatedAt" = NOW()
    WHERE "id" = ${clothInventoryId}
      AND "currentStock" - "reserved" >= ${qty}::double precision - 0.0005
    RETURNING "currentStock", "reserved"
  `
  const levels = first(rows)
  if (!levels) throw new InsufficientStockError(`Insufficient stock for ${label}`)
  return levels
}

/** Release a fabric reservation (never below zero). */
export async function releaseClothReservation(
  tx: TransactionClient,
  clothInventoryId: string,
  meters: number
): Promise<StockLevels | null> {
  const qty = roundMeters(meters)
  const rows = await tx.$queryRaw<StockLevels[]>`
    UPDATE "ClothInventory"
    SET "reserved" = GREATEST(0, ROUND(("reserved" - ${qty}::double precision)::numeric, 3))::double precision,
        "updatedAt" = NOW()
    WHERE "id" = ${clothInventoryId}
    RETURNING "currentStock", "reserved"
  `
  return first(rows)
}

/**
 * Consume fabric for a delivered order: remove `usedMeters` from stock and release
 * `reservedMeters` from the reservation (both clamped at zero).
 */
export async function consumeClothStock(
  tx: TransactionClient,
  clothInventoryId: string,
  usedMeters: number,
  reservedMeters: number
): Promise<StockLevels | null> {
  const used = roundMeters(usedMeters)
  const reserved = roundMeters(reservedMeters)
  const rows = await tx.$queryRaw<StockLevels[]>`
    UPDATE "ClothInventory"
    SET "currentStock" = GREATEST(0, ROUND(("currentStock" - ${used}::double precision)::numeric, 3))::double precision,
        "reserved" = GREATEST(0, ROUND(("reserved" - ${reserved}::double precision)::numeric, 3))::double precision,
        "updatedAt" = NOW()
    WHERE "id" = ${clothInventoryId}
    RETURNING "currentStock", "reserved"
  `
  return first(rows)
}

/**
 * Add (positive) or remove (negative) fabric stock, e.g. purchases, returns, wastage.
 * Removals are guarded: stock can't drop below what is currently reserved for orders.
 */
export async function changeClothStock(
  tx: TransactionClient,
  clothInventoryId: string,
  deltaMeters: number,
  opts: { countAsPurchase?: boolean; label?: string } = {}
): Promise<StockLevels> {
  const delta = roundMeters(deltaMeters)
  const purchased = opts.countAsPurchase && delta > 0 ? delta : 0
  const rows = await tx.$queryRaw<StockLevels[]>`
    UPDATE "ClothInventory"
    SET "currentStock" = GREATEST(0, ROUND(("currentStock" + ${delta}::double precision)::numeric, 3))::double precision,
        "totalPurchased" = ROUND(("totalPurchased" + ${purchased}::double precision)::numeric, 3)::double precision,
        "updatedAt" = NOW()
    WHERE "id" = ${clothInventoryId}
      AND "currentStock" + ${delta}::double precision >= "reserved" - 0.0005
    RETURNING "currentStock", "reserved"
  `
  const levels = first(rows)
  if (!levels) {
    throw new InsufficientStockError(
      `Cannot reduce stock${opts.label ? ` for ${opts.label}` : ''} below the quantity reserved for orders`
    )
  }
  return levels
}

// ── Accessories (AccessoryInventory, integer units) ──────────────────────────

export async function reserveAccessoryStock(
  tx: TransactionClient,
  accessoryId: string,
  units: number,
  label: string
): Promise<StockLevels | null> {
  const qty = Math.round(units)
  if (qty <= 0) return null
  const rows = await tx.$queryRaw<StockLevels[]>`
    UPDATE "AccessoryInventory"
    SET "reserved" = "reserved" + ${qty}::integer, "updatedAt" = NOW()
    WHERE "id" = ${accessoryId} AND "currentStock" - "reserved" >= ${qty}::integer
    RETURNING "currentStock", "reserved"
  `
  const levels = first(rows)
  if (!levels) throw new InsufficientStockError(`Insufficient stock for ${label}`)
  return levels
}

export async function releaseAccessoryReservation(
  tx: TransactionClient,
  accessoryId: string,
  units: number
): Promise<StockLevels | null> {
  const qty = Math.round(units)
  const rows = await tx.$queryRaw<StockLevels[]>`
    UPDATE "AccessoryInventory"
    SET "reserved" = GREATEST(0, "reserved" - ${qty}::integer), "updatedAt" = NOW()
    WHERE "id" = ${accessoryId}
    RETURNING "currentStock", "reserved"
  `
  return first(rows)
}

export async function consumeAccessoryStock(
  tx: TransactionClient,
  accessoryId: string,
  units: number
): Promise<StockLevels | null> {
  const qty = Math.round(units)
  const rows = await tx.$queryRaw<StockLevels[]>`
    UPDATE "AccessoryInventory"
    SET "currentStock" = GREATEST(0, "currentStock" - ${qty}::integer),
        "reserved" = GREATEST(0, "reserved" - ${qty}::integer),
        "updatedAt" = NOW()
    WHERE "id" = ${accessoryId}
    RETURNING "currentStock", "reserved"
  `
  return first(rows)
}

/**
 * Set accessory stock to an absolute count (manual stock-take / correction). Row-locked so the
 * previous value is exact; refuses to go below what is reserved for orders.
 * Returns the previous and new levels so callers can record an ADJUSTMENT movement.
 */
export async function setAccessoryStockLevel(
  tx: TransactionClient,
  accessoryId: string,
  units: number,
  label?: string
): Promise<StockLevels & { previousStock: number }> {
  const qty = Math.max(0, Math.round(units))
  const rows = await tx.$queryRaw<(StockLevels & { previousStock: number })[]>`
    UPDATE "AccessoryInventory" a
    SET "currentStock" = ${qty}::integer, "updatedAt" = NOW()
    FROM (SELECT "id", "currentStock" AS "previousStock" FROM "AccessoryInventory" WHERE "id" = ${accessoryId} FOR UPDATE) prev
    WHERE a."id" = prev."id" AND a."reserved" <= ${qty}::integer
    RETURNING prev."previousStock", a."currentStock", a."reserved"
  `
  const row = rows[0]
  if (!row) {
    throw new InsufficientStockError(
      `Cannot set stock${label ? ` for ${label}` : ''} below the quantity reserved for orders`
    )
  }
  return {
    previousStock: Number(row.previousStock),
    currentStock: Number(row.currentStock),
    reserved: Number(row.reserved),
  }
}

/** Add received accessory units (e.g. purchase order receipt). */
export async function addAccessoryStock(
  tx: TransactionClient,
  accessoryId: string,
  units: number
): Promise<StockLevels | null> {
  const qty = Math.max(0, Math.round(units))
  const rows = await tx.$queryRaw<StockLevels[]>`
    UPDATE "AccessoryInventory"
    SET "currentStock" = "currentStock" + ${qty}::integer, "updatedAt" = NOW()
    WHERE "id" = ${accessoryId}
    RETURNING "currentStock", "reserved"
  `
  return first(rows)
}
