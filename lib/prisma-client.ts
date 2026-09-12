/**
 * FEATURETRACE: Prisma client factory (money conversion at the database boundary)
 *
 * Every Prisma client in the app, seeds, scripts and DB-backed tests must come from
 * createPrismaClient(): amounts are BigInt minor units in the database and the extensions below
 * convert them, so a bare `new PrismaClient()` would read bigints and write wrong amounts.
 *
 *   - result: each money field is replaced by fromMinor(value) → a decimal number. Listed
 *     explicitly so TypeScript types those fields as numbers; tests/unit/lib/money-codec.test.ts
 *     checks this list against the schema.
 *   - query: encodeMoneyArgs() converts decimal amounts in data/where/having/nested writes.
 */

import { Prisma, PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { fromMinor } from '@/lib/money'
import { encodeMoneyArgs } from '@/lib/money-codec'

const amount = <F extends string>(field: F) => ({
  needs: { [field]: true } as { [K in F]: true },
  compute: (row: { [K in F]: bigint }): number => fromMinor(row[field]),
})

const optionalAmount = <F extends string>(field: F) => ({
  needs: { [field]: true } as { [K in F]: true },
  compute: (row: { [K in F]: bigint | null }): number | null => fromMinor(row[field]),
})

export const moneyResultFields = {
  clothInventory: { pricePerMeter: amount('pricePerMeter') },
  accessoryInventory: { pricePerUnit: amount('pricePerUnit') },
  garmentPattern: {
    basicStitchingCharge: amount('basicStitchingCharge'),
    premiumStitchingCharge: amount('premiumStitchingCharge'),
    luxuryStitchingCharge: amount('luxuryStitchingCharge'),
  },
  order: {
    totalAmount: amount('totalAmount'),
    advancePaid: amount('advancePaid'),
    discount: amount('discount'),
    balanceAmount: amount('balanceAmount'),
    subTotal: amount('subTotal'),
    cgst: amount('cgst'),
    sgst: amount('sgst'),
    igst: amount('igst'),
    gstAmount: amount('gstAmount'),
    taxableAmount: amount('taxableAmount'),
    fabricCost: amount('fabricCost'),
    fabricWastageAmount: amount('fabricWastageAmount'),
    accessoriesCost: amount('accessoriesCost'),
    stitchingCost: amount('stitchingCost'),
    workmanshipPremiums: amount('workmanshipPremiums'),
    designerConsultationFee: amount('designerConsultationFee'),
    handStitchingCost: amount('handStitchingCost'),
    fullCanvasCost: amount('fullCanvasCost'),
    rushOrderCost: amount('rushOrderCost'),
    complexDesignCost: amount('complexDesignCost'),
    additionalFittingsCost: amount('additionalFittingsCost'),
    premiumLiningCost: amount('premiumLiningCost'),
    fabricCostOverride: optionalAmount('fabricCostOverride'),
    stitchingCostOverride: optionalAmount('stitchingCostOverride'),
    accessoriesCostOverride: optionalAmount('accessoriesCostOverride'),
  },
  paymentInstallment: {
    installmentAmount: amount('installmentAmount'),
    paidAmount: amount('paidAmount'),
  },
  orderItem: {
    pricePerUnit: amount('pricePerUnit'),
    totalPrice: amount('totalPrice'),
  },
  supplierPrice: { pricePerMeter: amount('pricePerMeter') },
  purchaseOrder: {
    totalAmount: amount('totalAmount'),
    paidAmount: amount('paidAmount'),
    balanceAmount: amount('balanceAmount'),
    subTotal: amount('subTotal'),
    cgst: amount('cgst'),
    sgst: amount('sgst'),
    igst: amount('igst'),
    gstAmount: amount('gstAmount'),
  },
  pOItem: {
    pricePerUnit: amount('pricePerUnit'),
    totalPrice: amount('totalPrice'),
  },
  expense: {
    amount: amount('amount'),
    gstAmount: amount('gstAmount'),
    totalAmount: amount('totalAmount'),
    tdsAmount: amount('tdsAmount'),
  },
}

export const moneyExtension = Prisma.defineExtension({
  name: 'money-minor-units',
  result: moneyResultFields,
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        return query(encodeMoneyArgs(model, operation, args) as typeof args)
      },
    },
  },
})

export interface CreatePrismaClientOptions {
  connectionString?: string
  /** Reuse a pool the caller owns (and ends) instead of creating one */
  pool?: Pool
  poolMax?: number
  log?: Prisma.LogLevel[]
}

export function createPrismaClient(options: CreatePrismaClientOptions = {}) {
  const pool = options.pool ?? new Pool({
    connectionString: options.connectionString ?? process.env.DATABASE_URL,
    max: options.poolMax ?? (Number(process.env.DATABASE_POOL_MAX) || 10),
    idleTimeoutMillis: 30_000,
    // Fail fast instead of hanging requests (and deploy health checks) when the DB is unreachable
    connectionTimeoutMillis: 10_000,
  })
  const client = new PrismaClient({ adapter: new PrismaPg(pool), log: options.log ?? ['error'] })
  return client.$extends(moneyExtension)
}

export type AppPrismaClient = ReturnType<typeof createPrismaClient>
/** The client passed to `prisma.$transaction(async (tx) => …)` callbacks */
export type TransactionClient = Parameters<Parameters<AppPrismaClient['$transaction']>[0]>[0]
