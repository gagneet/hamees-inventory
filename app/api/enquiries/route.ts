import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'
import { z } from 'zod'

/**
 * @featuretrace Enquiries list (staff)
 * @route GET /api/enquiries?status=&kind=&q=&take=
 * @permission view_enquiries
 * @reads CustomerEnquiry
 *
 * Enquiries hold no money, so there is nothing here for lib/field-acl to strip. The submitter's
 * IP hash and user agent are abuse-control data and are never returned.
 */

const querySchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED']).optional(),
  kind: z.enum(['ORDER_ENQUIRY', 'FITTING']).optional(),
  q: z.string().trim().max(100).optional(),
  take: z.coerce.number().int().min(1).max(200).default(100),
})

export async function GET(request: Request) {
  const { error } = await requirePermission('view_enquiries')
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const { status, kind, q, take } = querySchema.parse({
      status: searchParams.get('status') || undefined,
      kind: searchParams.get('kind') || undefined,
      q: searchParams.get('q') || undefined,
      take: searchParams.get('take') || undefined,
    })

    const enquiries =
      (await prisma.customerEnquiry.findMany({
        where: {
          ...(status ? { status } : {}),
          ...(kind ? { kind } : {}),
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: 'insensitive' as const } },
                  { phone: { contains: q } },
                  { garmentType: { contains: q, mode: 'insensitive' as const } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          createdAt: true,
          name: true,
          phone: true,
          email: true,
          city: true,
          kind: true,
          garmentType: true,
          fabricNotes: true,
          quantity: true,
          preferredDate: true,
          notes: true,
          status: true,
          staffNotes: true,
          customerId: true,
          orderId: true,
          order: { select: { orderNumber: true } },
          handledBy: { select: { name: true } },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take,
      })) ?? []

    const counts =
      (await prisma.customerEnquiry.groupBy({ by: ['status'], _count: { _all: true } })) ?? []

    return NextResponse.json({
      enquiries,
      counts: Object.fromEntries(counts.map((row) => [row.status, row._count._all])),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query', details: error.issues }, { status: 400 })
    }
    console.error('Error listing enquiries:', error)
    return NextResponse.json({ error: 'Failed to load enquiries' }, { status: 500 })
  }
}
