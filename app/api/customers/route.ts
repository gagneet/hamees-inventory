import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { filterApiResponse } from '@/lib/api-filter-response'
import { actorFromSession, customerScope, orderScope, scopedWhere } from '@/lib/authz'
import { getAppSettings } from '@/lib/settings'
import { phoneSearchVariants } from '@/lib/phone'
import { phoneIssueMessage, phoneSchema } from '@/lib/phone-schema'
import { duplicatePhoneBody, findCustomersByPhone } from '@/lib/phone-lookup'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'

/** Phone numbers are stored in E.164; numbers typed without +code are read in the shop's region. */
const customerSchema = (phoneRegion: string) =>
  z.object({
    name: z.string().trim().min(1, 'Name is required').max(120),
    email: z.string().email().nullish(),
    phone: phoneSchema(phoneRegion),
    address: z.string().max(300).nullish(),
    city: z.string().max(80).nullish(),
    state: z.string().max(80).nullish(),
    pincode: z.string().max(20).nullish(),
    notes: z.string().max(2000).nullish(),
    /** Confirms a second customer with a number already on file (families often share one) */
    allowDuplicatePhone: z.boolean().optional(),
  })

export async function GET(request: Request) {
  const { session, error } = await requireAnyPermission(['view_customers'])
  if (error) return error
  const actor = actorFromSession(session)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    // Pagination parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10') || 10))
    const skip = (page - 1) * limit

    // "98765 43210", "098765…" and "+91 98765…" all find the stored "+919876543210"
    const phoneVariants = search ? phoneSearchVariants(search, (await getAppSettings()).phoneRegion) : []
    const filter: Prisma.CustomerWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search, mode: 'insensitive' as const } },
            ...phoneVariants.map((variant) => ({ phone: { contains: variant } })),
          ],
        }
      : {}

    // ABAC: tailors only see customers of orders assigned to them
    const where = scopedWhere(filter, customerScope(actor))
    const ordersInScope = orderScope(actor)

    const [totalItems, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        include: {
          measurements: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          orders: {
            where: ordersInScope,
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
              orders: { where: ordersInScope },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ])

    const totalPages = Math.ceil(totalItems / limit)

    return NextResponse.json({
      // Nested order amounts are stripped for roles without customer financial access
      customers: filterApiResponse(customers, actor.role, 'customer'),
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
  const { error } = await requireAnyPermission(['manage_customers'])
  if (error) return error

  try {
    const body = await request.json()
    const { phoneRegion } = await getAppSettings()
    const { allowDuplicatePhone, ...validatedData } = customerSchema(phoneRegion).parse(body)

    if (!allowDuplicatePhone) {
      const [existing] = await findCustomersByPhone(validatedData.phone, phoneRegion)
      if (existing) return NextResponse.json(duplicatePhoneBody(existing), { status: 409 })
    }

    const customer = await prisma.customer.create({
      data: validatedData,
    })

    return NextResponse.json({ customer }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: phoneIssueMessage(error) ?? 'Validation failed', details: error.issues },
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
