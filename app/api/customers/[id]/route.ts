import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { z } from 'zod'

const customerUpdateSchema = z.object({
  name: z.string().min(1).nullish(),
  email: z.string().email().nullish(),
  phone: z.string().nullish(),
  address: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  pincode: z.string().nullish(),
  notes: z.string().nullish(),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAnyPermission(['view_customers'])
  if (error) return error

  try {
    const { id } = await params
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        measurements: {
          orderBy: { createdAt: 'desc' },
        },
        orders: {
          include: {
            items: {
              include: {
                garmentPattern: true,
                clothInventory: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    return NextResponse.json({ customer })
  } catch (error) {
    console.error('Error fetching customer:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAnyPermission(['manage_customers'])
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json()
    const validatedData = customerUpdateSchema.parse(body)

    // Remove nullish values
    const updateData = Object.fromEntries(
      Object.entries(validatedData).filter(([_, v]) => v !== null && v !== undefined)
    )

    const customer = await prisma.customer.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ customer })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error updating customer:', error)
    return NextResponse.json(
      { error: 'Failed to update customer' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAnyPermission(['manage_customers'])
  if (error) return error

  try {
    const { id } = await params
    // Check if customer has orders
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: { orders: true },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    if (customer.orders.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete customer with existing orders' },
        { status: 400 }
      )
    }

    await prisma.customer.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting customer:', error)
    return NextResponse.json(
      { error: 'Failed to delete customer' },
      { status: 500 }
    )
  }
}
