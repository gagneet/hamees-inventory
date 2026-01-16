import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { z } from 'zod'

const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email().nullish(),
  phone: z.string().min(1, 'Phone is required'),
  address: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  pincode: z.string().nullish(),
  notes: z.string().nullish(),
})

export async function GET(request: Request) {
  const { error } = await requireAnyPermission(['view_customers'])
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}

    // Get total count for pagination
    const totalItems = await prisma.customer.count({ where })

    const customers = await prisma.customer.findMany({
      where,
      include: {
        measurements: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        orders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            deliveryDate: true,
            createdAt: true,
            _count: {
              select: {
                items: true, // Count of items per order
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            orders: true, // Get total order count
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    })

    const totalPages = Math.ceil(totalItems / limit)

    return NextResponse.json({
      customers,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
      },
    })
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const { session, error } = await requireAnyPermission(['manage_customers'])
  if (error) return error

  try {
    const body = await request.json()
    const validatedData = customerSchema.parse(body)

    const customer = await prisma.customer.create({
      data: validatedData,
    })

    return NextResponse.json({ customer }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating customer:', error)
    return NextResponse.json(
      { error: 'Failed to create customer' },
      { status: 500 }
    )
  }
}
