-- Fix Purchase Order and Outstanding Balance Calculations
-- Date: January 27, 2026
-- Version: v0.28.6

-- ============================================
-- PART 1: Fix Purchase Order Calculations
-- ============================================

-- Recalculate all PO totals based on POItem quantities × prices
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

-- Verify PO fixes
SELECT
  po."poNumber",
  po."subTotal" as stored_subtotal,
  SUM(poi."orderedQuantity" * poi."pricePerUnit") as calculated_subtotal,
  CASE
    WHEN ABS(po."subTotal" - SUM(poi."orderedQuantity" * poi."pricePerUnit")) < 0.01
    THEN 'CORRECT'
    ELSE 'MISMATCH'
  END as status
FROM "PurchaseOrder" po
JOIN "POItem" poi ON poi."purchaseOrderId" = po.id
GROUP BY po.id, po."poNumber", po."subTotal"
ORDER BY po."poNumber";

-- ============================================
-- PART 2: Fix Order Balance Calculations
-- ============================================

-- Identify orders with advance payment double-counted in installments
SELECT
  o."orderNumber",
  o."advancePaid",
  (SELECT pi."paidAmount"
   FROM "PaymentInstallment" pi
   WHERE pi."orderId" = o.id
   AND pi."installmentNumber" = 1
   LIMIT 1) as first_installment_amount,
  o."balanceAmount" as current_balance,
  (o."totalAmount" - o."advancePaid" - o.discount -
   COALESCE((SELECT SUM(pi2."paidAmount")
             FROM "PaymentInstallment" pi2
             WHERE pi2."orderId" = o.id
             AND pi2."installmentNumber" > 1), 0)) as correct_balance,
  (o."totalAmount" - o."advancePaid" - o.discount -
   COALESCE((SELECT SUM(pi2."paidAmount")
             FROM "PaymentInstallment" pi2
             WHERE pi2."orderId" = o.id
             AND pi2."installmentNumber" > 1), 0)) - o."balanceAmount" as difference
FROM "Order" o
WHERE o."advancePaid" > 0
  AND EXISTS (
    SELECT 1
    FROM "PaymentInstallment" pi
    WHERE pi."orderId" = o.id
    AND pi."installmentNumber" = 1
    AND pi."paidAmount" = o."advancePaid"
  );

-- Fix balance for orders with advance payment double-counted
-- Formula: totalAmount - advancePaid - discount - SUM(installments WHERE installmentNumber > 1)
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

-- Verify balance fixes
SELECT
  o."orderNumber",
  o.status,
  o."totalAmount",
  o."advancePaid",
  o.discount,
  (SELECT SUM(pi."paidAmount")
   FROM "PaymentInstallment" pi
   WHERE pi."orderId" = o.id
   AND pi."installmentNumber" > 1) as additional_installments,
  o."balanceAmount" as new_balance,
  CASE
    WHEN o.status = 'CANCELLED' THEN 'EXCLUDED'
    WHEN o."balanceAmount" > 0.01 THEN 'OUTSTANDING'
    WHEN o."balanceAmount" < -0.01 THEN 'OVERPAID'
    ELSE 'PAID'
  END as payment_status
FROM "Order" o
WHERE o."orderNumber" IN (
  'ORD-1769332602073-426',
  'ORD-1769338355430-738',
  'ORD-1769340093159-602',
  'ORD-1769327607178-935'
)
ORDER BY o."orderNumber";

-- Final verification: Total outstanding payments
SELECT
  SUM("balanceAmount") as total_outstanding
FROM "Order"
WHERE status != 'CANCELLED';

-- Expected result after fixes: ~₹91,093.32 (instead of ₹9,093.32)
