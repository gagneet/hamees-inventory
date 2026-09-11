-- Fix Installment Amounts Migration
-- Updates installmentAmount to show balance due at time of payment

-- For first installments (installmentNumber = 1), set to total order amount
UPDATE "PaymentInstallment" pi
SET "installmentAmount" = o."totalAmount"
FROM "Order" o
WHERE pi."orderId" = o.id
  AND pi."installmentNumber" = 1;

-- For subsequent installments, we need to calculate running balance
-- This is more complex, so we'll show the query but manual intervention may be needed
-- For now, just ensure first installments are correct
