# FeatureTrace — Hamees Attire Codebase Map

> **Purpose:** This document is a living map of every feature in the codebase — showing how UI pages, React components, API routes, lib utilities, and database models interconnect. Use it to understand the full call chain for any feature before modifying it.
>
> **Inspired by:** [CodeSee.io](https://codesee.io) concept — code should be self-documenting about its own relationships.
>
> Format: `Page → Component → API Route → lib function → Prisma model`

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Authentication & Sessions](#2-authentication--sessions)
3. [RBAC — Role-Based Access Control](#3-rbac--role-based-access-control)
4. [Database Models & Relationships](#4-database-models--relationships)
5. [Feature: Dashboard](#5-feature-dashboard)
6. [Feature: Order Lifecycle](#6-feature-order-lifecycle)
7. [Feature: Customer Management](#7-feature-customer-management)
8. [Feature: Measurements](#8-feature-measurements)
9. [Feature: Inventory — Cloth](#9-feature-inventory--cloth)
10. [Feature: Inventory — Accessories](#10-feature-inventory--accessories)
11. [Feature: Stock Movements](#11-feature-stock-movements)
12. [Feature: Purchase Orders](#12-feature-purchase-orders)
13. [Feature: Expenses](#13-feature-expenses)
14. [Feature: Alerts System](#14-feature-alerts-system)
15. [Feature: Reports & Analytics](#15-feature-reports--analytics)
16. [Feature: WhatsApp Integration](#16-feature-whatsapp-integration)
17. [Feature: Bulk Upload](#17-feature-bulk-upload)
18. [Feature: Garment Types (Patterns)](#18-feature-garment-types-patterns)
19. [Feature: Suppliers](#19-feature-suppliers)
20. [Feature: Admin — Users & Settings](#20-feature-admin--users--settings)
21. [Feature: Excel VBA Integration](#21-feature-excel-vba-integration)
22. [Shared Libraries Reference](#22-shared-libraries-reference)
23. [API Route Directory](#23-api-route-directory)
24. [Component Dependency Graph](#24-component-dependency-graph)
25. [Data Flow: New Order (Full Trace)](#25-data-flow-new-order-full-trace)
26. [Data Flow: Stock Reservation & Release](#26-data-flow-stock-reservation--release)

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    NEXT.JS 16 (APP ROUTER)                       │
│                                                                   │
│  ┌─────────────┐    ┌──────────────────┐    ┌────────────────┐  │
│  │  /app/page  │    │ /app/(dashboard) │    │  /app/api      │  │
│  │  (login)    │    │  (all UI pages)  │    │  (REST API)    │  │
│  └──────┬──────┘    └────────┬─────────┘    └───────┬────────┘  │
│         │                    │                       │            │
│         ▼                    ▼                       ▼            │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              SHARED LIB LAYER (/lib)                         │ │
│  │  auth.ts  permissions.ts  api-permissions.ts  db.ts  utils  │ │
│  └──────────────────────────┬────────────────────────────────┘  │
│                              │                                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              PRISMA 7 ORM (prisma/schema.prisma)             │ │
│  └──────────────────────────┬────────────────────────────────┘  │
│                              │                                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              POSTGRESQL 16 (local, tailor_inventory DB)       │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Key Middleware:** `middleware.ts` guards the `/(dashboard)` route group — all pages under it require authentication. Unauthenticated requests redirect to `/` (login page).

**Auth Provider:** NextAuth v5 with JWT strategy. Session includes `user.role` (UserRole enum) which is the single source of truth for permissions everywhere in the application.

---

## 2. Authentication & Sessions

### Files Involved

| File | Role |
|------|------|
| `lib/auth.ts` | NextAuth v5 config — JWT callbacks, session shape, credential provider |
| `middleware.ts` | Route protection — redirects unauthenticated users |
| `app/api/auth/[...nextauth]/route.ts` | NextAuth route handler (GET + POST) |
| `app/page.tsx` | Login page (public, renders `LoginForm`) |
| `components/login-form.tsx` | Login form — calls `signIn('credentials', ...)` |
| `components/dashboard/sign-out-button.tsx` | Sign out button — calls `signOut()` |
| `components/providers/session-provider.tsx` | Wraps app in `<SessionProvider>` |

### Call Chain: Login

```
app/page.tsx
  └── components/login-form.tsx
        └── next-auth/react: signIn('credentials', { email, password })
              └── app/api/auth/[...nextauth]/route.ts
                    └── lib/auth.ts → authorize()
                          └── prisma.user.findUnique({ where: { email } })
                                └── DB: User table — bcrypt.compare(password, user.password)
                          └── Returns: { id, email, name, role } → stored in JWT token
```

### Session Shape

```typescript
// Available via useSession() (client) or auth() (server)
session.user = {
  id: string,        // User.id from DB
  name: string,      // User.name
  email: string,     // User.email
  role: UserRole,    // 'OWNER' | 'ADMIN' | 'INVENTORY_MANAGER' | 'SALES_MANAGER' | 'TAILOR' | 'VIEWER'
}
```

### Usage Pattern

```typescript
// Server Component / API Route
import { auth } from '@/lib/auth'
const session = await auth()
// Note: auth() is wrapped in React.cache() for request deduplication

// Client Component
import { useSession } from 'next-auth/react'
const { data: session, status } = useSession()
// Always check status === 'loading' before accessing session.user.role
// (race condition: role is undefined before session loads)
```

---

## 3. RBAC — Role-Based Access Control

### Files Involved

| File | Role |
|------|------|
| `lib/permissions.ts` | Permission matrix + helper functions |
| `lib/api-permissions.ts` | API route auth guards |
| `components/auth/permission-guard.tsx` | UI permission guard component |

### Permission System

```
lib/permissions.ts defines:
  ├── Permission (union type) — 39+ permission strings
  ├── rolePermissions — Record<UserRole, Permission[]> — the permission matrix
  ├── hasPermission(role, permission) → boolean   ← used everywhere
  ├── hasAnyPermission(role, permissions[]) → boolean
  ├── hasAllPermissions(role, permissions[]) → boolean
  └── getRolePermissions(role) → Permission[]
```

### API Guard Pattern

```typescript
// Every API route uses one of these three guards:
import { requirePermission, requireAnyPermission, requireAuth } from '@/lib/api-permissions'

// Pattern:
export async function GET(req: Request) {
  const { session, error } = await requirePermission('view_orders')
  if (error) return error  // Returns 401 or 403 NextResponse
  // session.user.role is now guaranteed valid
}
```

### UI Guard Pattern

```typescript
// In page components:
import { PermissionGuard } from '@/components/auth/permission-guard'

<PermissionGuard permission="create_order">
  <Link href="/orders/new"><Button>New Order</Button></Link>
</PermissionGuard>
// Renders nothing if user lacks the permission

// In nav:
import { hasPermission } from '@/lib/permissions'
const navItems = allNavItems.filter(item =>
  userRole && hasPermission(userRole, item.permission)
)
```

### Role → Permission Map Summary

| Permission | OWNER | ADMIN | INV_MGR | SALES_MGR | TAILOR | VIEWER |
|-----------|-------|-------|---------|-----------|--------|--------|
| view_dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| manage_inventory | ✓ | ✓ | ✓ | - | - | - |
| create_order | ✓ | ✓ | - | ✓ | ✓ | - |
| delete_order | - | ✓ | - | - | - | - |
| update_order_status | ✓ | ✓ | - | ✓ | ✓ | - |
| manage_customers | ✓ | ✓ | - | ✓ | - | - |
| manage_measurements | ✓ | ✓ | - | ✓ | ✓ | - |
| view_expenses | ✓ | ✓ | - | - | - | - |
| manage_users | - | ✓ | - | - | - | - |
| manage_settings | - | ✓ | - | - | - | - |
| bulk_upload | - | ✓ | - | - | - | - |

---

## 4. Database Models & Relationships

### Entity Relationship Diagram

```
User ──────────────────┐
 │                     │ createdBy
 │ created             ▼
 ├──── Order ◄──── Customer ◄──── Measurement
 │      │               │              │
 │      │               └── WhatsAppMessage
 │      │
 │      ├──── OrderItem ──► GarmentPattern ──► GarmentAccessory ──► AccessoryInventory
 │      │         │
 │      │         └──► ClothInventory
 │      │         └──► Measurement (per-item copy)
 │      │         └──── DesignUpload
 │      │         └──── User (assignedTailor)
 │      │
 │      ├──── OrderHistory
 │      ├──── PaymentInstallment
 │      ├──── StockMovement ──► ClothInventory
 │      └──── AccessoryStockMovement ──► AccessoryInventory
 │
 ├──── Expense
 ├──── UploadHistory
 └──── StockMovement

ClothInventory ──► Supplier ◄── AccessoryInventory
     │                │
     └── SupplierPrice └── PurchaseOrder ──► POItem

Alert (standalone — references relatedId/relatedType by convention)
Settings (standalone key-value store)
BusinessSettings (singleton)
WhatsAppTemplate (standalone)
```

### Model Quick Reference

| Model | Table Purpose | Key Fields | Critical Relations |
|-------|--------------|-----------|-------------------|
| **User** | App users (staff) | role, email, active | orders, measurements, orderHistory |
| **Customer** | Shop customers | name, phone, city | orders, measurements |
| **Order** | Customer orders | status, totalAmount, balanceAmount | customer, items, stockMovements |
| **OrderItem** | Garment line items | garmentPatternId, clothInventoryId, estimatedMeters | order, garmentPattern, clothInventory, measurement |
| **OrderHistory** | Audit trail | changeType, oldValue, newValue | order, user |
| **PaymentInstallment** | Balance payments | installmentAmount, paidAmount, status | order |
| **Measurement** | Body measurements per garment type | chest, waist, neck, etc. | customer, orderItems |
| **GarmentPattern** | Garment templates | baseMeters, stitchingCharge tiers, bodyType adjustments | orderItems, accessories |
| **GarmentAccessory** | Pattern ↔ Accessory default links | quantityPerGarment | garmentPattern, accessoryInventory |
| **ClothInventory** | Fabric stock | currentStock, reserved, minimumStockMeters, colorHex | orderItems, stockMovements |
| **AccessoryInventory** | Button/thread stock | currentStock, reserved, minimumStockUnits | garmentAccessories, stockMovements |
| **StockMovement** | Fabric stock log | type (PURCHASE/ORDER_RESERVED/ORDER_USED/ORDER_CANCELLED), quantityMeters | clothInventory, order |
| **AccessoryStockMovement** | Accessory stock log | type, quantityUnits | accessoryInventory, order |
| **Supplier** | Fabric/accessory suppliers | name, phone, gstin | clothInventory, accessoryInventory, purchaseOrders |
| **PurchaseOrder** | Stock replenishment | status, totalAmount | supplier, items (POItem) |
| **POItem** | PO line items | itemType (CLOTH/ACCESSORY), orderedQuantity, receivedQuantity | purchaseOrder |
| **Alert** | System alerts | type (LOW_STOCK/ORDER_DELAYED etc.), severity, relatedId | — |
| **Expense** | Shop expenses | category, amount, gstAmount | user (paidBy) |
| **DesignUpload** | Design files per order item | category (SKETCH/FINAL etc.), filePath | orderItem, user |
| **WhatsAppMessage** | WhatsApp send log | recipient, status, messageType | customer, order |
| **WhatsAppTemplate** | Message templates | name, content, variables | — |
| **Settings** | Key-value app settings | key, value | — |
| **BusinessSettings** | Shop GSTIN, rates | gstin, fabricGstRate, garmentGstRate | — |

### Critical Business Rule: Stock = currentStock − reserved

```
ClothInventory.currentStock  = total physical stock (meters)
ClothInventory.reserved      = meters locked for active orders (not yet cut)
Available stock              = currentStock - reserved  ← use this for "can we fill this order?"

StockMovement type lifecycle:
  ORDER_RESERVED  → reserved += estimatedMeters   (on order creation)
  ORDER_USED      → currentStock -= actualMeters, reserved -= estimatedMeters  (on delivery)
  ORDER_CANCELLED → reserved -= estimatedMeters   (on order cancellation)
  PURCHASE        → currentStock += quantity       (on PO receipt)
  ADJUSTMENT      → explicit currentStock change   (manual correction)
```

---

## 5. Feature: Dashboard

### Pages & Components

```
app/(dashboard)/dashboard/page.tsx          ← Server Component
  └── lib/auth.ts: auth()                  ← Get session + role
  └── components/DashboardLayout.tsx       ← Sidebar + header wrapper
  └── components/dashboard/dashboard-client.tsx  ← Route to role-specific dashboard
        └── components/dashboard/role-dashboard-router.tsx
              ├── (OWNER/ADMIN)      → components/dashboard/owner-dashboard.tsx
              ├── (INVENTORY_MANAGER)→ components/dashboard/inventory-manager-dashboard.tsx
              ├── (SALES_MANAGER)    → components/dashboard/sales-manager-dashboard.tsx
              └── (TAILOR)           → components/dashboard/tailor-dashboard.tsx
```

### API Calls by Dashboard

**Owner Dashboard** (`owner-dashboard.tsx`):
```
GET /api/dashboard/enhanced-stats
  └── app/api/dashboard/enhanced-stats/route.ts
        └── requirePermission('view_dashboard')
        └── lib/dashboard-data.ts: getEnhancedStats()
              └── prisma.order.findMany(...)
              └── prisma.order.aggregate(...)
              └── prisma.expense.aggregate(...)
              └── prisma.customer.findMany(...)
              └── prisma.clothInventory.findMany(...)
              └── DB Models: Order, Expense, Customer, ClothInventory
        └── Returns: { financialTrend, revenueByFabric, revenueByGarmentType,
                       customerRetention, stockTurnoverRatio, efficiencyMetrics, ... }
```

**All Roles** (`stats`):
```
GET /api/dashboard/stats
  └── app/api/dashboard/stats/route.ts
        └── requirePermission('view_dashboard')
        └── lib/dashboard-data.ts: getDashboardStats(userRole)
              └── DB Models: Order, ClothInventory, Customer, Expense
        └── Returns: role-filtered stats object
```

### Sub-components (Owner Dashboard)

| Component | Data Source | Chart Type |
|-----------|------------|-----------|
| `financial-trend-chart.tsx` | `stats.financialTrend` | Recharts LineChart |
| `gauge-chart.tsx` | `stats.stockTurnoverRatio` | SVG gauge |
| `customer-retention-chart.tsx` | `stats.customerRetention` | Recharts PieChart |
| `orders-status-chart.tsx` | `stats.ordersByStatus` | Recharts BarChart |
| `inventory-summary.tsx` | `stats.inventoryHealth` | Custom table |
| `top-customers-chart.tsx` | `stats.topCustomers` | Recharts BarChart |
| `garment-type-revenue-chart.tsx` | `stats.revenueByGarmentType` | Recharts BarChart |
| `revenue-chart.tsx` | `stats.revenueByFabric` | Recharts BarChart |
| `revenue-forecast-chart.tsx` | `stats.revenueForecast` | Recharts AreaChart |
| `workload-chart.tsx` | `stats.workloadByGarment` | Recharts BarChart |
| `deadline-list.tsx` | `stats.upcomingDeadlines` | Custom list |

**Tailor Dashboard** specific:
- `radial-progress.tsx` — SVG radial progress (no API, pure props)
- `order-list-dialog.tsx` — clickable count card → Radix Dialog with order list
- `workload-details-dialog.tsx` — clickable workload bar → Radix Dialog

---

## 6. Feature: Order Lifecycle

### Pages

```
/orders                          → app/(dashboard)/orders/page.tsx
/orders/new                      → app/(dashboard)/orders/new/page.tsx
/orders/[id]                     → app/(dashboard)/orders/[id]/page.tsx
/orders/production               → app/(dashboard)/orders/production/page.tsx  ← Phase 2 (Tailor Kanban)
```

### Order List Page Call Chain

```
app/(dashboard)/orders/page.tsx
  └── GET /api/orders?status=&search=&page=&limit=...
        └── app/api/orders/route.ts: GET handler
              └── requirePermission('view_orders')
              └── Parallel:
                    prisma.order.count({ where })
                    prisma.order.groupBy({ by: ['status'], _count: { _all: true } })  ← status counts for tab bar
                    prisma.order.findMany({
                      where: { status, customer.name LIKE search, ... },
                      include: { customer, items: { include: { garmentPattern, clothInventory } } },
                      orderBy: { balanceAmount: 'desc' },
                      skip: (page-1)*limit, take: limit
                    })
              └── Returns: { orders, statusCounts: Record<string,number>, pagination }
              └── DB: Order + Customer + OrderItem + GarmentPattern + ClothInventory

  UI Features (Phase 2):
  - Status tab bar with count badges (All / NEW / CUTTING / STITCHING / ...)
  - Compact table view toggle (Cards ↔ Compact)
  - Tab clicks set status filter + reset to page 1
```

### Production Board (Tailor Kanban) Call Chain

```
app/(dashboard)/orders/production/page.tsx  ← Server Component
  └── auth() → session + role
  └── hasPermission(userRole, 'update_order_status') → canAdvance flag
  └── prisma.order.findMany({
        where: { status: { in: ['NEW','CUTTING','STITCHING','FINISHING','READY'] } },
        include: { customer, items: { include: { garmentPattern, clothInventory } }, assignedTailor },
        orderBy: [{ priority: 'desc' }, { deliveryDate: 'asc' }]
      })
  └── components/orders/tailor-kanban.tsx
        └── Optimistic UI: status change applied locally → PATCH /api/orders/[id]/status
        └── Rolls back on error (toast.error via sonner)
        └── Columns: NEW → CUTTING → STITCHING → FINISHING → READY
        └── Uses: requirePermission('update_order_status') guard on API
  └── DashboardLayout sidebar: "Production Board" nav item (Scissors icon, view_orders permission)
```

### New Order Form Call Chain (Multi-step)

```
app/(dashboard)/orders/new/page.tsx
  │
  ├── STEP 1: Customer Selection
  │     GET /api/customers                        → DB: Customer[]
  │     └── app/api/customers/route.ts
  │
  ├── STEP 2: Order Items
  │     GET /api/garment-patterns                 → DB: GarmentPattern[] with GarmentAccessory[]
  │     └── app/api/garment-patterns/route.ts
  │
  │     GET /api/inventory/cloth                  → DB: ClothInventory[]
  │     └── app/api/inventory/cloth/route.ts
  │
  │     GET /api/inventory/accessories            → DB: AccessoryInventory[]
  │     └── app/api/inventory/accessories/route.ts
  │
  └── STEP 3: Pricing + Submit
        POST /api/orders
        └── app/api/orders/route.ts: POST handler
              └── requirePermission('create_order')
              └── validateOrder(body) — checks customerId, items, overrides
              └── calculatePricing(items, garmentPatterns, clothInventory) — in lib/gst-utils.ts
              └── prisma.$transaction([
                    // 1. Create Order
                    prisma.order.create({ data: { customerId, items, totalAmount, ... } }),
                    // 2. Reserve stock for each cloth item
                    prisma.clothInventory.update({ data: { reserved: { increment: estimatedMeters } } }),
                    prisma.stockMovement.create({ type: 'ORDER_RESERVED', quantityMeters }),
                    // 3. Reserve accessories
                    prisma.accessoryInventory.update({ data: { reserved: { increment: quantity } } }),
                    prisma.accessoryStockMovement.create({ type: 'ORDER_RESERVED', quantityUnits }),
                    // 4. Create OrderHistory entry
                    prisma.orderHistory.create({ changeType: 'ORDER_CREATED' }),
                  ])
              └── DB: Order, OrderItem, ClothInventory (reserved++), AccessoryInventory (reserved++),
                      StockMovement (ORDER_RESERVED), AccessoryStockMovement (ORDER_RESERVED),
                      OrderHistory
```

### Order Detail Page Call Chain

```
app/(dashboard)/orders/[id]/page.tsx  ← Server Component
  └── getOrderDetails(id)
        └── prisma.order.findUnique({ where: { id },
              include: { customer, items: { include: { clothInventory, garmentPattern, measurement } },
                         history, installments } })
  └── Components rendered:
        ├── components/orders/order-actions.tsx          → PATCH /api/orders/[id]/status
        ├── components/orders/order-history.tsx          → (data passed as props from page)
        ├── components/payment-installments.tsx          → GET/POST /api/orders/[id]/installments
        │                                                   PATCH /api/installments/[id]
        ├── components/orders/order-item-edit.tsx        → PATCH /api/orders/[id]/items/[itemId]
        ├── components/orders/split-order-dialog.tsx     → POST /api/orders/[id]/split
        ├── components/orders/record-payment-dialog.tsx  → POST /api/orders/[id]/payments
        ├── components/orders/print-invoice-button.tsx   → (client-side PDF generation)
        ├── components/orders/order-item-measurements.tsx → (inline collapsible panel; props only)
        │     Phase 2: 22 measurement fields in 4 groups (Upper Body / Arms / Lengths / Lower Body)
        │     Collapsed for managers, expanded for tailors
        ├── components/orders/edit-measurement-dialog.tsx→ PATCH /api/customers/[id]/measurements/[measurementId]
        │     Phase 2: data-driven FIELD_SECTIONS, garment-type-aware field visibility
        ├── components/orders/order-item-detail-dialog.tsx→ (data from page props)
        ├── components/orders/assign-tailor-dialog.tsx   → PATCH /api/orders/[id]/items/[itemId]
        └── components/orders/send-whatsapp-button.tsx   → POST /api/whatsapp/send
```

### Order Status Update Chain

```
components/orders/order-actions.tsx
  └── PATCH /api/orders/[id]/status
        └── app/api/orders/[id]/status/route.ts
              └── requireAnyPermission(['update_order_status', 'update_order'])
              └── prisma.$transaction([
                    // Update order status
                    prisma.order.update({ where: { id }, data: { status: newStatus } }),
                    // If DELIVERED: consume reserved stock → actual usage
                    prisma.clothInventory.update({ data: {
                      currentStock: { decrement: actualMeters },
                      reserved: { decrement: estimatedMeters }
                    }}),
                    prisma.stockMovement.create({ type: 'ORDER_USED' }),
                    // If CANCELLED: release reservation
                    prisma.clothInventory.update({ data: { reserved: { decrement: estimatedMeters } }}),
                    prisma.stockMovement.create({ type: 'ORDER_CANCELLED' }),
                    // Always: create history entry
                    prisma.orderHistory.create({ changeType: 'STATUS_UPDATE', oldValue, newValue })
                  ])
              └── next/server: after(() => generateAlerts())  ← async post-response
```

### Payment Recording Chain

```
components/orders/record-payment-dialog.tsx
  └── POST /api/orders/[id]/payments
        └── app/api/orders/[id]/payments/route.ts
              └── requirePermission('update_order')
              └── prisma.$transaction([
                    prisma.paymentInstallment.create({ installmentAmount, paidAmount, paymentMode }),
                    prisma.order.update({ data: { balanceAmount: { decrement: paidAmount } } }),
                    prisma.orderHistory.create({ changeType: 'PAYMENT_RECORDED' })
                  ])
              └── DB: PaymentInstallment, Order (balanceAmount updated), OrderHistory
```

### Order Split Chain

```
components/orders/split-order-dialog.tsx
  └── POST /api/orders/[id]/split
        └── app/api/orders/[id]/split/route.ts
              └── requirePermission('update_order')
              └── getOrderDetails(id) — fetch original
              └── distributeCosts(items) — proportional cost allocation by fabric cost
                    └── lib: inline calculation in route (see CLAUDE.md §Multi-Item Invoice)
              └── prisma.$transaction([
                    // Create new order with selected items
                    prisma.order.create({ new order }),
                    // Remove items from original order, recalculate totals
                    prisma.order.update({ original order — recalculated }),
                    // Move stock reservations
                    prisma.stockMovement.createMany([...]),
                    prisma.orderHistory.createMany([...])
                  ])
```

### Tailor Notes Chain

```
(Order detail page — tailorNotes field)
  └── PATCH /api/orders/[id]/tailor-notes
        └── requireAnyPermission(['update_order_status', 'update_order'])
        └── prisma.order.update({ data: { tailorNotes } })
        └── prisma.orderHistory.create({ changeType: 'TAILOR_NOTE_UPDATED' })
```

---

## 7. Feature: Customer Management

### Pages

```
/customers              → app/(dashboard)/customers/page.tsx
/customers/new          → app/(dashboard)/customers/new/page.tsx
/customers/[id]         → app/(dashboard)/customers/[id]/page.tsx (server)
                              └── components: customer-detail-client.tsx
/customers/[id]/measurements/new → app/(dashboard)/customers/[id]/measurements/new/page.tsx
/customers/[id]/visual-measurements → app/(dashboard)/customers/[id]/visual-measurements/page.tsx
                                          └── visual-measurement-client.tsx
```

### Customer List API

```
app/(dashboard)/customers/page.tsx
  └── GET /api/customers?search=&page=&limit=
        └── app/api/customers/route.ts: GET
              └── requirePermission('view_customers')
              └── prisma.customer.findMany({
                    where: { OR: [{ name: LIKE search }, { phone: LIKE search }] },
                    include: { orders: { select: { status, totalAmount } } },
                    orderBy: { name: 'asc' }
                  })
              └── DB: Customer + Order (count + totalAmount aggregation)
```

### Customer Detail API

```
app/(dashboard)/customers/[id]/page.tsx  ← Server Component
  └── prisma.customer.findUnique({
        include: {
          orders: { include: { items: { include: { garmentPattern } } } },
          measurements: { where: { isActive: true } }
        }
      })
  └── DB: Customer + Order + OrderItem + GarmentPattern + Measurement
  └── components/customer-detail-client.tsx
        └── components/customer-measurements-section.tsx
              └── components/measurement-edit-dialog.tsx → PATCH /api/customers/[id]/measurements/[measurementId]
              └── components/measurement-history-dialog.tsx → GET /api/customers/[id]/measurements/[measurementId]/history
```

### Customer CRUD API

```
POST /api/customers              → prisma.customer.create()
GET  /api/customers/:id          → prisma.customer.findUnique() with orders + measurements
PATCH /api/customers/:id         → prisma.customer.update() — edit dialog
DELETE /api/customers/:id        → requirePermission('delete_customer')
                                    prisma.customer.update({ active: false })  ← soft delete
```

### Customer Edit Dialog

```
components/customer-edit-dialog.tsx
  └── PATCH /api/customers/[id]
        └── prisma.customer.update({ data: { name, phone, email, address, ... } })
        └── DB: Customer
```

### Returning Customers API (for Reports)

```
GET /api/customers/returning
  └── app/api/customers/returning/route.ts
        └── requirePermission('view_customer_reports')
        └── prisma.customer.findMany({
              where: { orders: { some: {} } },
              include: { _count: { select: { orders: true } } }
            })
        └── Returns customers with order counts for retention analysis
```

---

## 8. Feature: Measurements

### Data Model

```
Measurement model:
  ├── customerId       → links to Customer
  ├── userId           → who recorded it (User)
  ├── garmentType      → 'Sherwani' | 'Kurta Pajama' | 'Shirt' | 'Trouser' | etc.
  ├── bodyType         → BodyType enum (SLIM/REGULAR/LARGE/XL)
  │
  ├── Upper Body (all Float?)
  │     neck, chest, waist, hip, shoulder, crossChest (Phase 2)
  │
  ├── Arms (all Float?)
  │     sleeveLength, bicep (Phase 2), elbow (Phase 2),
  │     armCircumference (Phase 2), cuff (Phase 2)
  │
  ├── Lengths (all Float?)
  │     shirtLength, jacketLength, backLength (Phase 2), lapelWidth
  │
  ├── Lower Body (all Float?)
  │     inseam, outseam, thigh, knee, bottomOpening,
  │     rise (Phase 2), seat (Phase 2)
  │
  ├── notes            → free text measurement notes
  ├── replacesId       → previous Measurement.id (version chain)
  └── isActive         → only latest active version shown by default

Phase 2 additions (8 new fields): bicep, cuff, armCircumference, crossChest, backLength, seat, rise, elbow
```

### Measurement UI Components (Phase 2)

```
components/orders/order-item-measurements.tsx
  ├── Shows 22 fields grouped: Upper Body / Arms / Lengths / Lower Body
  ├── Collapsible panel (defaultExpanded=true for TAILORs)
  ├── Missing-measurement warning badge (orange alert)
  └── Used in: app/(dashboard)/orders/[id]/page.tsx (per OrderItem)

components/orders/edit-measurement-dialog.tsx
  ├── Data-driven: FIELD_SECTIONS array with garments: 'all' | string[] per field
  ├── isVisible(field, garmentType): shows only relevant fields for the garment
  ├── 22 numeric fields handled dynamically via ALL_NUMERIC_FIELDS flat array
  └── PATCH /api/measurements/[id]
```

### API Routes

```
GET    /api/customers/[id]/measurements          → list active measurements for customer
POST   /api/customers/[id]/measurements          → create new measurement
                                                   (if one exists for garmentType, marks old as isActive:false)
GET    /api/customers/[id]/measurements/[mId]    → get specific measurement
PATCH  /api/customers/[id]/measurements/[mId]    → update measurement (creates new version)
DELETE /api/customers/[id]/measurements/[mId]    → requirePermission('delete_measurement')
                                                   soft-deletes (isActive: false)
GET    /api/customers/[id]/measurements/[mId]/history → version history via replacesId chain

GET    /api/measurements/[id]                    → get measurement by ID (used in order items)
PATCH  /api/measurements/[id]                    → update measurement
GET    /api/measurements/compare                 → compare two measurements (diff view)
```

### Measurement in Order Items

```
OrderItem.measurementId → Measurement.id
  ← When order is created: the customer's active measurement for the garment type is linked
  ← When order item is shown: the linked measurement values are displayed to the tailor

components/orders/edit-measurement-dialog.tsx
  └── PATCH /api/measurements/[id]              ← update measurement from within order
        └── prisma.measurement.update(...)
```

### Visual Measurements

```
/customers/[id]/visual-measurements
  └── visual-measurement-client.tsx
        ├── SVG body diagram with measurement labels
        ├── GET /api/customers/[id]/measurements → pre-fills existing measurements
        └── POST /api/customers/[id]/measurements → save new measurements
```

---

## 9. Feature: Inventory — Cloth

### Pages

```
/inventory                       → app/(dashboard)/inventory/page.tsx
                                     └── components/InventoryPageClient.tsx
/inventory/cloth/[id]            → app/(dashboard)/inventory/cloth/[id]/page.tsx
/inventory/accessories/[id]      → app/(dashboard)/inventory/accessories/[id]/page.tsx
```

### API Routes

```
GET    /api/inventory/cloth?search=&type=&page=&limit=
         └── prisma.clothInventory.findMany({ where: { active: true, ... } })
         └── Includes: available = currentStock - reserved (computed in response)

POST   /api/inventory/cloth
         └── requirePermission('add_inventory')
         └── prisma.clothInventory.create({ ... })
         └── lib/utils.ts: generateSKU() → unique SKU

GET    /api/inventory/cloth/[id]
         └── prisma.clothInventory.findUnique({ include: { stockMovements, supplierRel } })

PATCH  /api/inventory/cloth/[id]
         └── requirePermission('manage_inventory')
         └── prisma.clothInventory.update({ ... })

DELETE /api/inventory/cloth/[id]
         └── requirePermission('delete_inventory')
         └── prisma.clothInventory.update({ active: false })  ← soft delete

POST   /api/inventory/cloth/[id]/adjust-stock
         └── requirePermission('manage_inventory')
         └── prisma.$transaction([
               prisma.clothInventory.update({ currentStock: { increment: adjustment } }),
               prisma.stockMovement.create({ type: 'ADJUSTMENT', ... })
             ])

GET    /api/inventory/cloth/[id]/history
         └── prisma.stockMovement.findMany({ where: { clothInventoryId }, orderBy: { createdAt: 'desc' } })
```

### Low Stock Alert API

```
GET /api/inventory/low-stock
  └── prisma.clothInventory.findMany({
        where: { active: true, currentStock: { lt: prisma.raw('minimumStockMeters') } }
      })
  └── Returns fabrics where available (currentStock - reserved) < minimumStockMeters
  └── Used by: Alerts generation, Dashboard inventory summary
```

### Stock Status Calculation

```
lib/utils.ts: calculateStockStatus(currentStock, reserved, minimum)
  Returns: 'healthy' | 'low' | 'critical'
  Logic:
    available = currentStock - reserved
    if available >= minimum → 'healthy'
    if available >= minimum * 0.5 → 'low'
    else → 'critical'
```

---

## 10. Feature: Inventory — Accessories

### API Routes

```
GET    /api/inventory/accessories?search=&type=
         └── prisma.accessoryInventory.findMany({ where: { active: true } })

POST   /api/inventory/accessories
         └── requirePermission('add_inventory')
         └── prisma.accessoryInventory.create({ ... })

GET    /api/inventory/accessories/[id]
         └── prisma.accessoryInventory.findUnique({ include: { stockMovements, garmentAccessories } })

PATCH  /api/inventory/accessories/[id]
         └── requirePermission('manage_inventory')

DELETE /api/inventory/accessories/[id]
         └── requirePermission('delete_inventory')
         └── soft delete (active: false)
```

### Accessory Linking to Garment Patterns

```
GarmentAccessory model bridges GarmentPattern ↔ AccessoryInventory:
  garmentPatternId  → which garment uses this accessory
  accessoryId       → which accessory
  quantityPerGarment → default quantity (e.g., 10 buttons per shirt)

GET /api/garment-patterns/[id]/accessories
  └── prisma.garmentAccessory.findMany({
        where: { garmentPatternId },
        include: { accessory: true }
      })
  ← Used in order form: when garment is selected, defaults are pre-loaded
```

---

## 11. Feature: Stock Movements

### Two Movement Tables

```
StockMovement         → tracks ClothInventory changes (in meters)
AccessoryStockMovement → tracks AccessoryInventory changes (in units)

Both share the same StockMovementType enum:
  PURCHASE        → new stock received (PO received)
  ORDER_RESERVED  → stock reserved when order created
  ORDER_USED      → stock consumed when order delivered
  ORDER_CANCELLED → reservation released on order cancellation
  ADJUSTMENT      → manual stock correction
  RETURN          → stock returned (damaged goods, etc.)
  WASTAGE         → explicit wastage recording
```

### Who Creates Movements

| Movement Type | Triggered By | API Route |
|--------------|-------------|-----------|
| ORDER_RESERVED | New order creation | POST /api/orders |
| ORDER_USED | Order → DELIVERED status | PATCH /api/orders/[id]/status |
| ORDER_CANCELLED | Order → CANCELLED status | PATCH /api/orders/[id]/status |
| PURCHASE | PO received | POST /api/purchase-orders/[id]/receive |
| ADJUSTMENT | Manual inventory adjustment | POST /api/inventory/cloth/[id]/adjust-stock |

### Enum Usage Note

```typescript
// ⚠️ IMPORTANT: Prisma 7 requires string literals in WHERE clauses, not enum references
// ✓ Correct:
prisma.stockMovement.findMany({ where: { type: 'ORDER_RESERVED' } })
// ✗ Wrong (will error):
prisma.stockMovement.findMany({ where: { type: StockMovementType.ORDER_RESERVED } })
```

---

## 12. Feature: Purchase Orders

### Pages

```
/purchase-orders              → app/(dashboard)/purchase-orders/page.tsx
/purchase-orders/new          → app/(dashboard)/purchase-orders/new/page.tsx
/purchase-orders/[id]         → app/(dashboard)/purchase-orders/[id]/page.tsx
```

### API Routes & Call Chains

```
GET    /api/purchase-orders?status=&search=
         └── requirePermission('view_purchase_orders')
         └── prisma.purchaseOrder.findMany({ include: { supplier, items } })

POST   /api/purchase-orders
         └── requirePermission('manage_purchase_orders')
         └── lib/utils.ts: generatePONumber()
         └── prisma.purchaseOrder.create({ data: { supplierId, items, totalAmount, ... } })
         └── DB: PurchaseOrder + POItem[]

GET    /api/purchase-orders/[id]
         └── prisma.purchaseOrder.findUnique({ include: { supplier, items } })

PATCH  /api/purchase-orders/[id]
         └── requirePermission('manage_purchase_orders')
         └── prisma.purchaseOrder.update(...)

DELETE /api/purchase-orders/[id]
         └── requirePermission('delete_purchase_order')
         └── soft delete

POST   /api/purchase-orders/[id]/receive    ← CRITICAL STOCK UPDATE
         └── requirePermission('manage_purchase_orders')
         └── prisma.$transaction([
               // Update PO status and received quantities
               prisma.poItem.update({ receivedQuantity }),
               prisma.purchaseOrder.update({ status: 'RECEIVED' | 'PARTIAL' }),
               // Update actual inventory stock
               prisma.clothInventory.update({ currentStock: { increment: receivedMeters } }),
               // Log the stock movement
               prisma.stockMovement.create({ type: 'PURCHASE', quantityMeters }),
             ])
         └── DB: PurchaseOrder, POItem, ClothInventory, StockMovement

POST   /api/purchase-orders/[id]/payment
         └── prisma.$transaction([
               prisma.purchaseOrder.update({ paidAmount: { increment }, balanceAmount: { decrement } })
             ])
```

---

## 13. Feature: Expenses

### Pages

```
/expenses → app/(dashboard)/expenses/page.tsx
```

### API Routes

```
GET    /api/expenses?category=&dateFrom=&dateTo=&page=
         └── requirePermission('view_expenses')
         └── prisma.expense.findMany({ where: { ... }, include: { paidByUser } })

POST   /api/expenses
         └── requirePermission('manage_expenses')
         └── lib/gst-utils.ts: calculateGST(amount, gstRate)
         └── prisma.expense.create({
               data: { category, amount, gstAmount, totalAmount, expenseDate, paidBy: session.user.id }
             })
         └── DB: Expense

PATCH  /api/expenses/[id]
         └── requirePermission('manage_expenses')

DELETE /api/expenses/[id]
         └── requirePermission('delete_expenses')
         └── soft delete (active: false)
```

### Expense Categories (ExpenseCategory enum)

```
RENT | UTILITIES | SALARIES | TRANSPORT | MARKETING | MAINTENANCE |
OFFICE_SUPPLIES | PROFESSIONAL_FEES | INSURANCE | DEPRECIATION |
BANK_CHARGES | MISCELLANEOUS
```

### Filter Component

```
components/expenses-filter.tsx
  └── Renders filter form (category, date range)
  └── Updates URL query params → triggers re-fetch in page
```

---

## 14. Feature: Alerts System

### Alert Types & Severity

```
AlertType: LOW_STOCK | CRITICAL_STOCK | ORDER_DELAYED | REORDER_REMINDER
AlertSeverity: LOW | MEDIUM | HIGH | CRITICAL

Alert.relatedId   → ID of the related entity (fabric ID, order ID, etc.)
Alert.relatedType → 'cloth' | 'accessory' | 'order'
Unique constraint: (relatedId, relatedType, type, isDismissed) — no duplicate alerts
```

### Alert Generation (Async, Post-Response)

```
lib/generate-alerts.ts: generateAlerts()
  ├── Check ClothInventory for low/critical stock
  │     └── prisma.clothInventory.findMany({ where: { active: true } })
  │     └── lib/utils.ts: calculateStockStatus(currentStock, reserved, minimum)
  │     └── prisma.alert.upsert({ where: { relatedId_relatedType_type_isDismissed: ... } })
  │
  ├── Check for overdue orders
  │     └── prisma.order.findMany({
  │           where: { deliveryDate: { lt: now }, status: { notIn: ['DELIVERED', 'CANCELLED'] } }
  │         })
  │     └── prisma.alert.upsert({ type: 'ORDER_DELAYED' })
  │
  └── Called from:
        ├── POST /api/alerts/generate   (manual trigger)
        └── next/server: after()        (async after order status update)
              └── app/api/orders/[id]/status/route.ts
```

### Alert API Routes

```
GET    /api/alerts?type=&severity=&isRead=
         └── requirePermission('view_alerts')
         └── prisma.alert.findMany({ where: { isDismissed: false, dismissedUntil: null | past } })

POST   /api/alerts/generate
         └── requirePermission('manage_alerts')
         └── lib/generate-alerts.ts: generateAlerts()

PATCH  /api/alerts/[id]/read
         └── prisma.alert.update({ isRead: true })

PATCH  /api/alerts/[id]/dismiss
         └── prisma.alert.update({ isDismissed: true, dismissedUntil: snoozeDate | null })

GET    /api/alerts/[id]
PATCH  /api/alerts/[id]            → update alert

POST   /api/alerts/mark-all-read
         └── prisma.alert.updateMany({ where: { isRead: false }, data: { isRead: true } })
```

---

## 15. Feature: Reports & Analytics

### Pages

```
/reports/financial    → app/(dashboard)/reports/financial/page.tsx  ← ⚠️ missing DashboardLayout
/reports/expenses     → app/(dashboard)/reports/expenses/page.tsx
```

### Financial Report API Chain

```
GET /api/reports/financial?months=12
  └── app/api/reports/financial/route.ts
        └── requireAnyPermission(['view_financial_reports', 'view_reports'])
        └── Queries (date range = last N months):
              prisma.order.groupBy({ by: ['createdAt'], _sum: { totalAmount, advancePaid } })
              prisma.expense.groupBy({ by: ['expenseDate'], _sum: { totalAmount } })
              prisma.paymentInstallment.aggregate({ _sum: { paidAmount } })
        └── Returns: { summary: { thisMonthRevenue, profit }, monthlyData: [], ... }
```

### Expenses Report API Chain

```
GET /api/reports/expenses?months=6
  └── app/api/reports/expenses/route.ts
        └── requirePermission('view_expense_reports')
        └── prisma.expense.groupBy({ by: ['category'], _sum: { amount } })
        └── Returns: { byCategory, trend: [], summary }
```

### Customer Report API Chain

```
GET /api/reports/customers
  └── app/api/reports/customers/route.ts
        └── requirePermission('view_customer_reports')
        └── prisma.customer.findMany({ include: { orders: { _count } } })
        └── Returns: { topCustomers, newVsReturning, cityDistribution }
```

---

## 16. Feature: WhatsApp Integration

### Architecture

```
lib/whatsapp/whatsapp-service.ts
  └── WhatsAppService class
        ├── sendMessage(recipient, message, templateName?, variables?) → API call to WhatsApp Business API
        └── getTemplates() → fetch approved templates

WhatsAppMessage model → stores send log per message
WhatsAppTemplate model → stores reusable message templates
```

### API Routes

```
POST   /api/whatsapp/send
         └── requirePermission('update_order') (or similar)
         └── lib/whatsapp/whatsapp-service.ts: WhatsAppService.sendMessage()
         └── prisma.whatsAppMessage.create({ recipient, customerId, orderId, status: 'SENT' })
         └── DB: WhatsAppMessage

GET    /api/whatsapp/templates
         └── prisma.whatsAppTemplate.findMany({ where: { active: true } })

GET    /api/whatsapp/history?customerId=&orderId=
         └── prisma.whatsAppMessage.findMany({ where: { customerId | orderId } })
```

### Component Integration

```
components/orders/send-whatsapp-button.tsx
  └── Triggered from: app/(dashboard)/orders/[id]/page.tsx
  └── Fetches templates from GET /api/whatsapp/templates
  └── Substitutes variables (customer name, order number, delivery date)
  └── POST /api/whatsapp/send → sends + logs
```

### Testing Note

```
vitest.setup.ts mocks lib/whatsapp/whatsapp-service:
  vi.mock('@/lib/whatsapp/whatsapp-service', () => ({ WhatsAppService: vi.fn() }))
  ← Unit tests never actually send WhatsApp messages
```

---

## 17. Feature: Bulk Upload

### Architecture

```
/bulk-upload → app/(dashboard)/bulk-upload/page.tsx
  └── requirePermission('bulk_upload')  ← ADMIN only
  └── lib/excel-processor.ts: processExcelFile()  ← core processing
  └── lib/excel-upload.ts: parseAndValidate()     ← validation layer
```

### API Routes

```
GET  /api/bulk-upload/download-template
       └── Returns Excel template with correct column headers

POST /api/bulk-upload/preview
       └── lib/excel-processor.ts: parseExcel(file) → { rows, errors, duplicates }
       └── Does NOT write to DB — preview only

POST /api/bulk-upload/process
       └── requirePermission('bulk_upload')
       └── lib/excel-processor.ts: processRows(rows)
       └── For each row (safe-fail — continues on invalid row):
             ├── prisma.customer.upsert() — find by phone, create or update
             ├── prisma.clothInventory.upsert() — find by SKU
             └── prisma.accessoryInventory.upsert() — find by SKU
       └── prisma.uploadHistory.create({ userId, filename, successCount, failureCount, ... })
       └── DB: Customer, ClothInventory, AccessoryInventory, UploadHistory

GET  /api/bulk-upload/history
       └── prisma.uploadHistory.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })
```

### Safe-Fail Pattern

```typescript
// lib/excel-processor.ts
for (const row of rows) {
  try {
    await processRow(row)
    successCount++
  } catch (error) {
    failures.push({ row: row.rowNumber, error: error.message })
    failureCount++
    // Continues to next row — does not abort entire upload
  }
}
```

---

## 18. Feature: Garment Types (Patterns)

### Pages

```
/garment-types             → app/(dashboard)/garment-types/page.tsx
/garment-types/new         → app/(dashboard)/garment-types/new/page.tsx
/garment-types/[id]        → app/(dashboard)/garment-types/[id]/page.tsx
/garment-types/[id]/edit   → app/(dashboard)/garment-types/[id]/edit/page.tsx
```

### Data Model Key Fields

```
GarmentPattern:
  ├── baseMeters              → default fabric required (e.g., 2.5m for shirt)
  ├── slimAdjustment          → extra meters for SLIM body type (can be negative)
  ├── regularAdjustment       → for REGULAR (usually 0)
  ├── largeAdjustment         → for LARGE (e.g., +0.3m)
  ├── xlAdjustment            → for XL (e.g., +0.5m)
  ├── basicStitchingCharge    → stitching cost for BASIC tier
  ├── premiumStitchingCharge  → stitching cost for PREMIUM tier
  └── luxuryStitchingCharge   → stitching cost for LUXURY tier
```

### API Routes

```
GET    /api/garment-patterns              → all active patterns + default accessories
POST   /api/garment-patterns             → requirePermission('manage_garment_types')
GET    /api/garment-patterns/[id]        → single pattern with accessories
PATCH  /api/garment-patterns/[id]        → update pattern
DELETE /api/garment-patterns/[id]        → requirePermission('delete_garment_type') → soft delete

GET    /api/garment-patterns/[id]/accessories   → accessories linked to this pattern
POST   /api/garment-patterns/[id]/accessories   → link an accessory to pattern
DELETE /api/garment-patterns/[id]/accessories   → unlink accessory
```

### Fabric Calculation Logic

```typescript
// Used in: app/(dashboard)/orders/new/page.tsx: calculateEstimate()
// Also in: app/api/orders/route.ts: when creating order items

const adjustment = {
  SLIM: pattern.slimAdjustment,
  REGULAR: pattern.regularAdjustment,
  LARGE: pattern.largeAdjustment,
  XL: pattern.xlAdjustment,
}[item.bodyType]

const estimatedMeters = (pattern.baseMeters + adjustment) * item.quantityOrdered
const fabricCost = estimatedMeters * cloth.pricePerMeter
```

---

## 19. Feature: Suppliers

```
GET    /api/suppliers              → prisma.supplier.findMany({ where: { active: true } })
POST   /api/suppliers              → requirePermission('manage_suppliers')
                                     prisma.supplier.create(...)
```

Suppliers link to `ClothInventory.supplierId` and `AccessoryInventory.supplierId` and `PurchaseOrder.supplierId`.

---

## 20. Feature: Admin — Users & Settings

### Pages

```
/admin/settings → app/(dashboard)/admin/settings/page.tsx
```

### API Routes

```
GET    /api/admin/users              → requirePermission('manage_users')
                                       prisma.user.findMany({ where: { active: true } })

POST   /api/admin/users              → requirePermission('manage_users')
                                       bcrypt.hash(password, 10)
                                       prisma.user.create({ ... })

PATCH  /api/admin/users/[id]        → requirePermission('manage_users')
                                       prisma.user.update({ role, active, ... })

DELETE /api/admin/users/[id]        → requirePermission('manage_users')
                                       prisma.user.update({ active: false })  ← soft delete

GET    /api/users                    → requireAuth() — current user's own profile

GET/POST /api/admin/settings        → requirePermission('manage_settings')
                                       prisma.settings.upsert({ key, value })
```

---

## 21. Feature: Excel VBA Integration

> Added in Phase 2. Allows staff to submit orders directly from the Excel spreadsheet template
> (`hamees_orders_template.xlsm`) without opening the web app.

### Authentication

```
Static API key: x-excel-api-key header
Source: EXCEL_API_KEY env var (generate: openssl rand -hex 32)
Verified by: lib/excel-api-auth.ts → verifyExcelApiKey(request)
  └── Constant-time XOR comparison to prevent timing attacks
  └── Returns { ok: true } | { ok: false; error: NextResponse }
```

### VBA → API Flow

```
Excel file: hamees_orders_template.xlsm
  └── VBA Module: docs/excel-vba-module.bas (import via Alt+F11 → Import)
        ├── SubmitOrder() — reads cells → builds JSON → HTTP POST
        │     └── POST /api/excel/submit-order
        │           └── lib/excel-api-auth.ts: verifyExcelApiKey()
        │           └── Schema validation (zod): submitOrderSchema (32 fields)
        │           └── Look up system OWNER user for userId attribution
        │           └── Customer: find by phone → create if not found
        │           └── GarmentPattern: case-insensitive name match
        │           └── ClothInventory: name+color match → fallback by name → fallback to any active
        │           └── Create Measurement (22 fields)
        │           └── prisma.$transaction:
        │                 ClothInventory.reserved += estimatedMeters
        │                 StockMovement.create { type: ORDER_RESERVED, userId: systemOwnerId }
        │                 Order.create { userId: systemOwnerId, ... }
        │                   └── OrderItem.create { pricePerUnit, estimatedMeters, ... }
        │           └── Returns: { orderId, orderNumber, totalAmount, balanceAmount }
        │
        ├── TestConnection() — GET /api/excel/submit-order
        │     └── Returns: { status: 'ok', garmentPatterns[], clothInventory[] }
        │     └── Used to populate VBA dropdowns / health check
        │
        └── ResetForm() — clears all cells
              ExtractJsonField() — simple JSON string parser
              StrField() / NumField() — JSON payload building helpers

Key constants (user must configure in VBA):
  HAMEES_API_URL = "https://hamees.gagneet.com"
  HAMEES_API_KEY = "<from EXCEL_API_KEY env var>"

Stock note: advance payment → Order.advancePaid only (no PaymentInstallment)
userId note: attributed to first OWNER user in DB (system actor for API-key calls)
gstRate stored as integer 12 (matches main orders route convention)
```

### Files

| File | Purpose |
|------|---------|
| `app/api/excel/submit-order/route.ts` | POST (submit order) + GET (health check / dropdown data) |
| `lib/excel-api-auth.ts` | API key verification with constant-time comparison |
| `docs/excel-vba-module.bas` | VBA source code to import into the Excel template |
| `.env.example` | Added `EXCEL_API_KEY=""` entry |

---

## 22. Shared Libraries Reference

### `lib/db.ts` — Prisma Singleton

```typescript
// Creates ONE PrismaClient per Node.js process (prevents connection pool exhaustion in dev)
// Uses PrismaPg adapter (required for Prisma 7)
// Usage: import { prisma } from '@/lib/db'  — EVERYWHERE
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })
```

### `lib/auth.ts` — NextAuth Config

```typescript
// Wrapped in React.cache() for request deduplication
// JWT strategy: stores user.id, name, email, role in token
// Session expiry: 30 days
export const auth = React.cache(handlers.auth)
// Usage: const session = await auth()  — server components & API routes
```

### `lib/permissions.ts` — RBAC

```typescript
hasPermission(role: UserRole, permission: Permission): boolean
hasAnyPermission(role, permissions[]): boolean
getRolePermissions(role): Permission[]
// Usage: import { hasPermission } from '@/lib/permissions'
```

### `lib/api-permissions.ts` — API Guards

```typescript
requirePermission(permission)    → { session, error }
requireAnyPermission(permissions[]) → { session, error }
requireAuth()                    → { session, error }
// Usage: const { session, error } = await requirePermission('view_orders')
//        if (error) return error
```

### `lib/utils.ts` — Shared Utilities

```typescript
formatCurrency(amount: number): string
  // → '₹12,500.00' (INR formatting, en-IN locale)
  // Used: everywhere amounts are displayed

generateOrderNumber(): string
  // → 'ORD-' + timestamp-based unique string
  // Used: POST /api/orders

generateSKU(): string
  // → 'FAB-' + random alphanumeric
  // Used: POST /api/inventory/cloth

calculateStockStatus(currentStock, reserved, minimum): 'healthy' | 'low' | 'critical'
  // Logic: available = currentStock - reserved
  //   >= minimum → 'healthy'
  //   >= minimum * 0.5 → 'low'
  //   else → 'critical'
  // Used: inventory list, alerts generation, dashboard
```

### `lib/gst-utils.ts` — GST Calculations

```typescript
calculateGST(amount, gstRate): { cgst, sgst, igst, gstAmount, total }
  // Indian GST: intra-state = CGST(rate/2) + SGST(rate/2), inter-state = IGST(rate)
  // Default garment rate: 12% (6% CGST + 6% SGST)
  // Used: order creation, expense recording, PO creation
```

### `lib/dashboard-data.ts` — Analytics Queries

```typescript
getDashboardStats(userRole): Promise<RoleSpecificStats>
  // Returns different data based on role
  // Queries: Order, Customer, ClothInventory, Expense

getEnhancedStats(): Promise<OwnerStats>
  // Heavy analytics: revenue trends, retention, efficiency metrics
  // Used only by OWNER/ADMIN dashboard
```

### `lib/generate-alerts.ts` — Alert Generation

```typescript
generateAlerts(): Promise<void>
  // Checks inventory levels → creates Alert records
  // Checks overdue orders → creates Alert records
  // Uses upsert with unique constraint to avoid duplicates
  // Called async after order status updates (via next/server: after())
```

### `lib/excel-processor.ts` — Bulk Import

```typescript
parseExcel(buffer): ParsedData
processRows(rows): Promise<ProcessResult>
  // Safe-fail: continues on row errors
  // Upserts: customer by phone, cloth by SKU, accessory by SKU
```

---

## 23. API Route Directory

### Authentication
| Route | Method | Permission | Description |
|-------|--------|-----------|-------------|
| `/api/auth/[...nextauth]` | GET, POST | none | NextAuth handler |

### Orders
| Route | Method | Permission | DB Models Touched |
|-------|--------|-----------|-------------------|
| `/api/orders` | GET | view_orders | Order, Customer, OrderItem; returns `statusCounts` for tab bar |
| `/api/orders` | POST | create_order | Order, OrderItem, ClothInventory, AccessoryInventory, StockMovement, OrderHistory |
| `/api/orders/[id]` | GET | view_orders | Order + all relations |
| `/api/orders/[id]` | PATCH | update_order | Order, OrderHistory |
| `/api/orders/[id]` | DELETE | delete_order | Order (soft delete) |
| `/api/orders/[id]/status` | PATCH | update_order_status | Order, ClothInventory, StockMovement, OrderHistory |
| `/api/orders/[id]/split` | POST | update_order | Order(×2), OrderItem, StockMovement, OrderHistory |
| `/api/orders/[id]/payments` | POST | update_order | PaymentInstallment, Order |
| `/api/orders/[id]/installments` | GET | view_orders | PaymentInstallment |
| `/api/orders/[id]/items/[itemId]` | PATCH | update_order | OrderItem |
| `/api/orders/[id]/tailor-notes` | PATCH | update_order_status | Order, OrderHistory |

### Excel VBA Integration (API-key auth, no session)
| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/excel/submit-order` | POST | x-excel-api-key header | Create order from Excel VBA macro; upserts Customer; creates Measurement, Order, OrderItem, StockMovement |
| `/api/excel/submit-order` | GET | x-excel-api-key header | Health check; returns garment patterns + cloth inventory for dropdown population |

### Customers
| Route | Method | Permission | DB Models |
|-------|--------|-----------|-----------|
| `/api/customers` | GET | view_customers | Customer |
| `/api/customers` | POST | manage_customers | Customer |
| `/api/customers/[id]` | GET | view_customers | Customer, Order, Measurement |
| `/api/customers/[id]` | PATCH | manage_customers | Customer |
| `/api/customers/[id]` | DELETE | delete_customer | Customer |
| `/api/customers/returning` | GET | view_customer_reports | Customer, Order |
| `/api/customers/[id]/measurements` | GET/POST | manage_measurements | Measurement |
| `/api/customers/[id]/measurements/[mId]` | PATCH/DELETE | manage_measurements | Measurement |
| `/api/customers/[id]/measurements/[mId]/history` | GET | manage_measurements | Measurement |

### Inventory
| Route | Method | Permission | DB Models |
|-------|--------|-----------|-----------|
| `/api/inventory/cloth` | GET/POST | view/add_inventory | ClothInventory |
| `/api/inventory/cloth/[id]` | GET/PATCH/DELETE | view/manage/delete_inventory | ClothInventory |
| `/api/inventory/cloth/[id]/adjust-stock` | POST | manage_inventory | ClothInventory, StockMovement |
| `/api/inventory/cloth/[id]/history` | GET | view_inventory | StockMovement |
| `/api/inventory/accessories` | GET/POST | view/add_inventory | AccessoryInventory |
| `/api/inventory/accessories/[id]` | GET/PATCH/DELETE | view/manage/delete_inventory | AccessoryInventory |
| `/api/inventory/low-stock` | GET | view_inventory | ClothInventory |
| `/api/inventory/barcode` | GET | view_inventory | ClothInventory |

### Purchase Orders
| Route | Method | Permission | DB Models |
|-------|--------|-----------|-----------|
| `/api/purchase-orders` | GET/POST | view/manage_purchase_orders | PurchaseOrder, POItem |
| `/api/purchase-orders/[id]` | GET/PATCH/DELETE | view/manage/delete_purchase_order | PurchaseOrder |
| `/api/purchase-orders/[id]/receive` | POST | manage_purchase_orders | PurchaseOrder, POItem, ClothInventory, StockMovement |
| `/api/purchase-orders/[id]/payment` | POST | manage_purchase_orders | PurchaseOrder |

### Reports & Dashboard
| Route | Method | Permission | DB Models |
|-------|--------|-----------|-----------|
| `/api/dashboard/stats` | GET | view_dashboard | Order, Customer, ClothInventory, Expense |
| `/api/dashboard/enhanced-stats` | GET | view_dashboard | Order, Customer, ClothInventory, Expense, StockMovement |
| `/api/reports/financial` | GET | view_financial_reports | Order, Expense, PaymentInstallment |
| `/api/reports/expenses` | GET | view_expense_reports | Expense |
| `/api/reports/customers` | GET | view_customer_reports | Customer, Order |

### Other Features
| Route | Method | Permission | Notes |
|-------|--------|-----------|-------|
| `/api/alerts` | GET | view_alerts | Alert |
| `/api/alerts/generate` | POST | manage_alerts | Triggers lib/generate-alerts.ts |
| `/api/alerts/[id]/read` | PATCH | view_alerts | Alert |
| `/api/alerts/[id]/dismiss` | PATCH | view_alerts | Alert |
| `/api/expenses` | GET/POST | view/manage_expenses | Expense |
| `/api/garment-patterns` | GET/POST | view/manage_garment_types | GarmentPattern |
| `/api/whatsapp/send` | POST | update_order | WhatsAppMessage, WhatsAppService |
| `/api/whatsapp/templates` | GET | view_orders | WhatsAppTemplate |
| `/api/bulk-upload/process` | POST | bulk_upload | Customer, ClothInventory, AccessoryInventory |
| `/api/admin/users` | GET/POST | manage_users | User |
| `/api/measurements/[id]` | GET/PATCH | manage_measurements | Measurement |

---

## 24. Component Dependency Graph

### `DashboardLayout.tsx` — Used By All Pages

```
components/DashboardLayout.tsx
  ├── components/dashboard/sign-out-button.tsx
  ├── next-auth/react: useSession()
  ├── lib/permissions.ts: hasPermission()
  └── Renders: sidebar nav + header + <main>{children}</main>
```

### `InventoryPageClient.tsx` — Inventory Hub

```
components/InventoryPageClient.tsx
  ├── GET /api/inventory/cloth          → fabric table
  ├── GET /api/inventory/accessories    → accessory table
  └── components/dashboard/inventory-stock-dialog.tsx
        └── GET /api/inventory/cloth/[id]/history
```

### `components/orders/` — Order Detail Components

```
All used in: app/(dashboard)/orders/[id]/page.tsx

order-actions.tsx
  └── PATCH /api/orders/[id]/status
        └── Calls next status in: NEW → MATERIAL_SELECTED → CUTTING → STITCHING → FINISHING → READY → DELIVERED

order-history.tsx
  └── Props-only (data passed from server page, no extra API call)

payment-installments.tsx
  └── GET  /api/orders/[id]/installments
  └── PATCH /api/installments/[id]

order-item-edit.tsx
  └── PATCH /api/orders/[id]/items/[itemId]
  └── GET   /api/inventory/cloth        (for fabric change)
  └── GET   /api/garment-patterns       (for garment type change)

split-order-dialog.tsx
  └── POST /api/orders/[id]/split

record-payment-dialog.tsx
  └── POST /api/orders/[id]/payments

print-invoice-button.tsx
  └── Client-side: reads order data from page props → generates PDF in browser

edit-measurement-dialog.tsx
  └── PATCH /api/measurements/[id]

order-item-measurements.tsx                        ← Phase 2 (inline collapsible panel)
  └── Props-only (measurement data from page props)
  └── 22 fields in 4 groups: Upper Body / Arms / Lengths / Lower Body
  └── defaultExpanded: true for TAILOR role, false for managers

order-item-detail-dialog.tsx
  └── Props-only (no API call — data from page props)

assign-tailor-dialog.tsx
  └── GET   /api/admin/users            (fetch tailor list)
  └── PATCH /api/orders/[id]/items/[itemId]  (assign tailor)

send-whatsapp-button.tsx
  └── GET  /api/whatsapp/templates
  └── POST /api/whatsapp/send

tailor-kanban.tsx                                  ← Phase 2 (Production Board)
  └── Used in: app/(dashboard)/orders/production/page.tsx
  └── Optimistic status advance → PATCH /api/orders/[id]/status
  └── Uses sonner toast for success/error feedback
  └── DeliveryBadge: overdue=red / today=amber / 1 day=orange / future=slate
```

### `components/orders/customer-selector.tsx` — Phase 1 (Searchable Customer Selection)

```
components/orders/customer-selector.tsx
  ├── Used in: app/(dashboard)/orders/new/page.tsx (Step 1)
  ├── Combobox (components/ui/combobox.tsx)
  │     └── Filters customers by name OR phone — replaces plain <select>
  │
  ├── Customer Profile Card (inline, rendered on selection)
  │     ├── Shows: name, phone, city, last order number + garment types, saved measurements
  │     └── GET /api/customers/[id]  → fetches last order + measurement summary
  │
  ├── "Repeat Last Order" Button
  │     ├── GET /api/orders/[lastOrderId]  → fetches full order items + stitching config
  │     └── Calls onRepeatOrder(RepeatOrderData) prop → parent form pre-fills Steps 2 & 3
  │
  └── InlineNewCustomerForm (when no match found)
        ├── Name + Phone + City fields (no page navigation)
        ├── POST /api/customers  → creates customer
        └── Calls onNewCustomer(customer) → adds to dropdown + auto-selects
```

### `components/ui/combobox.tsx` — Phase 1 (Searchable Dropdown)

```
components/ui/combobox.tsx
  ├── @featuretrace Customer Combobox
  ├── Built on Radix UI Popover + controlled Input + client-side filtered list (no cmdk)
  ├── Props: options[], value, onSelect, placeholder, emptyMessage, onAddNew, onAddNewLabel
  ├── Filters options client-side via label.toLowerCase().includes(search) || sublabel?.toLowerCase().includes(search)
  └── Used in:
        ├── components/orders/customer-selector.tsx  (customer search)
        └── app/(dashboard)/orders/new/page.tsx      (garment + fabric selects)
```

### `components/orders/tailor-kanban.tsx` — Phase 2 (Production Board)

```
components/orders/tailor-kanban.tsx
  ├── Used in: app/(dashboard)/orders/production/page.tsx
  ├── Renders 5 swim-lane columns: NEW | CUTTING | STITCHING | FINISHING | READY
  ├── Each column: filteredOrders.filter(o => o.status === col.status)
  │
  ├── KanbanCard per order:
  │     ├── Order number (bold) + customer name
  │     ├── Garment type chips (items[].garmentPattern.name)
  │     ├── DeliveryBadge: overdue=red / today=amber / 1 day=orange / future=slate
  │     ├── Assigned tailor name (if set)
  │     └── Fabric name text (items[0].clothInventory.name)
  │
  ├── One-click status advance (canAdvance prop = update_order_status permission)
  │     └── Optimistic: moves card locally → PATCH /api/orders/[id]/status
  │           On error: reverts to previous status + toast.error
  │
  └── Props: orders: KanbanOrder[] (from server) | canAdvance: boolean
```



```
dashboard-client.tsx
  └── GET /api/dashboard/stats (for all roles)
  └── GET /api/dashboard/enhanced-stats (OWNER/ADMIN only)
  └── role-dashboard-router.tsx
        ├── owner-dashboard.tsx
        │     ├── financial-trend-chart.tsx  (Recharts LineChart)
        │     ├── gauge-chart.tsx            (SVG, no external lib)
        │     ├── customer-retention-chart.tsx (Recharts PieChart)
        │     ├── orders-status-chart.tsx    (Recharts BarChart)
        │     ├── inventory-summary.tsx      (custom table)
        │     ├── top-customers-chart.tsx    (Recharts BarChart)
        │     ├── garment-type-revenue-chart.tsx (Recharts BarChart)
        │     ├── revenue-chart.tsx          (Recharts BarChart)
        │     └── revenue-forecast-chart.tsx (Recharts AreaChart)
        │
        ├── inventory-manager-dashboard.tsx
        │     ├── stock-comparison-chart.tsx (Recharts BarChart)
        │     ├── revenue-chart.tsx          (reused)
        │     └── pending-pos-dialog.tsx     (GET /api/purchase-orders)
        │
        ├── sales-manager-dashboard.tsx
        │     ├── production-pipeline-chart.tsx (Recharts FunnelChart)
        │     ├── top-fabrics-chart.tsx      (Recharts BarChart)
        │     ├── sales-orders-dialog.tsx    (GET /api/orders)
        │     └── top-customers-chart.tsx    (reused)
        │
        └── tailor-dashboard.tsx
              ├── radial-progress.tsx        (pure SVG, props only)
              ├── workload-chart.tsx         (Recharts BarChart)
              ├── deadline-list.tsx          (props only)
              ├── order-list-dialog.tsx      (props only — list in dialog)
              └── workload-details-dialog.tsx (props only)
```

---

## 25. Data Flow: New Order (Full Trace)

This traces every system call from clicking "New Order" to the order appearing in the database.

```
1. USER CLICKS "New Order" button
   └── components/auth/permission-guard.tsx checks: hasPermission(role, 'create_order')
   └── Browser navigates to /orders/new

2. PAGE LOADS: app/(dashboard)/orders/new/page.tsx
   └── Suspense boundary with loading spinner
   └── Renders: NewOrderForm component (client component)

3. CLIENT COMPONENT MOUNTS — parallel API calls:
   ├── GET /api/customers
   │     └── prisma.customer.findMany({ where: { active: true }, orderBy: { name: 'asc' } })
   │     └── Returns: Customer[] (id, name, phone, email)
   │
   ├── GET /api/garment-patterns
   │     └── prisma.garmentPattern.findMany({
   │           where: { active: true },
   │           include: { accessories: { include: { accessory: true } } }
   │         })
   │     └── Returns: GarmentPattern[] with default accessories per pattern
   │
   ├── GET /api/inventory/cloth
   │     └── prisma.clothInventory.findMany({ where: { active: true } })
   │     └── Returns: ClothInventory[] (name, color, colorHex, pricePerMeter, currentStock, reserved)
   │
   └── GET /api/inventory/accessories
         └── prisma.accessoryInventory.findMany({ where: { active: true } })
         └── Returns: AccessoryInventory[]

4. STEP 1 — Customer selected via CustomerSelector searchable combobox
   └── components/orders/customer-selector.tsx (Phase 1)
   ├── Customer typed in combobox → filters Customer[] by name OR phone
   ├── On selection → GET /api/customers/[id] → fetches last order + measurements
   ├── Customer profile card shown (last order, measurement coverage per garment type)
   ├── "Repeat Last Order" → GET /api/orders/[lastOrderId] → onRepeatOrder() pre-fills Steps 2/3
   └── "Add new customer" → InlineNewCustomerForm → POST /api/customers → onNewCustomer()

5. STEP 2 — Items added (local state only)
   ├── addItem() → items.push({ garmentPatternId: '', clothInventoryId: '', bodyType: 'REGULAR', accessories: [] })
   ├── updateItem(index, 'garmentPatternId', patternId) → auto-loads default accessories from pattern
   └── calculateEstimate() → called on every state change:
         ├── For each item: estimatedMeters = (baseMeters + adjustment[bodyType]) * quantity
         ├── fabricCost += estimatedMeters * cloth.pricePerMeter
         ├── accessoriesCost += sum(accessory.pricePerUnit * quantity)
         ├── stitchingCost += pattern.{basic|premium|luxury}StitchingCharge
         ├── Apply premiums (rush, hand-stitch, etc.)
         ├── Apply wastage %
         ├── subTotal = all costs summed
         ├── gstAmount = subTotal * 0.12
         └── total = subTotal + gstAmount

6. STEP 3 — Details + Submit

7. handleSubmit() called:
   └── Client-side validation:
         if (!customerId) → error
         if (items.length === 0) → error
         if (isFabricCostOverridden && !fabricCostOverride) → error
   └── POST /api/orders with full payload

8. POST /api/orders — SERVER PROCESSING:
   └── app/api/orders/route.ts: POST handler
   ├── requirePermission('create_order')
   │     └── lib/api-permissions.ts: requirePermission()
   │           └── lib/auth.ts: auth() → JWT session
   │           └── lib/permissions.ts: hasPermission(role, 'create_order')
   │
   ├── Parse body: { customerId, deliveryDate, advancePaid, items, stitchingTier, premiums, overrides }
   │
   ├── Validate customer exists:
   │     └── prisma.customer.findUnique({ where: { id: customerId } })
   │
   ├── Load garmentPatterns for each item:
   │     └── prisma.garmentPattern.findMany({ where: { id: { in: patternIds } } })
   │
   ├── Load clothInventory for each item:
   │     └── prisma.clothInventory.findMany({ where: { id: { in: clothIds } } })
   │     └── Check available: currentStock - reserved >= estimatedMeters
   │           If not: return 400 "Insufficient stock for [fabricName]"
   │
   ├── Recalculate pricing server-side (don't trust client):
   │     └── lib/gst-utils.ts: calculateGST()
   │     └── Same formula as client calculateEstimate()
   │
   ├── Generate order number:
   │     └── lib/utils.ts: generateOrderNumber()
   │
   └── prisma.$transaction([
         // 1. Create the Order
         prisma.order.create({
           data: {
             orderNumber, customerId, userId: session.user.id,
             status: 'NEW', deliveryDate,
             totalAmount, subTotal, gstAmount, cgst, sgst,
             advancePaid, balanceAmount: total - advancePaid,
             fabricCost, accessoriesCost, stitchingCost,
             stitchingTier, isHandStitched, isRushOrder, ...
             items: {
               create: items.map(item => ({
                 garmentPatternId, clothInventoryId, bodyType,
                 estimatedMeters, pricePerUnit, totalPrice
               }))
             }
           }
         }),

         // 2. For each ClothInventory item → reserve stock
         ...items.map(item =>
           prisma.clothInventory.update({
             where: { id: item.clothInventoryId },
             data: { reserved: { increment: item.estimatedMeters } }
           })
         ),

         // 3. Log StockMovement for each cloth reservation
         ...items.map(item =>
           prisma.stockMovement.create({
             data: {
               clothInventoryId: item.clothInventoryId,
               orderId: newOrder.id,
               userId: session.user.id,
               type: 'ORDER_RESERVED',
               quantityMeters: item.estimatedMeters,
               balanceAfterMeters: cloth.currentStock - cloth.reserved - item.estimatedMeters
             }
           })
         ),

         // 4. For each accessory → reserve stock
         ...accessories.flatMap(acc =>
           prisma.accessoryInventory.update({ reserved: { increment: acc.quantity } })
         ),

         // 5. Log AccessoryStockMovement
         prisma.accessoryStockMovement.createMany([...]),

         // 6. Create OrderHistory entry
         prisma.orderHistory.create({
           data: { orderId, userId, changeType: 'ORDER_CREATED', description: 'Order created' }
         })
       ])

9. RESPONSE: { order: { id, orderNumber } }
   └── Browser: router.push('/orders/' + order.id)
   └── User lands on Order Detail page

10. ASYNC (after response sent via next/server: after()):
    └── lib/generate-alerts.ts: generateAlerts()
          └── Checks if any cloth inventory now below minimum
          └── Creates/updates Alert records if stock is low
```

---

## 26. Data Flow: Stock Reservation & Release

```
LIFECYCLE OF CLOTH STOCK FOR ONE ORDER ITEM:

ORDER CREATED (status: NEW)
  prisma.clothInventory.update({ reserved: +estimatedMeters })
  prisma.stockMovement.create({ type: 'ORDER_RESERVED' })
  Result: currentStock unchanged, reserved INCREASES
  Available = currentStock - reserved (DECREASES — stock is "locked")

ORDER → DELIVERED (status change)
  prisma.clothInventory.update({
    currentStock: -actualMetersUsed,   ← physical stock consumed
    reserved: -estimatedMeters,         ← reservation released
  })
  prisma.stockMovement.create({ type: 'ORDER_USED', quantityMeters: -actualMetersUsed })
  Result: currentStock DECREASES, reserved DECREASES
  wastageMeters = actualMetersUsed - estimatedMeters (if positive, more was used than estimated)

ORDER → CANCELLED (status change)
  prisma.clothInventory.update({ reserved: -estimatedMeters })
  prisma.stockMovement.create({ type: 'ORDER_CANCELLED' })
  Result: currentStock unchanged, reserved DECREASES
  Available = currentStock - reserved (INCREASES — stock unlocked)

PURCHASE ORDER RECEIVED (PO status → RECEIVED)
  prisma.clothInventory.update({ currentStock: +receivedMeters })
  prisma.stockMovement.create({ type: 'PURCHASE', quantityMeters: +receivedMeters })
  Result: currentStock INCREASES
  Available = currentStock - reserved (INCREASES — new stock added)

INVENTORY ADJUSTMENT (manual correction)
  prisma.clothInventory.update({ currentStock: stockValue })
  prisma.stockMovement.create({ type: 'ADJUSTMENT' })
  Result: currentStock SET to new value
```

---

## Code Comments Standard (FeatureTrace Inline Documentation)

All new code added to this codebase should follow this comment standard to keep FeatureTrace current:

### API Route Comment Block

```typescript
/**
 * @featuretrace Order Creation
 * @route POST /api/orders
 * @permission create_order
 * @calls lib/gst-utils.ts:calculateGST, lib/utils.ts:generateOrderNumber
 * @writes Order, OrderItem, StockMovement, AccessoryStockMovement, OrderHistory
 * @reads Customer, GarmentPattern, ClothInventory, AccessoryInventory
 * @atomic prisma.$transaction — all writes succeed or all fail
 * @sideeffects ClothInventory.reserved increases, async alert generation
 */
export async function POST(req: Request) { ... }
```

### Component Comment Block

```typescript
/**
 * @featuretrace Order Status Update
 * @component OrderActions
 * @renders Status update buttons + confirmation dialog
 * @calls PATCH /api/orders/[id]/status
 * @reads order.status (from props)
 * @permissions update_order_status | update_order
 * @stateeffect Order status changes → triggers stock movement if DELIVERED/CANCELLED
 */
export function OrderActions({ order, permissions }: Props) { ... }
```

### Database Query Comment Block

```typescript
// @featuretrace Stock Reservation
// Reserves fabric for this order. Increments ClothInventory.reserved.
// Must be inside a $transaction — partial updates would corrupt stock counts.
// See: FEATURETRACE.md §25 for full lifecycle
await prisma.clothInventory.update({
  where: { id: clothInventoryId },
  data: { reserved: { increment: estimatedMeters } }
})
```

---

*This document should be updated whenever:*
- *A new API route is added*
- *A new DB model is created or modified*
- *A component's data source changes*
- *A permission is added or reassigned*

*Last updated: May 2026 (Phase 2: Excel VBA integration, Production Board, 22-field measurements, status tab bar, compact view)*
