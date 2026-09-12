/**
 * @featuretrace Customer report
 * GET /api/reports/customers?months=12  (view_customer_reports)
 *
 * Roles with financial report access (OWNER/ADMIN) get revenue figures. Other roles with the
 * permission (SALES_MANAGER) get the same shape with every amount set to null and
 * `financialsHidden: true`; `customerSegments` (revenue bands) is null for them.
 * Segment thresholds (50,000 / 20,000) are absolute amounts in the shop's currency.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { hasFinancialAccess } from '@/lib/field-acl'
import type { UserRole } from '@/lib/permissions'
import { subMonths } from 'date-fns'
import { sumMoney } from '@/lib/money'

const HIGH_VALUE_THRESHOLD = 50000
const MEDIUM_VALUE_THRESHOLD = 20000

export async function GET(request: Request) {
  const { session, error } = await requireAnyPermission(['view_customer_reports'])
  if (error) return error

  const showFinancials = hasFinancialAccess(session.user.role as UserRole, 'report_financial')

  try {
    const { searchParams } = new URL(request.url)
    const months = Math.min(120, Math.max(1, parseInt(searchParams.get('months') || '12') || 12))

    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        city: true,
        orders: {
          where: {
            status: 'DELIVERED',
            createdAt: {
              gte: subMonths(new Date(), months),
            },
          },
          select: { totalAmount: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
        measurements: { select: { id: true }, take: 1 },
      },
    })

    const customersWithStats = customers
      .map((customer) => {
        // Customer lifetime spend: what the customer was INVOICED, tax included. This is
        // deliberately a different basis from the P&L "revenue" in the financial report, which
        // excludes tax because tax is collected for the tax authority, not earned.
        const revenue = sumMoney(customer.orders.map((o) => o.totalAmount))
        return {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          city: customer.city,
          orderCount: customer.orders.length,
          totalRevenue: revenue,
          avgOrderValue: customer.orders.length > 0 ? revenue / customer.orders.length : 0,
          lastOrderDate: customer.orders.length > 0 ? customer.orders[customer.orders.length - 1].createdAt : null,
          hasMeasurements: customer.measurements.length > 0,
        }
      })
      .filter((c) => c.orderCount > 0)

    const repeatCustomers = customersWithStats.filter((c) => c.orderCount > 1).length
    const repeatRate = customersWithStats.length > 0 ? (repeatCustomers / customersWithStats.length) * 100 : 0

    const summaryCounts = {
      totalCustomers: customers.length,
      activeCustomers: customersWithStats.length,
      repeatCustomers,
      repeatRate: repeatRate.toFixed(1),
    }

    if (!showFinancials) {
      // No amounts at all: rank by number of delivered orders instead of revenue
      const topCustomers = [...customersWithStats]
        .sort((a, b) => b.orderCount - a.orderCount)
        .slice(0, 20)
        .map((c) => ({ ...c, totalRevenue: null, avgOrderValue: null }))

      return NextResponse.json({
        financialsHidden: true,
        summary: { ...summaryCounts, avgLifetimeValue: null, avgOrderValue: null },
        topCustomers,
        customerSegments: null,
      })
    }

    customersWithStats.sort((a, b) => b.totalRevenue - a.totalRevenue)

    const avgLifetimeValue =
      customersWithStats.length > 0
        ? customersWithStats.reduce((sum, c) => sum + c.totalRevenue, 0) / customersWithStats.length
        : 0
    const avgOrderValue =
      customersWithStats.length > 0
        ? customersWithStats.reduce((sum, c) => sum + c.avgOrderValue, 0) / customersWithStats.length
        : 0

    return NextResponse.json({
      financialsHidden: false,
      summary: {
        ...summaryCounts,
        avgLifetimeValue: avgLifetimeValue.toFixed(0),
        avgOrderValue: avgOrderValue.toFixed(0),
      },
      topCustomers: customersWithStats.slice(0, 20),
      customerSegments: {
        highValue: customersWithStats.filter((c) => c.totalRevenue > HIGH_VALUE_THRESHOLD).length,
        mediumValue: customersWithStats.filter(
          (c) => c.totalRevenue >= MEDIUM_VALUE_THRESHOLD && c.totalRevenue <= HIGH_VALUE_THRESHOLD
        ).length,
        lowValue: customersWithStats.filter((c) => c.totalRevenue < MEDIUM_VALUE_THRESHOLD).length,
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
