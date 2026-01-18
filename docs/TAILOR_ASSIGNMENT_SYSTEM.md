# Tailor Assignment System (v0.19.0)

## Overview

The Tailor Assignment System enables granular workload distribution by allowing **each order item** to be assigned to a different tailor, while maintaining a **single order-level status** for simplified workflow management.

**Implementation Date:** January 18, 2026
**Version:** v0.19.0
**Status:** ✅ Production Ready

---

## Table of Contents

1. [Key Features](#key-features)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [API Reference](#api-reference)
5. [UI Components](#ui-components)
6. [Usage Guide](#usage-guide)
7. [Testing](#testing)
8. [Future Enhancements](#future-enhancements)

---

## Key Features

### ✅ **Per-Item Tailor Assignment**
- Assign different tailors to different items in the same order
- Example: Shirt → Tailor A, Trouser → Tailor B
- Flexible workload distribution across team members

### ✅ **Order-Level Status**
- Single status for entire order (NEW, CUTTING, STITCHING, etc.)
- Simplifies payment and delivery workflow
- Reduces complexity for customer-facing processes

### ✅ **Dynamic Assignment**
- Assign during order creation (optional)
- Change assignment anytime before order completion
- Unassign items if needed

### ✅ **Role Validation**
- Only users with TAILOR role can be assigned
- Prevents assigning non-tailor users
- Automatic validation at API level

### ✅ **Complete Audit Trail**
- All assignment changes logged in order history
- Track who assigned which tailor when
- Full transparency for management

---

## Architecture

### Design Philosophy: **Hybrid Approach**

```
┌─────────────────────────────────────┐
│           ORDER                     │
│  ┌─────────────────────────────┐   │
│  │ Status: STITCHING           │   │  ← Single status for entire order
│  │ Delivery Date: 2026-01-25   │   │
│  └─────────────────────────────┘   │
│                                     │
│  ORDER ITEMS:                       │
│  ┌─────────────────────────────┐   │
│  │ Item 1: Men's Shirt         │   │
│  │ Assigned: Ramesh Kumar      │   │  ← Individual tailor assignment
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ Item 2: Men's Trouser       │   │
│  │ Assigned: Suresh Singh      │   │  ← Different tailor
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Why Hybrid?

**✓ Tailor Assignment Per Item:**
- Natural workflow (different garments need different skills)
- Better workload distribution
- Prevents bottlenecks

**✓ Status at Order Level:**
- Simpler customer communication
- Single delivery date
- Unified payment process
- Less complex UI

**✓ Use "Split Order" When:**
- Items need different delivery dates
- Items have different priorities (URGENT vs NORMAL)
- Items need completely independent workflows

---

## Database Schema

### OrderItem Model Changes

```prisma
model OrderItem {
  id                String    @id @default(cuid())
  orderId           String
  garmentPatternId  String
  clothInventoryId  String
  measurementId     String?
  assignedTailorId  String?   // ← NEW FIELD

  // ... other fields

  // Relations
  order             Order     @relation(...)
  garmentPattern    GarmentPattern @relation(...)
  clothInventory    ClothInventory @relation(...)
  measurement       Measurement? @relation(...)
  assignedTailor    User?     @relation("OrderItemAssignedTailor", ...) // ← NEW RELATION
  designUploads     DesignUpload[]

  @@index([orderId])
  @@index([measurementId])
  @@index([assignedTailorId]) // ← NEW INDEX
}
```

### User Model Changes

```prisma
model User {
  // ... existing fields

  // Relations
  orders        Order[]
  // ... other relations
  assignedOrderItems OrderItem[] @relation("OrderItemAssignedTailor") // ← NEW RELATION
}
```

### Migration

**Schema Changes:**
- Added `assignedTailorId` field (nullable String)
- Added relation to User model
- Added index for query performance

**Migration Method:**
- Used `prisma db push` (development - no shadow database permission)
- Production: Use manual migration or direct schema update

**Backward Compatibility:**
- Field is nullable - existing orders work without changes
- No data migration required
- Existing order items have `assignedTailorId = null`

---

## API Reference

### 1. Create Order with Tailor Assignment

**Endpoint:** `POST /api/orders`

**Request Body:**
```json
{
  "customerId": "customer_123",
  "deliveryDate": "2026-01-25",
  "advancePaid": 5000,
  "items": [
    {
      "garmentPatternId": "pattern_shirt",
      "clothInventoryId": "cloth_cotton_blue",
      "quantity": 2,
      "bodyType": "REGULAR",
      "assignedTailorId": "user_tailor_ramesh" // ← Optional
    },
    {
      "garmentPatternId": "pattern_trouser",
      "clothInventoryId": "cloth_wool_black",
      "quantity": 1,
      "bodyType": "SLIM",
      "assignedTailorId": "user_tailor_suresh" // ← Different tailor
    }
  ]
}
```

**Response:** `201 Created`
```json
{
  "order": {
    "id": "ord_123",
    "orderNumber": "ORD-2026-01-0123",
    "items": [
      {
        "id": "item_1",
        "assignedTailorId": "user_tailor_ramesh"
      },
      {
        "id": "item_2",
        "assignedTailorId": "user_tailor_suresh"
      }
    ]
  }
}
```

**Validation:**
- `assignedTailorId` is optional (can be null)
- No automatic validation during creation (for performance)
- Invalid IDs will be caught during item edit

---

### 2. Update Order Item - Change Tailor Assignment

**Endpoint:** `PATCH /api/orders/{orderId}/items/{itemId}`

**Request Body:**
```json
{
  "assignedTailorId": "user_tailor_new"
}
```

**Or unassign:**
```json
{
  "assignedTailorId": null
}
```

**Response:** `200 OK`
```json
{
  "id": "item_123",
  "assignedTailorId": "user_tailor_new",
  "assignedTailor": {
    "id": "user_tailor_new",
    "name": "Ramesh Kumar",
    "email": "ramesh@hameesattire.com"
  }
}
```

**Validation:**
- User must exist
- User must have role `TAILOR`
- Cannot edit delivered/cancelled orders
- Creates audit trail in OrderHistory

**Error Responses:**

```json
// 400 - Invalid tailor
{
  "error": "Invalid tailor assignment"
}

// 400 - Not a tailor
{
  "error": "Assigned user must have TAILOR role"
}

// 400 - Order completed
{
  "error": "Cannot edit items for delivered or cancelled orders"
}
```

---

### 3. Fetch Tailors List

**Endpoint:** `GET /api/users?role=TAILOR`

**Response:** `200 OK`
```json
{
  "users": [
    {
      "id": "user_tailor_1",
      "name": "Ramesh Kumar",
      "email": "ramesh@hameesattire.com",
      "role": "TAILOR"
    },
    {
      "id": "user_tailor_2",
      "name": "Suresh Singh",
      "email": "suresh@hameesattire.com",
      "role": "TAILOR"
    }
  ]
}
```

**Permissions:**
- Requires: `view_orders`, `update_order`, or `manage_users`
- Returns only active users (`active: true`)
- Ordered by name (alphabetically)

---

### 4. Get Order Details with Assigned Tailors

**Endpoint:** `GET /api/orders/{orderId}` (via page render)

**Includes:**
```typescript
{
  items: {
    include: {
      assignedTailor: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  }
}
```

**Usage:** Order detail page (`/orders/[id]`) automatically fetches assigned tailors.

---

## UI Components

### 1. AssignTailorDialog Component

**Location:** `components/orders/assign-tailor-dialog.tsx`

**Props:**
```typescript
interface AssignTailorDialogProps {
  orderId: string
  itemId: string
  currentTailorId?: string
  currentTailorName?: string
  garmentName: string
}
```

**Features:**
- Fetches list of active TAILOR users on open
- Shows current assignment (if any)
- Dropdown with all available tailors
- "Unassigned" option to remove assignment
- Validates changes before submitting
- Auto-refreshes page on success

**Usage:**
```tsx
<AssignTailorDialog
  orderId={order.id}
  itemId={item.id}
  currentTailorId={item.assignedTailor?.id}
  currentTailorName={item.assignedTailor?.name}
  garmentName={item.garmentPattern.name}
/>
```

**Button Labels:**
- No assignment: "Assign Tailor"
- Has assignment: "Change Tailor"

---

### 2. Order Detail Page Integration

**Location:** `app/(dashboard)/orders/[id]/page.tsx`

**Display:**
```tsx
{/* Assigned Tailor Section */}
<div className="mt-3 pt-3 border-t border-slate-200">
  <div className="flex items-center justify-between">
    <div className="flex-1">
      <p className="text-sm font-medium text-slate-900 mb-1">
        Assigned Tailor
      </p>
      {item.assignedTailor ? (
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <User className="h-4 w-4 text-primary" />
          <span>{item.assignedTailor.name}</span>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Not assigned yet</p>
      )}
    </div>
    {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
      <AssignTailorDialog {...props} />
    )}
  </div>
</div>
```

**Visibility Rules:**
- Always visible: Assigned tailor display
- Conditionally visible: Assignment button
  - Hidden for DELIVERED orders
  - Hidden for CANCELLED orders
  - Visible for all other statuses

---

## Usage Guide

### Workflow 1: Assign Tailors During Order Creation

**Scenario:** Owner/Sales Manager creating new order

**Steps:**
1. Navigate to `/orders/new`
2. Select customer and add items
3. **Future Enhancement:** Add tailor dropdown per item (not yet in UI)
4. **Current:** Submit order, assign tailors afterward

**Note:** Order creation form doesn't have tailor assignment UI yet. This is planned for future enhancement.

---

### Workflow 2: Assign Tailors After Order Creation

**Scenario:** Order created, now distribute work

**Steps:**
1. Navigate to order detail page: `/orders/{orderId}`
2. Find the order item (e.g., Men's Shirt)
3. See "Assigned Tailor: Not assigned yet"
4. Click **"Assign Tailor"** button
5. Dialog opens with list of tailors
6. Select tailor from dropdown (e.g., "Ramesh Kumar")
7. Click **"Assign Tailor"**
8. Page refreshes, now shows "Assigned Tailor: Ramesh Kumar"

---

### Workflow 3: Reassign Tailor (Change Assignment)

**Scenario:** Tailor is sick/busy, need to reassign work

**Steps:**
1. Open order detail page
2. Find item showing "Assigned Tailor: Ramesh Kumar"
3. Click **"Change Tailor"** button
4. Dialog shows current assignment in blue info box
5. Select new tailor from dropdown (e.g., "Suresh Singh")
6. Click **"Assign Tailor"**
7. Page refreshes with new assignment

**Audit Trail:**
- Change is logged in OrderHistory
- Shows who made the change and when
- Visible in Order History section at bottom of page

---

### Workflow 4: Unassign Tailor

**Scenario:** Remove tailor assignment

**Steps:**
1. Click **"Change Tailor"** button
2. Select **"Unassigned"** from dropdown (first option)
3. Click **"Assign Tailor"**
4. Tailor assignment removed, shows "Not assigned yet"

---

### Workflow 5: View Tailor's Workload

**Scenario:** See what each tailor is working on

**Current:** Manual review of order detail pages

**Future Enhancement:** Tailor dashboard showing:
```
Ramesh Kumar's Workload:
├─ ORD-2026-01-0123 - Men's Shirt (CUTTING)
├─ ORD-2026-01-0125 - Men's Suit (STITCHING)
└─ ORD-2026-01-0127 - Sherwani (NEW)
```

---

## Testing

### Test Scenario 1: Assign Single Tailor

**Setup:**
- Create order with 1 item
- No tailor assigned

**Test:**
1. Open order detail page
2. Verify "Assigned Tailor: Not assigned yet"
3. Click "Assign Tailor"
4. Verify dialog opens with tailor list
5. Select a tailor
6. Click "Assign Tailor"
7. Verify page refreshes
8. Verify assigned tailor name appears
9. Verify button now says "Change Tailor"

**Expected Result:** ✅ Tailor successfully assigned

---

### Test Scenario 2: Assign Different Tailors to Different Items

**Setup:**
- Create order with 2 items (Shirt + Trouser)
- No tailors assigned

**Test:**
1. Open order detail page
2. Assign Tailor A to Item 1 (Shirt)
3. Verify Item 1 shows Tailor A
4. Assign Tailor B to Item 2 (Trouser)
5. Verify Item 2 shows Tailor B
6. Verify both assignments persist

**Expected Result:** ✅ Different tailors assigned to different items

---

### Test Scenario 3: Change Tailor Assignment

**Setup:**
- Order with item assigned to Tailor A

**Test:**
1. Open order detail page
2. Verify current assignment (Tailor A)
3. Click "Change Tailor"
4. Verify dialog shows current assignment in blue box
5. Select Tailor B
6. Click "Assign Tailor"
7. Verify assignment changed to Tailor B
8. Check OrderHistory for audit trail

**Expected Result:** ✅ Assignment changed, history logged

---

### Test Scenario 4: Unassign Tailor

**Setup:**
- Order with item assigned to Tailor A

**Test:**
1. Click "Change Tailor"
2. Select "Unassigned"
3. Click "Assign Tailor"
4. Verify shows "Not assigned yet"
5. Verify button says "Assign Tailor" (not "Change")

**Expected Result:** ✅ Assignment removed

---

### Test Scenario 5: Role Validation

**Setup:**
- User with role SALES_MANAGER (not TAILOR)

**Test:**
1. Try to assign SALES_MANAGER to order item via API:
   ```bash
   curl -X PATCH /api/orders/{orderId}/items/{itemId} \
     -d '{"assignedTailorId": "user_sales_manager_id"}'
   ```
2. Expect 400 error: "Assigned user must have TAILOR role"

**Expected Result:** ✅ Non-tailor users rejected

---

### Test Scenario 6: Delivered Order Restriction

**Setup:**
- Order with status DELIVERED

**Test:**
1. Open order detail page
2. Verify "Assign Tailor" button is NOT visible
3. Try API call to assign tailor
4. Expect 400 error: "Cannot edit items for delivered or cancelled orders"

**Expected Result:** ✅ Cannot edit completed orders

---

### Test Scenario 7: API Tailor Assignment During Order Creation

**Setup:**
- API client (Postman/curl)

**Test:**
```bash
curl -X POST /api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "customer_123",
    "deliveryDate": "2026-02-01",
    "items": [
      {
        "garmentPatternId": "pattern_shirt",
        "clothInventoryId": "cloth_cotton",
        "assignedTailorId": "user_tailor_ramesh"
      }
    ]
  }'
```

**Expected Result:** ✅ Order created with tailor pre-assigned

---

## Performance Considerations

### Database Queries

**Before (N+1 Query Issue):**
```typescript
// Fetching order
const order = await prisma.order.findUnique({ ... })

// For each item, fetching tailor separately (N queries)
for (const item of order.items) {
  const tailor = await prisma.user.findUnique({ where: { id: item.assignedTailorId } })
}
```

**After (Optimized with Include):**
```typescript
const order = await prisma.order.findUnique({
  include: {
    items: {
      include: {
        assignedTailor: {  // Single JOIN, no N+1
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    }
  }
})
```

**Performance Gain:**
- Before: 1 + N queries (N = number of items)
- After: 1 query with JOIN
- Example: 10 items = 11 queries → 1 query (10x faster)

### Index Optimization

**Added Index:**
```prisma
@@index([assignedTailorId])
```

**Query Performance:**
- Queries by tailor: `O(log N)` instead of `O(N)`
- Future dashboard queries: "Find all items assigned to Tailor X"
- Supports efficient filtering and sorting

---

## Security & Permissions

### Role-Based Access Control

**Who Can Assign Tailors:**
- **OWNER**: ✅ Full access
- **ADMIN**: ✅ Full access
- **SALES_MANAGER**: ✅ Can assign during order creation
- **INVENTORY_MANAGER**: ❌ No access
- **TAILOR**: ❌ Cannot assign themselves
- **VIEWER**: ❌ No access

**Permission Required:**
- `update_order` - To change tailor assignments
- Enforced at API level via `requireAnyPermission(['update_order'])`

### Validation Rules

1. **User Existence:**
   - Assigned user ID must exist in database
   - Returns 400 error if user not found

2. **Role Validation:**
   - Assigned user must have role = `TAILOR`
   - Prevents assigning customers, managers, or viewers

3. **Order Status:**
   - Cannot edit DELIVERED orders
   - Cannot edit CANCELLED orders
   - Prevents changes after completion

4. **Active Users Only:**
   - `/api/users?role=TAILOR` returns only `active: true`
   - Inactive tailors cannot be assigned

---

## Future Enhancements

### Phase 1: Enhanced Order Creation Form

**Feature:** Tailor dropdown during order creation

**UI Changes:**
```tsx
<OrderItemForm>
  <Select garmentPattern />
  <Select clothInventory />
  <Input quantity />
  <Select assignedTailor /> {/* NEW */}
</OrderItemForm>
```

**Benefit:** Assign tailors immediately instead of after creation

---

### Phase 2: Tailor Dashboard

**Feature:** Personalized dashboard for TAILOR role

**Displays:**
- My assigned items (all orders)
- Grouped by status (NEW, CUTTING, STITCHING, etc.)
- Filtered to show only my work
- Quick status update actions

**Query:**
```typescript
const myItems = await prisma.orderItem.findMany({
  where: {
    assignedTailorId: session.user.id,
    order: {
      status: { notIn: ['DELIVERED', 'CANCELLED'] }
    }
  },
  include: {
    order: true,
    garmentPattern: true,
    clothInventory: true
  }
})
```

---

### Phase 3: Workload Analytics

**Feature:** Management dashboard for workload distribution

**Metrics:**
- Items per tailor (current workload)
- Items completed per tailor (productivity)
- Average completion time per tailor
- Overloaded tailors (red alert)

**UI:**
```
Tailor Workload Summary:
┌─────────────────┬────────────┬───────────┬──────────┐
│ Tailor Name     │ Active     │ Completed │ Avg Time │
├─────────────────┼────────────┼───────────┼──────────┤
│ Ramesh Kumar    │ 5 items    │ 42 items  │ 3.2 days │
│ Suresh Singh    │ 8 items ⚠  │ 35 items  │ 4.1 days │
│ Vijay Sharma    │ 2 items    │ 28 items  │ 2.8 days │
└─────────────────┴────────────┴───────────┴──────────┘
```

---

### Phase 4: Auto-Assignment Algorithm

**Feature:** Automatic tailor assignment based on:
- Current workload (least busy tailor)
- Garment type expertise (shirt specialist, trouser specialist)
- Historical performance (fastest tailor for this type)

**Implementation:**
```typescript
async function autoAssignTailor(garmentType: string): Promise<string> {
  // 1. Fetch all tailors
  // 2. Count active items per tailor
  // 3. Check expertise (optional metadata)
  // 4. Select best match
  // 5. Return tailor ID
}
```

**Configuration:**
```typescript
// User metadata (future)
{
  "expertise": ["SHIRT", "TROUSER"],
  "maxConcurrentItems": 10
}
```

---

### Phase 5: WhatsApp Notifications

**Feature:** Notify tailors when items are assigned

**Trigger:** When `assignedTailorId` changes from null → value

**Message:**
```
Hello Ramesh,

You have been assigned a new item:
- Order: ORD-2026-01-0123
- Item: Men's Shirt (Blue Cotton)
- Delivery Date: 2026-01-25
- Customer: John Doe

Please check the dashboard for details.

- Hamees Attire
```

**Integration:** Use existing WhatsApp service (`lib/whatsapp/whatsapp-service.ts`)

---

### Phase 6: Per-Item Status (Advanced)

**Feature:** Track status per item instead of per order

**Schema Change:**
```prisma
model OrderItem {
  // ... existing fields
  itemStatus OrderStatus? // NEW (optional)
}
```

**Logic:**
- Order status = derived from item statuses
- If any item is STITCHING → Order shows "In Progress"
- If all items are DELIVERED → Order shows "Delivered"

**Complexity:** High (payment, delivery logic needs refactoring)

**Recommendation:** Only implement if absolutely necessary

---

## Troubleshooting

### Issue 1: "Assigned user must have TAILOR role"

**Cause:** Trying to assign a user who is not a tailor

**Solution:**
1. Verify user role: `SELECT role FROM "User" WHERE id = 'user_id'`
2. Create new TAILOR user or change existing user's role

---

### Issue 2: Assignment button not visible

**Cause 1:** Order is DELIVERED or CANCELLED

**Solution:** Cannot edit completed orders (by design)

**Cause 2:** Permissions issue

**Solution:** Ensure logged-in user has `update_order` permission

---

### Issue 3: No tailors in dropdown

**Cause:** No active users with TAILOR role

**Solution:**
1. Check: `SELECT * FROM "User" WHERE role = 'TAILOR' AND active = true`
2. Create TAILOR user via Admin Settings (`/admin/settings`)
3. Or update existing user: `UPDATE "User" SET role = 'TAILOR' WHERE email = '...'`

---

### Issue 4: Changes not reflecting

**Cause:** Page not refreshing after update

**Solution:**
- AssignTailorDialog automatically calls `router.refresh()`
- If stuck, manually refresh browser
- Check browser console for errors

---

### Issue 5: TypeScript errors after schema update

**Cause:** Prisma client not regenerated

**Solution:**
```bash
pnpm prisma generate
npm run build
```

---

## Rollback Plan

### If Issues Occur in Production

**Step 1: Revert Database Changes**
```sql
-- Remove assignedTailorId column
ALTER TABLE "OrderItem" DROP COLUMN "assignedTailorId";
```

**Step 2: Revert Code Changes**
```bash
git revert HEAD
git push origin master
pm2 restart hamees-inventory
```

**Step 3: Rebuild Application**
```bash
npm run build
pm2 restart hamees-inventory
```

**Data Safety:**
- No existing data is affected (field is nullable)
- No data loss on rollback
- Re-applying changes is safe

---

## Version History

### v0.19.0 (January 18, 2026)
- ✅ Initial release of Tailor Assignment System
- ✅ Database schema updated
- ✅ Order creation API supports tailor assignment
- ✅ Order item edit API supports tailor reassignment
- ✅ UI component for assignment dialog
- ✅ Order detail page integration
- ✅ Role validation (TAILOR only)
- ✅ Complete audit trail

### Planned v0.19.1
- 🔄 Add tailor assignment to order creation form UI
- 🔄 Tailor dashboard with "My Items" view
- 🔄 Workload analytics for management

### Planned v0.20.0
- 🔄 Auto-assignment algorithm
- 🔄 WhatsApp notifications for tailors
- 🔄 Workload balancing recommendations

---

## Support

**For Questions:**
- Technical Lead: Review this documentation
- Database Issues: Check `docs/SETUP.md`
- API Questions: See `docs/API_REFERENCE.md`

**For Bugs:**
- Create issue in project repository
- Include: Steps to reproduce, expected vs actual behavior, screenshots

**For Feature Requests:**
- Review "Future Enhancements" section
- Submit proposal with use case and priority

---

## Conclusion

The Tailor Assignment System provides **flexible workload distribution** while maintaining **simple order-level status** for payment and delivery workflows. This hybrid approach balances granular control with operational simplicity.

**Key Takeaways:**
- ✅ Each item can have a different tailor
- ✅ Order status remains unified
- ✅ Easy to assign, change, or unassign tailors
- ✅ Complete audit trail for all changes
- ✅ Role-based access control enforced
- ✅ Production-ready and tested

**Next Steps:**
1. Train staff on using "Assign Tailor" feature
2. Monitor usage and gather feedback
3. Plan Phase 2 enhancements (Tailor Dashboard)
4. Consider auto-assignment for high-volume shops

---

**Document Version:** 1.0
**Last Updated:** January 18, 2026
**Author:** Development Team
**Status:** Production Documentation
