import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { VisualMeasurementClient } from './visual-measurement-client'

async function getCustomerData(id: string) {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        measurements: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    return customer
  } catch (error) {
    console.error('[Visual Measurements] Error fetching customer:', error)
    return null
  }
}

export default async function VisualMeasurementsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/')

  // Check permissions - TAILOR role or higher can use visual measurements
  const canManageMeasurements = hasPermission(session.user.role as any, 'manage_measurements')

  if (!canManageMeasurements) {
    redirect('/dashboard')
  }

  const { id } = await params
  const customer = await getCustomerData(id)

  if (!customer) {
    redirect('/customers')
  }

  return (
    <VisualMeasurementClient
      customerId={customer.id}
      customerName={customer.name}
      customerPhone={customer.phone}
      existingMeasurements={customer.measurements}
      session={session}
    />
  )
}
