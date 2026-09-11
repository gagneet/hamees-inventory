import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { filterApiResponse } from '@/lib/api-filter-response'
import { actorFromSession, orderScope, requireCustomerAccess } from '@/lib/authz'
import { getAppSettings } from '@/lib/settings'
import { optionalPhoneSchema, phoneIssueMessage } from '@/lib/phone-schema'
import { duplicatePhoneBody, findCustomersByPhone, samePhone } from '@/lib/phone-lookup'
import { z } from 'zod'

const customerUpdateSchema = (phoneRegion: string) =>
  z.object({
    name: z.string().trim().min(1).max(120).nullish(),
    email: z.string().email().nullish(),
    phone: optionalPhoneSchema(phoneRegion),
    address: z.string().max(300).nullish(),
    city: z.string().max(80).nullish(),
    state: z.string().max(80).nullish(),
    pincode: z.string().max(20).nullish(),
    notes: z.string().max(2000).nullish(),
    /** Confirms a number that another customer already has */
    allowDuplicatePhone: z.boolean().optional(),
  })

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAnyPermission(['view_customers'])
  if (error) return error
  const actor = actorFromSession(session)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params

    const denied = await requireCustomerAccess(actor, id)
    if (denied) return denied

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        measurements: {
          orderBy: { createdAt: 'desc' },
        },
        orders: {
          // Tailors only see the orders assigned to them, even for a customer in scope
          where: orderScope(actor),
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

    return NextResponse.json({ customer: filterApiResponse(customer, actor.role, 'customer') })
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
  const { session, error } = await requireAnyPermission(['manage_customers'])
  if (error) return error
  const actor = actorFromSession(session)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await request.json()
    const { phoneRegion } = await getAppSettings()
    const { allowDuplicatePhone, ...validatedData } = customerUpdateSchema(phoneRegion).parse(body)

    const denied = await requireCustomerAccess(actor, id)
    if (denied) return denied

    // Remove nullish values
    const updateData = Object.fromEntries(
      Object.entries(validatedData).filter(([_, v]) => v !== null && v !== undefined)
    )

    const existing = await prisma.customer.findUnique({ where: { id }, select: { id: true, phone: true } })
    if (!existing) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Only a changed number is checked, so customers who already share one can still be edited
    const phone = validatedData.phone
    if (phone && !allowDuplicatePhone && !samePhone(existing.phone, phone, phoneRegion)) {
      const [other] = await findCustomersByPhone(phone, phoneRegion, { excludeId: id })
      if (other) return NextResponse.json(duplicatePhoneBody(other), { status: 409 })
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ customer })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: phoneIssueMessage(error) ?? 'Validation failed', details: error.issues },
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
  const { error } = await requireAnyPermission(['delete_customer'])
  if (error) return error

  try {
    const { id } = await params
    // Check if customer has orders
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    if (customer._count.orders > 0) {
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
