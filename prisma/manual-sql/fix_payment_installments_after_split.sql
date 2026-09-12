-- Fix Payment Installments After Split Orders
-- This migration fixes orders where Order.advancePaid doesn't match PaymentInstallment #1
-- Created: January 26, 2026
-- Issue: Split orders have incorrect installment amounts leading to wrong balance calculations

-- Step 1: Find and fix mismatched advance payments
-- Update installment #1 paidAmount to match Order.advancePaid
WITH mismatched_advance AS (
  SELECT
    o.id as order_id,
    o."orderNumber",
    o."totalAmount" as order_total,
    o."advancePaid" as order_advance,
    o."discount" as order_discount,
    pi.id as installment_id,
    pi."paidAmount" as installment_paid,
    pi."installmentAmount" as installment_amount,
    ABS(o."advancePaid" - pi."paidAmount") as difference
  FROM "Order" o
  INNER JOIN "PaymentInstallment" pi
    ON pi."orderId" = o.id
    AND pi."installmentNumber" = 1
  WHERE ABS(o."advancePaid" - pi."paidAmount") > 0.01
    AND o.status NOT IN ('CANCELLED')
)
UPDATE "PaymentInstallment"
SET
  "paidAmount" = ma.order_advance,
  "installmentAmount" = ma.order_total,
  "updatedAt" = NOW()
FROM mismatched_advance ma
WHERE "PaymentInstallment".id = ma.installment_id;

-- Step 2: Recalculate balance amounts for all affected orders
-- Balance = Total - Discount - Sum(PaidInstallments)
WITH order_payments AS (
  SELECT
    o.id as order_id,
    o."totalAmount",
    o."discount",
    o."balanceAmount" as current_balance,
    COALESCE(SUM(pi."paidAmount"), 0) as total_paid
  FROM "Order" o
  LEFT JOIN "PaymentInstallment" pi
    ON pi."orderId" = o.id
    AND pi.status = 'PAID'
  WHERE o.status NOT IN ('CANCELLED')
  GROUP BY o.id, o."totalAmount", o."discount", o."balanceAmount"
),
recalculated_balance AS (
  SELECT
    order_id,
    "totalAmount",
    "discount",
    total_paid,
    current_balance,
    ROUND(CAST("totalAmount" - "discount" - total_paid AS numeric), 2) as new_balance,
    ABS(ROUND(CAST("totalAmount" - "discount" - total_paid AS numeric), 2) - current_balance) as difference
  FROM order_payments
  WHERE ABS(ROUND(CAST("totalAmount" - "discount" - total_paid AS numeric), 2) - current_balance) > 0.01
)
UPDATE "Order"
SET
  "balanceAmount" = rb.new_balance,
  "updatedAt" = NOW()
FROM recalculated_balance rb
WHERE "Order".id = rb.order_id;

-- Step 3: Report on fixed orders
SELECT
  o."orderNumber",
  o."totalAmount" as total,
  o."advancePaid" as advance,
  o."discount",
  o."balanceAmount" as balance,
  COALESCE(SUM(pi."paidAmount"), 0) as total_paid_installments,
  COUNT(pi.id) as num_installments,
  CASE
    WHEN ABS(o."advancePaid" - pi_first."paidAmount") > 0.01 THEN '⚠️ ADVANCE MISMATCH'
    WHEN ABS(o."balanceAmount" - (o."totalAmount" - o."discount" - COALESCE(SUM(pi."paidAmount"), 0))) > 0.01 THEN '⚠️ BALANCE MISMATCH'
    ELSE '✓ OK'
  END as status
FROM "Order" o
LEFT JOIN "PaymentInstallment" pi
  ON pi."orderId" = o.id
  AND pi.status = 'PAID'
LEFT JOIN "PaymentInstallment" pi_first
  ON pi_first."orderId" = o.id
  AND pi_first."installmentNumber" = 1
WHERE o.status NOT IN ('CANCELLED')
GROUP BY o.id, o."orderNumber", o."totalAmount", o."advancePaid", o."discount", o."balanceAmount", pi_first."paidAmount"
ORDER BY
  CASE
    WHEN ABS(o."advancePaid" - pi_first."paidAmount") > 0.01 THEN 0
    WHEN ABS(o."balanceAmount" - (o."totalAmount" - o."discount" - COALESCE(SUM(pi."paidAmount"), 0))) > 0.01 THEN 1
    ELSE 2
  END,
  o."createdAt" DESC
LIMIT 20;
