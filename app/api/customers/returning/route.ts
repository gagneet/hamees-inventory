import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { format } from 'date-fns'

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all customers with their orders
    const customers = await prisma.customer.findMany({
      include: {
        orders: {
          select: {
            id: true,
            orderDate: true,
          },
          orderBy: {
            orderDate: 'asc',
          },
        },
      },
    })

    type CustomerWithOrders = typeof customers[number]
    type OrderData = CustomerWithOrders['orders'][number]

    interface ReturningCustomerData {
      id: string
      name: string
      email: string | null
      phone: string
      totalOrders: number
      monthsActive: string[]
      firstOrderDate: string
      lastOrderDate: string
    }

    // Filter customers with 3+ orders across different months
    const returningCustomers: ReturningCustomerData[] = customers
      .filter((customer: CustomerWithOrders) => {
        if (customer.orders.length < 3) {
          return false
        }

        // Get unique months from orders
        const uniqueMonths = new Set(
          customer.orders.map((order: OrderData) =>
            format(new Date(order.orderDate), 'MMM yyyy')
          )
        )

        // Must have orders in at least 2 different months
        return uniqueMonths.size >= 2
      })
      .map((customer: CustomerWithOrders): ReturningCustomerData => {
        const orderDates = customer.orders.map((o: OrderData) => new Date(o.orderDate))
        const uniqueMonths: string[] = Array.from(
          new Set(
            customer.orders.map((order: OrderData) =>
              format(new Date(order.orderDate), 'MMM yyyy')
            )
          )
        )

        return {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          totalOrders: customer.orders.length,
          monthsActive: uniqueMonths,
          firstOrderDate: orderDates[0].toISOString(),
          lastOrderDate: orderDates[orderDates.length - 1].toISOString(),
        }
      })
      // Sort by total orders descending
      .sort((a: ReturningCustomerData, b: ReturningCustomerData) => b.totalOrders - a.totalOrders)

    return NextResponse.json({
      customers: returningCustomers,
      total: returningCustomers.length,
    })
  } catch (error) {
    console.error('Error fetching returning customers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch returning customers' },
      { status: 500 }
    )
  }
}
