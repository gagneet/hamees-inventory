-- Migration: Rename Ambiguous Fields to Explicit Names
-- Version: v0.26.0
-- Date: 2026-01-24
-- Description: Improves field name clarity by adding unit context and explicit naming

-- ===== ClothInventory =====
ALTER TABLE "ClothInventory"
RENAME COLUMN minimum TO "minimumStockMeters";

-- ===== AccessoryInventory =====
ALTER TABLE "AccessoryInventory"
RENAME COLUMN minimum TO "minimumStockUnits";

-- ===== OrderItem =====
ALTER TABLE "OrderItem"
RENAME COLUMN quantity TO "quantityOrdered";

ALTER TABLE "OrderItem"
RENAME COLUMN wastage TO "wastageMeters";

-- ===== StockMovement =====
ALTER TABLE "StockMovement"
RENAME COLUMN quantity TO "quantityMeters";

ALTER TABLE "StockMovement"
RENAME COLUMN "balanceAfter" TO "balanceAfterMeters";

-- ===== AccessoryStockMovement =====
ALTER TABLE "AccessoryStockMovement"
RENAME COLUMN quantity TO "quantityUnits";

ALTER TABLE "AccessoryStockMovement"
RENAME COLUMN "balanceAfter" TO "balanceAfterUnits";

-- ===== POItem =====
ALTER TABLE "POItem"
RENAME COLUMN quantity TO "orderedQuantity";

-- ===== PaymentInstallment =====
ALTER TABLE "PaymentInstallment"
RENAME COLUMN amount TO "installmentAmount";

-- Migration complete
-- All renamed fields now explicitly indicate their unit or purpose
