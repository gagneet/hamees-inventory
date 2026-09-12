-- Fix Advance Payment Duplication Issue
-- Problem: Some orders have advance payment stored in BOTH Order.advancePaid AND PaymentInstallment #1
-- Solution: Remove installment #1 and keep advance ONLY in Order.advancePaid

-- Step 1: Identify orders with duplicate advance payments
SELECT
  o."orderNumber",
  o."advancePaid" as order_advance,
  pi."paidAmount" as installment_advance,
  CASE
    WHEN ABS(o."advancePaid" - pi."paidAmount") < 0.01 THEN 'DUPLICATE'
    ELSE 'MISMATCH'
  END as status
FROM "Order" o
INNER JOIN "PaymentInstallment" pi ON pi."orderId" = o.id
WHERE pi."installmentNumber" = 1
  AND o."advancePaid" > 0
ORDER BY o."orderNumber";

-- Step 2: Delete installment #1 (advance payment installments)
-- This removes the duplicate storage while keeping Order.advancePaid
DELETE FROM "PaymentInstallment"
WHERE "installmentNumber" = 1
  AND EXISTS (
    SELECT 1 FROM "Order" o
    WHERE o.id = "PaymentInstallment"."orderId"
    AND o."advancePaid" > 0
  );

-- Step 3: Renumber remaining installments to start from 1
-- (Balance payments should be numbered 1, 2, 3... not 2, 3, 4...)
WITH renumbered AS (
  SELECT
    id,
    "orderId",
    ROW_NUMBER() OVER (PARTITION BY "orderId" ORDER BY "installmentNumber") as new_number
  FROM "PaymentInstallment"
)
UPDATE "PaymentInstallment" pi
SET "installmentNumber" = renumbered.new_number
FROM renumbered
WHERE pi.id = renumbered.id;

-- Step 4: Verify the fix
SELECT
  o."orderNumber",
  o."totalAmount",
  o."advancePaid",
  o.discount,
  COALESCE(SUM(pi."paidAmount"), 0) as installments_paid,
  (o."totalAmount" - o.discount - o."advancePaid" - COALESCE(SUM(pi."paidAmount"), 0)) as calculated_balance,
  o."balanceAmount" as stored_balance,
  CASE
    WHEN ABS((o."totalAmount" - o.discount - o."advancePaid" - COALESCE(SUM(pi."paidAmount"), 0)) - o."balanceAmount") < 0.01
    THEN '✅ CORRECT'
    ELSE '❌ WRONG'
  END as balance_status
FROM "Order" o
LEFT JOIN "PaymentInstallment" pi ON pi."orderId" = o.id
WHERE o."advancePaid" > 0
GROUP BY o.id
ORDER BY o."orderNumber";
