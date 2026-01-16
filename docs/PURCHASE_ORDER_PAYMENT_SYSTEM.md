# Purchase Order Payment System

**Version:** v0.14.0
**Date:** January 16, 2026
**Feature:** Separate payment tracking for Purchase Orders with complete closure workflow

## Overview

The Purchase Order payment system allows independent management of item receipt and payment transactions. A PO is only marked as "RECEIVED" (closed) when **both** all items are received AND full payment is made.

## Problem Solved

**Before:**
- Payments were only possible when receiving items
- Payment amount REPLACED existing payments (bug)
- PO marked "RECEIVED" when all items arrived, regardless of payment status
- No way to make payments separately from receiving items

**After:**
- Separate "Make Payment" functionality
- Payments ADD to existing balance (fixed bug)
- PO status considers BOTH items received AND payment complete
- Clear payment workflow with dedicated UI

## Status Logic

### PO Status Flow

```
PENDING → PARTIAL → RECEIVED
```

**PENDING:**
- No items received
- No payment made

**PARTIAL:**
- Some items received OR
- Some payment made OR
- All items received but payment pending OR
- All payment made but items pending

**RECEIVED:**
- All items fully received AND
- Full payment made (balance ≤ ₹0.01)

### Status Determination Code

```typescript
// Check if all items are received
const allItemsReceived = items.every((item) =>
  item.receivedQuantity >= item.quantity
)

// Check if payment is complete (allow floating point errors)
const paymentComplete = balanceAmount <= 0.01

// Determine status
if (allItemsReceived && paymentComplete) {
  status = 'RECEIVED' // Fully complete
} else if (anyItemsReceived || paidAmount > 0) {
  status = 'PARTIAL' // Partial completion
} else {
  status = 'PENDING' // Nothing done yet
}
```

## API Endpoints

### 1. Make Payment (New)

**Endpoint:** `POST /api/purchase-orders/[id]/payment`

**Permission:** `manage_inventory`

**Request Body:**
```json
{
  "amount": 50000.00,
  "paymentMode": "BANK_TRANSFER",
  "transactionRef": "TXN123456",
  "notes": "First installment payment"
}
```

**Response:**
```json
{
  "purchaseOrder": {
    "id": "po_123",
    "poNumber": "PO-2026-0001",
    "totalAmount": 100000.00,
    "paidAmount": 50000.00,
    "balanceAmount": 50000.00,
    "status": "PARTIAL",
    "notes": "...\n[16/01/2026] Payment: 50000.00 via BANK_TRANSFER - First installment payment",
    ...
  },
  "message": "Payment of 50000.00 recorded. Balance remaining: 50000.00"
}
```

**Validation:**
- Amount must be positive
- Amount cannot exceed `balanceAmount`
- Cannot pay on cancelled POs

**Payment Modes:**
- `CASH`
- `UPI`
- `CARD`
- `BANK_TRANSFER`
- `CHEQUE`
- `NET_BANKING`

### 2. Receive Items (Updated)

**Endpoint:** `POST /api/purchase-orders/[id]/receive`

**Permission:** `manage_inventory`

**Changes:**
- Payment amount now **ADDS** to existing `paidAmount` (was replacing)
- Status considers both items and payment
- Label changed to "Additional Payment (Optional)"

**Request Body:**
```json
{
  "items": [
    {
      "id": "item_1",
      "receivedQuantity": 100.0,
      "clothInventoryId": "cloth_123"
    }
  ],
  "paidAmount": 25000.00,  // Optional additional payment
  "notes": "First batch received"
}
```

**Behavior:**
```typescript
// OLD (Bug):
paidAmount = newPayment  // Replaced!

// NEW (Fixed):
paidAmount = existingPaidAmount + newPayment  // Added!
balanceAmount = totalAmount - paidAmount
```

## UI Components

### "Make Payment" Button

**Location:** PO detail page (`/purchase-orders/[id]`)

**Visibility:**
```typescript
{purchaseOrder.balanceAmount > 0 &&
 purchaseOrder.status !== 'CANCELLED' && (
  <Button variant="outline" onClick={openPaymentDialog}>
    <DollarSign className="mr-2 h-4 w-4" />
    Make Payment
  </Button>
)}
```

**Dialog Features:**
1. **Payment Summary Card** (Blue background)
   - Total Amount
   - Already Paid
   - Balance Due (red, bold)

2. **Payment Amount Input**
   - Pre-filled with full balance
   - Editable (can do partial payment)
   - Maximum: `balanceAmount`
   - Large, bold text for visibility

3. **Payment Mode Dropdown**
   - 6 payment methods
   - Default: CASH

4. **Transaction Reference** (Optional)
   - Text input for tracking
   - Examples: "TXN123456", "Cheque #456789"

5. **Notes** (Optional)
   - Textarea for additional info
   - Appended to PO notes with timestamp

### "Receive Items" Dialog (Updated)

**Changes:**
- Payment field labeled "Additional Payment (Optional)"
- Shows current balance due
- Default value: 0 (not pre-filled)
- Clarifies this is optional

## Workflows

### Workflow 1: Pay in Full After Receiving Items

```
1. Create PO (status: PENDING)
2. Receive all items (status: PARTIAL - items done, payment pending)
3. Click "Make Payment"
4. Enter full balance amount
5. Select payment mode
6. Record payment
→ Status: RECEIVED ✅
```

### Workflow 2: Partial Payments Over Time

```
1. Create PO for ₹100,000 (status: PENDING)
2. Receive all items (status: PARTIAL)
3. Make payment ₹40,000 (status: PARTIAL, balance: ₹60,000)
4. Make payment ₹30,000 (status: PARTIAL, balance: ₹30,000)
5. Make payment ₹30,000 (status: RECEIVED, balance: ₹0) ✅
```

### Workflow 3: Pay While Receiving (Mixed)

```
1. Create PO for ₹100,000 (status: PENDING)
2. Receive 50% items + pay ₹40,000 (status: PARTIAL)
3. Receive remaining 50% items (status: PARTIAL, balance: ₹60,000)
4. Make separate payment ₹60,000 (status: RECEIVED) ✅
```

### Workflow 4: Pay Before Receiving

```
1. Create PO for ₹100,000 (status: PENDING)
2. Make advance payment ₹50,000 (status: PARTIAL - payment done, items pending)
3. Receive all items (status: PARTIAL, balance: ₹50,000)
4. Make final payment ₹50,000 (status: RECEIVED) ✅
```

## Database Schema

**No schema changes required.** Uses existing fields:

```prisma
model PurchaseOrder {
  totalAmount   Float     // Total PO value
  paidAmount    Float     // Sum of all payments made
  balanceAmount Float     // totalAmount - paidAmount
  status        String    // PENDING | PARTIAL | RECEIVED | CANCELLED
  notes         String?   // Payment history appended here
}
```

**Payment History Format:**
```
[16/01/2026] Payment: 50000.00 via BANK_TRANSFER - First installment
[18/01/2026] Payment: 25000.00 via CASH - Second payment
[20/01/2026] Payment: 25000.00 via UPI - Final payment
```

## Testing Scenarios

### Test 1: Full Payment After Receipt
```bash
# Login as Inventory Manager
Email: inventory@hameesattire.com
Password: admin123

1. Open any PO with items received but balance > 0
2. Click "Make Payment"
3. Verify balance is pre-filled
4. Select "Bank Transfer"
5. Enter transaction ref: "TEST-001"
6. Click "Record Payment"
→ Expect: Status changes to "RECEIVED", balance = 0
```

### Test 2: Partial Payment
```bash
1. Open PO with balance ₹100,000
2. Click "Make Payment"
3. Change amount to ₹40,000
4. Record payment
→ Expect: Status stays "PARTIAL", balance = ₹60,000
5. Click "Make Payment" again
6. Pay remaining ₹60,000
→ Expect: Status changes to "RECEIVED"
```

### Test 3: Payment Validation
```bash
1. Open PO with balance ₹50,000
2. Click "Make Payment"
3. Try to pay ₹60,000 (exceeds balance)
→ Expect: Error "Payment amount exceeds balance amount"
4. Try to pay ₹-100 (negative)
→ Expect: Validation error
```

### Test 4: Cancelled PO Protection
```bash
1. Open CANCELLED PO
2. Verify "Make Payment" button is hidden
3. Try API call directly
→ Expect: 400 Error "Cannot make payment on cancelled PO"
```

## User Interface

### Payment Dialog Layout

```
┌─────────────────────────────────────┐
│ Make Payment                     ✕  │
│ Record payment for PO-2026-0001     │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ Total Amount    Already Paid    │ │
│ │ ₹100,000.00     ₹50,000.00      │ │
│ │ ─────────────────────────────── │ │
│ │ Balance Due: ₹50,000.00         │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Payment Amount *                    │
│ ┌─────────────────────────────────┐ │
│ │ 50000.00                        │ │
│ └─────────────────────────────────┘ │
│ Maximum: ₹50,000.00                 │
│                                     │
│ Payment Mode *                      │
│ ┌─────────────────────────────────┐ │
│ │ Cash                        ▼   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Transaction Reference               │
│ ┌─────────────────────────────────┐ │
│ │ TXN123456                       │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Notes                               │
│ ┌─────────────────────────────────┐ │
│ │ First installment payment       │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│             [Cancel] [Record Payment]│
└─────────────────────────────────────┘
```

### Color Coding

- **Total Amount:** Slate (neutral)
- **Already Paid:** Green (positive)
- **Balance Due:** Red, Bold (attention needed)
- **Payment Amount Input:** Large text (₹50,000.00)

## Permission Requirements

**Required Permission:** `manage_inventory`

**Roles with Access:**
- ✅ OWNER
- ✅ ADMIN
- ✅ INVENTORY_MANAGER
- ❌ SALES_MANAGER
- ❌ TAILOR
- ❌ VIEWER

## Error Handling

**Payment Amount Exceeds Balance:**
```json
{
  "error": "Payment amount (60000.00) exceeds balance amount (50000.00)"
}
```

**Payment on Cancelled PO:**
```json
{
  "error": "Cannot make payment on cancelled purchase order"
}
```

**Validation Errors:**
```json
{
  "error": "Validation failed",
  "details": [
    {
      "code": "too_small",
      "minimum": 0,
      "path": ["amount"],
      "message": "Number must be greater than 0"
    }
  ]
}
```

## Audit Trail

All payment activities are logged in PO notes:

```
Original PO notes...

[16/01/2026] Payment: 40000.00 via BANK_TRANSFER - First installment
[18/01/2026] Payment: 30000.00 via UPI - Second payment
[20/01/2026] Payment: 30000.00 via CASH - Final settlement
```

**Format:**
```
[DD/MM/YYYY] Payment: {amount} via {mode}[ - {notes}]
```

## Files Modified

**API Routes:**
- `app/api/purchase-orders/[id]/payment/route.ts` (NEW)
- `app/api/purchase-orders/[id]/receive/route.ts`

**UI Components:**
- `app/(dashboard)/purchase-orders/[id]/page.tsx`

**Lines Changed:**
- +190 lines added
- ~30 lines modified

## Future Enhancements

1. **Payment History Table:** Show all payments in a dedicated table
2. **Payment Receipts:** Generate PDF receipts for each payment
3. **Payment Reminders:** Alert when PO has items received but payment pending
4. **Payment Terms:** Add payment due dates and overdue tracking
5. **Bank Integration:** Auto-fetch transaction details from bank API
6. **Payment Approval:** Require manager approval for large payments
7. **Payment Refunds:** Support refund workflow for returned items

## Breaking Changes

**None.** This is a backward-compatible addition:
- Existing POs work as before
- Old payment workflow (via /receive) still works
- New payment endpoint is optional
- No database migration required

## Migration Guide

**For Existing POs with Items Received but Unpaid:**

1. Go to PO detail page
2. Notice status is "PARTIAL" (not "RECEIVED")
3. Click "Make Payment" button
4. Complete payment
5. Status updates to "RECEIVED"

**No data migration needed** - existing POs automatically use new status logic.

## Support

For issues or questions:
- Review this documentation
- Check PO detail page UI
- Verify permissions (manage_inventory required)
- Check browser console for errors
- Contact: gagneet@hamees.com
