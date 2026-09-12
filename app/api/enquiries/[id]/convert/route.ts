import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAllPermissions } from '@/lib/api-permissions'
import { actorFromSession } from '@/lib/authz'
import { getAppSettings } from '@/lib/settings'
import { findCustomersByPhone } from '@/lib/phone-lookup'

/**
 * @featuretrace Convert an enquiry into a customer, ready for an order
 * @route POST /api/enquiries/[id]/convert
 * @permission manage_enquiries AND manage_customers AND create_order
 * @writes Customer (find or create), CustomerEnquiry
 *
 * Links the enquiry to a customer record and hands the caller a customerId to open the new-order
 * form with. It does NOT create the order: pricing, tax and stock reservation stay in
 * POST /api/orders, behind the same permissions as any other order. The enquiry becomes
 * CONVERTED only when that order is actually created.
 *
 * When several customers share the number (families do), the choice is returned to the caller
 * rather than guessed.
 */

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAllPermissions(['manage_enquiries', 'manage_customers', 'create_order'])
  if (error) return error
  const actor = actorFromSession(session)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const chosenCustomerId: string | undefined = body?.customerId

    const enquiry = await prisma.customerEnquiry.findUnique({
      where: { id },
      select: { id: true, name: true, phone: true, email: true, city: true, status: true, customerId: true },
    })
    if (!enquiry) return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 })
    if (enquiry.status === 'CONVERTED') {
      return NextResponse.json({ error: 'This enquiry already has an order' }, { status: 400 })
    }

    const settings = await getAppSettings()

    let customerId = chosenCustomerId ?? enquiry.customerId ?? null
    if (customerId) {
      const exists = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } })
      if (!exists) customerId = null
    }

    if (!customerId) {
      const matches = await findCustomersByPhone(enquiry.phone, settings.phoneRegion)
      if (matches.length > 1) {
        // Families share a number — let the person decide instead of picking one
        return NextResponse.json(
          { code: 'MULTIPLE_CUSTOMERS', error: 'More than one customer has this number.', candidates: matches },
          { status: 409 }
        )
      }
      if (matches.length === 1) {
        customerId = matches[0].id
      } else {
        const created = await prisma.customer.create({
          data: {
            name: enquiry.name,
            phone: enquiry.phone,
            email: enquiry.email,
            city: enquiry.city,
          },
          select: { id: true },
        })
        customerId = created.id
      }
    }

    await prisma.customerEnquiry.update({
      where: { id },
      data: {
        customerId,
        handledById: actor.id,
        // Not CONVERTED yet — that happens when the order is created
        ...(enquiry.status === 'NEW' ? { status: 'CONTACTED' as const } : {}),
      },
      select: { id: true },
    })

    return NextResponse.json({ customerId, enquiryId: id })
  } catch (error) {
    console.error('Error converting enquiry:', error)
    return NextResponse.json({ error: 'Failed to convert enquiry' }, { status: 500 })
  }
}
