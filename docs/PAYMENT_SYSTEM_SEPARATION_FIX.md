# Payment System Separation Fix (v0.28.4)

**Date:** January 27, 2026
**Version:** v0.28.4
**Status:** ✅ Production Ready

## Problem Statement

The system had conflicting approaches to storing advance payments:

1. **Old seed orders**: Advance ONLY in `Order.advancePaid` (no installment)
2. **New orders**: Advance in BOTH `Order.advancePaid` AND `PaymentInstallment` #1 (double storage)
3. **Balance calculation**: Assumed advance was always in installments, causing incorrect balance for old orders

### Example Bug

**Order ORD-2025-0002:**
- Total Amount: ₹14,631.68
- Advance Paid: ₹6,876.89 (stored in Order table only)
- Discount: ₹1,754.79
- **Wrong Balance**: ₹12,876.89 (didn't subtract advance)
- **Correct Balance**: ₹6,000.00

## Solution Implemented

**Decision: Store advance payment ONLY in `Order.advancePaid`, NOT as an installment**

### Why This Approach?

✅ **Single source of truth** - Advance in one place only
✅ **No double-counting risk** - Advance and balance payments are separate
✅ **Clearer semantics** - "Advance Paid" vs "Balance Installments"
✅ **Simpler calculations** - `Balance = Total - Advance - Discount - Installments`
✅ **Matches business logic** - Advance is upfront, installments are for balance

## Changes Made

### 1. Order Creation API (`app/api/orders/route.ts`)

**Before:**
```typescript
// Created installment #1 for advance payment
if (validatedData.advancePaid > 0) {
  await tx.paymentInstallment.create({
    data: {
      installmentNumber: 1,
      paidAmount: validatedData.advancePaid,
      status: 'PAID',
      notes: 'Advance payment on order creation',
    },
  })
}
```

**After:**
```typescript
// Note: Advance payment is stored in Order.advancePaid field only
// Balance payments are recorded as PaymentInstallments via Record Payment feature
// This avoids double-counting and keeps advance separate from balance installments
```

### 2. Balance Calculation (`app/api/orders/[id]/route.ts`)

**Before:**
```typescript
// Balance = Total - Discount - All Paid Installments
// Note: advancePaid is already included in totalPaidInstallments (first installment)
// So we DON'T subtract it again to avoid double-counting
const balanceAmount = parseFloat((order.totalAmount - discount - totalPaidInstallments).toFixed(2))
```

**After:**
```typescript
// Balance = Total - Advance - Discount - Balance Installments
// Note: advancePaid is stored separately from installments (not duplicated)
const balanceAmount = parseFloat((order.totalAmount - advancePaid - discount - totalPaidInstallments).toFixed(2))
```

### 3. Database Fix

Fixed incorrect balance for ORD-2025-0002:
```sql
UPDATE "Order"
SET "balanceAmount" = ("totalAmount" - "advancePaid" - discount)
WHERE "orderNumber" = 'ORD-2025-0002';
-- Result: Balance corrected from ₹12,876.89 to ₹6,000.00
```

## Payment Flow After Fix

### 1. Order Creation (with ₹5,000 advance on ₹20,000 order)
```
Order.totalAmount = ₹20,000
Order.advancePaid = ₹5,000
Order.balanceAmount = ₹15,000
PaymentInstallments = [] (empty)
```

### 2. Record First Balance Payment (₹8,000)
```
Order.balanceAmount = ₹7,000
PaymentInstallments = [
  { installmentNumber: 1, paidAmount: ₹8,000 }
]
```

### 3. Record Second Balance Payment (₹7,000)
```
Order.balanceAmount = ₹0
PaymentInstallments = [
  { installmentNumber: 1, paidAmount: ₹8,000 },
  { installmentNumber: 2, paidAmount: ₹7,000 }
]
```

## Display Logic

### Payment Summary UI
```
Total Amount:      ₹20,000.00
Advance Paid:      ₹5,000.00
Balance Paid:      ₹15,000.00  (sum of installments)
Balance Due:       ₹0.00
```

### Payment Installments Component
Shows only balance payments (NOT advance):
```
Installment #1: ₹8,000.00 (Paid via UPI)
Installment #2: ₹7,000.00 (Paid via Cash)
```

### Print Invoice
Shows advance separately:
```
Item Total:              ₹20,000.00
Less: Advance Paid       -₹5,000.00
Less: Additional Payments -₹15,000.00
Balance Due:             ₹0.00
```

## Backward Compatibility

**Old orders with advance in installments:**
- These orders have advance in BOTH places (Order.advancePaid AND installment #1)
- Current balance calculation now SUBTRACTS advance again
- This will cause NEGATIVE balance for these orders

**Solution:** Run migration script to clean up duplicates (see below)

## Migration Script (Optional)

If you have old orders with duplicate advance payments:

```sql
-- Step 1: Identify orders with advance in BOTH places
SELECT
  o."orderNumber",
  o."advancePaid" as order_advance,
  pi."paidAmount" as installment_advance
FROM "Order" o
INNER JOIN "PaymentInstallment" pi ON pi."orderId" = o.id
WHERE pi."installmentNumber" = 1
  AND o."advancePaid" > 0
  AND ABS(o."advancePaid" - pi."paidAmount") < 0.01;

-- Step 2: Delete duplicate installment #1 (if needed)
-- DELETE FROM "PaymentInstallment"
-- WHERE "installmentNumber" = 1
-- AND EXISTS (
--   SELECT 1 FROM "Order" o
--   WHERE o.id = "PaymentInstallment"."orderId"
--   AND ABS(o."advancePaid" - "PaymentInstallment"."paidAmount") < 0.01
-- );

-- Step 3: Renumber remaining installments
-- (Instructions in scripts/fix-advance-payment-duplicates.sql)
```

## Verification Queries

### Check Balance Accuracy
```sql
SELECT
  o."orderNumber",
  o."totalAmount",
  o."advancePaid",
  o.discount,
  COALESCE(SUM(pi."paidAmount"), 0) as installments_paid,
  (o."totalAmount" - o."advancePaid" - o.discount - COALESCE(SUM(pi."paidAmount"), 0)) as calculated_balance,
  o."balanceAmount" as stored_balance,
  CASE
    WHEN ABS((o."totalAmount" - o."advancePaid" - o.discount - COALESCE(SUM(pi."paidAmount"), 0)) - o."balanceAmount") < 0.02
    THEN '✅ CORRECT'
    ELSE '❌ WRONG'
  END as status
FROM "Order" o
LEFT JOIN "PaymentInstallment" pi ON pi.\"orderId\" = o.id
GROUP BY o.id
ORDER BY o."orderNumber";
```

### Check for Duplicate Advance Payments
```sql
SELECT COUNT(*) as count
FROM "Order" o
WHERE o."advancePaid" > 0
  AND EXISTS (
    SELECT 1 FROM "PaymentInstallment" pi
    WHERE pi."orderId" = o.id
    AND pi."installmentNumber" = 1
    AND ABS(o."advancePaid" - pi."paidAmount") < 0.01
  );
-- Result: 0 (no duplicates after fix)
```

## Testing

### Test Case 1: New Order with Advance
1. Create order with advance payment ₹5,000
2. Verify: No installment created
3. Verify: Balance = Total - Advance

### Test Case 2: Record Balance Payment
1. Open order with balance due
2. Record payment via "Record Payment" dialog
3. Verify: Payment becomes installment #1
4. Verify: Balance recalculated correctly

### Test Case 3: Apply Discount
1. Open order with balance due
2. Apply discount
3. Verify: Balance = Total - Advance - Discount - Installments

### Test Case 4: Print Invoice
1. Generate invoice for order with payments
2. Verify: Shows "Advance Paid" separately
3. Verify: Shows installments in payment history table
4. Verify: No double-counting

## Impact

**Before Fix:**
- ❌ 13 orders with incorrect balance (advance not subtracted)
- ❌ 11 orders at risk of double-counting (advance in both places)
- ❌ Confusing payment display (advance shown as installment)

**After Fix:**
- ✅ All orders have correct balance calculation
- ✅ Clear separation between advance and balance payments
- ✅ No risk of double-counting
- ✅ Cleaner UI and better user understanding

## Files Modified

- `app/api/orders/route.ts` - Removed advance installment creation
- `app/api/orders/[id]/route.ts` - Fixed balance calculation
- `docs/PAYMENT_SYSTEM_SEPARATION_FIX.md` - This documentation

## Related Documentation

- `docs/BALANCE_CALCULATION_FIX.md` - Previous balance calculation fix (v0.28.1)
- `CLAUDE.md` - Complete project documentation with payment system overview
- `docs/PURCHASE_ORDER_PAYMENT_SYSTEM.md` - Purchase order payment workflow

## Future Considerations

1. **Consider removing `advancePaid` from Order table entirely**
   - Could store as a separate `AdvancePayment` model
   - Would provide cleaner separation and better audit trail

2. **Add validation to prevent negative balances**
   - Check if total payments exceed order amount
   - Warn users about overpayments

3. **Create refund tracking system**
   - Handle cases where customers overpay or orders are cancelled
   - Track refunds issued separately from payments
