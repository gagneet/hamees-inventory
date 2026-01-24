import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { z } from 'zod'

const updateInstallmentSchema = z.object({
  paidAmount: z.number().min(0),
  paidDate: z.string().optional(),
  paymentMode: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'NET_BANKING']).optional(),
  transactionRef: z.string().optional(),
  notes: z.string().optional(),
})

// GET /api/installments/[id] - Get single installment
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

    const installment = await prisma.paymentInstallment.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            customer: {
              select: {
                name: true,
                phone: true,
              },
            },
          },
        },
      },
    })

    if (!installment) {
      return NextResponse.json({ error: 'Installment not found' }, { status: 404 })
    }

    return NextResponse.json(installment)
  } catch (error) {
    console.error('Error fetching installment:', error)
    return NextResponse.json(
      { error: 'Failed to fetch installment' },
      { status: 500 }
    )
  }
}

// PATCH /api/installments/[id] - Record payment for installment
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updateInstallmentSchema.parse(body)

    // Get existing installment
    const existingInstallment = await prisma.paymentInstallment.findUnique({
      where: { id },
    })

    if (!existingInstallment) {
      return NextResponse.json({ error: 'Installment not found' }, { status: 404 })
    }

    // Calculate new status based on paid amount
    type InstallmentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED'
    let newStatus: InstallmentStatus = existingInstallment.status as InstallmentStatus

    if (validatedData.paidAmount === 0) {
      // Check if overdue
      if (existingInstallment.dueDate < new Date()) {
        newStatus = 'OVERDUE'
      } else {
        newStatus = 'PENDING'
      }
    } else if (validatedData.paidAmount >= existingInstallment.installmentAmount) {
      newStatus = 'PAID'
    } else {
      newStatus = 'PARTIAL'
    }

    // Update installment
    const updatedInstallment = await prisma.paymentInstallment.update({
      where: { id },
      data: {
        paidAmount: validatedData.paidAmount,
        paidDate: validatedData.paidDate ? new Date(validatedData.paidDate) : undefined,
        paymentMode: validatedData.paymentMode,
        transactionRef: validatedData.transactionRef,
        notes: validatedData.notes,
        status: newStatus,
      },
      include: {
        order: true,
      },
    })

    return NextResponse.json({
      success: true,
      installment: updatedInstallment,
      message: 'Payment recorded successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error updating installment:', error)
    return NextResponse.json(
      { error: 'Failed to update installment' },
      { status: 500 }
    )
  }
}

// DELETE /api/installments/[id] - Delete installment
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAnyPermission(['delete_order'])
  if (error) return error

  try {
    const { id } = await params

    // Check if installment exists
    const installment = await prisma.paymentInstallment.findUnique({
      where: { id },
    })

    if (!installment) {
      return NextResponse.json({ error: 'Installment not found' }, { status: 404 })
    }

    // Don't allow deletion of paid installments
    if (installment.status === 'PAID' && installment.paidAmount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete paid installments' },
        { status: 400 }
      )
    }

    await prisma.paymentInstallment.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'Installment deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting installment:', error)
    return NextResponse.json(
      { error: 'Failed to delete installment' },
      { status: 500 }
    )
  }
}
