-- Fix Split Order Payment Issue
-- Order ORD-1769338355430-738 was split into ORD-1769340093159-602
-- The payment installment was not properly split

BEGIN;

-- Get order IDs
\set original_id '(SELECT id FROM \"Order\" WHERE \"orderNumber\" = ''ORD-1769338355430-738'')'
\set split_id '(SELECT id FROM \"Order\" WHERE \"orderNumber\" = ''ORD-1769340093159-602'')'

-- 1. Update original order's installment to correct installmentAmount and paidAmount
UPDATE "PaymentInstallment"
SET
  "installmentAmount" = (SELECT "totalAmount" FROM "Order" WHERE "orderNumber" = 'ORD-1769338355430-738'),
  "paidAmount" = (SELECT "advancePaid" FROM "Order" WHERE "orderNumber" = 'ORD-1769338355430-738')
WHERE "orderId" = :original_id;

-- 2. Create installment on split order for its advance payment
INSERT INTO "PaymentInstallment" (
  id,
  "orderId",
  "installmentNumber",
  "installmentAmount",
  "dueDate",
  "paidDate",
  "paidAmount",
  "paymentMode",
  "transactionRef",
  status,
  notes,
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  :split_id,
  1,
  o."totalAmount",
  pi."dueDate",
  pi."paidDate",
  o."advancePaid",
  pi."paymentMode",
  pi."transactionRef",
  'PAID',
  'Advance payment from split of ORD-1769338355430-738',
  NOW(),
  NOW()
FROM "Order" o
CROSS JOIN "PaymentInstallment" pi
WHERE o."orderNumber" = 'ORD-1769340093159-602'
  AND pi."orderId" = :original_id
  AND NOT EXISTS (
    SELECT 1 FROM "PaymentInstallment"
    WHERE "orderId" = :split_id
  );

-- 3. Recalculate balances
UPDATE "Order"
SET "balanceAmount" = ROUND(CAST("totalAmount" - COALESCE(discount, 0) - "advancePaid" AS numeric), 2)
WHERE "orderNumber" IN ('ORD-1769338355430-738', 'ORD-1769340093159-602');

-- Verification
\echo '\n=== Verification ==='
SELECT
  "orderNumber",
  "totalAmount" as total,
  "advancePaid" as advance,
  discount,
  "balanceAmount" as balance,
  status
FROM "Order"
WHERE "orderNumber" IN ('ORD-1769338355430-738', 'ORD-1769340093159-602')
ORDER BY "orderNumber";

\echo '\n=== Installments ==='
SELECT
  o."orderNumber",
  pi."installmentNumber" as num,
  pi."installmentAmount" as amount,
  pi."paidAmount" as paid,
  pi.status
FROM "PaymentInstallment" pi
JOIN "Order" o ON pi."orderId" = o.id
WHERE o."orderNumber" IN ('ORD-1769338355430-738', 'ORD-1769340093159-602')
ORDER BY o."orderNumber", pi."installmentNumber";

COMMIT;
