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

    // Get all customers with their DELIVERED orders only
    const customers = await prisma.customer.findMany({
      include: {
        orders: {
          where: {
            status: 'DELIVERED', // Only count delivered orders
          },
          select: {
            id: true,
            orderDate: true,
            completedDate: true,
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

    // Filter customers with 3+ DELIVERED orders across different months with 2+ orders at least 2 weeks apart
    const returningCustomers: ReturningCustomerData[] = customers
      .filter((customer: CustomerWithOrders) => {
        // Must have at least 3 delivered orders
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
        if (uniqueMonths.size < 2) {
          return false
        }

        // Check if at least 2 orders are at least 2 weeks (14 days) apart
        const orderDates = customer.orders.map((o: OrderData) => new Date(o.orderDate).getTime())
        let hasTwoWeeksApart = false

        for (let i = 0; i < orderDates.length - 1; i++) {
          for (let j = i + 1; j < orderDates.length; j++) {
            const daysDiff = Math.abs(orderDates[j] - orderDates[i]) / (1000 * 60 * 60 * 24)
            if (daysDiff >= 14) {
              hasTwoWeeksApart = true
              break
            }
          }
          if (hasTwoWeeksApart) break
        }

        return hasTwoWeeksApart
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
