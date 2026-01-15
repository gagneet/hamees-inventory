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
  const canManageMeasurements = hasPermission(session.user.role as any, 'manage_customers')

  return (
    <CustomerDetailClient
      customer={customer}
      canManageMeasurements={canManageMeasurements}
      highlight={highlight}
    />
  )
}
