import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { filterApiResponse } from '@/lib/api-filter-response'
import { isLegacyAdvanceInstallment, roundMoney } from '@/lib/order-finance'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'
import { sumFromMinor, sumMoney, subtractMoney, addMoney } from '@/lib/money'

/**
 * FEATURETRACE: Financial report (P&L + cash position)
 *
 * Revenue is NET SALES EXCLUDING TAX, not the invoice total:
 *
 *   gross value (subTotal)      list value of the work
 *   − discounts                 price reductions granted
 *   = net sales (taxableAmount) ← "revenue"; profit is measured against this
 *   + tax charged               collected for the tax authority, never income
 *   = invoiced total            what the customer owes
 *
 * Orders are counted in the month they were SUPPLIED (completedDate, set when the order is
 * delivered), falling back to createdAt only for legacy delivered rows that never recorded one —
 * an order taken in March and delivered in May is May's revenue. This matches the dashboard,
 * which already windows delivered revenue on completedDate.
 *
 * Receipts are a separate cash-flow measure: grouped by the date money arrived and broken down
 * by payment mode. Advances carry no payment mode (they are a scalar on Order, not a payment
 * record), so they are reported under UNRECORDED rather than silently counted as cash.
 */

const MAX_MONTHS = 36

/** Delivered in this month: by supply date, or creation date for rows with no supply date. */
function suppliedIn(start: Date, end: Date) {
  return {
    status: 'DELIVERED' as const,
    OR: [
      { completedDate: { gte: start, lte: end } },
      { completedDate: null, createdAt: { gte: start, lte: end } },
    ],
  }
}

export async function GET(request: Request) {
  const { session, error } = await requireAnyPermission(['view_financial_reports'])
  if (error) return error

  const userRole = session.user.role

  try {
    const { searchParams } = new URL(request.url)
    const requested = parseInt(searchParams.get('months') || '12', 10)
    const months = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), MAX_MONTHS) : 12

    // Revenue and expenses by month (parallelized to avoid async waterfall)
    const financialData = await Promise.all(
      Array.from({ length: months }, async (_, index) => {
        const i = months - 1 - index
        const monthStart = startOfMonth(subMonths(new Date(), i))
        const monthEnd = endOfMonth(subMonths(new Date(), i))

        const [sales, expenses] = await Promise.all([
          prisma.order.aggregate({
            where: suppliedIn(monthStart, monthEnd),
            // Aggregates are NOT converted by the money extension — wrap each with sumFromMinor
            _sum: { subTotal: true, discount: true, taxableAmount: true, gstAmount: true, totalAmount: true },
          }),
          prisma.expense.aggregate({
            where: {
              expenseDate: { gte: monthStart, lte: monthEnd },
            },
            _sum: { totalAmount: true },
          }),
        ])

        const grossValue = sumFromMinor(sales._sum.subTotal)
        const discounts = sumFromMinor(sales._sum.discount)
        const taxCollected = sumFromMinor(sales._sum.gstAmount)
        const invoicedTotal = sumFromMinor(sales._sum.totalAmount)
        // taxableAmount was only filled in from v0.32 onwards; fall back to gross − discount
        const storedNet = sumFromMinor(sales._sum.taxableAmount)
        const netSales = storedNet > 0 ? storedNet : subtractMoney(grossValue, discounts)

        const expenseAmount = sumFromMinor(expenses._sum.totalAmount)
        const profit = subtractMoney(netSales, expenseAmount)

        return {
          month: format(monthStart, 'MMM yyyy'),
          grossValue,
          discounts,
          // "revenue" is net sales excluding tax: tax is a liability, not income
          revenue: netSales,
          taxCollected,
          invoicedTotal,
          expenses: expenseAmount,
          profit,
          margin: netSales > 0 ? (profit / netSales) * 100 : 0,
        }
      })
    )

    // Current month P&L
    const thisMonth = financialData[financialData.length - 1]
    const monthStart = startOfMonth(new Date())

    // Parallelize independent database queries to avoid sequential waiting
    const [outstandingPayments, inventoryValueResult, installmentsThisMonth, advancesThisMonth] = await Promise.all([
      // Outstanding payments
      prisma.order.aggregate({
        where: {
          balanceAmount: { gt: 0 },
          status: { notIn: ['CANCELLED'] },
        },
        _sum: { balanceAmount: true },
        _count: true,
      }),

      // Inventory value - compute at database level for better performance
      prisma.$queryRaw<{ totalValue: number }[]>`
        SELECT COALESCE(SUM("currentStock" * "pricePerMeter"), 0) as "totalValue"
        FROM "ClothInventory"
      `,

      // Receipts this month: every installment with money on it (PAID and PARTIAL) …
      prisma.paymentInstallment.findMany({
        where: { paidDate: { gte: monthStart }, paidAmount: { gt: 0 } },
        select: {
          installmentNumber: true,
          paidAmount: true,
          paymentMode: true,
          notes: true,
          order: { select: { advancePaid: true } },
        },
      }),

      // … plus advances taken on orders created this month (advances are never installments)
      prisma.order.aggregate({
        where: { createdAt: { gte: monthStart }, advancePaid: { gt: 0 } },
        _sum: { advancePaid: true },
      }),
    ])

    // currentStock (meters) × pricePerMeter (minor units) → minor units
    const totalInventoryValue = roundMoney(sumFromMinor(Number(inventoryValueResult[0]?.totalValue || 0)))

    // Legacy rows duplicating an advance are excluded; that advance is counted via Order.advancePaid
    const realInstallments = (installmentsThisMonth ?? []).filter(
      (installment) => !isLegacyAdvanceInstallment(installment, installment.order?.advancePaid ?? 0)
    )

    // An advance has no payment mode recorded (it is a column on Order, not a payment record),
    // so it cannot be attributed to cash, card or UPI — see docs/issues_and_payment_options.md.
    const advanceReceipts = sumFromMinor(advancesThisMonth?._sum.advancePaid)
    const receiptsByMode: Record<string, number> = advanceReceipts > 0 ? { UNRECORDED: advanceReceipts } : {}
    for (const installment of realInstallments) {
      const mode = installment.paymentMode ?? 'UNRECORDED'
      receiptsByMode[mode] = addMoney(receiptsByMode[mode] ?? 0, installment.paidAmount || 0)
    }

    const installmentReceipts = sumMoney(realInstallments.map((installment) => installment.paidAmount || 0))
    const receiptsTotal = addMoney(installmentReceipts, advanceReceipts)

    const response = {
      summary: {
        // Net sales excluding tax — the figure profit is measured against
        thisMonthRevenue: thisMonth?.revenue || 0,
        thisMonthGrossValue: thisMonth?.grossValue || 0,
        thisMonthDiscounts: thisMonth?.discounts || 0,
        thisMonthTaxCollected: thisMonth?.taxCollected || 0,
        thisMonthInvoicedTotal: thisMonth?.invoicedTotal || 0,
        thisMonthExpenses: thisMonth?.expenses || 0,
        thisMonthProfit: thisMonth?.profit || 0,
        thisMonthMargin: thisMonth?.margin || 0,
        outstandingPayments: sumFromMinor(outstandingPayments._sum.balanceAmount),
        outstandingCount: outstandingPayments._count,
        inventoryValue: totalInventoryValue,
        // Cash flow, grouped by the date money arrived — not by when the order was invoiced
        receiptsTotal,
        receiptsByMode,
        cashReceived: receiptsByMode.CASH ?? 0,
        unrecordedModeReceipts: receiptsByMode.UNRECORDED ?? 0,
      },
      financialData,
      yearToDate: {
        grossValue: sumMoney(financialData.map((m) => m.grossValue)),
        discounts: sumMoney(financialData.map((m) => m.discounts)),
        revenue: sumMoney(financialData.map((m) => m.revenue)),
        taxCollected: sumMoney(financialData.map((m) => m.taxCollected)),
        invoicedTotal: sumMoney(financialData.map((m) => m.invoicedTotal)),
        expenses: sumMoney(financialData.map((m) => m.expenses)),
        profit: sumMoney(financialData.map((m) => m.profit)),
      },
    }

    const filtered = filterApiResponse(response, userRole, 'report_financial')
    return NextResponse.json(filtered)
  } catch (error) {
    console.error('Error generating financial report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
