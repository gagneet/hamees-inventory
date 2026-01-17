import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { subMonths } from 'date-fns'

export async function GET(request: Request) {
  const { error } = await requireAnyPermission(['view_customer_reports'])
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const months = parseInt(searchParams.get('months') || '12')

    // Top customers by revenue
    const customers = await prisma.customer.findMany({
      include: {
        orders: {
          where: {
            status: 'DELIVERED',
            createdAt: {
              gte: subMonths(new Date(), months),
            },
          },
        },
        measurements: true,
      },
    })

    const customersWithStats = customers
      .map((customer) => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        city: customer.city,
        orderCount: customer.orders.length,
        totalRevenue: customer.orders.reduce((sum, o) => sum + o.totalAmount, 0),
        avgOrderValue:
          customer.orders.length > 0
            ? customer.orders.reduce((sum, o) => sum + o.totalAmount, 0) /
              customer.orders.length
            : 0,
        lastOrderDate:
          customer.orders.length > 0
            ? customer.orders[customer.orders.length - 1].createdAt
            : null,
        hasMeasurements: customer.measurements.length > 0,
      }))
      .filter((c) => c.orderCount > 0)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)

    // Repeat customer rate
    const repeatCustomers = customersWithStats.filter((c) => c.orderCount > 1).length
    const repeatRate =
      customersWithStats.length > 0
        ? (repeatCustomers / customersWithStats.length) * 100
        : 0

    // Average lifetime value
    const avgLifetimeValue =
      customersWithStats.length > 0
        ? customersWithStats.reduce((sum, c) => sum + c.totalRevenue, 0) /
          customersWithStats.length
        : 0

    return NextResponse.json({
      summary: {
        totalCustomers: customers.length,
        activeCustomers: customersWithStats.length,
        repeatCustomers,
        repeatRate: repeatRate.toFixed(1),
        avgLifetimeValue: avgLifetimeValue.toFixed(0),
        avgOrderValue:
          customersWithStats.length > 0
            ? (
                customersWithStats.reduce((sum, c) => sum + c.avgOrderValue, 0) /
                customersWithStats.length
              ).toFixed(0)
            : 0,
      },
      topCustomers: customersWithStats.slice(0, 20),
      customerSegments: {
        highValue: customersWithStats.filter((c) => c.totalRevenue > 50000).length,
        mediumValue: customersWithStats.filter(
          (c) => c.totalRevenue >= 20000 && c.totalRevenue <= 50000
        ).length,
        lowValue: customersWithStats.filter((c) => c.totalRevenue < 20000).length,
      },
    })
  } catch (error) {
    console.error('Error generating customer report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
