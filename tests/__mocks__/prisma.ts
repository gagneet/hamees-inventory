/**
 * Reusable Prisma mock factory.
 *
 * Usage in tests:
 *   import { createPrismaMock, type PrismaMock } from '@/tests/__mocks__/prisma'
 *   const db = createPrismaMock()
 *   vi.mocked(prisma.order.findMany).mockResolvedValue(db.order.findMany())
 */

import { vi } from 'vitest'

/** One model's worth of mocked methods */
function makeModelMock() {
  return {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    upsert: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
    aggregate: vi.fn().mockResolvedValue({ _sum: { paidAmount: null } }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    fields: new Proxy({}, { get: () => undefined }),
  }
}

export type ModelMock = ReturnType<typeof makeModelMock>

export function createPrismaMock() {
  const order = makeModelMock()
  const clothInventory = makeModelMock()
  const accessoryInventory = makeModelMock()
  const stockMovement = makeModelMock()
  const accessoryStockMovement = makeModelMock()
  const customer = makeModelMock()
  const user = makeModelMock()
  const measurement = makeModelMock()
  const garmentPattern = makeModelMock()
  const paymentInstallment = makeModelMock()
  const purchaseOrder = makeModelMock()
  const expense = makeModelMock()
  const alert = makeModelMock()
  const orderHistory = makeModelMock()

  // The transaction proxy executes the callback with the same mock models
  const transactionProxy = new Proxy(
    {},
    { get: (_t, key: string) => ({ order, clothInventory, accessoryInventory, stockMovement, accessoryStockMovement, customer, user, measurement, garmentPattern, paymentInstallment, purchaseOrder, expense, alert, orderHistory }[key] ?? makeModelMock()) }
  )

  return {
    order,
    clothInventory,
    accessoryInventory,
    stockMovement,
    accessoryStockMovement,
    customer,
    user,
    measurement,
    garmentPattern,
    paymentInstallment,
    purchaseOrder,
    expense,
    alert,
    orderHistory,
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(transactionProxy)),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  }
}

export type PrismaMock = ReturnType<typeof createPrismaMock>
