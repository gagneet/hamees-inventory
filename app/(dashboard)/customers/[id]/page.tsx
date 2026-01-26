import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { CustomerDetailClient } from './customer-detail-client'

async function getCustomerDetails(id: string) {
  try {
    console.log('[Customer Detail] Fetching customer:', id)
    const customer = await prisma.customer.findUnique({
      where: { id },
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

    console.log('[Customer Detail] Customer found:', customer ? 'yes' : 'no')
    if (!customer) {
      console.log('[Customer Detail] Customer not found in database')
    }
    return customer
  } catch (error) {
    console.error('[Customer Detail] Error fetching customer details:', error)
    return null
  }
}

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ highlight?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/')

  const { id } = await params
  const { highlight } = await searchParams
  const customer = await getCustomerDetails(id)

  if (!customer) {
    redirect('/customers')
  }

  // Check if user can manage measurements
  const canManageMeasurements = hasPermission(session.user.role, 'manage_customers')

  // Serialize dates and normalize types for client component
  const serializedCustomer = {
    ...customer,
    createdAt: customer.createdAt.toISOString(),
    orders: customer.orders?.map(order => ({
      ...order,
      deliveryDate: order.deliveryDate.toISOString(),
      createdAt: order.createdAt.toISOString(),
    })),
    measurements: customer.measurements?.map(measurement => ({
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
      createdBy: measurement.createdBy ? {
        id: measurement.createdBy.id,
        name: measurement.createdBy.name,
        email: measurement.createdBy.email,
      } : undefined,
    })),
  }

  return (
    <CustomerDetailClient
      customer={serializedCustomer}
      canManageMeasurements={canManageMeasurements}
      highlight={highlight}
    />
  )
}
