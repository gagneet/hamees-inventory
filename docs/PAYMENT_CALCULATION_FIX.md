# Payment Calculation Fix - Split Order Logic

**Date:** January 26, 2026
**Version:** v0.28.2
**Issue:** Balance calculation showing ₹0.00 instead of ₹37,058.93 after split order with discount

## Problem Analysis

### Symptoms
For Order ORD-1769338355430-738:
- Total Amount: ₹69,591.54
- Advance Paid: ₹29,371.15
- Discount: ₹3,161.46
- **Balance Due: ₹0.00** (WRONG - should be ₹37,058.93)

### Root Cause

**Balance Calculation Formula:**
```typescript
balanceAmount = totalAmount - discount - totalPaidInstallments
```

Where `totalPaidInstallments` is the sum of all `PaymentInstallment.paidAmount` where `status = 'PAID'`.

**Problem:** After split order, installments retain OLD paid amounts from before split.

Example:
- Original Order: Total ₹177,704.13, Advance ₹75,000.13
- After Split: Remaining Order Total ₹69,591.54
- **Expected:** Installment #1 should have `paidAmount = ₹29,371.15` (proportional)
- **Actual:** Installment #1 still has `paidAmount = ₹75,000.13` (old value!)

This causes `totalPaidInstallments` to be much higher than it should be, resulting in negative or zero balance.

## Payment Flow Architecture

### 1. Order Creation
```typescript
// app/api/orders/route.ts (lines 674-688)
if (advancePaid > 0) {
  await prisma.paymentInstallment.create({
    installmentNumber: 1,
    installmentAmount: totalAmount,  // Total order amount (commitment)
    paidAmount: advancePaid,         // Actual advance paid
    status: 'PAID'
  })
}
```

### 2. Balance Calculation
```typescript
// app/api/orders/[id]/route.ts (lines 126-140)
const paidInstallments = await prisma.paymentInstallment.aggregate({
  where: { orderId: id, status: 'PAID' },
  _sum: { paidAmount: true }
})
const totalPaidInstallments = paidInstallments._sum.paidAmount || 0
const balanceAmount = totalAmount - discount - totalPaidInstallments
```

**Key Point:** `Order.advancePaid` field is NOT used in balance calculation. Only installments are summed.

### 3. Split Order Logic
```typescript
// app/api/orders/[id]/split/route.ts

// Current logic (WRONG):
1. Proportionally split paid amounts:
   splitAdvance = originalAdvance × splitProportion
   remainingAdvance = originalAdvance - splitAdvance

2. Update installments with proportional amounts

// Correct logic (REQUIRED):
1. Keep advance with original order if possible:
   if (remainingTotal >= originalAdvance) {
     // Original order keeps full advance
     remainingAdvance = originalAdvance
     splitAdvance = 0
   } else {
     // Split advance only if remaining order < advance
     remainingAdvance = remainingTotal
     splitAdvance = originalAdvance - remainingTotal
   }
```

## Detailed Fix Plan

### Fix 1: Update Split Order Logic

**File:** `app/api/orders/[id]/split/route.ts`

**Current Code (Lines 177-194):**
```typescript
const paidAmounts = originalOrder.installments.map(inst => inst.paidAmount || 0)
const { split: splitPaidAmounts, remaining: remainingPaidAmounts } =
  allocatePaidAmounts(paidAmounts, splitProportion)

const splitAdvance = hasInstallments ? (splitPaidAmounts[0] || 0) : fallbackSplitAdvance
const remainingAdvance = hasInstallments ? (remainingPaidAmounts[0] || 0) : fallbackRemainingAdvance
```

**New Code:**
```typescript
// Calculate advance payment distribution
const originalAdvance = originalOrder.advancePaid
let splitAdvance = 0
let remainingAdvance = 0

if (originalAdvance > 0) {
  // Business Rule: Keep advance with original order unless it exceeds remaining total
  if (remainingTotalAmount >= originalAdvance) {
    // Original order keeps full advance
    remainingAdvance = originalAdvance
    splitAdvance = 0
  } else {
    // Split order gets the excess
    remainingAdvance = remainingTotalAmount
    splitAdvance = originalAdvance - remainingTotalAmount
  }

  // Round to 2 decimal places
  remainingAdvance = roundCurrency(remainingAdvance)
  splitAdvance = roundCurrency(splitAdvance)
}

// Recalculate paid amounts for all installments
const hasOtherPayments = originalOrder.installments.length > 1
let remainingPaidAmounts = [remainingAdvance]
let splitPaidAmounts = [splitAdvance]

if (hasOtherPayments) {
  // Handle additional installments (balance payments) proportionally
  const otherPayments = originalOrder.installments
    .slice(1)
    .map(inst => inst.paidAmount || 0)

  const { split: splitOther, remaining: remainingOther } =
    allocatePaidAmounts(otherPayments, splitProportion)

  remainingPaidAmounts = [remainingAdvance, ...remainingOther]
  splitPaidAmounts = [splitAdvance, ...splitOther]
}
```

### Fix 2: Update Balance Calculation Display

**File:** `app/(dashboard)/orders/[id]/page.tsx`

**Current Code (Lines 199-202):**
```typescript
const balancePayments = order.installments
  .filter((i: OrderInstallment) => i.installmentNumber > 1 && i.status === 'PAID')
  .reduce((sum: number, i: OrderInstallment) => sum + i.paidAmount, 0)
```

**Issue:** This calculates "balance payments" (installments after #1) but doesn't verify correctness.

**Add Verification:**
```typescript
// Calculate total paid from installments
const totalPaidFromInstallments = order.installments
  .filter((i: OrderInstallment) => i.status === 'PAID')
  .reduce((sum: number, i: OrderInstallment) => sum + i.paidAmount, 0)

// Verify consistency with advance paid
const advanceFromInstallment = order.installments
  .find((i: OrderInstallment) => i.installmentNumber === 1)?.paidAmount || 0

// Log warning if mismatch
if (Math.abs(advanceFromInstallment - order.advancePaid) > 0.01) {
  console.warn(`Order ${order.orderNumber}: Advance mismatch! ` +
    `Order.advancePaid = ₹${order.advancePaid.toFixed(2)}, ` +
    `Installment #1 = ₹${advanceFromInstallment.toFixed(2)}`)
}

const balancePayments = order.installments
  .filter((i: OrderInstallment) => i.installmentNumber > 1 && i.status === 'PAID')
  .reduce((sum: number, i: OrderInstallment) => sum + i.paidAmount, 0)
```

### Fix 3: Update Order.advancePaid Consistently

**Issue:** `Order.advancePaid` field and `PaymentInstallment[0].paidAmount` must stay in sync.

**Solution:** Update BOTH when installments change.

**File:** `app/api/orders/[id]/split/route.ts` (Lines 342-374)

**Add after installment updates:**
```typescript
// Update original order totals
await tx.order.update({
  where: { id },
  data: {
    // ... existing fields
    advancePaid: remainingAdvance,  // MUST match installment #1
    balanceAmount: roundCurrency(
      remainingTotalAmount - remainingDiscount - remainingPaidTotal
    ),
  },
})
```

## Testing Strategy

### Test Case 1: Split with Advance >= Remaining Total
```
Original Order:
- Total: ₹100,000
- Advance: ₹40,000
- Items: 4 items @ ₹25,000 each

Split: Remove 1 item (₹25,000)
Remaining: ₹75,000

Expected:
- Remaining Order: Total ₹75,000, Advance ₹40,000, Balance ₹35,000
- Split Order: Total ₹25,000, Advance ₹0, Balance ₹25,000
```

### Test Case 2: Split with Advance < Remaining Total
```
Original Order:
- Total: ₹100,000
- Advance: ₹80,000
- Items: 4 items @ ₹25,000 each

Split: Remove 3 items (₹75,000)
Remaining: ₹25,000

Expected:
- Remaining Order: Total ₹25,000, Advance ₹25,000, Balance ₹0
- Split Order: Total ₹75,000, Advance ₹55,000, Balance ₹20,000
```

### Test Case 3: Apply Discount After Split
```
After Split:
- Remaining Order: Total ₹69,591.54, Advance ₹29,371.15

Apply Discount: ₹3,161.46

Expected:
- Balance = ₹69,591.54 - ₹29,371.15 - ₹3,161.46 = ₹37,058.93
```

## Database Migration Script

```sql
-- Fix existing split orders with incorrect installment amounts
-- This finds orders where Order.advancePaid doesn't match installment #1

WITH mismatched_orders AS (
  SELECT
    o.id as order_id,
    o."orderNumber",
    o."advancePaid" as order_advance,
    pi."paidAmount" as installment_advance,
    pi.id as installment_id
  FROM "Order" o
  INNER JOIN "PaymentInstallment" pi
    ON pi."orderId" = o.id
    AND pi."installmentNumber" = 1
  WHERE ABS(o."advancePaid" - pi."paidAmount") > 0.01
)
UPDATE "PaymentInstallment"
SET "paidAmount" = mo.order_advance,
    "updatedAt" = NOW()
FROM mismatched_orders mo
WHERE "PaymentInstallment".id = mo.installment_id;

-- Recalculate balance amounts for all orders
UPDATE "Order" o
SET "balanceAmount" = (
  o."totalAmount" -
  o."discount" -
  COALESCE((
    SELECT SUM(pi."paidAmount")
    FROM "PaymentInstallment" pi
    WHERE pi."orderId" = o.id
      AND pi.status = 'PAID'
  ), 0)
),
"updatedAt" = NOW()
WHERE o.status NOT IN ('CANCELLED');
```

## Implementation Checklist

- [x] Analyze current payment calculation logic
- [x] Identify root cause (installments not updated during split)
- [ ] Update split order logic with new advance payment distribution
- [ ] Add verification logging for advance payment consistency
- [ ] Update balance calculation with proper rounding
- [ ] Create database migration script for existing data
- [ ] Update seed data with split order scenarios
- [ ] Verify Excel upload handles payments correctly
- [ ] Create comprehensive tests
- [ ] Document payment flow architecture
- [ ] Create git commits with detailed messages

## Next Steps

1. **Implement Fix**: Update `split/route.ts` with new logic
2. **Run Migration**: Fix existing orders in database
3. **Test Thoroughly**: Verify all test cases pass
4. **Deploy**: Build, restart PM2, verify production
5. **Monitor**: Check logs for any advance payment mismatches
