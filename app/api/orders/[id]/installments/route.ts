import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-permissions'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { addDays, addMonths } from 'date-fns'
import { filterApiResponse } from '@/lib/api-filter-response'
import { canViewField } from '@/lib/field-acl'
import { actorFromSession, requireOrderAccess } from '@/lib/authz'
import { roundMoney } from '@/lib/order-finance'

const createInstallmentPlanSchema = z.object({
  numberOfInstallments: z.number().int().min(1).max(12),
  firstInstallmentAmount: z.number().positive().optional(),
  installmentFrequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY']).optional().default('MONTHLY'),
  startDate: z.string().optional(),
})

// GET /api/orders/[id]/installments - Get all installments for an order
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requirePermission('view_orders')
    if (error) return error
    const actor = actorFromSession(session)
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: orderId } = await params

    const denied = await requireOrderAccess(actor, orderId)
    if (denied) return denied

    // Get order with installments
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        installments: {
          orderBy: {
            installmentNumber: 'asc',
          },
        },
        customer: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Calculate summary
    type Installment = typeof order.installments[number]

    const totalPaid = order.installments.reduce((sum: number, inst: Installment) => sum + inst.paidAmount, 0)
    const totalDue = order.balanceAmount
    const overdue = order.installments.filter((inst: Installment) =>
      inst.status === 'OVERDUE' || (inst.status === 'PENDING' && inst.dueDate < new Date())
    ).length

    // FEATURETRACE: Apply ACL field filtering to response
    const userRole = actor.role
    const canViewPaymentAmounts = canViewField(userRole, 'payment', 'amount')
    const canViewOrderBalance = canViewField(userRole, 'order', 'balanceAmount')
    const filteredOrder = {
      id: order.id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      advancePaid: order.advancePaid,
      balanceAmount: order.balanceAmount,
      customer: order.customer,
    }
    const filtered = filterApiResponse(filteredOrder, userRole, 'order')
    const filteredInstallments = filterApiResponse(order.installments, userRole, 'payment')

    return NextResponse.json({
      order: filtered,
      installments: filteredInstallments,
      summary: {
        totalInstallments: order.installments.length,
        ...(canViewPaymentAmounts ? { totalPaid } : {}),
        ...(canViewOrderBalance ? { totalDue } : {}),
        overdueCount: overdue,
      },
    })
  } catch (error) {
    console.error('Error fetching installments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch installments' },
      { status: 500 }
    )
  }
}

// POST /api/orders/[id]/installments - Create installment plan (record_payment: OWNER/ADMIN)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requirePermission('record_payment')
    if (error) return error
    const actor = actorFromSession(session)
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: orderId } = await params
    const body = await request.json()
    const validatedData = createInstallmentPlanSchema.parse(body)

    const denied = await requireOrderAccess(actor, orderId)
    if (denied) return denied

    // Get order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        installments: true,
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Cannot create an installment plan for a cancelled order' }, { status: 400 })
    }

    // Check if installments already exist
    if (order.installments.length > 0) {
      return NextResponse.json(
        { error: 'Installment plan already exists for this order' },
        { status: 400 }
      )
    }

    // Calculate installment amounts
    const balanceAmount = order.balanceAmount
    if (balanceAmount <= 0) {
      return NextResponse.json({ error: 'This order has no outstanding balance' }, { status: 400 })
    }

    const numberOfInstallments = validatedData.numberOfInstallments
    const firstInstallmentAmount =
      numberOfInstallments === 1
        ? balanceAmount
        : validatedData.firstInstallmentAmount ?? balanceAmount / numberOfInstallments
    if (firstInstallmentAmount > balanceAmount) {
      return NextResponse.json({ error: 'First installment cannot exceed the outstanding balance' }, { status: 400 })
    }
    const remainingAmount = balanceAmount - firstInstallmentAmount
    const subsequentInstallmentAmount = numberOfInstallments > 1 ? remainingAmount / (numberOfInstallments - 1) : 0

    // Calculate due dates
    const startDate = validatedData.startDate ? new Date(validatedData.startDate) : new Date()
    if (Number.isNaN(startDate.getTime())) {
      return NextResponse.json({ error: 'Invalid start date' }, { status: 400 })
    }
    const installments = []

    for (let i = 0; i < numberOfInstallments; i++) {
      let dueDate: Date

      if (i === 0) {
        dueDate = startDate
      } else {
        const previousDate = i === 1 ? startDate : installments[i - 1].dueDate

        switch (validatedData.installmentFrequency) {
          case 'WEEKLY':
            dueDate = addDays(previousDate, 7)
            break
          case 'BIWEEKLY':
            dueDate = addDays(previousDate, 14)
            break
          case 'MONTHLY':
          default:
            dueDate = addMonths(previousDate, 1)
            break
        }
      }

      const amount = i === 0 ? firstInstallmentAmount : subsequentInstallmentAmount

      installments.push({
        orderId: order.id,
        installmentNumber: i + 1,
        installmentAmount: roundMoney(amount),
        dueDate,
        status: 'PENDING' as const,
      })
    }

    // Create installments in database
    await prisma.paymentInstallment.createMany({
      data: installments,
    })

    // Fetch created installments
    const createdInstallments = await prisma.paymentInstallment.findMany({
      where: { orderId: order.id },
      orderBy: { installmentNumber: 'asc' },
    })

    const filteredInstallments = filterApiResponse(createdInstallments, actor.role, 'payment')

    return NextResponse.json({
      success: true,
      installments: filteredInstallments,
      message: `Created ${numberOfInstallments} installments for order ${order.orderNumber}`,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating installments:', error)
    return NextResponse.json(
      { error: 'Failed to create installments' },
      { status: 500 }
    )
  }
}
