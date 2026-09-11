/**
 * Integration Tests – automatic reorder check (lib/reorder.ts) against a real database.
 *
 * With auto-reorder on, one run drafts exactly one PENDING_APPROVAL purchase order for the test
 * supplier (linked lines, whole-meter quantities) and raises reorder alerts; a second run adds nothing.
 * A run while another session holds the advisory lock is skipped.
 *
 * Runs only when TEST_DATABASE_URL names a disposable database (vitest.config.ts). Test rows use the
 * prefix "TEST_REORDER_"; anything the runs create for pre-existing rows (POs, alerts, audit logs) and
 * the settings row are restored afterwards.
 *
 * Run with: TEST_DATABASE_URL=… pnpm vitest run tests/integration/reorder.test.ts
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Pool } from 'pg'
import type { Alert } from '@prisma/client'

vi.unmock('@/lib/db')

import { prisma } from '@/lib/db'
import { invalidateAppSettings, SETTINGS_ROW_ID } from '@/lib/settings'
import { REORDER_LOCK_KEY, runReorderCheck } from '@/lib/reorder'

const PREFIX = 'TEST_REORDER_'
const SKU = `${PREFIX}${Date.now()}`

let supplierId: string
let clothId: string
let accessoryId: string
let orphanClothId: string
let settingsRow: { id: string; autoReorderEnabled: boolean } | null = null
let poIdsBefore = new Set<string>()
let reorderAlertsBefore: Alert[] = []

beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error('Integration tests need TEST_DATABASE_URL')
  await cleanupTestRows()

  poIdsBefore = new Set((await prisma.purchaseOrder.findMany({ select: { id: true } })).map((po) => po.id))
  reorderAlertsBefore = await prisma.alert.findMany({ where: { type: 'REORDER_REMINDER' } })

  // Auto-reorder on for this test; restored in afterAll
  settingsRow = await prisma.businessSettings.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true, autoReorderEnabled: true },
  })
  if (settingsRow) {
    await prisma.businessSettings.update({ where: { id: settingsRow.id }, data: { autoReorderEnabled: true } })
  } else {
    await prisma.businessSettings.create({ data: { id: SETTINGS_ROW_ID, autoReorderEnabled: true } })
  }
  invalidateAppSettings()

  const supplier = await prisma.supplier.create({ data: { name: `${PREFIX}Supplier`, phone: '+910000000000' } })
  supplierId = supplier.id

  const clothBase = {
    brand: 'Test Mill',
    color: 'Grey',
    colorHex: '#808080',
    pattern: 'Plain',
    quality: 'Standard',
    type: 'Cotton',
    supplier: supplier.name,
  }
  // available 2.4 m (3.4 − 1 reserved), minimum 10 → top up to 20: 17.6 → 18 m
  const cloth = await prisma.clothInventory.create({
    data: {
      ...clothBase,
      sku: `${SKU}-C1`,
      name: `${PREFIX}Cloth`,
      pricePerMeter: 150.5,
      currentStock: 3.4,
      reserved: 1,
      minimumStockMeters: 10,
      supplierId,
    },
  })
  clothId = cloth.id

  // No supplier: alert only, never on a PO
  const orphan = await prisma.clothInventory.create({
    data: {
      ...clothBase,
      sku: `${SKU}-C2`,
      name: `${PREFIX}Orphan cloth`,
      pricePerMeter: 80,
      currentStock: 1,
      minimumStockMeters: 5,
    },
  })
  orphanClothId = orphan.id

  // Reorder quantity set: 25 units
  const accessory = await prisma.accessoryInventory.create({
    data: {
      sku: `${SKU}-A1`,
      name: `${PREFIX}Buttons`,
      type: 'Button',
      color: 'Black',
      currentStock: 2,
      minimumStockUnits: 10,
      reorderQuantity: 25,
      pricePerUnit: 4.25,
      supplierId,
    },
  })
  accessoryId = accessory.id
})

afterAll(async () => {
  try {
    // POs the runs drafted (for the test supplier and for any pre-existing low-stock items)
    const newPoIds = (await prisma.purchaseOrder.findMany({ select: { id: true } }))
      .map((po) => po.id)
      .filter((id) => !poIdsBefore.has(id))
    if (newPoIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { entityType: 'PurchaseOrder', entityId: { in: newPoIds } } })
      await prisma.purchaseOrder.deleteMany({ where: { id: { in: newPoIds } } })
    }

    // Reorder alerts back to how they were
    const beforeIds = new Set(reorderAlertsBefore.map((alert) => alert.id))
    await prisma.alert.deleteMany({ where: { type: 'REORDER_REMINDER', id: { notIn: [...beforeIds] } } })
    for (const alert of reorderAlertsBefore) {
      await prisma.alert.upsert({ where: { id: alert.id }, create: alert, update: alert })
    }

    await cleanupTestRows()

    if (settingsRow) {
      await prisma.businessSettings.update({
        where: { id: settingsRow.id },
        data: { autoReorderEnabled: settingsRow.autoReorderEnabled },
      })
    } else {
      await prisma.businessSettings.deleteMany({ where: { id: SETTINGS_ROW_ID } })
    }
    invalidateAppSettings()
  } finally {
    await prisma.$disconnect()
  }
})

async function cleanupTestRows() {
  const suppliers = await prisma.supplier.findMany({ where: { name: { startsWith: PREFIX } }, select: { id: true } })
  const supplierIds = suppliers.map((s) => s.id)
  const cloth = await prisma.clothInventory.findMany({ where: { sku: { startsWith: PREFIX } }, select: { id: true } })
  const accessories = await prisma.accessoryInventory.findMany({ where: { sku: { startsWith: PREFIX } }, select: { id: true } })
  const itemIds = [...cloth.map((c) => c.id), ...accessories.map((a) => a.id)]

  if (supplierIds.length > 0) {
    const pos = await prisma.purchaseOrder.findMany({ where: { supplierId: { in: supplierIds } }, select: { id: true } })
    const poIds = pos.map((po) => po.id)
    await prisma.auditLog.deleteMany({ where: { entityType: 'PurchaseOrder', entityId: { in: poIds } } })
    await prisma.purchaseOrder.deleteMany({ where: { id: { in: poIds } } })
  }
  if (itemIds.length > 0) await prisma.alert.deleteMany({ where: { relatedId: { in: itemIds } } })
  await prisma.clothInventory.deleteMany({ where: { sku: { startsWith: PREFIX } } })
  await prisma.accessoryInventory.deleteMany({ where: { sku: { startsWith: PREFIX } } })
  await prisma.supplier.deleteMany({ where: { id: { in: supplierIds } } })
}

const testSupplierDrafts = () =>
  prisma.purchaseOrder.findMany({
    where: { supplierId, autoGenerated: true },
    include: { items: { orderBy: { itemType: 'asc' } } },
  })

describe('runReorderCheck (database)', () => {
  it('drafts one purchase order for the supplier and raises reorder alerts', async () => {
    const result = await runReorderCheck({ trigger: 'manual' })

    expect(result.status).toBe('completed')
    expect(result.autoReorderEnabled).toBe(true)
    expect(result.purchaseOrders.filter((po) => po.supplierId === supplierId)).toEqual([
      expect.objectContaining({ created: true, linesAdded: 2 }),
    ])

    const drafts = await testSupplierDrafts()
    expect(drafts).toHaveLength(1)
    const [draft] = drafts
    expect(draft.status).toBe('PENDING_APPROVAL')
    expect(draft.items).toEqual([
      expect.objectContaining({
        itemType: 'ACCESSORY',
        accessoryInventoryId: accessoryId,
        clothInventoryId: null,
        orderedQuantity: 25,
        unit: 'pieces',
        pricePerUnit: 4.25,
        totalPrice: 106.25,
      }),
      expect.objectContaining({
        itemType: 'CLOTH',
        clothInventoryId: clothId,
        accessoryInventoryId: null,
        orderedQuantity: 18,
        unit: 'meters',
        pricePerUnit: 150.5,
        totalPrice: 2709,
      }),
    ])
    expect(draft.totalAmount).toBe(2815.25)
    expect(draft.balanceAmount).toBe(2815.25)

    // The item without a supplier gets an alert, never a PO line
    const alerts = await prisma.alert.findMany({
      where: { type: 'REORDER_REMINDER', relatedId: { in: [clothId, accessoryId, orphanClothId] } },
    })
    expect(alerts.map((a) => a.relatedId).sort()).toEqual([clothId, accessoryId, orphanClothId].sort())
    expect(alerts.find((a) => a.relatedId === orphanClothId)?.message).toContain('no supplier linked')
    expect(alerts.find((a) => a.relatedId === clothId)?.message).toContain(draft.poNumber)

    const auditRows = await prisma.auditLog.findMany({ where: { entityType: 'PurchaseOrder', entityId: draft.id } })
    expect(auditRows.map((row) => row.action)).toEqual(['PURCHASE_ORDER_AUTO_CREATED'])
  })

  it('adds nothing on a second run', async () => {
    const result = await runReorderCheck({ trigger: 'alerts' })

    expect(result.status).toBe('completed')
    expect(result.purchaseOrders.filter((po) => po.supplierId === supplierId)).toEqual([])
    const drafts = await testSupplierDrafts()
    expect(drafts).toHaveLength(1)
    expect(drafts[0].items).toHaveLength(2)

    // Stock on the draft now covers the drafted items; the orphan still needs a reorder
    const alerts = await prisma.alert.findMany({
      where: { type: 'REORDER_REMINDER', relatedId: { in: [clothId, accessoryId, orphanClothId] } },
    })
    expect(alerts.map((a) => a.relatedId)).toEqual([orphanClothId])
  })

  it('skips while another session holds the reorder lock', async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const client = await pool.connect()
    try {
      await client.query('SELECT pg_advisory_lock($1::bigint)', [REORDER_LOCK_KEY])
      const result = await runReorderCheck({ trigger: 'manual' })
      expect(result.status).toBe('skipped')
    } finally {
      await client.query('SELECT pg_advisory_unlock($1::bigint)', [REORDER_LOCK_KEY])
      client.release()
      await pool.end()
    }
  })
})
