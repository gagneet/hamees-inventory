/**
 * @featuretrace Purchase Order Approval
 * FEATURETRACE:
 *   feature: purchase_order_non_owner_price_privacy, purchase_order_inventory_links
 *   owner_area: purchase-orders
 *   entry_points: POST /api/purchase-orders, UI /purchase-orders/new, CreatePODialog
 *   upstream_callers: app/(dashboard)/purchase-orders/new/page.tsx, components/dashboard/create-po-dialog.tsx
 *   downstream_dependencies: Prisma PurchaseOrder/POItem, ClothInventory/AccessoryInventory, field ACL filtering,
 *     NextAuth role, lib/purchase-order-items (line names, PO number), lib/reorder (after())
 *   related_tests: tests/unit/api/purchase-orders.test.ts, tests/integration/acl-filtering.test.ts
 *   change_risk: medium - status controls whether PO can be approved, paid, or received; links drive stock receipts
 */
import { NextResponse, after } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission, requirePermission } from '@/lib/api-permissions'
import { filterApiResponse } from '@/lib/api-filter-response'
import { multiplyMoney, sumMoney } from '@/lib/money'
import { roundMeters } from '@/lib/stock'
import {
  PO_LINE_UNIT,
  accessoryLineName,
  clothLineName,
  nextPoNumber,
  poItemInventoryInclude,
} from '@/lib/purchase-order-items'
import { runReorderCheckQuietly } from '@/lib/reorder'
import { z } from 'zod'
import type { UserRole } from '@prisma/client'

/**
 * A line names the inventory item it restocks: clothInventoryId for CLOTH, accessoryInventoryId for
 * ACCESSORY. itemName and unit are derived from that item; values sent by the client are ignored.
 */
const purchaseOrderItemSchema = z
  .object({
    itemType: z.enum(['CLOTH', 'ACCESSORY']),
    clothInventoryId: z.string().min(1).nullish(),
    accessoryInventoryId: z.string().min(1).nullish(),
    quantity: z.number().positive().optional(),
    orderedQuantity: z.number().positive().optional(),
    pricePerUnit: z.number().nonnegative().optional(),
    itemName: z.string().optional(),
    unit: z.string().optional(),
  })
  .refine((item) => item.quantity !== undefined || item.orderedQuantity !== undefined, {
    message: 'Quantity is required',
    path: ['quantity'],
  })
  .superRefine((item, ctx) => {
    const isCloth = item.itemType === 'CLOTH'
    if (!(isCloth ? item.clothInventoryId : item.accessoryInventoryId)) {
      ctx.addIssue({
        code: 'custom',
        path: [isCloth ? 'clothInventoryId' : 'accessoryInventoryId'],
        message: `Choose the ${isCloth ? 'fabric' : 'accessory'} this line restocks`,
      })
    }
    if (isCloth ? item.accessoryInventoryId : item.clothInventoryId) {
      ctx.addIssue({
        code: 'custom',
        path: [isCloth ? 'accessoryInventoryId' : 'clothInventoryId'],
        message: isCloth ? 'A fabric line cannot link an accessory' : 'An accessory line cannot link a fabric',
      })
    }
  })

function getInitialPurchaseOrderStatus(role: UserRole): 'APPROVED' | 'PENDING_APPROVAL' {
  return role === 'OWNER' ? 'APPROVED' : 'PENDING_APPROVAL'
}

const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1),
  expectedDate: z.string().nullish(),
  items: z.array(purchaseOrderItemSchema).min(1).max(200),
  notes: z.string().nullish(),
})

const PO_STATUSES = new Set(['PENDING_APPROVAL', 'PENDING', 'APPROVED', 'PARTIAL', 'RECEIVED', 'CANCELLED'])

type Issue = { path: (string | number)[]; message: string }

function validationError(issues: Issue[]) {
  return NextResponse.json({ error: issues[0].message, details: issues }, { status: 400 })
}

export async function GET(request: Request) {
  try {
    const { session, error } = await requirePermission('view_purchase_orders')
    if (error) return error

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const supplierId = searchParams.get('supplierId')

    const where: any = { active: true }
    if (status) {
      if (!PO_STATUSES.has(status)) {
        return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 })
      }
      where.status = status
    }
    if (supplierId) where.supplierId = supplierId

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        items: { include: poItemInventoryInclude },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // FEATURETRACE: Apply ACL field filtering to response
    const userRole = session.user.role as any
    const filtered = filterApiResponse(purchaseOrders, userRole, 'purchase_order')

    return NextResponse.json({ purchaseOrders: filtered })
  } catch (error) {
    console.error('Error fetching purchase orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase orders' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const { session, error } = await requireAnyPermission(['manage_inventory', 'manage_purchase_orders'])
  if (error) return error

  try {
    const body = await request.json()
    const { supplierId, expectedDate, items, notes } = purchaseOrderSchema.parse(body)
    const isOwner = session.user.role === 'OWNER'

    if (isOwner && items.some((item) => item.pricePerUnit === undefined)) {
      return validationError([{ path: ['items', 'pricePerUnit'], message: 'Price per unit is required' }])
    }

    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true, active: true } })
    if (!supplier || !supplier.active) {
      return validationError([{ path: ['supplierId'], message: 'Supplier not found or inactive' }])
    }

    const clothIds = [...new Set(items.flatMap((item) => (item.itemType === 'CLOTH' && item.clothInventoryId ? [item.clothInventoryId] : [])))]
    const accessoryIds = [
      ...new Set(items.flatMap((item) => (item.itemType === 'ACCESSORY' && item.accessoryInventoryId ? [item.accessoryInventoryId] : []))),
    ]
    const supplierSelect = { select: { id: true, name: true } } as const
    const [cloths, accessories] = await Promise.all([
      clothIds.length > 0
        ? prisma.clothInventory.findMany({
            where: { id: { in: clothIds } },
            select: { id: true, sku: true, name: true, brand: true, color: true, active: true, supplierId: true, supplierRel: supplierSelect },
          })
        : [],
      accessoryIds.length > 0
        ? prisma.accessoryInventory.findMany({
            where: { id: { in: accessoryIds } },
            select: { id: true, sku: true, name: true, color: true, active: true, supplierId: true, supplierRel: supplierSelect },
          })
        : [],
    ])
    const clothById = new Map((cloths ?? []).map((c) => [c.id, c]))
    const accessoryById = new Map((accessories ?? []).map((a) => [a.id, a]))

    const issues: Issue[] = []
    const warnings: string[] = []
    const seen = new Set<string>()
    const lines = items.flatMap((item, index) => {
      const isCloth = item.itemType === 'CLOTH'
      const linkField = isCloth ? 'clothInventoryId' : 'accessoryInventoryId'
      const linkId = (isCloth ? item.clothInventoryId : item.accessoryInventoryId)!
      const record = isCloth ? clothById.get(linkId) : accessoryById.get(linkId)

      if (!record || !record.active) {
        issues.push({
          path: ['items', index, linkField],
          message: `Line ${index + 1}: ${isCloth ? 'fabric' : 'accessory'} not found or no longer active`,
        })
        return []
      }
      if (seen.has(`${item.itemType}:${linkId}`)) {
        issues.push({ path: ['items', index, linkField], message: `Line ${index + 1}: ${record.name} is already on this purchase order` })
        return []
      }
      seen.add(`${item.itemType}:${linkId}`)

      const requested = item.quantity ?? item.orderedQuantity ?? 0
      const quantity = isCloth ? roundMeters(requested) : requested
      if (!isCloth && !Number.isInteger(quantity)) {
        issues.push({ path: ['items', index, 'quantity'], message: `Line ${index + 1}: accessory quantities must be whole units` })
        return []
      }
      if (quantity <= 0) {
        issues.push({ path: ['items', index, 'quantity'], message: `Line ${index + 1}: quantity must be greater than zero` })
        return []
      }

      const itemName = isCloth ? clothLineName(clothById.get(linkId)!) : accessoryLineName(record)
      if (record.supplierId && record.supplierId !== supplierId) {
        warnings.push(`${itemName} is usually supplied by ${record.supplierRel?.name ?? 'another supplier'}`)
      }

      const pricePerUnit = isOwner ? item.pricePerUnit ?? 0 : 0
      return [
        {
          itemName,
          itemType: item.itemType,
          orderedQuantity: quantity,
          unit: PO_LINE_UNIT[item.itemType],
          pricePerUnit,
          totalPrice: multiplyMoney(pricePerUnit, quantity),
          clothInventoryId: isCloth ? linkId : null,
          accessoryInventoryId: isCloth ? null : linkId,
        },
      ]
    })

    if (issues.length > 0) return validationError(issues)

    const totalAmount = sumMoney(lines.map((line) => line.totalPrice))

    // poNumber is unique and the automatic reorder check creates POs too, so another request can
    // take the number between generating and inserting it: try again with the next one.
    const createWithNumber = async (poNumber: string) =>
      prisma.purchaseOrder.create({
        data: {
          poNumber,
          supplierId,
          expectedDate: expectedDate ? new Date(expectedDate) : null,
          totalAmount,
          subTotal: totalAmount,
          balanceAmount: totalAmount,
          notes: notes || null,
          status: getInitialPurchaseOrderStatus(session.user.role),
          items: { create: lines },
        },
        include: {
          supplier: true,
          items: { include: poItemInventoryInclude },
        },
      })

    const numberTaken = (error: unknown) =>
      typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'

    let purchaseOrder: Awaited<ReturnType<typeof createWithNumber>> | undefined
    for (let attempt = 1; attempt <= 3 && !purchaseOrder; attempt++) {
      try {
        purchaseOrder = await createWithNumber(await nextPoNumber(prisma))
      } catch (error) {
        if (!numberTaken(error) || attempt === 3) throw error
      }
    }
    if (!purchaseOrder) throw new Error('Could not allocate a purchase order number')

    // New on-order quantities can resolve reorder alerts
    after(() => runReorderCheckQuietly({ trigger: 'purchase_order_changed', userId: session.user.id }))

    // FEATURETRACE: Apply ACL field filtering to response
    const userRole = session.user.role as any
    const filtered = filterApiResponse(purchaseOrder, userRole, 'purchase_order')

    return NextResponse.json({ purchaseOrder: filtered, warnings }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating purchase order:', error)
    return NextResponse.json(
      { error: 'Failed to create purchase order' },
      { status: 500 }
    )
  }
}
