# Dashboard Calculation Fixes (v0.28.6)

**Date:** January 27, 2026
**Status:** ✅ Production Ready

## Issues Fixed

### 1. Purchase Order Calculations (ALL 10 POs)

**Problem:** All Purchase Orders had incorrect `subTotal`, `gstAmount`, and `totalAmount` values in the database.

**Example - PO-2025-0010:**
- **Before:** ₹129,416.62 (WRONG)
- **After:** ₹18,801.17 (CORRECT)
- **Calculation:** 28.41m × ₹661.78/m = ₹18,801.17

**Root Cause:** Seed data generated incorrect totals. The POItem records had correct `orderedQuantity` and `pricePerUnit`, but the PurchaseOrder totals didn't match.

**Solution:**
- Recalculated all PO totals from POItem data
- Formula: `SUM(orderedQuantity × pricePerUnit)` for all items
- Applied 18% GST (9% CGST + 9% SGST)
- Updated `balanceAmount = totalAmount - paidAmount`

**Verification:**
```sql
SELECT
  po."poNumber",
  po."subTotal" as stored_subtotal,
  SUM(poi."orderedQuantity" * poi."pricePerUnit") as calculated_subtotal
FROM "PurchaseOrder" po
JOIN "POItem" poi ON poi."purchaseOrderId" = po.id
GROUP BY po.id, po."poNumber", po."subTotal";
```

All 10 POs now show CORRECT calculations.

---

### 2. Outstanding Payments (₹9,093.32 → ₹91,093.32)

**Problem:** Dashboard showed ₹9,093.32 outstanding payments instead of the correct ~₹90,000+.

**Root Cause:** Order ORD-1769327607178-935 had incorrect balance calculation due to advance payment being double-counted:
- **Advance Payment:** ₹82,000 (stored in `Order.advancePaid`)
- **First Installment:** ₹82,000 (SAME amount stored as PaymentInstallment #1)
- **Balance Calculation:** Subtracted ₹82,000 TWICE, resulting in -₹32,000 (negative balance)

**Before Fix:**
```
Order: ORD-1769327607178-935
Total Amount:    ₹133,969.81
Advance Paid:    ₹82,000
Discount:        ₹1,969.81
Balance (stored): -₹32,000 ❌ (WRONG - negative balance!)
```

**After Fix:**
```
Order: ORD-1769327607178-935
Total Amount:    ₹133,969.81
Advance Paid:    ₹82,000
Discount:        ₹1,969.81
Balance (stored): ₹50,000 ✅ (CORRECT)
```

**Impact on Dashboard:**
- **Before:** Total outstanding = ₹9,093.32
- **After:** Total outstanding = ₹91,093.32
- **Difference:** ₹82,000 (exactly the double-counted advance amount)

---

## Solution Implementation

### 1. Database Fixes (SQL Migration)

**File:** `prisma/migrations/fix_po_and_balance_calculations.sql`

**Part 1: Purchase Orders**
```sql
-- Recalculate all PO totals from POItem data
WITH po_calculations AS (
  SELECT
    po.id as po_id,
    SUM(poi."orderedQuantity" * poi."pricePerUnit") as correct_subtotal,
    SUM(poi."orderedQuantity" * poi."pricePerUnit") * 0.18 as correct_gst,
    SUM(poi."orderedQuantity" * poi."pricePerUnit") * 1.18 as correct_total
  FROM "PurchaseOrder" po
  JOIN "POItem" poi ON poi."purchaseOrderId" = po.id
  GROUP BY po.id
)
UPDATE "PurchaseOrder" po
SET
  "subTotal" = pc.correct_subtotal,
  "gstAmount" = pc.correct_gst,
  "cgst" = pc.correct_gst / 2,
  "sgst" = pc.correct_gst / 2,
  "totalAmount" = pc.correct_total,
  "balanceAmount" = pc.correct_total - po."paidAmount"
FROM po_calculations pc
WHERE po.id = pc.po_id;
```

**Part 2: Order Balances**
```sql
-- Fix balance for orders with advance payment double-counted
UPDATE "Order" o
SET "balanceAmount" = (
  o."totalAmount" - o."advancePaid" - o.discount -
  COALESCE((SELECT SUM(pi."paidAmount")
            FROM "PaymentInstallment" pi
            WHERE pi."orderId" = o.id
            AND pi."installmentNumber" > 1), 0)
)
WHERE o."advancePaid" > 0
  AND EXISTS (
    SELECT 1
    FROM "PaymentInstallment" pi
    WHERE pi."orderId" = o.id
    AND pi."installmentNumber" = 1
    AND pi."paidAmount" = o."advancePaid"
  );
```

**Affected Orders:**
1. ORD-1769332602073-426 (CANCELLED) - Balance unchanged (refund due)
2. ORD-1769338355430-738 (DELIVERED) - Balance unchanged (fully paid with additional payments)
3. ORD-1769340093159-602 (FINISHING) - Balance unchanged (correct calculation)
4. **ORD-1769327607178-935 (DELIVERED) - Balance FIXED: -₹32,000 → ₹50,000**

---

### 2. Code Fixes (Balance Calculation Logic)

**File:** `app/api/orders/[id]/route.ts`

**Problem:** Order update API didn't handle legacy orders with advance payment in both places.

**Solution:** Enhanced balance calculation to detect and exclude duplicate advance payments.

**Before:**
```typescript
const paidInstallments = await prisma.paymentInstallment.aggregate({
  where: {
    orderId: id,
  },
  _sum: {
    paidAmount: true,
  },
})
const totalPaidInstallments = paidInstallments._sum.paidAmount || 0

// This would subtract advance twice if it's in both places
const balanceAmount = parseFloat(
  (order.totalAmount - advancePaid - discount - totalPaidInstallments).toFixed(2)
)
```

**After:**
```typescript
// Check if first installment equals advance payment (legacy double-counting)
const firstInstallment = await prisma.paymentInstallment.findFirst({
  where: {
    orderId: id,
    installmentNumber: 1,
  },
  select: {
    paidAmount: true,
  },
})

const isAdvanceInInstallments =
  firstInstallment &&
  Math.abs(firstInstallment.paidAmount - advancePaid) < 0.01

// If advance is in installments, exclude it from sum (only count installments #2 onwards)
const paidInstallments = await prisma.paymentInstallment.aggregate({
  where: {
    orderId: id,
    ...(isAdvanceInInstallments ? { installmentNumber: { gt: 1 } } : {}),
  },
  _sum: {
    paidAmount: true,
  },
})
const totalPaidInstallments = paidInstallments._sum.paidAmount || 0

// Balance = Total - Advance - Discount - Balance Installments
// For legacy orders, advance is only counted once (excluded from installments sum)
const balanceAmount = parseFloat(
  (order.totalAmount - advancePaid - discount - totalPaidInstallments).toFixed(2)
)
```

**Key Changes:**
1. Detect if first installment equals advance payment (within 0.01 tolerance)
2. If detected, exclude first installment from aggregation (only sum installments #2 onwards)
3. This ensures advance is only counted once, preventing double-subtraction
4. Works for both legacy orders (advance in both places) and new orders (advance only in field)

---

## Background Context (v0.28.4)

The advance payment double-counting issue was first identified in v0.28.4 (January 27, 2026).

**System Design Decision:**
- **Advance payment should be stored ONLY in `Order.advancePaid` field**
- **NOT as first PaymentInstallment** (to avoid duplication)
- **Balance payments** (after advance) should be recorded as installments #1, #2, etc.

**Why This Approach:**
- ✅ Single source of truth (no duplication)
- ✅ Clear semantics ("Advance Paid" vs "Balance Installments")
- ✅ Simpler calculations (`Balance = Total - Advance - Discount - Installments`)
- ✅ No risk of double-counting
- ✅ Matches UI requirements (advance separate from installments)

**However, Legacy Data Issue:**
- Some old orders (from seed data) had advance in BOTH places
- This caused balance calculation to subtract advance TWICE
- Fix applied in this version handles both legacy and new data correctly

---

## Verification Results

### Purchase Orders - All Correct ✅

```sql
SELECT "poNumber", "subTotal", "totalAmount"
FROM "PurchaseOrder"
ORDER BY "poNumber";
```

| PO Number | SubTotal (₹) | Total (₹) | Status |
|-----------|-------------|-----------|--------|
| PO-2025-0001 | 12,429.02 | 14,666.26 | ✅ CORRECT |
| PO-2025-0002 | 10,624.71 | 12,537.16 | ✅ CORRECT |
| PO-2025-0003 | 23,440.56 | 27,659.87 | ✅ CORRECT |
| PO-2025-0004 | 21,934.83 | 25,883.10 | ✅ CORRECT |
| PO-2025-0005 | 16,496.66 | 19,466.06 | ✅ CORRECT |
| PO-2025-0006 | 13,676.39 | 16,138.14 | ✅ CORRECT |
| PO-2025-0007 | 26,244.38 | 30,968.36 | ✅ CORRECT |
| PO-2025-0008 | 8,096.47 | 9,553.83 | ✅ CORRECT |
| PO-2025-0009 | 18,263.25 | 21,550.63 | ✅ CORRECT |
| **PO-2025-0010** | **18,801.17** | **22,185.38** | **✅ FIXED** |

### Outstanding Payments - Correct Total ✅

```sql
SELECT SUM("balanceAmount") as total_outstanding
FROM "Order"
WHERE status <> 'CANCELLED';
```

**Result:** ₹91,093.32 ✅ (was ₹9,093.32 ❌)

### Individual Order Verification ✅

| Order Number | Status | Total (₹) | Advance (₹) | Discount (₹) | Balance (₹) | Status |
|--------------|--------|-----------|-------------|--------------|-------------|--------|
| ORD-1769327607178-935 | DELIVERED | 133,969.81 | 82,000 | 1,969.81 | 50,000 | ✅ FIXED |
| ORD-1769340093159-602 | FINISHING | 48,219.96 | 45,628.98 | 878.93 | 1,712.05 | ✅ CORRECT |
| ORD-1769338355430-738 | DELIVERED | 69,591.54 | 29,371.15 | 3,161.46 | 0.00 | ✅ CORRECT |
| ORD-1769332602073-426 | CANCELLED | 141,775.02 | 375,000 | 0 | -233,224.98 | ℹ️ OVERPAID |

---

## Dashboard Impact

All dashboard cards and charts now show correct values:

### Owner Dashboard:
- **Outstanding Payments Card:** Now shows ₹91,093.32 (was ₹9,093.32) ✅
- **Revenue Metrics:** Unchanged (correctly calculated from delivered orders)
- **Profit Calculations:** Unchanged (correctly based on revenue - expenses)

### Sales Manager Dashboard:
- **Order Pipeline:** Unchanged (status-based counts)
- **Revenue Forecast:** Unchanged (based on order totals)
- **Top Customers:** Unchanged (aggregation correct)

### Inventory Manager Dashboard:
- **Pending POs:** Unchanged (count correct)
- **Fast-Moving Fabrics:** Unchanged (usage-based)
- **PO Totals:** Now show correct amounts ✅

### Tailor Dashboard:
- **In Progress:** Unchanged (status-based)
- **Due Today:** Unchanged (date-based)
- **Overdue:** Unchanged (date comparison)

---

## Deployment

**Build Time:** 35.0 seconds
**TypeScript Errors:** 0
**PM2 Restart:** ✅ Successful
**Production URL:** https://hamees.gagneet.com

**Database Changes:**
- ✅ All 10 Purchase Orders recalculated
- ✅ 4 Orders with balance fixes (1 critical fix)
- ✅ Total outstanding: ₹91,093.32 (correct)

**Code Changes:**
- ✅ Enhanced balance calculation logic
- ✅ Handles both legacy and new data
- ✅ Prevents future double-counting issues

---

## Testing Checklist

- [x] Verify PO-2025-0010 shows ₹18,801.17 (not ₹129,416.62)
- [x] Verify ORD-1769327607178-935 shows ₹50,000 balance (not -₹32,000)
- [x] Verify total outstanding = ₹91,093.32 (not ₹9,093.32)
- [x] Test dashboard Outstanding Payments card shows correct value
- [x] Test PO detail pages show correct totals
- [x] Test order detail pages show correct balances
- [x] Verify new order creation doesn't create duplicate advance installment
- [x] Verify payment recording updates balance correctly

---

## Related Documentation

- **v0.28.4:** Payment System Separation Fix (Single Source of Truth)
- **v0.28.3:** Print Invoice Enhancements
- **v0.28.2:** Payment Installment Balance Fix (PARTIAL Status Support)
- **v0.28.1:** Balance Calculation Double-Counting Fix

---

## Future Enhancements

1. **Data Cleanup Script:** Remove first installment for all orders where it equals advance payment
2. **Migration Tool:** Convert legacy orders to new payment structure
3. **Validation Layer:** Prevent creation of installments that match advance payment
4. **Admin Dashboard:** Add financial health check to detect balance calculation anomalies

---

**Version:** v0.28.6
**Status:** ✅ Production Ready
**Deployment Date:** January 27, 2026
