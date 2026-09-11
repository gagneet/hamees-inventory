-- Migration: Round all currency values to 2 decimal places
-- This migration updates existing records to ensure all monetary values have exactly 2 decimal places
-- Run this manually: psql -h localhost -U hamees_user -d tailor_inventory -f prisma/manual-sql/round-currency-values.sql

-- Orders table
UPDATE "Order" SET
  totalAmount = ROUND(totalAmount::numeric, 2),
  advancePaid = ROUND(advancePaid::numeric, 2),
  discount = ROUND(discount::numeric, 2),
  balanceAmount = ROUND(balanceAmount::numeric, 2),
  subTotal = ROUND(subTotal::numeric, 2),
  cgst = ROUND(cgst::numeric, 2),
  sgst = ROUND(sgst::numeric, 2),
  igst = ROUND(igst::numeric, 2),
  gstAmount = ROUND(gstAmount::numeric, 2),
  taxableAmount = ROUND(taxableAmount::numeric, 2)
WHERE
  totalAmount::text ~ '\.\d{3,}' OR
  advancePaid::text ~ '\.\d{3,}' OR
  discount::text ~ '\.\d{3,}' OR
  balanceAmount::text ~ '\.\d{3,}' OR
  subTotal::text ~ '\.\d{3,}' OR
  gstAmount::text ~ '\.\d{3,}';

-- PaymentInstallment table
UPDATE "PaymentInstallment" SET
  amount = ROUND(amount::numeric, 2),
  paidAmount = ROUND(paidAmount::numeric, 2)
WHERE
  amount::text ~ '\.\d{3,}' OR
  paidAmount::text ~ '\.\d{3,}';

-- OrderItem table
UPDATE "OrderItem" SET
  pricePerUnit = ROUND(pricePerUnit::numeric, 2),
  totalPrice = ROUND(totalPrice::numeric, 2),
  estimatedMeters = ROUND(estimatedMeters::numeric, 2),
  actualMetersUsed = CASE
    WHEN actualMetersUsed IS NOT NULL THEN ROUND(actualMetersUsed::numeric, 2)
    ELSE NULL
  END,
  wastage = CASE
    WHEN wastage IS NOT NULL THEN ROUND(wastage::numeric, 2)
    ELSE NULL
  END
WHERE
  pricePerUnit::text ~ '\.\d{3,}' OR
  totalPrice::text ~ '\.\d{3,}' OR
  estimatedMeters::text ~ '\.\d{3,}';

-- ClothInventory table
UPDATE "ClothInventory" SET
  currentStock = ROUND(currentStock::numeric, 2),
  reserved = ROUND(reserved::numeric, 2),
  minimum = ROUND(minimum::numeric, 2),
  pricePerMeter = ROUND(pricePerMeter::numeric, 2)
WHERE
  currentStock::text ~ '\.\d{3,}' OR
  reserved::text ~ '\.\d{3,}' OR
  minimum::text ~ '\.\d{3,}' OR
  pricePerMeter::text ~ '\.\d{3,}';

-- AccessoryInventory table
UPDATE "AccessoryInventory" SET
  currentStock = ROUND(currentStock::numeric, 2),
  minimum = ROUND(minimum::numeric, 2),
  pricePerUnit = ROUND(pricePerUnit::numeric, 2)
WHERE
  currentStock::text ~ '\.\d{3,}' OR
  minimum::text ~ '\.\d{3,}' OR
  pricePerUnit::text ~ '\.\d{3,}';

-- PurchaseOrder table
UPDATE "PurchaseOrder" SET
  totalAmount = ROUND(totalAmount::numeric, 2),
  paidAmount = ROUND(paidAmount::numeric, 2),
  balanceAmount = ROUND(balanceAmount::numeric, 2)
WHERE
  totalAmount::text ~ '\.\d{3,}' OR
  paidAmount::text ~ '\.\d{3,}' OR
  balanceAmount::text ~ '\.\d{3,}';

-- Expense table
UPDATE "Expense" SET
  amount = ROUND(amount::numeric, 2),
  gstAmount = ROUND(gstAmount::numeric, 2),
  totalAmount = ROUND(totalAmount::numeric, 2)
WHERE
  amount::text ~ '\.\d{3,}' OR
  gstAmount::text ~ '\.\d{3,}' OR
  totalAmount::text ~ '\.\d{3,}';

-- StockMovement table
UPDATE "StockMovement" SET
  quantity = ROUND(quantity::numeric, 2),
  balanceAfter = ROUND(balanceAfter::numeric, 2)
WHERE
  quantity::text ~ '\.\d{3,}' OR
  balanceAfter::text ~ '\.\d{3,}';

-- Print summary
DO $$
DECLARE
  orders_updated INTEGER;
  installments_updated INTEGER;
  orderitems_updated INTEGER;
BEGIN
  SELECT COUNT(*) INTO orders_updated FROM "Order";
  SELECT COUNT(*) INTO installments_updated FROM "PaymentInstallment";
  SELECT COUNT(*) INTO orderitems_updated FROM "OrderItem";

  RAISE NOTICE '✓ Currency values rounded to 2 decimal places';
  RAISE NOTICE '  - Orders: % total records', orders_updated;
  RAISE NOTICE '  - Payment Installments: % total records', installments_updated;
  RAISE NOTICE '  - Order Items: % total records', orderitems_updated;
  RAISE NOTICE '  - All monetary values now have exactly 2 decimal places';
END $$;
