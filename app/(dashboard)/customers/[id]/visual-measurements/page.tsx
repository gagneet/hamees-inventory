import type { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import { hasPermission } from '@/lib/permissions'
import { actorFromSession, customerScope, scopedWhere, type Actor } from '@/lib/authz'
import { prisma } from '@/lib/db'
import { VisualMeasurementClient } from './visual-measurement-client'

async function getCustomerData(id: string, actor: Actor) {
  try {
    const customer = await prisma.customer.findFirst({
      where: scopedWhere<Prisma.CustomerWhereInput>({ id }, customerScope(actor)),
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
  const actor = actorFromSession(session)
  if (!session?.user || !actor) redirect('/login')

  // Check permissions - TAILOR role or higher can use visual measurements
  const canManageMeasurements = hasPermission(session.user.role, 'manage_measurements')

  if (!canManageMeasurements) {
    redirect('/dashboard')
  }

  const { id } = await params
  const customer = await getCustomerData(id, actor)

  // Out-of-scope and missing customers are indistinguishable to the caller
  if (!customer) notFound()

  // Serialize dates for client component
  const serializedMeasurements = customer.measurements.map(m => ({
    id: m.id,
    garmentType: m.garmentType,
    createdAt: m.createdAt.toISOString(),
  }))

  return (
    <VisualMeasurementClient
      customerId={customer.id}
      customerName={customer.name}
      customerPhone={customer.phone}
      existingMeasurements={serializedMeasurements}
      session={session}
    />
  )
}
