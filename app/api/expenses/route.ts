import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { startOfMonth, endOfMonth, parse } from 'date-fns'

type DeliveredOrder = Awaited<ReturnType<typeof getDeliveredOrders>>[number]
type InventoryPurchase = Awaited<ReturnType<typeof getInventoryPurchases>>[number]
type Expense = Awaited<ReturnType<typeof getExpenses>>[number]

async function getDeliveredOrders(startDate: Date, endDate: Date, additionalFilters: any = {}) {
  return await prisma.order.findMany({
    where: {
      status: 'DELIVERED',
      completedDate: {
        gte: startDate,
        lte: endDate,
      },
      ...additionalFilters,
    },
    include: {
      customer: {
        select: {
          name: true,
          email: true,
          state: true,
        },
      },
      items: {
        include: {
          clothInventory: {
            select: {
              name: true,
              type: true,
            },
          },
          garmentPattern: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      completedDate: 'desc',
    },
  })
}

async function getInventoryPurchases(startDate: Date, endDate: Date) {
  return await prisma.stockMovement.findMany({
    where: {
      type: 'PURCHASE',
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      clothInventory: {
        select: {
          name: true,
          type: true,
          pricePerMeter: true,
        },
      },
      user: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}

async function getExpenses(startDate: Date, endDate: Date, additionalFilters: any = {}) {
  return await prisma.expense.findMany({
    where: {
      active: true,
      expenseDate: {
        gte: startDate,
        lte: endDate,
      },
      ...additionalFilters,
    },
    include: {
      paidByUser: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      expenseDate: 'desc',
    },
  })
}

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    // Support both old 'month' parameter and new 'from'/'to' parameters
    const monthParam = searchParams.get('month')
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')

    // Advanced filters
    const customerName = searchParams.get('customerName')
    const supplierName = searchParams.get('supplierName')
    const category = searchParams.get('category')
    const minAmount = searchParams.get('minAmount')
    const maxAmount = searchParams.get('maxAmount')
    const paymentMode = searchParams.get('paymentMode')

    let startDate: Date
    let endDate: Date
    let label: string

    if (fromParam && toParam) {
      // Use date range if provided
      startDate = new Date(fromParam)
      endDate = new Date(toParam)
      label = `${startDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })} - ${endDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}`
    } else if (monthParam) {
      // Parse the month parameter (format: "MMM yyyy" e.g., "Jan 2026")
      const parsedDate = parse(monthParam, 'MMM yyyy', new Date())
      startDate = startOfMonth(parsedDate)
      endDate = endOfMonth(parsedDate)
      label = monthParam
    } else {
      // Default to current month
      const now = new Date()
      startDate = startOfMonth(now)
      endDate = endOfMonth(now)
      label = now.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    }

    // Build filter objects
    const orderFilters: any = {}
    if (customerName) {
      orderFilters.customer = {
        name: {
          contains: customerName,
          mode: 'insensitive',
        },
      }
    }

    const expenseFilters: any = {}
    if (category) {
      expenseFilters.category = category
    }
    if (minAmount) {
      expenseFilters.totalAmount = { ...expenseFilters.totalAmount, gte: parseFloat(minAmount) }
    }
    if (maxAmount) {
      expenseFilters.totalAmount = { ...expenseFilters.totalAmount, lte: parseFloat(maxAmount) }
    }
    if (paymentMode) {
      expenseFilters.paymentMode = paymentMode
    }

    // Get all delivered orders for the period with filters
    const deliveredOrders = await getDeliveredOrders(startDate, endDate, orderFilters)

    // Get inventory purchases for the period (stock movements of type PURCHASE)
    const inventoryPurchases = await getInventoryPurchases(startDate, endDate)

    // Get expenses for the period with filters
    const expenses = await getExpenses(startDate, endDate, expenseFilters)

    // Calculate totals
    const totalRevenue = deliveredOrders.reduce(
      (sum: number, order: DeliveredOrder) => sum + order.totalAmount,
      0
    )

    const purchaseCosts = inventoryPurchases.reduce(
      (sum: number, purchase: InventoryPurchase) => sum + (purchase.quantityMeters * (purchase.clothInventory?.pricePerMeter || 0)),
      0
    )

    const expenseCosts = expenses.reduce(
      (sum: number, expense: Expense) => sum + expense.totalAmount,
      0
    )

    const totalExpenses = purchaseCosts + expenseCosts

    const netProfit = totalRevenue - totalExpenses

    // Calculate GST totals
    const gstCollected = deliveredOrders.reduce(
      (sum: number, order: DeliveredOrder) => sum + (order.gstAmount || 0),
      0
    )

    const gstPaid = inventoryPurchases.reduce(
      (sum: number) => sum + 0, // TODO: Add GST to stock movements
      0
    ) + expenses.reduce(
      (sum: number, expense: Expense) => sum + (expense.gstAmount || 0),
      0
    )

    const netGST = gstCollected - gstPaid

    // Format the data for the UI
    const formattedOrders = deliveredOrders.map((order: DeliveredOrder) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customer.name,
      customerEmail: order.customer.email,
      totalAmount: order.totalAmount,
      advancePaid: order.advancePaid,
      balanceAmount: order.balanceAmount,
      completedDate: order.completedDate,
      gstAmount: order.gstAmount || 0,
      cgst: order.cgst || 0,
      sgst: order.sgst || 0,
      igst: order.igst || 0,
      items: order.items.map((item: DeliveredOrder['items'][number]) => ({
        garmentName: item.garmentPattern?.name || 'Unknown',
        fabricName: item.clothInventory?.name || 'Unknown',
        fabricType: item.clothInventory?.type || 'Unknown',
        metersUsed: item.actualMetersUsed || item.estimatedMeters,
        wastage: item.wastageMeters,
      })),
    }))

    const formattedPurchases = inventoryPurchases.map((purchase: InventoryPurchase) => ({
      id: purchase.id,
      fabricName: purchase.clothInventory?.name || 'Unknown',
      fabricType: purchase.clothInventory?.type || 'Unknown',
      quantity: purchase.quantityMeters,
      pricePerMeter: purchase.clothInventory?.pricePerMeter || 0,
      totalCost: purchase.quantityMeters * (purchase.clothInventory?.pricePerMeter || 0),
      purchasedBy: purchase.user?.name || 'Unknown',
      createdAt: purchase.createdAt,
      notes: purchase.notes,
    }))

    const formattedExpenses = expenses.map((expense: Expense) => ({
      id: expense.id,
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      gstAmount: expense.gstAmount,
      totalAmount: expense.totalAmount,
      expenseDate: expense.expenseDate,
      vendorName: expense.vendorName,
      paymentMode: expense.paymentMode,
      paidBy: expense.paidByUser?.name || 'Unknown',
      notes: expense.notes,
    }))

    return NextResponse.json({
      dateRange: {
        from: startDate,
        to: endDate,
        label,
      },
      summary: {
        totalRevenue,
        totalExpenses,
        netProfit,
        orderCount: deliveredOrders.length,
        purchaseCount: inventoryPurchases.length,
        expenseCount: expenses.length,
        gstCollected,
        gstPaid,
        netGST,
      },
      orders: formattedOrders,
      purchases: formattedPurchases,
      expenses: formattedExpenses,
    })
  } catch (error) {
    console.error('Error fetching expenses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch expenses data' },
      { status: 500 }
    )
  }
}
