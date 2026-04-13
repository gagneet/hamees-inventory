# API Routes

All API routes are under `app/api/`. Every protected endpoint calls `requireAnyPermission()` or `requirePermission()` from `lib/api-permissions.ts` as its first operation.

**Base URL:** `https://hamees.gagneet.com/api`

## Authentication

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET/POST | `/auth/[...nextauth]` | NextAuth.js handlers (signin, signout, session) | Public |

## Orders

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/orders` | `view_orders` | List orders with filters and pagination |
| POST | `/orders` | `create_order` | Create new order (reserves stock atomically) |
| GET | `/orders/[id]` | `view_orders` | Get single order with all relations |
| PATCH | `/orders/[id]` | `update_order` | Update order fields (discount, notes, advance) |
| DELETE | `/orders/[id]` | `delete_order` | Soft delete order |
| PATCH | `/orders/[id]/status` | `update_order_status` | Update order status (triggers stock effects) |
| POST | `/orders/[id]/payments` | `update_order` | Record balance payment (creates installment) |
| POST | `/orders/[id]/split` | `update_order` | Split multi-item order into two orders |
| PATCH | `/orders/[id]/items/[itemId]` | `update_order` OR `update_order_status` | Edit order item (fabric, garment) |

### GET /orders — Query Parameters

| Parameter | Type | Example | Description |
|-----------|------|---------|-------------|
| `status` | OrderStatus | `DELIVERED` | Filter by order status |
| `customerId` | string | `cmk...` | Filter by customer |
| `search` | string | `ORD-2026` | Search order number or customer name |
| `fabricId` | string | `cmk...` | Filter orders using specific fabric |
| `garmentPatternId` | string | `cmk...` | Filter by garment type |
| `minAmount` | number | `5000` | Minimum total amount |
| `maxAmount` | number | `50000` | Maximum total amount |
| `deliveryDateFrom` | date | `2026-01-01` | Delivery date range start |
| `deliveryDateTo` | date | `2026-12-31` | Delivery date range end |
| `isOverdue` | boolean | `true` | Only overdue orders |
| `balanceAmount` | filter | `gt:0` | Balance amount filter (operators: gt, gte, lt, lte, eq) |
| `page` | number | `1` | Page number (default: 1) |
| `limit` | number | `10` | Items per page (default: 10) |

### POST /orders — Request Body

```json
{
  "customerId": "string",
  "measurementId": "string (optional)",
  "deliveryDate": "2026-03-15",
  "priority": "NORMAL | URGENT",
  "advancePaid": 5000,
  "notes": "Customer special instructions",
  "stitchingTier": "BASIC | PREMIUM | LUXURY",
  "fabricWastagePercent": 10,
  "designerConsultationFee": 0,
  "isHandStitched": false,
  "isFullCanvas": false,
  "isRushOrder": false,
  "hasComplexDesign": false,
  "additionalFittings": 0,
  "hasPremiumLining": false,
  "items": [
    {
      "garmentPatternId": "string",
      "clothInventoryId": "string",
      "quantityOrdered": 1,
      "bodyType": "REGULAR",
      "assignedTailorId": "string (optional)",
      "accessories": [
        { "accessoryId": "string", "quantity": 10 }
      ]
    }
  ]
}
```

## Customers

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/customers` | `view_customers` | List customers with search and pagination |
| POST | `/customers` | `manage_customers` | Create new customer |
| GET | `/customers/[id]` | `view_customers` | Get customer with measurements and orders |
| PATCH | `/customers/[id]` | `manage_customers` | Update customer details |
| DELETE | `/customers/[id]` | `delete_customer` | Delete customer (only if no orders) |
| GET | `/customers/[id]/measurements` | `view_customers` | Get all measurements for customer |
| POST | `/customers/[id]/measurements` | `manage_measurements` | Add new measurement version |
| PATCH | `/customers/[id]/measurements/[measurementId]` | `manage_measurements` | Update measurement |
| DELETE | `/customers/[id]/measurements/[measurementId]` | `delete_measurement` | Delete measurement |
| GET | `/customers/returning` | `view_customers` | Customers with 3+ orders across different months |

### GET /customers — Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search by name or phone |
| `page` | number | Page number |
| `limit` | number | Items per page (default: 15) |

## Inventory — Cloth

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/inventory/cloth` | `view_inventory` | List cloth items with pagination |
| POST | `/inventory/cloth` | `add_inventory` | Create cloth item (auto-generates SKU) |
| GET | `/inventory/cloth/[id]` | `view_inventory` | Get single cloth item with stock movements |
| PATCH | `/inventory/cloth/[id]` | `manage_inventory` | Update cloth item + Phase 1 fields (creates StockMovement if stock changes) |
| DELETE | `/inventory/cloth/[id]` | `delete_inventory` | Delete cloth item |
| POST | `/inventory/cloth/[id]/adjust-stock` | `manage_inventory` | Manual stock adjustment (ADJUSTMENT/RETURN/WASTAGE) |
| GET | `/inventory/cloth/[id]/history` | `view_inventory` | Get stock movement history |
| GET | `/inventory/barcode` | `view_inventory` | Look up item by SKU/barcode |
| GET | `/inventory/low-stock` | `view_inventory` | Get low and critical stock items |

### GET /inventory/cloth — Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `lowStock` | boolean | Only items below minimum |
| `page` | number | Page number |
| `limit` | number | Items per page (default: 25) |

### GET /inventory/barcode

```
GET /api/inventory/barcode?barcode=CLT-COT-ABC-158925
```

Returns:
```json
{
  "found": true,
  "type": "cloth",
  "item": { /* ClothInventory record */ }
}
```
or
```json
{
  "found": false,
  "type": "accessory",
  "item": { /* AccessoryInventory record */ }
}
```
or
```json
{ "found": false, "barcode": "CLT-NOTFOUND-123" }
```

## Inventory — Accessories

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/inventory/accessories` | `view_inventory` | List accessories with pagination |
| POST | `/inventory/accessories` | `add_inventory` | Create accessory item (auto-generates SKU) |
| GET | `/inventory/accessories/[id]` | `view_inventory` | Get single accessory with movements |
| PATCH | `/inventory/accessories/[id]` | `manage_inventory` | Update accessory + Phase 1 fields |
| DELETE | `/inventory/accessories/[id]` | `delete_inventory` | Delete accessory |

## Suppliers

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/suppliers` | `view_suppliers` | List all suppliers |
| POST | `/suppliers` | `manage_suppliers` | Create supplier |
| GET | `/suppliers/[id]` | `view_suppliers` | Get supplier with price history |
| PATCH | `/suppliers/[id]` | `manage_suppliers` | Update supplier |
| DELETE | `/suppliers/[id]` | `manage_suppliers` | Soft delete supplier |

## Purchase Orders

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/purchase-orders` | `view_purchase_orders` | List POs with filters |
| POST | `/purchase-orders` | `manage_purchase_orders` | Create PO |
| GET | `/purchase-orders/[id]` | `view_purchase_orders` | Get PO with items |
| PATCH | `/purchase-orders/[id]` | `manage_purchase_orders` | Update PO |
| DELETE | `/purchase-orders/[id]` | `delete_purchase_order` | Delete PO |
| POST | `/purchase-orders/[id]/receive` | `manage_purchase_orders` | Mark items received (increments stock) |
| POST | `/purchase-orders/[id]/payment` | `manage_purchase_orders` | Record supplier payment |

### POST /purchase-orders/[id]/receive

Records arrival of ordered goods and increments inventory stock:
```json
{
  "items": [
    { "poItemId": "string", "receivedQuantity": 50 }
  ],
  "notes": "Received in good condition"
}
```

### POST /purchase-orders/[id]/payment

```json
{
  "amount": 50000,
  "paymentMode": "BANK_TRANSFER",
  "transactionRef": "TXN-2026-001",
  "notes": "First installment"
}
```

## Garment Patterns

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/garment-patterns` | `view_garment_types` | List all patterns |
| POST | `/garment-patterns` | `manage_garment_types` | Create pattern with accessories |
| GET | `/garment-patterns/[id]` | `view_garment_types` | Get pattern with accessories |
| PATCH | `/garment-patterns/[id]` | `manage_garment_types` | Update pattern |
| DELETE | `/garment-patterns/[id]` | `delete_garment_type` | Delete pattern |
| GET | `/garment-patterns/[id]/accessories` | `view_garment_types` | Get default accessories for garment |

## Expenses

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/expenses` | `view_expenses` | List expenses with filters |
| POST | `/expenses` | `manage_expenses` | Create expense (auto-calculates GST) |
| GET | `/expenses/[id]` | `view_expenses` | Get single expense |
| PATCH | `/expenses/[id]` | `manage_expenses` | Update expense (recalculates GST/total) |
| DELETE | `/expenses/[id]` | `delete_expenses` | Soft delete expense (active: false) |

### POST /expenses — Auto-calculation

```json
{
  "category": "MARKETING",
  "description": "Social media campaign",
  "amount": 10000,
  "gstRate": 18,
  "expenseDate": "2026-04-01",
  "vendorName": "Meta Platforms",
  "paymentMode": "BANK_TRANSFER"
}
```

API auto-calculates: `gstAmount = amount × gstRate / 100`, `totalAmount = amount + gstAmount`

## Dashboard

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/dashboard/enhanced-stats` | `view_dashboard` | All dashboard metrics for all roles |

Returns role-appropriate subset of:
```json
{
  "generalStats": {
    "orders": { "total", "pending", "thisMonth", "lastMonth", "growth" },
    "revenue": { "thisMonth", "lastMonth", "growth" },
    "outstanding": { "amount" }
  },
  "inventory": {
    "cloth": { "totalItems", "totalValue", "lowStockCount", "criticalStockCount" },
    "accessories": { "totalItems", "totalReserved", "lowStock", "criticalStock" },
    "lowStockItems": [...],
    "criticalStockItems": [...]
  },
  "tailor": {
    "inProgress": 5,
    "inProgressList": [...],
    "dueToday": 3,
    "dueTodayList": [...],
    "overdue": 2,
    "overdueList": [...],
    "workloadByGarment": [...]
  },
  "sales": {
    "newOrdersToday": 3,
    "newOrdersTodayList": [...],
    "readyForPickup": 5,
    "readyForPickupList": [...],
    "pendingOrdersList": [...],
    "revenueForecast": { "deliveredRevenue", "pendingRevenue", "forecastedRevenue" }
  }
}
```

## Reports

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/reports/financial?months=12` | `view_financial_reports` | P&L statement, revenue trends |
| GET | `/reports/expenses?months=6` | `view_expense_reports` | Expense breakdown by category |
| GET | `/reports/customers?months=12` | `view_customer_reports` | Customer analytics and CLV |

## Alerts

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/alerts` | `view_alerts` | List alerts with filters |
| POST | `/alerts/generate` | `manage_alerts` | Trigger alert generation scan |
| PATCH | `/alerts/[id]` | `manage_alerts` | Mark read, dismiss alert |

## Design Uploads

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/design-uploads` | `update_order` | Upload design file for order item |
| GET | `/design-uploads?orderItemId=[id]` | `view_orders` | List files for order item |
| GET | `/design-uploads/[id]` | `view_orders` | Download design file |
| DELETE | `/design-uploads/[id]` | `update_order` | Delete design file |

**Accepted file types:** image/jpeg, image/png, image/gif, image/webp, application/pdf
**Maximum size:** 10MB
**Storage:** Local filesystem at `/uploads/designs/`

## WhatsApp

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/whatsapp/send` | `manage_customers` OR `create_order` | Send message to customer |
| GET | `/whatsapp/templates` | `view_inventory` | List message templates |
| POST | `/whatsapp/templates` | `manage_settings` | Create message template |
| GET | `/whatsapp/history` | `view_orders` | View sent message history |

## Barcode / QR Code

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/barcode/generate` | `view_inventory` | Generate QR code for inventory item |
| GET | `/barcode/generate?data=[qr]` | `view_inventory` | Look up item by QR data |
| POST | `/barcode/label` | `view_inventory` | Generate printable 80mm × 40mm label HTML |

## Bulk Upload (ADMIN only)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/bulk-upload/download-template` | `bulk_upload` | Download Excel template with current data |
| POST | `/bulk-upload/preview` | `bulk_upload` | Validate upload without inserting |
| POST | `/bulk-upload/process` | `bulk_upload` | Process upload with duplicate handling |
| GET | `/bulk-upload/history` | `bulk_upload` | View upload history |

## Admin (ADMIN only)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/admin/users` | `manage_users` | List all users |
| POST | `/admin/users` | `manage_users` | Create user (hashes password, assigns role) |
| GET | `/admin/users/[id]` | `manage_users` | Get single user |
| PATCH | `/admin/users/[id]` | `manage_users` | Update user (name, email, role, active, optional password reset) |

## Payment Installments

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| DELETE | `/installments/[id]` | `delete_order` | Delete payment installment |

## Standard Response Format

### Success
```json
HTTP 200 OK
{ "data": ... }
```

### Created
```json
HTTP 201 Created
{ ...created_object }
```

### Validation Error
```json
HTTP 400 Bad Request
{ "error": "descriptive message" }
```

### Unauthorized
```json
HTTP 401 Unauthorized
{ "error": "Unauthorized" }
```

### Forbidden
```json
HTTP 403 Forbidden
{ "error": "Forbidden" }
```

### Not Found
```json
HTTP 404 Not Found
{ "error": "Not found" }
```

### Server Error
```json
HTTP 500 Internal Server Error
{ "error": "Internal server error" }
```
