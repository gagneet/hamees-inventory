# PHASE 13: REPORTS & ANALYTICS - COMPREHENSIVE GUIDE

## Updated Role-Based Access Control

### Step 1: Update Permission Matrix

#### File: `lib/permissions.ts`

```typescript
import { UserRole } from '@prisma/client'

export type Permission =
  | 'view_dashboard'
  | 'view_inventory'
  | 'manage_inventory'
  | 'add_inventory'
  | 'delete_inventory'
  | 'view_orders'
  | 'create_order'
  | 'update_order'
  | 'delete_order'
  | 'update_order_status'
  | 'view_customers'
  | 'manage_customers'
  | 'delete_customers'
  | 'view_suppliers'
  | 'manage_suppliers'
  | 'view_purchase_orders'
  | 'create_purchase_orders'
  | 'delete_purchase_orders'
  | 'view_expenses'
  | 'manage_expenses'
  | 'delete_expenses'
  | 'view_reports'
  | 'view_inventory_reports'
  | 'view_sales_reports'
  | 'view_customer_reports'
  | 'view_expense_reports'
  | 'view_financial_reports'
  | 'manage_users'
  | 'manage_settings'
  | 'bulk_upload'
  | 'bulk_delete'
  | 'view_alerts'
  | 'manage_alerts'
  | 'view_measurements'
  | 'manage_measurements'
  | 'view_garment_patterns'
  | 'manage_garment_patterns'
  | 'delete_garment_patterns'

/**
 * Updated permission matrix based on new role requirements
 */
const rolePermissions: Record<UserRole, Permission[]> = {
  OWNER: [
    // Dashboard & Navigation
    'view_dashboard',
    
    // Inventory (No Delete)
    'view_inventory',
    'manage_inventory',
    'add_inventory',
    
    // Orders (No Delete)
    'view_orders',
    'create_order',
    'update_order',
    'update_order_status',
    
    // Customers (No Delete)
    'view_customers',
    'manage_customers',
    'view_measurements',
    'manage_measurements',
    
    // Suppliers (No Delete)
    'view_suppliers',
    'manage_suppliers',
    
    // Purchase Orders (No Delete)
    'view_purchase_orders',
    'create_purchase_orders',
    
    // Expenses (No Delete)
    'view_expenses',
    'manage_expenses',
    
    // Garment Patterns (No Delete)
    'view_garment_patterns',
    'manage_garment_patterns',
    
    // Reports - All Access
    'view_reports',
    'view_inventory_reports',
    'view_sales_reports',
    'view_customer_reports',
    'view_expense_reports',
    'view_financial_reports',
    
    // Alerts
    'view_alerts',
    'manage_alerts',
    
    // NO: manage_users, manage_settings, bulk_upload, bulk_delete, delete_*
  ],

  ADMIN: [
    // Full CRUD Access - Everything
    'view_dashboard',
    
    // Inventory - Full CRUD
    'view_inventory',
    'manage_inventory',
    'add_inventory',
    'delete_inventory',
    
    // Orders - Full CRUD
    'view_orders',
    'create_order',
    'update_order',
    'delete_order',
    'update_order_status',
    
    // Customers - Full CRUD
    'view_customers',
    'manage_customers',
    'delete_customers',
    'view_measurements',
    'manage_measurements',
    
    // Suppliers - Full CRUD
    'view_suppliers',
    'manage_suppliers',
    
    // Purchase Orders - Full CRUD
    'view_purchase_orders',
    'create_purchase_orders',
    'delete_purchase_orders',
    
    // Expenses - Full CRUD
    'view_expenses',
    'manage_expenses',
    'delete_expenses',
    
    // Garment Patterns - Full CRUD
    'view_garment_patterns',
    'manage_garment_patterns',
    'delete_garment_patterns',
    
    // Reports - All Access
    'view_reports',
    'view_inventory_reports',
    'view_sales_reports',
    'view_customer_reports',
    'view_expense_reports',
    'view_financial_reports',
    
    // Alerts
    'view_alerts',
    'manage_alerts',
    
    // Admin Exclusive
    'manage_users',
    'manage_settings',
    'bulk_upload',
    'bulk_delete',
  ],

  INVENTORY_MANAGER: [
    'view_dashboard',
    
    // Inventory
    'view_inventory',
    'manage_inventory',
    'add_inventory',
    
    // Suppliers
    'view_suppliers',
    'manage_suppliers',
    
    // Purchase Orders
    'view_purchase_orders',
    'create_purchase_orders',
    
    // Garment Patterns (view and create)
    'view_garment_patterns',
    'manage_garment_patterns',
    
    // Reports - Inventory Only
    'view_reports',
    'view_inventory_reports',
    
    // Alerts
    'view_alerts',
    
    // NO: orders, customers, expenses, sales_reports, customer_reports
  ],

  SALES_MANAGER: [
    'view_dashboard',
    
    // Orders
    'view_orders',
    'create_order',
    'update_order',
    'update_order_status',
    
    // Customers
    'view_customers',
    'manage_customers',
    'view_measurements',
    'manage_measurements',
    
    // Garment Patterns (view and create)
    'view_garment_patterns',
    'manage_garment_patterns',
    
    // Reports - Sales & Customer Only
    'view_reports',
    'view_sales_reports',
    'view_customer_reports',
    
    // Alerts
    'view_alerts',
    
    // NO: inventory, purchase_orders, expenses, suppliers
  ],

  TAILOR: [
    'view_dashboard',
    
    // Inventory (view only)
    'view_inventory',
    
    // Orders
    'view_orders',
    'create_order',
    'update_order_status',
    
    // Customers (measurements)
    'view_customers',
    'view_measurements',
    'manage_measurements',
    
    // Purchase Orders
    'view_purchase_orders',
    'create_purchase_orders',
    
    // Garment Patterns (view only)
    'view_garment_patterns',
    
    // Alerts
    'view_alerts',
    
    // NO: expenses, delete anything, manage inventory/suppliers
  ],

  VIEWER: [
    'view_dashboard',
    'view_inventory',
    'view_orders',
    'view_customers',
    'view_alerts',
    
    // NO: create, update, delete anything
  ],
}

// ... rest of the existing permission functions ...
```

---

### Step 2: Create Expense Management System

#### Update: `prisma/schema.prisma`

Add Expense model:

```prisma
enum ExpenseCategory {
  RENT
  UTILITIES
  SALARIES
  MATERIALS
  MARKETING
  MAINTENANCE
  TRANSPORTATION
  MISCELLANEOUS
}

model Expense {
  id              String          @id @default(cuid())
  category        ExpenseCategory
  title           String
  description     String?
  amount          Float
  date            DateTime        @default(now())
  paymentMethod   String          // CASH, UPI, CARD, BANK_TRANSFER
  receiptNumber   String?
  vendorName      String?
  notes           String?
  attachments     Json?           // Array of file URLs
  createdBy       String
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  // Relations
  user            User            @relation(fields: [createdBy], references: [id])

  @@index([category])
  @@index([date])
  @@index([createdBy])
}

// Update User model
model User {
  // ... existing fields ...
  expenses        Expense[]
}
```

Run migration:
```bash
pnpm db:push
```

---

### Step 3: Create Role-Specific Dashboard Components

#### File: `components/dashboard/owner-dashboard.tsx`

```typescript
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  TrendingUp,
  Package,
  ShoppingBag,
  Users,
  IndianRupee,
  AlertCircle,
  FileText,
} from 'lucide-react'
import { RevenueChart } from './revenue-chart'
import { OrdersStatusChart } from './orders-status-chart'
import { TopFabricsChart } from './top-fabrics-chart'
import { KPICard } from './kpi-card'

interface OwnerDashboardProps {
  stats: any
}

export function OwnerDashboard({ stats }: OwnerDashboardProps) {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Revenue (Month)"
          value={`₹${stats.revenue.thisMonth.toLocaleString('en-IN')}`}
          change={stats.revenue.growth}
          icon={IndianRupee}
          iconColor="text-green-600"
          trend={stats.revenue.growth >= 0 ? 'up' : 'down'}
        />
        <KPICard
          title="Orders This Month"
          value={stats.orders.thisMonth}
          change={stats.orders.growth}
          icon={ShoppingBag}
          iconColor="text-blue-600"
          trend={stats.orders.growth >= 0 ? 'up' : 'down'}
        />
        <KPICard
          title="Pending Orders"
          value={stats.orders.pending}
          icon={Package}
          iconColor="text-orange-600"
        />
        <KPICard
          title="Low Stock Items"
          value={stats.inventory.lowStock}
          icon={AlertCircle}
          iconColor={stats.inventory.lowStock > 0 ? 'text-red-600' : 'text-green-600'}
        />
      </div>

      {/* Financial Summary */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              ₹{stats.revenue.thisMonth.toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              {stats.revenue.growth >= 0 ? '+' : ''}
              {stats.revenue.growth.toFixed(1)}% vs last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Monthly Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              ₹{(stats.expenses?.thisMonth || 0).toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              {stats.expenses?.count || 0} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              ₹{((stats.revenue.thisMonth || 0) - (stats.expenses?.thisMonth || 0)).toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Margin: {(((stats.revenue.thisMonth || 0) - (stats.expenses?.thisMonth || 0)) / (stats.revenue.thisMonth || 1) * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend (6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={stats.revenue.byMonth} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.charts.ordersByStatus.length > 0 ? (
              <OrdersStatusChart data={stats.charts.ordersByStatus} />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-500">
                No orders yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Fabrics */}
      {stats.charts.topFabrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Most Used Fabrics</CardTitle>
          </CardHeader>
          <CardContent>
            <TopFabricsChart data={stats.charts.topFabrics} />
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Access Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Link href="/reports/inventory">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Inventory Report
              </Button>
            </Link>
            <Link href="/reports/sales">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Sales Report
              </Button>
            </Link>
            <Link href="/reports/expenses">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Expense Report
              </Button>
            </Link>
            <Link href="/reports/financial">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Financial Summary
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

#### File: `components/dashboard/inventory-manager-dashboard.tsx`

```typescript
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Package, AlertCircle, TrendingUp, FileText } from 'lucide-react'
import { KPICard } from './kpi-card'

interface InventoryManagerDashboardProps {
  stats: any
}

export function InventoryManagerDashboard({ stats }: InventoryManagerDashboardProps) {
  return (
    <div className="space-y-6">
      {/* KPI Cards - Inventory Focused */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Items"
          value={stats.inventory.totalItems}
          icon={Package}
          iconColor="text-blue-600"
        />
        <KPICard
          title="Total Value"
          value={`₹${stats.inventory.totalValue.toLocaleString('en-IN')}`}
          icon={TrendingUp}
          iconColor="text-green-600"
        />
        <KPICard
          title="Low Stock Items"
          value={stats.inventory.lowStock}
          icon={AlertCircle}
          iconColor="text-orange-600"
        />
        <KPICard
          title="Critical Stock"
          value={stats.inventory.criticalStock}
          icon={AlertCircle}
          iconColor="text-red-600"
        />
      </div>

      {/* Inventory Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium text-slate-600">Total Meters</p>
              <p className="text-2xl font-bold text-slate-900">
                {stats.inventory.totalMeters.toFixed(1)}m
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm font-medium text-slate-600">Turnover Rate</p>
              <p className="text-2xl font-bold text-slate-900">
                {(stats.inventory.turnoverRate || 0).toFixed(2)}×
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Low Stock Alerts */}
      {stats.inventory.lowStock > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-error">⚠️ Items Needing Reorder</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.lowStockItems?.slice(0, 5).map((item: any) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center p-3 border border-orange-200 bg-orange-50 rounded-lg"
                >
                  <span className="font-medium">{item.name}</span>
                  <span className="text-sm text-orange-700">
                    {item.available}m / {item.minimum}m min
                  </span>
                </div>
              ))}
            </div>
            <Link href="/inventory?filter=lowStock" className="block mt-4">
              <Button variant="outline" className="w-full">
                View All Low Stock Items
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <Link href="/inventory">
              <Button className="w-full justify-start">
                <Package className="h-4 w-4 mr-2" />
                Manage Inventory
              </Button>
            </Link>
            <Link href="/purchase-orders/new">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Create Purchase Order
              </Button>
            </Link>
            <Link href="/reports/inventory">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Inventory Report
              </Button>
            </Link>
            <Link href="/suppliers">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Manage Suppliers
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

#### File: `components/dashboard/sales-manager-dashboard.tsx`

```typescript
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ShoppingBag, Users, TrendingUp, FileText } from 'lucide-react'
import { KPICard } from './kpi-card'
import { RevenueChart } from './revenue-chart'

interface SalesManagerDashboardProps {
  stats: any
}

export function SalesManagerDashboard({ stats }: SalesManagerDashboardProps) {
  return (
    <div className="space-y-6">
      {/* KPI Cards - Sales Focused */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Orders This Month"
          value={stats.orders.thisMonth}
          change={stats.orders.growth}
          icon={ShoppingBag}
          iconColor="text-blue-600"
          trend={stats.orders.growth >= 0 ? 'up' : 'down'}
        />
        <KPICard
          title="Revenue This Month"
          value={`₹${stats.revenue.thisMonth.toLocaleString('en-IN')}`}
          change={stats.revenue.growth}
          icon={TrendingUp}
          iconColor="text-green-600"
          trend={stats.revenue.growth >= 0 ? 'up' : 'down'}
        />
        <KPICard
          title="Total Customers"
          value={stats.customers?.total || 0}
          icon={Users}
          iconColor="text-purple-600"
        />
        <KPICard
          title="Pending Orders"
          value={stats.orders.pending}
          icon={ShoppingBag}
          iconColor="text-orange-600"
        />
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Trend (6 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueChart data={stats.revenue.byMonth} />
        </CardContent>
      </Card>

      {/* Top Customers */}
      <Card>
        <CardHeader>
          <CardTitle>Top Customers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.topCustomers?.slice(0, 5).map((customer: any) => (
              <div
                key={customer.id}
                className="flex justify-between items-center p-3 border border-slate-200 rounded-lg"
              >
                <div>
                  <p className="font-semibold">{customer.name}</p>
                  <p className="text-sm text-slate-600">{customer.orderCount} orders</p>
                </div>
                <p className="text-sm font-medium text-green-600">
                  ₹{customer.totalRevenue.toLocaleString('en-IN')}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <Link href="/orders/new">
              <Button className="w-full justify-start">
                <ShoppingBag className="h-4 w-4 mr-2" />
                Create Order
              </Button>
            </Link>
            <Link href="/customers/new">
              <Button variant="outline" className="w-full justify-start">
                <Users className="h-4 w-4 mr-2" />
                Add Customer
              </Button>
            </Link>
            <Link href="/reports/sales">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Sales Report
              </Button>
            </Link>
            <Link href="/reports/customers">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Customer Report
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

---

### Step 4: Update Main Dashboard with Role-Based Views

#### Update: `app/(dashboard)/dashboard/page.tsx`

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Scissors } from 'lucide-react'
import { SignOutButton } from '@/components/dashboard/sign-out-button'
import { OwnerDashboard } from '@/components/dashboard/owner-dashboard'
import { InventoryManagerDashboard } from '@/components/dashboard/inventory-manager-dashboard'
import { SalesManagerDashboard } from '@/components/dashboard/sales-manager-dashboard'
import { UserRole } from '@prisma/client'

async function getDashboardStats(role: UserRole) {
  try {
    const res = await fetch(`${process.env.NEXTAUTH_URL}/api/dashboard/stats?role=${role}`, {
      cache: 'no-store',
    })

    if (!res.ok) {
      console.error('Failed to fetch dashboard stats')
      return null
    }

    return await res.json()
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return null
  }
}

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/')
  }

  const stats = await getDashboardStats(session.user.role as UserRole)
  const userRole = session.user.role as UserRole

  // Role-based dashboard title
  const dashboardTitles: Record<UserRole, string> = {
    OWNER: 'Business Overview',
    ADMIN: 'Administrative Dashboard',
    INVENTORY_MANAGER: 'Inventory Dashboard',
    SALES_MANAGER: 'Sales Dashboard',
    TAILOR: 'Work Dashboard',
    VIEWER: 'Overview',
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Scissors className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Hamees Inventory</h1>
                <p className="text-sm text-slate-600">Tailor Shop Management System</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900">{session.user.name}</p>
                <p className="text-xs text-slate-500">{session.user.role}</p>
              </div>
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">
            {dashboardTitles[userRole]}
          </h2>
          <p className="text-slate-600">Welcome back, {session.user.name}!</p>
        </div>

        {/* Role-Based Dashboard */}
        {stats && (
          <>
            {userRole === 'OWNER' && <OwnerDashboard stats={stats} />}
            {userRole === 'ADMIN' && <OwnerDashboard stats={stats} />}
            {userRole === 'INVENTORY_MANAGER' && (
              <InventoryManagerDashboard stats={stats} />
            )}
            {userRole === 'SALES_MANAGER' && <SalesManagerDashboard stats={stats} />}
            {(userRole === 'TAILOR' || userRole === 'VIEWER') && (
              <OwnerDashboard stats={stats} />
            )}
          </>
        )}
      </main>
    </div>
  )
}
```

---

### Step 5: Create Comprehensive Reports API

#### File: `app/api/reports/expenses/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'

export async function GET(request: Request) {
  const { error } = await requireAnyPermission(['view_expense_reports'])
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const months = parseInt(searchParams.get('months') || '6')

    // Expenses by month
    const expensesByMonth = []
    for (let i = months - 1; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(new Date(), i))
      const monthEnd = endOfMonth(subMonths(new Date(), i))

      const expenses = await prisma.expense.aggregate({
        where: {
          date: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
        _count: true,
      })

      expensesByMonth.push({
        month: format(monthStart, 'MMM yyyy'),
        amount: expenses._sum.amount || 0,
        count: expenses._count,
      })
    }

    // Expenses by category
    const expensesByCategory = await prisma.expense.groupBy({
      by: ['category'],
      where: {
        date: {
          gte: subMonths(new Date(), months),
        },
      },
      _sum: { amount: true },
      _count: true,
    })

    const categoryData = expensesByCategory.map((item) => ({
      category: item.category,
      amount: item._sum.amount || 0,
      count: item._count,
    }))

    // Total expenses
    const totalExpenses = categoryData.reduce((sum, cat) => sum + cat.amount, 0)

    // This month vs last month
    const thisMonthExpenses = await prisma.expense.aggregate({
      where: {
        date: {
          gte: startOfMonth(new Date()),
        },
      },
      _sum: { amount: true },
    })

    const lastMonthExpenses = await prisma.expense.aggregate({
      where: {
        date: {
          gte: startOfMonth(subMonths(new Date(), 1)),
          lte: endOfMonth(subMonths(new Date(), 1)),
        },
      },
      _sum: { amount: true },
    })

    const growth =
      (lastMonthExpenses._sum.amount || 0) > 0
        ? (((thisMonthExpenses._sum.amount || 0) -
            (lastMonthExpenses._sum.amount || 0)) /
            (lastMonthExpenses._sum.amount || 1)) *
          100
        : 0

    // Top expenses
    const topExpenses = await prisma.expense.findMany({
      where: {
        date: {
          gte: subMonths(new Date(), months),
        },
      },
      orderBy: { amount: 'desc' },
      take: 10,
      include: {
        user: {
          select: { name: true },
        },
      },
    })

    return NextResponse.json({
      summary: {
        totalExpenses,
        thisMonth: thisMonthExpenses._sum.amount || 0,
        lastMonth: lastMonthExpenses._sum.amount || 0,
        growth: growth.toFixed(1),
        transactionCount: expensesByMonth.reduce((sum, m) => sum + m.count, 0),
      },
      expensesByMonth,
      expensesByCategory: categoryData,
      topExpenses,
    })
  } catch (error) {
    console.error('Error generating expense report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
```

#### File: `app/api/reports/financial/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'

export async function GET(request: Request) {
  const { error } = await requireAnyPermission(['view_financial_reports'])
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const months = parseInt(searchParams.get('months') || '12')

    // Revenue and expenses by month
    const financialData = []
    for (let i = months - 1; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(new Date(), i))
      const monthEnd = endOfMonth(subMonths(new Date(), i))

      const [revenue, expenses] = await Promise.all([
        prisma.order.aggregate({
          where: {
            createdAt: { gte: monthStart, lte: monthEnd },
            status: 'DELIVERED',
          },
          _sum: { totalAmount: true },
        }),
        prisma.expense.aggregate({
          where: {
            date: { gte: monthStart, lte: monthEnd },
          },
          _sum: { amount: true },
        }),
      ])

      const revenueAmount = revenue._sum.totalAmount || 0
      const expenseAmount = expenses._sum.amount || 0
      const profit = revenueAmount - expenseAmount

      financialData.push({
        month: format(monthStart, 'MMM yyyy'),
        revenue: revenueAmount,
        expenses: expenseAmount,
        profit,
        margin: revenueAmount > 0 ? (profit / revenueAmount) * 100 : 0,
      })
    }

    // Current month P&L
    const thisMonth = financialData[financialData.length - 1]

    // Outstanding payments
    const outstandingPayments = await prisma.order.aggregate({
      where: {
        balanceAmount: { gt: 0 },
        status: { notIn: ['CANCELLED'] },
      },
      _sum: { balanceAmount: true },
      _count: true,
    })

    // Inventory value
    const inventoryValue = await prisma.clothInventory.findMany({
      select: {
        currentStock: true,
        pricePerMeter: true,
      },
    })

    const totalInventoryValue = inventoryValue.reduce(
      (sum, item) => sum + item.currentStock * item.pricePerMeter,
      0
    )

    // Cash flow (payments received)
    const paymentsReceived = await prisma.payment.aggregate({
      where: {
        paidAt: {
          gte: startOfMonth(new Date()),
        },
        paymentStatus: 'COMPLETED',
      },
      _sum: { amount: true },
    })

    return NextResponse.json({
      summary: {
        thisMonthRevenue: thisMonth?.revenue || 0,
        thisMonthExpenses: thisMonth?.expenses || 0,
        thisMonthProfit: thisMonth?.profit || 0,
        thisMonthMargin: thisMonth?.margin || 0,
        outstandingPayments: outstandingPayments._sum.balanceAmount || 0,
        outstandingCount: outstandingPayments._count,
        inventoryValue: totalInventoryValue,
        cashReceived: paymentsReceived._sum.amount || 0,
      },
      financialData,
      yearToDate: {
        revenue: financialData.reduce((sum, m) => sum + m.revenue, 0),
        expenses: financialData.reduce((sum, m) => sum + m.expenses, 0),
        profit: financialData.reduce((sum, m) => sum + m.profit, 0),
      },
    })
  } catch (error) {
    console.error('Error generating financial report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
```

#### File: `app/api/reports/customers/route.ts`

```typescript
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

    // Customer acquisition by month
    const customersByMonth = await prisma.customer.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: {
          gte: subMonths(new Date(), months),
        },
      },
      _count: true,
    })

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
```

---

### Step 6: Create Report Pages

#### File: `app/(dashboard)/reports/expenses/page.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, Printer } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

const CATEGORY_COLORS: Record<string, string> = {
  RENT: '#3B82F6',
  UTILITIES: '#10B981',
  SALARIES: '#F59E0B',
  MATERIALS: '#8B5CF6',
  MARKETING: '#EC4899',
  MAINTENANCE: '#06B6D4',
  TRANSPORTATION: '#EF4444',
  MISCELLANEOUS: '#6B7280',
}

export default function ExpenseReportPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState(6)

  useEffect(() => {
    fetchReport()
  }, [timeRange])

  const fetchReport = async () => {
    setLoading(true)
    const response = await fetch(`/api/reports/expenses?months=${timeRange}`)
    const data = await response.json()
    setData(data)
    setLoading(false)
  }

  if (loading || !data) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 print:hidden">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Expense Report</h1>
              <p className="text-sm text-slate-600">
                Last {timeRange} months • Generated {new Date().toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(parseInt(e.target.value))}
                className="px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value={3}>3 Months</option>
                <option value={6}>6 Months</option>
                <option value={12}>12 Months</option>
              </select>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                ₹{data.summary.totalExpenses.toLocaleString('en-IN')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                ₹{data.summary.thisMonth.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-slate-600">
                {data.summary.growth >= 0 ? '+' : ''}
                {data.summary.growth}% vs last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data.summary.transactionCount}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Avg/Month</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                ₹
                {(
                  data.summary.totalExpenses / data.expensesByMonth.length
                ).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 md:grid-cols-2 mb-6">
          {/* Monthly Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Expense Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.expensesByMonth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="amount" fill="#EF4444" name="Expenses (₹)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Expenses by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.expensesByCategory}
                      dataKey="amount"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {data.expensesByCategory.map((entry: any, index: number) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CATEGORY_COLORS[entry.category] || '#6B7280'}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Category Table */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Category</th>
                  <th className="text-right p-2">Transactions</th>
                  <th className="text-right p-2">Total Amount</th>
                  <th className="text-right p-2">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {data.expensesByCategory.map((cat: any) => (
                  <tr key={cat.category} className="border-b">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: CATEGORY_COLORS[cat.category] }}
                        />
                        {cat.category}
                      </div>
                    </td>
                    <td className="text-right p-2">{cat.count}</td>
                    <td className="text-right p-2">
                      ₹{cat.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="text-right p-2">
                      {((cat.amount / data.summary.totalExpenses) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Top Expenses */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topExpenses.map((expense: any) => (
                <div
                  key={expense.id}
                  className="flex justify-between items-center p-3 border border-slate-200 rounded-lg"
                >
                  <div>
                    <p className="font-semibold">{expense.title}</p>
                    <p className="text-sm text-slate-600">
                      {expense.category} • {expense.user.name} •{' '}
                      {new Date(expense.date).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-red-600">
                    ₹{expense.amount.toLocaleString('en-IN')}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
```

#### File: `app/(dashboard)/reports/financial/page.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, Printer, TrendingUp, TrendingDown } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

export default function FinancialReportPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState(12)

  useEffect(() => {
    fetchReport()
  }, [timeRange])

  const fetchReport = async () => {
    setLoading(true)
    const response = await fetch(`/api/reports/financial?months=${timeRange}`)
    const data = await response.json()
    setData(data)
    setLoading(false)
  }

  if (loading || !data) {
    return <div className="p-8">Loading...</div>
  }

  const isProfitable = data.summary.thisMonthProfit >= 0

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 print:hidden">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Financial Summary</h1>
              <p className="text-sm text-slate-600">
                Profit & Loss Statement • Last {timeRange} months
              </p>
            </div>
            <div className="flex gap-2">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(parseInt(e.target.value))}
                className="px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value={6}>6 Months</option>
                <option value={12}>12 Months</option>
                <option value={24}>24 Months</option>
              </select>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Current Month P&L */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>This Month - Profit & Loss</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm font-medium text-green-800">Revenue</p>
                <p className="text-2xl font-bold text-green-900">
                  ₹{data.summary.thisMonthRevenue.toLocaleString('en-IN')}
                </p>
              </div>

              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm font-medium text-red-800">Expenses</p>
                <p className="text-2xl font-bold text-red-900">
                  ₹{data.summary.thisMonthExpenses.toLocaleString('en-IN')}
                </p>
              </div>

              <div
                className={`p-4 rounded-lg border ${
                  isProfitable
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-orange-50 border-orange-200'
                }`}
              >
                <p
                  className={`text-sm font-medium ${
                    isProfitable ? 'text-blue-800' : 'text-orange-800'
                  }`}
                >
                  Net Profit
                </p>
                <div className="flex items-center gap-2">
                  <p
                    className={`text-2xl font-bold ${
                      isProfitable ? 'text-blue-900' : 'text-orange-900'
                    }`}
                  >
                    ₹{Math.abs(data.summary.thisMonthProfit).toLocaleString('en-IN')}
                  </p>
                  {isProfitable ? (
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-orange-600" />
                  )}
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-sm font-medium text-slate-600">Profit Margin</p>
                <p className="text-2xl font-bold text-slate-900">
                  {data.summary.thisMonthMargin.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Year to Date Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Year to Date Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-slate-600">Total Revenue</p>
                <p className="text-xl font-bold text-green-600">
                  ₹{data.yearToDate.revenue.toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Total Expenses</p>
                <p className="text-xl font-bold text-red-600">
                  ₹{data.yearToDate.expenses.toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Net Profit</p>
                <p
                  className={`text-xl font-bold ${
                    data.yearToDate.profit >= 0 ? 'text-blue-600' : 'text-orange-600'
                  }`}
                >
                  ₹{data.yearToDate.profit.toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trend Chart */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Financial Trend Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.financialData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10B981"
                    strokeWidth={2}
                    name="Revenue (₹)"
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    stroke="#EF4444"
                    strokeWidth={2}
                    name="Expenses (₹)"
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    name="Profit (₹)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Additional Metrics */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Cash Position</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="text-sm font-medium">Cash Received (Month)</span>
                <span className="text-lg font-bold text-green-600">
                  ₹{data.summary.cashReceived.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                <span className="text-sm font-medium">
                  Outstanding Payments ({data.summary.outstandingCount})
                </span>
                <span className="text-lg font-bold text-orange-600">
                  ₹{data.summary.outstandingPayments.toLocaleString('en-IN')}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="text-sm font-medium">Inventory Value</span>
                <span className="text-lg font-bold text-blue-600">
                  ₹{data.summary.inventoryValue.toLocaleString('en-IN')}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
```

---

### Step 7: Create Admin Settings Page

#### File: `app/(dashboard)/settings/admin/page.tsx`

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { hasPermission } from '@/lib/permissions'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Settings, Users, Shield } from 'lucide-react'

async function getUsers() {
  return await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
  })
}

async function getSettings() {
  return await prisma.settings.findMany({
    orderBy: { key: 'asc' },
  })
}

export default async function AdminSettingsPage() {
  const session = await auth()

  if (!session?.user) redirect('/')

  const userRole = session.user.role as UserRole

  // Only ADMIN can access this page
  if (!hasPermission(userRole, 'manage_users')) {
    redirect('/dashboard')
  }

  const [users, settings] = await Promise.all([getUsers(), getSettings()])

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Admin Settings</h1>
              <p className="text-sm text-slate-600">
                User management and system configuration
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid gap-6">
          {/* User Management */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <CardTitle>User Management</CardTitle>
              </div>
              <CardDescription>Manage user access and roles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">Name</th>
                      <th className="text-left p-3">Email</th>
                      <th className="text-left p-3">Role</th>
                      <th className="text-left p-3">Phone</th>
                      <th className="text-center p-3">Status</th>
                      <th className="text-center p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b">
                        <td className="p-3 font-medium">{user.name}</td>
                        <td className="p-3">{user.email}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              user.role === 'OWNER'
                                ? 'bg-purple-100 text-purple-700'
                                : user.role === 'ADMIN'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="p-3">{user.phone || '-'}</td>
                        <td className="text-center p-3">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              user.active
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {user.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="text-center p-3">
                          <div className="flex justify-center gap-2">
                            <button className="text-blue-600 hover:underline text-xs">
                              Edit
                            </button>
                            {user.email !== session.user.email && (
                              <button className="text-red-600 hover:underline text-xs">
                                {user.active ? 'Deactivate' : 'Activate'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Role Permissions */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <CardTitle>Role Permissions</CardTitle>
              </div>
              <CardDescription>View and configure role-based access</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries({
                  OWNER: 'Full access except delete operations and settings',
                  ADMIN: 'Full CRUD access, user management, bulk operations',
                  INVENTORY_MANAGER: 'Inventory, suppliers, purchase orders, garments',
                  SALES_MANAGER: 'Orders, customers, garments (no inventory/expenses)',
                  TAILOR: 'Create orders/POs, update measurements, view inventory',
                  VIEWER: 'Read-only access to dashboard, inventory, customers, orders',
                }).map(([role, description]) => (
                  <div
                    key={role}
                    className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">{role}</p>
                        <p className="text-sm text-slate-600 mt-1">{description}</p>
                      </div>
                      <button className="text-blue-600 hover:underline text-sm">
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* System Settings */}
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>Application configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {settings.map((setting) => (
                  <div
                    key={setting.id}
                    className="flex justify-between items-center p-3 border border-slate-200 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{setting.key}</p>
                      <p className="text-sm text-slate-600">{setting.description}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono bg-slate-100 px-3 py-1 rounded">
                        {setting.value}
                      </span>
                      <button className="text-blue-600 hover:underline text-sm">
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
```

---

This is a comprehensive expansion of Phase 13 with:

1. ✅ Updated permissions for all 6 roles
2. ✅ Role-specific dashboards
3. ✅ Expense management system
4. ✅ Financial reports (P&L statement)
5. ✅ Customer analytics
6. ✅ Admin settings page (ADMIN only)
7. ✅ Detailed permission matrix

**Continue with implementation?** Let me know if you need clarification on any part! 🚀
