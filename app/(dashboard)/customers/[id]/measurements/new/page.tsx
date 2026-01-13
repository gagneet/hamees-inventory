import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { MeasurementForm } from '@/components/measurements/measurement-form'
import { GarmentTypeSelector } from '@/components/measurements/garment-type-selector'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import DashboardLayout from '@/components/DashboardLayout'
import { ArrowLeft } from 'lucide-react'

async function getCustomer(id: string) {
  return await prisma.customer.findUnique({
    where: { id },
    select: { id: true, name: true },
  })
}

export default async function NewMeasurementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ garmentType?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/')

  const { id } = await params
  const { garmentType = "Men's Shirt" } = await searchParams

  const customer = await getCustomer(id)
  if (!customer) redirect('/customers')

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href={`/customers/${id}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">New Measurement</h1>
            <p className="text-sm text-slate-600">{customer.name}</p>
          </div>
        </div>

        {/* Garment Type Selector */}
        <div className="max-w-4xl">
          <GarmentTypeSelector customerId={id} currentType={garmentType} />
        </div>

        {/* Measurement Form */}
        <div className="max-w-4xl">
          <MeasurementForm
            customerId={id}
            garmentType={garmentType}
          />
        </div>
      </div>
    </DashboardLayout>
  )
}
