# Accessory Tracking Feature - Dependency Map

## Overview
This document provides a visual dependency map (CodeSee-style) for the complete accessory tracking feature (v0.25.0), showing all interconnected files, data flows, and relationships.

---

## 🗺️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE LAYER                         │
├─────────────────────────────────────────────────────────────────────┤
│  - Dashboard (/dashboard)                                           │
│  - Inventory Page (/inventory)                                      │
│  - Order Creation (/orders/new)                                     │
│  - Order Detail (/orders/[id])                                      │
└────────────────────┬────────────────────────────────────────────────┘
                     │ HTTP Requests
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            API LAYER                                 │
├─────────────────────────────────────────────────────────────────────┤
│  - POST /api/orders              ──►  Reserve Accessories           │
│  - PATCH /api/orders/[id]/status ──►  Consume/Release Accessories   │
│  - GET /api/dashboard/enhanced-stats ──► Accessory Analytics        │
└────────────────────┬────────────────────────────────────────────────┘
                     │ Prisma ORM
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         DATABASE LAYER                               │
├─────────────────────────────────────────────────────────────────────┤
│  - AccessoryInventory (currentStock, reserved)                       │
│  - AccessoryStockMovement (audit trail)                             │
│  - GarmentAccessory (pattern → accessory linking)                   │
│  - Order, OrderItem (order data)                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Complete File Dependency Graph

```
prisma/schema.prisma ────────────────────────────────────────────┐
     │                                                            │
     │ defines models                                            │
     │                                                            │
     ├──► AccessoryInventory (currentStock, reserved, minimum)   │
     ├──► AccessoryStockMovement (audit trail)                   │
     ├──► GarmentAccessory (pattern → accessory link)            │
     └──► StockMovementType enum                                 │
     │                                                            │
     │ Prisma Client Generated                                   │
     ▼                                                            │
┌─────────────────────────────────────────────────────────┐       │
│                  API ROUTES                             │       │
├─────────────────────────────────────────────────────────┤       │
│                                                         │       │
│  app/api/orders/route.ts (POST)                        │       │
│  ├── Fetches GarmentAccessory for each order item      │       │
│  ├── Validates AccessoryInventory.available >= needed  │       │
│  ├── Updates AccessoryInventory.reserved += quantity   │       │
│  └── Creates AccessoryStockMovement (ORDER_RESERVED)   │       │
│                                                         │       │
│  app/api/orders/[id]/status/route.ts (PATCH)           │       │
│  ├── DELIVERED:                                         │       │
│  │   ├── Updates AccessoryInventory.currentStock -= qty│       │
│  │   ├── Updates AccessoryInventory.reserved -= qty    │       │
│  │   └── Creates AccessoryStockMovement (ORDER_USED)   │       │
│  └── CANCELLED:                                         │       │
│      ├── Updates AccessoryInventory.reserved -= qty    │       │
│      └── Creates AccessoryStockMovement (ORDER_CANCELLED)│     │
│                                                         │       │
│  app/api/dashboard/enhanced-stats/route.ts (GET)       │       │
│  ├── Fetches all AccessoryInventory items              │       │
│  ├── Calculates available = currentStock - reserved    │       │
│  ├── Determines low/critical stock status              │       │
│  └── Returns accessory analytics                       │       │
│                                                         │       │
│  app/api/inventory/accessories/route.ts (GET/POST)     │       │
│  └── CRUD operations for AccessoryInventory            │       │
│                                                         │       │
└─────────────────────────────────────────────────────────┘       │
     │                                                            │
     │ API responses                                             │
     ▼                                                            │
┌─────────────────────────────────────────────────────────┐       │
│                UI COMPONENTS                            │       │
├─────────────────────────────────────────────────────────┤       │
│                                                         │       │
│  components/InventoryPageClient.tsx                     │       │
│  ├── Fetches AccessoryInventory via API                │       │
│  ├── Calculates: available = currentStock - reserved   │       │
│  ├── Calls: getStockStatus(current, reserved, min)     │       │
│  ├── Displays: "X available (Y reserved)"              │       │
│  └── Reorder button: disabled if available > minimum   │       │
│                                                         │       │
│  components/dashboard/owner-dashboard.tsx               │       │
│  ├── Fetches dashboard stats from API                  │       │
│  ├── Displays accessory low/critical stock counts      │       │
│  └── Shows accessory total value and units             │       │
│                                                         │       │
│  app/(dashboard)/orders/new/page.tsx                    │       │
│  ├── Order creation form                               │       │
│  ├── Calls: POST /api/orders                           │       │
│  └── Triggers accessory reservation logic              │       │
│                                                         │       │
│  app/(dashboard)/orders/[id]/page.tsx                   │       │
│  ├── Order detail display                              │       │
│  ├── Status update calls: PATCH /api/orders/[id]/status│       │
│  └── Triggers accessory consumption/release            │       │
│                                                         │       │
└─────────────────────────────────────────────────────────┘       │
     │                                                            │
     │                                                            │
     ▼                                                            │
┌─────────────────────────────────────────────────────────┐       │
│                 SEED DATA / SCRIPTS                     │       │
├─────────────────────────────────────────────────────────┤       │
│                                                         │       │
│  prisma/seed.ts                                         │       │
│  ├── Creates sample order with shirt                   │       │
│  ├── Fetches GarmentAccessory for shirt pattern        │       │
│  ├── Reserves 10 buttons + 1 thread                    │       │
│  └── Creates AccessoryStockMovement records            │       │
│                                                         │       │
│  prisma/seed-complete.ts                                │       │
│  ├── Creates 232 orders across 7 months                │       │
│  ├── For each active order:                            │       │
│  │   ├── Fetches GarmentAccessory for patterns         │       │
│  │   ├── Reserves accessories (Map aggregation)        │       │
│  │   └── Creates AccessoryStockMovement records        │       │
│  └── Matches production API logic exactly              │       │
│                                                         │       │
│  scripts/export-to-excel.ts                             │       │
│  ├── Exports AccessoryInventory with reserved column   │       │
│  ├── Bulk upload template generation                   │       │
│  └── Includes notes on reserved field                  │       │
│                                                         │       │
└─────────────────────────────────────────────────────────┘       │
                                                                  │
                      ▲                                           │
                      │                                           │
                      └───────────────────────────────────────────┘
                           Uses Prisma Client
```

---

## 🔄 Data Flow Diagrams

### 1. Order Creation Flow (Accessory Reservation)

```
User Creates Order
       │
       ▼
[Order Creation Form] (/orders/new)
       │
       │ Selects: Customer, Garment Pattern, Fabric, Quantity
       ▼
POST /api/orders/route.ts
       │
       ├─► Query GarmentAccessory
       │   WHERE garmentPatternId = selectedPattern.id
       │   INCLUDE accessory
       │   ↓
       │   Returns: [{ accessoryId, quantityPerGarment }]
       │
       ├─► Calculate Total Needed
       │   quantityNeeded = quantityPerGarment × orderQuantity
       │   Aggregate by accessoryId (Map)
       │   ↓
       │   Example: Shirt × 2 = 20 buttons, 2 threads
       │
       ├─► Validate Stock
       │   FOR EACH accessory:
       │     available = accessory.currentStock - accessory.reserved
       │     IF available < quantityNeeded: RETURN 400 Error
       │   ↓
       │   All accessories available? Proceed.
       │
       ├─► START TRANSACTION
       │   │
       │   ├─► Create Order
       │   │   └─► Create OrderItems
       │   │
       │   ├─► FOR EACH accessory:
       │   │   │
       │   │   ├─► UPDATE AccessoryInventory
       │   │   │   SET reserved = reserved + quantityNeeded
       │   │   │   WHERE id = accessoryId
       │   │   │
       │   │   └─► CREATE AccessoryStockMovement
       │   │       SET type = ORDER_RESERVED
       │   │       SET quantity = -quantityNeeded (negative)
       │   │       SET balanceAfter = currentStock
       │   │       SET notes = "Order ORD-XXX - accessories reserved"
       │   │
       │   └─► COMMIT TRANSACTION
       │
       ▼
Return Order Created (200 OK)
       │
       ▼
[Order Detail Page] shows reserved accessories
[Inventory Page] shows reduced available stock
```

### 2. Order Delivery Flow (Accessory Consumption)

```
User Marks Order as DELIVERED
       │
       ▼
PATCH /api/orders/[id]/status/route.ts
       │ body: { status: "DELIVERED" }
       │
       ├─► Fetch Order
       │   INCLUDE accessoryStockMovements
       │   WHERE type = ORDER_RESERVED
       │   ↓
       │   Returns: [{ accessoryInventoryId, quantity }]
       │
       ├─► START TRANSACTION
       │   │
       │   ├─► FOR EACH reserved accessory:
       │   │   │
       │   │   ├─► UPDATE AccessoryInventory
       │   │   │   SET currentStock = currentStock - quantityReserved
       │   │   │   SET reserved = reserved - quantityReserved
       │   │   │   WHERE id = accessoryInventoryId
       │   │   │   ↓
       │   │   │   Example: 500 buttons → 490 buttons (10 consumed)
       │   │   │            10 reserved → 0 reserved
       │   │   │
       │   │   └─► CREATE AccessoryStockMovement
       │   │       SET type = ORDER_USED
       │   │       SET quantity = -quantityReserved (negative)
       │   │       SET balanceAfter = newCurrentStock
       │   │       SET notes = "Order ORD-XXX delivered - consumed"
       │   │
       │   ├─► UPDATE Order
       │   │   SET status = DELIVERED
       │   │   SET completedDate = NOW()
       │   │
       │   └─► COMMIT TRANSACTION
       │
       ▼
Return Order Updated (200 OK)
       │
       ▼
[Order Detail Page] shows DELIVERED status
[Inventory Page] shows reduced available & currentStock
[Dashboard] updates accessory low/critical counts
```

### 3. Order Cancellation Flow (Accessory Release)

```
User Cancels Order
       │
       ▼
PATCH /api/orders/[id]/status/route.ts
       │ body: { status: "CANCELLED" }
       │
       ├─► Fetch Order
       │   INCLUDE accessoryStockMovements
       │   WHERE type = ORDER_RESERVED
       │   ↓
       │   Returns: [{ accessoryInventoryId, quantity }]
       │
       ├─► START TRANSACTION
       │   │
       │   ├─► FOR EACH reserved accessory:
       │   │   │
       │   │   ├─► UPDATE AccessoryInventory
       │   │   │   SET reserved = reserved - quantityReserved
       │   │   │   WHERE id = accessoryInventoryId
       │   │   │   (currentStock remains unchanged)
       │   │   │   ↓
       │   │   │   Example: 500 stock, 10 reserved → 500 stock, 0 reserved
       │   │   │
       │   │   └─► CREATE AccessoryStockMovement
       │   │       SET type = ORDER_CANCELLED
       │   │       SET quantity = +quantityReserved (positive)
       │   │       SET balanceAfter = currentStock (unchanged)
       │   │       SET notes = "Order ORD-XXX cancelled - released"
       │   │
       │   ├─► UPDATE Order
       │   │   SET status = CANCELLED
       │   │
       │   └─► COMMIT TRANSACTION
       │
       ▼
Return Order Updated (200 OK)
       │
       ▼
[Order Detail Page] shows CANCELLED status
[Inventory Page] shows increased available stock
[Dashboard] updates accessory low/critical counts
```

### 4. Dashboard Analytics Flow

```
User Opens Dashboard
       │
       ▼
GET /api/dashboard/enhanced-stats/route.ts
       │
       ├─► Query AccessoryInventory
       │   SELECT currentStock, reserved, minimum, pricePerUnit
       │   ↓
       │   Returns: All accessory items
       │
       ├─► Calculate Metrics
       │   FOR EACH item:
       │     available = currentStock - reserved
       │     IF available < minimum × 0.5:
       │       criticalStock++
       │     ELSE IF available < minimum × 1.25:
       │       lowStock++
       │     totalValue += currentStock × pricePerUnit
       │     totalReserved += reserved
       │   ↓
       │   Aggregated metrics ready
       │
       ▼
Return {
  inventory: {
    accessories: {
      totalItems, totalUnits,
      totalReserved, totalValue,
      lowStock, criticalStock
    }
  }
}
       │
       ▼
[Dashboard] displays:
  - Accessory Inventory Summary Card
  - Low Stock Count (amber)
  - Critical Stock Count (red)
  - Total Value (formatted currency)
```

---

## 🔗 Cross-File Dependencies

### Database → APIs
```
prisma/schema.prisma
  ├──► app/api/orders/route.ts
  │    └── Uses: AccessoryInventory, GarmentAccessory, AccessoryStockMovement
  │
  ├──► app/api/orders/[id]/status/route.ts
  │    └── Uses: AccessoryInventory, AccessoryStockMovement
  │
  ├──► app/api/dashboard/enhanced-stats/route.ts
  │    └── Uses: AccessoryInventory
  │
  └──► app/api/inventory/accessories/route.ts
       └── Uses: AccessoryInventory
```

### APIs → UI Components
```
app/api/orders/route.ts (POST)
  └──► app/(dashboard)/orders/new/page.tsx
       └── Calls API on order creation

app/api/orders/[id]/status/route.ts (PATCH)
  └──► app/(dashboard)/orders/[id]/page.tsx
       └── Calls API on status update

app/api/dashboard/enhanced-stats/route.ts (GET)
  └──► components/dashboard/owner-dashboard.tsx
       └── Fetches stats on mount

app/api/inventory/accessories/route.ts (GET)
  └──► components/InventoryPageClient.tsx
       └── Fetches accessories with pagination
```

### Shared Utilities
```
lib/utils.ts
  ├──► getStockStatus(currentStock, reserved, minimum)
  │    └── Used by: InventoryPageClient.tsx (both cloth & accessories)
  │
  └──► formatCurrency(amount)
       └── Used by: Dashboard, Inventory, Order pages
```

### Type Definitions
```
lib/types.ts
  └──► StockMovementType enum
       ├── ORDER_RESERVED
       ├── ORDER_USED
       └── ORDER_CANCELLED
       └── Used by: All order-related APIs and components
```

---

## 📊 Data Entity Relationships

```
┌─────────────────────┐
│   GarmentPattern    │
│  (Shirt, Trouser)   │
└──────────┬──────────┘
           │ 1:many
           │
           ▼
┌─────────────────────────────┐      1:1       ┌──────────────────────┐
│    GarmentAccessory         │───────────────►│  AccessoryInventory  │
│  (Links pattern to items)   │                │  (Buttons, Thread)   │
│  - quantityPerGarment: 10   │                │  - currentStock: 500 │
└─────────────────────────────┘                │  - reserved: 10      │
                                                │  - minimum: 50       │
                                                └──────────┬───────────┘
                                                           │ 1:many
                                                           │
                                                           ▼
                                                ┌──────────────────────────┐
                                                │ AccessoryStockMovement   │
                                                │  (Audit Trail)           │
                                                │  - type: ORDER_RESERVED  │
                                                │  - quantity: -10         │
                                                │  - balanceAfter: 500     │
                                                │  - orderId: ord_123      │
                                                └──────────────────────────┘
                                                           ▲
                                                           │ many:1
                                                           │
┌─────────────────────┐      1:many     ┌─────────────────┴────────┐
│       Order         │────────────────►│      OrderItem           │
│  - orderNumber      │                 │  - garmentPatternId      │
│  - status           │                 │  - quantity: 1           │
└─────────────────────┘                 └──────────────────────────┘
```

### Stock Calculation Formula

```
Available Stock = currentStock - reserved

Status Determination:
  IF available < minimum × 0.5:
    STATUS = "CRITICAL" (red)
  ELSE IF available < minimum × 1.25:
    STATUS = "LOW_STOCK" (amber)
  ELSE:
    STATUS = "IN_STOCK" (green)

Reorder Button:
  DISABLED = (available > minimum)
  ENABLED = (available ≤ minimum)
```

---

## 🧩 Module Interaction Matrix

| Module | Creates | Reads | Updates | Deletes |
|--------|---------|-------|---------|---------|
| **Order Creation API** | AccessoryStockMovement | GarmentAccessory, AccessoryInventory | AccessoryInventory.reserved | - |
| **Order Status API (DELIVERED)** | AccessoryStockMovement | Order.accessoryStockMovements | AccessoryInventory.currentStock, AccessoryInventory.reserved | - |
| **Order Status API (CANCELLED)** | AccessoryStockMovement | Order.accessoryStockMovements | AccessoryInventory.reserved | - |
| **Dashboard API** | - | AccessoryInventory | - | - |
| **Inventory Page Component** | - | AccessoryInventory (via API) | - | - |
| **Seed Scripts** | AccessoryInventory, AccessoryStockMovement | GarmentAccessory | AccessoryInventory.reserved | - |

---

## 🚦 Critical Path Flows

### Path 1: Order Creation → Accessory Reservation
```
User Input → Order Form → POST /api/orders
  → Query GarmentAccessory
  → Validate AccessoryInventory
  → Transaction:
      └─► Update AccessoryInventory.reserved
      └─► Create AccessoryStockMovement
  → Return Success
  → Update UI (Inventory Page)
```

### Path 2: Order Delivery → Accessory Consumption
```
Status Update → PATCH /api/orders/[id]/status
  → Query Order.accessoryStockMovements
  → Transaction:
      └─► Update AccessoryInventory.currentStock
      └─► Update AccessoryInventory.reserved
      └─► Create AccessoryStockMovement (ORDER_USED)
  → Return Success
  → Update UI (Order Page, Inventory Page, Dashboard)
```

### Path 3: Order Cancellation → Accessory Release
```
Status Update → PATCH /api/orders/[id]/status
  → Query Order.accessoryStockMovements
  → Transaction:
      └─► Update AccessoryInventory.reserved
      └─► Create AccessoryStockMovement (ORDER_CANCELLED)
  → Return Success
  → Update UI (Order Page, Inventory Page, Dashboard)
```

---

## 🛡️ Error Handling & Validation Points

### 1. Order Creation Validation
```
Location: app/api/orders/route.ts (Lines 276-340)

Checks:
  ✓ GarmentAccessory exists for pattern
  ✓ AccessoryInventory exists for accessory
  ✓ available = currentStock - reserved
  ✓ available >= quantityNeeded
  ✗ Insufficient stock → 400 Error: "Insufficient {accessory.name} stock"
```

### 2. Order Status Update Validation
```
Location: app/api/orders/[id]/status/route.ts (Lines 20-25)

Checks:
  ✓ User has 'update_order_status' permission
  ✓ Order exists
  ✓ Status is valid enum value (Zod schema)
  ✗ Invalid status → 400 Error: "Validation failed"
  ✗ Unauthorized → 403 Error: "Forbidden"
```

### 3. Stock Calculation Safeguards
```
Location: components/InventoryPageClient.tsx (Line 1001)

Formula:
  available = item.currentStock - (item.reserved || 0)

Safeguard: `|| 0` prevents NaN if reserved is null/undefined
```

---

## 📈 Performance Considerations

### Database Queries
```
Order Creation (Per Order):
  - 1 query: Fetch GarmentAccessory (with INCLUDE)
  - 1 query: Validate AccessoryInventory (per unique accessory)
  - 1 transaction: Update + Create (batch)

  Optimization: Map aggregation reduces duplicate queries

Order Delivery/Cancellation:
  - 1 query: Fetch Order with accessoryStockMovements
  - 1 transaction: Update + Create (loop)

  Note: Could be optimized with batch updates (Prisma updateMany)

Dashboard Analytics:
  - 1 query: Fetch all AccessoryInventory
  - Client-side aggregation (fast)

  Optimization: Results could be cached (Redis)
```

### Transaction Isolation
```
All order operations use Prisma transactions:
  - Ensures atomicity (all-or-nothing)
  - Prevents race conditions
  - Maintains referential integrity

Example:
  await prisma.$transaction(async (tx) => {
    // All updates here are atomic
  })
```

---

## 🔍 Debugging Guide

### 1. Accessory Not Reserved
**Symptom**: Order created but accessory reserved = 0

**Check**:
1. `prisma/schema.prisma` - Does AccessoryInventory have `reserved` field?
2. `app/api/orders/route.ts` - Is `AccessoryInventory.update()` called?
3. Database: Run `SELECT reserved FROM "AccessoryInventory" WHERE id = 'xxx'`
4. Logs: Check for transaction errors

### 2. Dashboard Shows Wrong Stock
**Symptom**: Dashboard shows low stock but inventory page shows sufficient

**Check**:
1. `app/api/dashboard/enhanced-stats/route.ts` - Is calculation using `currentStock - reserved`?
2. Database: Compare `currentStock` vs `reserved` values
3. API response: Log `inventory.accessories` object
4. UI: Check `components/dashboard/owner-dashboard.tsx` rendering

### 3. Order Delivery Not Consuming Stock
**Symptom**: Order marked DELIVERED but accessory stock unchanged

**Check**:
1. `app/api/orders/[id]/status/route.ts` - Is DELIVERED block executing?
2. Database: Check if `AccessoryStockMovement` records exist with `ORDER_USED` type
3. Logs: Check for transaction failures
4. Permissions: Verify user has `update_order_status` permission

---

## 📝 Code Snippets for Common Operations

### Query Accessories for Pattern
```typescript
const garmentAccessories = await prisma.garmentAccessory.findMany({
  where: { garmentPatternId: patternId },
  include: { accessory: true },
})
```

### Calculate Total Accessory Needs
```typescript
const accessoryMap = new Map<string, number>()

for (const ga of garmentAccessories) {
  const needed = ga.quantityPerGarment * orderQuantity
  const current = accessoryMap.get(ga.accessoryId) || 0
  accessoryMap.set(ga.accessoryId, current + needed)
}
```

### Reserve Accessories (Transaction)
```typescript
await prisma.$transaction(async (tx) => {
  for (const [accessoryId, quantity] of accessoryMap.entries()) {
    await tx.accessoryInventory.update({
      where: { id: accessoryId },
      data: { reserved: { increment: quantity } },
    })

    await tx.accessoryStockMovement.create({
      data: {
        accessoryInventoryId: accessoryId,
        orderId: order.id,
        type: StockMovementType.ORDER_RESERVED,
        quantity: -quantity,
        // ... other fields
      },
    })
  }
})
```

---

## 🎯 Testing Entry Points

### Unit Testing
```
Test: Accessory Reservation Logic
Entry: app/api/orders/route.ts (Line 276)
Mock: GarmentAccessory query
Assert: AccessoryInventory.reserved incremented

Test: Stock Status Calculation
Entry: components/InventoryPageClient.tsx (Line 1001)
Input: currentStock=100, reserved=30, minimum=50
Assert: available=70, status="IN_STOCK"
```

### Integration Testing
```
Test: Complete Order Flow
1. POST /api/orders (reserve accessories)
2. PATCH /api/orders/[id]/status → DELIVERED (consume)
3. GET /api/inventory/accessories (verify stock reduced)
4. GET /api/dashboard/enhanced-stats (verify metrics updated)
```

---

## 📚 Related Documentation

- **Main Feature Docs**: `CLAUDE.md` (v0.25.0 section)
- **Update Checklist**: `docs/ACCESSORY_TRACKING_UPDATES_CHECKLIST.md`
- **Database Schema**: `prisma/schema.prisma`
- **API Reference**: See individual route files for endpoint documentation

---

*Document Version: 1.0*
*Created: January 24, 2026*
*Feature: Accessory Tracking v0.25.0*
*Author: Claude (AI Assistant)*
