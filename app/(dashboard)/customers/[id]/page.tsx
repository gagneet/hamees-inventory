/**
 * @featuretrace Customer Detail
 * @page /customers/[id]
 * @permission view_customers (+ object-level scope: TAILOR sees only customers of orders assigned to them)
 * @description Server-rendered customer profile page. Shows customer info (name, phone,
 *   email, city), order count, and measurements by garment type.
 *   Primary CTA: New Order (pre-fills customerId).
 *
 * @reads Customer + orders + measurements (all garment types, active only)
 * @renders CustomerDetailClient — client shell for measurements + order list
 * @actions New Order | Edit Customer | Add Measurement
 */

import { auth } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import { hasPermission, type UserRole } from '@/lib/permissions'
import { hasFinancialAccess } from '@/lib/field-acl'
import { actorFromSession, customerScope, orderScope, scopedWhere, type Actor } from '@/lib/authz'
import { prisma } from '@/lib/db'
import { CustomerDetailClient } from './customer-detail-client'
import { Prisma } from '@prisma/client'

async function getCustomerDetails(id: string, actor: Actor) {
  try {
    const customer = await prisma.customer.findFirst({
      where: scopedWhere<Prisma.CustomerWhereInput>({ id }, customerScope(actor)),
      include: {
        measurements: {
          where: { isActive: true }, // Only fetch active measurements
          orderBy: { createdAt: 'desc' },
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        orders: {
          // Scoped roles only see the orders they work on
          where: orderScope(actor),
          include: {
            items: {
              include: {
                garmentPattern: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    return customer
  } catch (error) {
    console.error('[Customer Detail] Error fetching customer details:', error)
    return null
  }
}

type CustomerWithRelations = NonNullable<Awaited<ReturnType<typeof getCustomerDetails>>>

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ highlight?: string }>
}) {
  const session = await auth()
  const actor = actorFromSession(session)
  if (!session?.user || !actor) redirect('/')

  const role = session.user.role as UserRole
  const { id } = await params
  const { highlight } = await searchParams
  const customer = await getCustomerDetails(id, actor)

  // Out-of-scope and missing customers are indistinguishable to the caller
  if (!customer) notFound()

  const canEditCustomer = hasPermission(role, 'manage_customers')
  const canManageMeasurements = hasPermission(role, 'manage_measurements')
  const canCreateOrder = hasPermission(role, 'create_order')
  const showFinancials = hasFinancialAccess(role, 'order')

  // Serialize dates and send only the order fields the client renders (no pricing for restricted roles)
  const serializedCustomer = {
    ...customer,
    createdAt: customer.createdAt.toISOString(),
    orders: customer.orders?.map((order: CustomerWithRelations['orders'][number]) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      deliveryDate: order.deliveryDate.toISOString(),
      createdAt: order.createdAt.toISOString(),
      totalAmount: showFinancials ? order.totalAmount : 0,
      balanceAmount: showFinancials ? order.balanceAmount : 0,
      items: order.items.map((item) => ({ garmentPattern: { name: item.garmentPattern.name } })),
    })),
    measurements: customer.measurements?.map((measurement: CustomerWithRelations['measurements'][number]) => ({
      id: measurement.id,
      garmentType: measurement.garmentType,
      bodyType: measurement.bodyType,
      neck: measurement.neck,
      chest: measurement.chest,
      waist: measurement.waist,
      hip: measurement.hip,
      shoulder: measurement.shoulder,
      sleeveLength: measurement.sleeveLength,
      shirtLength: measurement.shirtLength,
      inseam: measurement.inseam,
      outseam: measurement.outseam,
      thigh: measurement.thigh,
      knee: measurement.knee,
      bottomOpening: measurement.bottomOpening,
      jacketLength: measurement.jacketLength,
      lapelWidth: measurement.lapelWidth,
      additionalMeasurements: measurement.additionalMeasurements,
      notes: measurement.notes,
      isActive: measurement.isActive,
      createdAt: measurement.createdAt.toISOString(),
      // Staff emails are not needed on this page (and would reach TAILOR/VIEWER), so only the name is sent
      createdBy: measurement.createdBy ? {
        id: measurement.createdBy.id,
        name: measurement.createdBy.name,
      } : undefined,
    })),
  }

  return (
    <CustomerDetailClient
      customer={serializedCustomer}
      canManageMeasurements={canManageMeasurements}
      canEditCustomer={canEditCustomer}
      canCreateOrder={canCreateOrder}
      showFinancials={showFinancials}
      highlight={highlight}
    />
  )
}
