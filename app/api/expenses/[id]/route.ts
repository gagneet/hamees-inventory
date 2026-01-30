import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { hasPermission } from '@/lib/permissions'

const updateExpenseSchema = z.object({
  category: z.enum(['RENT', 'UTILITIES', 'SALARIES', 'TRANSPORT', 'MARKETING', 'MAINTENANCE', 'OFFICE_SUPPLIES', 'PROFESSIONAL_FEES', 'INSURANCE', 'DEPRECIATION', 'BANK_CHARGES', 'MISCELLANEOUS']).optional(),
  description: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  gstRate: z.number().min(0).max(100).optional(),
  expenseDate: z.string().optional(),
  vendorName: z.string().optional(),
  vendorGstin: z.string().optional(),
  invoiceNumber: z.string().optional(),
  paymentMode: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'NET_BANKING']).optional(),
  tdsAmount: z.number().min(0).optional(),
  tdsRate: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
})

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
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        paidByUser: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    return NextResponse.json({ expense })
  } catch (error) {
    console.error('Error fetching expense:', error)
    return NextResponse.json({ error: 'Failed to fetch expense' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user.role, 'manage_expenses')) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updateExpenseSchema.parse(body)

    // Get current expense to calculate new totals if amount or GST rate changed
    const currentExpense = await prisma.expense.findUnique({
      where: { id },
    })

    if (!currentExpense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    // Calculate new amounts if amount or gstRate changed
    const amount = validatedData.amount ?? currentExpense.amount
    const gstRate = validatedData.gstRate ?? currentExpense.gstRate
    const gstAmount = (amount * gstRate) / 100
    const totalAmount = amount + gstAmount

    const expense = await prisma.expense.update({
      where: { id: id },
      data: {
        ...(validatedData.category && { category: validatedData.category }),
        ...(validatedData.description && { description: validatedData.description }),
        ...(validatedData.amount !== undefined && { amount: validatedData.amount }),
        ...(validatedData.gstRate !== undefined && { gstRate: validatedData.gstRate }),
        gstAmount,
        totalAmount,
        ...(validatedData.expenseDate && { expenseDate: new Date(validatedData.expenseDate) }),
        ...(validatedData.vendorName !== undefined && { vendorName: validatedData.vendorName }),
        ...(validatedData.vendorGstin !== undefined && { vendorGstin: validatedData.vendorGstin }),
        ...(validatedData.invoiceNumber !== undefined && { invoiceNumber: validatedData.invoiceNumber }),
        ...(validatedData.paymentMode && { paymentMode: validatedData.paymentMode }),
        ...(validatedData.tdsAmount !== undefined && { tdsAmount: validatedData.tdsAmount }),
        ...(validatedData.tdsRate !== undefined && { tdsRate: validatedData.tdsRate }),
        ...(validatedData.notes !== undefined && { notes: validatedData.notes }),
      },
      include: {
        paidByUser: {
          select: {
            name: true,
          },
        },
      },
    })

    return NextResponse.json({ expense })
  } catch (error) {
    console.error('Error updating expense:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user.role, 'delete_expenses')) {
      return NextResponse.json({ error: 'Forbidden - Only ADMIN can delete expenses' }, { status: 403 })
    }

    const { id } = await params
    // Soft delete - mark as inactive instead of deleting
    const expense = await prisma.expense.update({
      where: { id },
      data: {
        active: false,
      },
    })

    return NextResponse.json({ expense, message: 'Expense deleted successfully' })
  } catch (error) {
    console.error('Error deleting expense:', error)
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 })
  }
}
