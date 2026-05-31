/**
 * @featuretrace Purchase Order Approval
 * FEATURETRACE:
 *   feature: purchase_order_non_owner_price_privacy
 *   owner_area: purchase-orders
 *   entry_points: POST /api/purchase-orders, UI /purchase-orders/new, CreatePODialog
 *   upstream_callers: app/(dashboard)/purchase-orders/new/page.tsx, components/dashboard/create-po-dialog.tsx
 *   downstream_dependencies: Prisma PurchaseOrder/POItem, field ACL filtering, NextAuth role
 *   related_tests: tests/unit/api/purchase-orders.test.ts, tests/integration/acl-filtering.test.ts
 *   change_risk: medium - status controls whether PO can be approved, paid, or received
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { filterApiResponse } from '@/lib/api-filter-response'
import { z } from 'zod'
import type { UserRole } from '@prisma/client'

const purchaseOrderItemSchema = z
  .object({
    itemName: z.string().min(1),
    itemType: z.enum(['CLOTH', 'ACCESSORY']),
    quantity: z.number().positive().optional(),
    orderedQuantity: z.number().positive().optional(),
    unit: z.string().min(1),
    pricePerUnit: z.number().nonnegative().optional(),
  })
  .refine((item) => item.quantity !== undefined || item.orderedQuantity !== undefined, {
    message: 'Quantity is required',
    path: ['quantity'],
  })

function getInitialPurchaseOrderStatus(role: UserRole): 'APPROVED' | 'PENDING_APPROVAL' {
  return role === 'OWNER' ? 'APPROVED' : 'PENDING_APPROVAL'
}

const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1),
  expectedDate: z.string().nullish(),
  items: z.array(purchaseOrderItemSchema).min(1),
  notes: z.string().nullish(),
})

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const supplierId = searchParams.get('supplierId')

    const where: any = { active: true }
    if (status) where.status = status
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
        items: true,
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
      return NextResponse.json(
        { error: 'Validation failed', details: [{ path: ['items', 'pricePerUnit'], message: 'Price per unit is required' }] },
        { status: 400 }
      )
    }

    const normalizedItems = items.map((item) => ({
      itemName: item.itemName,
      itemType: item.itemType,
      quantity: item.quantity ?? item.orderedQuantity ?? 0,
      unit: item.unit,
      pricePerUnit: isOwner ? item.pricePerUnit ?? 0 : 0,
    }))

    // Calculate totals
    const totalAmount = normalizedItems.reduce(
      (sum, item) => sum + item.quantity * item.pricePerUnit,
      0
    )

    // Generate PO number
    const poCount = await prisma.purchaseOrder.count()
    const poNumber = `PO-${new Date().getFullYear()}-${String(poCount + 1).padStart(4, '0')}`

    // Create purchase order with items
    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        supplierId,
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        totalAmount,
        balanceAmount: totalAmount,
        notes: notes || null,
        status: getInitialPurchaseOrderStatus(session.user.role),
        items: {
          create: normalizedItems.map((item) => ({
            itemName: item.itemName,
            itemType: item.itemType,
            orderedQuantity: item.quantity,
            unit: item.unit,
            pricePerUnit: item.pricePerUnit,
            totalPrice: item.quantity * item.pricePerUnit,
          })),
        },
      },
      include: {
        supplier: true,
        items: true,
      },
    })

    // FEATURETRACE: Apply ACL field filtering to response
    const userRole = session.user.role as any
    const filtered = filterApiResponse(purchaseOrder, userRole, 'purchase_order')

    return NextResponse.json({ purchaseOrder: filtered }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
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
