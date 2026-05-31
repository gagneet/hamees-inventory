/**
 * @featuretrace Purchase Order Approval
 * FEATURETRACE:
 *   feature: purchase_order_non_owner_price_privacy
 *   owner_area: purchase-orders
 *   entry_points: GET/PATCH/DELETE /api/purchase-orders/:id, UI /purchase-orders/:id
 *   upstream_callers: app/(dashboard)/purchase-orders/[id]/page.tsx
 *   downstream_dependencies: Prisma PurchaseOrder/POItem, field ACL filtering, NextAuth role
 *   related_tests: tests/unit/api/purchase-orders.test.ts
 *   change_risk: medium - approval writes item prices and enables receiving/payment
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { filterApiResponse } from '@/lib/api-filter-response'
import { z } from 'zod'

const approvePurchaseOrderSchema = z.object({
  status: z.literal('APPROVED'),
  items: z.array(
    z.object({
      id: z.string().min(1),
      pricePerUnit: z.number().positive(),
    })
  ).min(1),
  notes: z.string().nullish(),
})

function canApprovePurchaseOrder(role: string | undefined): boolean {
  return role === 'OWNER' || role === 'INVENTORY_MANAGER'
}

function appendApprovalNote(
  existingNotes: string | null,
  approver: string | null | undefined,
  notes: string | null | undefined
): string | null {
  if (!notes) return existingNotes

  const approvalNote = `[${new Date().toLocaleDateString('en-IN')}] Approved by ${approver || 'Unknown approver'}: ${notes}`
  return [existingNotes, approvalNote].filter(Boolean).join('\n')
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: true,
      },
    })

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    // FEATURETRACE: Apply ACL field filtering to response
    const userRole = session.user.role as any
    const filtered = filterApiResponse(purchaseOrder, userRole, 'purchase_order')

    return NextResponse.json({ purchaseOrder: filtered })
  } catch (error) {
    console.error('Error fetching purchase order:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase order' },
      { status: 500 }
    )
  }
}


export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAnyPermission(['manage_purchase_orders'])
  if (error) return error

  if (!canApprovePurchaseOrder(session.user.role)) {
    return NextResponse.json(
      { error: 'Only Owner or Inventory Manager can approve purchase orders' },
      { status: 403 }
    )
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { items, notes } = approvePurchaseOrderSchema.parse(body)

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    })

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    if (!['PENDING_APPROVAL', 'PENDING', 'APPROVED'].includes(purchaseOrder.status)) {
      return NextResponse.json(
        { error: 'Only pending approval purchase orders can be approved' },
        { status: 400 }
      )
    }

    const priceByItemId = new Map(items.map((item) => [item.id, item.pricePerUnit]))
    const missingItems = purchaseOrder.items.filter((item) => !priceByItemId.has(item.id))
    if (missingItems.length > 0) {
      return NextResponse.json(
        { error: 'Price per unit is required for every purchase order item' },
        { status: 400 }
      )
    }

    const updatedItems = purchaseOrder.items.map((item) => {
      const pricePerUnit = priceByItemId.get(item.id) ?? 0
      return {
        id: item.id,
        pricePerUnit,
        totalPrice: item.orderedQuantity * pricePerUnit,
      }
    })

    const totalAmount = updatedItems.reduce((sum, item) => sum + item.totalPrice, 0)
    const balanceAmount = totalAmount - purchaseOrder.paidAmount

    const updatedPO = await prisma.$transaction(async (tx) => {
      for (const item of updatedItems) {
        await tx.pOItem.update({
          where: { id: item.id },
          data: {
            pricePerUnit: item.pricePerUnit,
            totalPrice: item.totalPrice,
          },
        })
      }

      return tx.purchaseOrder.update({
        where: { id },
        data: {
          status: 'APPROVED',
          totalAmount,
          balanceAmount,
          notes: appendApprovalNote(
            purchaseOrder.notes,
            session.user.name || session.user.email,
            notes
          ),
        },
        include: {
          supplier: true,
          items: true,
        },
      })
    })

    const userRole = session.user.role as any
    const filtered = filterApiResponse(updatedPO, userRole, 'purchase_order')

    return NextResponse.json({ purchaseOrder: filtered })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error approving purchase order:', error)
    return NextResponse.json(
      { error: 'Failed to approve purchase order' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAnyPermission(['delete_purchase_order'])
  if (error) return error

  try {
    const { id } = await params

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
    })

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    // Only allow deletion if status is PENDING
    if (!['PENDING_APPROVAL', 'PENDING', 'APPROVED'].includes(purchaseOrder.status)) {
      return NextResponse.json(
        { error: 'Can only cancel purchase orders before receiving starts' },
        { status: 400 }
      )
    }

    await prisma.purchaseOrder.update({
      where: { id },
      data: { active: false, status: 'CANCELLED' },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting purchase order:', error)
    return NextResponse.json(
      { error: 'Failed to delete purchase order' },
      { status: 500 }
    )
  }
}
