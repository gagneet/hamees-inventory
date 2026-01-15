import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { addDays, addMonths } from 'date-fns'

const createInstallmentPlanSchema = z.object({
  numberOfInstallments: z.number().min(1).max(12),
  firstInstallmentAmount: z.number().optional(),
  installmentFrequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY']).optional().default('MONTHLY'),
  startDate: z.string().optional(),
})

// GET /api/orders/[id]/installments - Get all installments for an order
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: orderId } = await params

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
    const totalPaid = order.installments.reduce((sum, inst) => sum + inst.paidAmount, 0)
    const totalDue = order.balanceAmount
    const overdue = order.installments.filter(inst =>
      inst.status === 'OVERDUE' || (inst.status === 'PENDING' && inst.dueDate < new Date())
    ).length

    return NextResponse.json({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        advancePaid: order.advancePaid,
        balanceAmount: order.balanceAmount,
        customer: order.customer,
      },
      installments: order.installments,
      summary: {
        totalInstallments: order.installments.length,
        totalPaid,
        totalDue,
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

// POST /api/orders/[id]/installments - Create installment plan
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: orderId } = await params
    const body = await request.json()
    const validatedData = createInstallmentPlanSchema.parse(body)

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

    // Check if installments already exist
    if (order.installments.length > 0) {
      return NextResponse.json(
        { error: 'Installment plan already exists for this order' },
        { status: 400 }
      )
    }

    // Calculate installment amounts
    const balanceAmount = order.balanceAmount
    const numberOfInstallments = validatedData.numberOfInstallments
    const firstInstallmentAmount = validatedData.firstInstallmentAmount || balanceAmount / numberOfInstallments
    const remainingAmount = balanceAmount - firstInstallmentAmount
    const subsequentInstallmentAmount = remainingAmount / (numberOfInstallments - 1)

    // Calculate due dates
    const startDate = validatedData.startDate ? new Date(validatedData.startDate) : new Date()
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
        amount: parseFloat(amount.toFixed(2)),
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

    return NextResponse.json({
      success: true,
      installments: createdInstallments,
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
