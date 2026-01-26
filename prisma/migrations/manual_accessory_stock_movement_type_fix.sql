-- Migration: Fix AccessoryStockMovement.type column to use proper enum
-- Date: 2026-01-26
-- Version: v0.27.6
-- Issue: Order status updates failing with "operator does not exist: text = StockMovementType"

-- Root Cause:
-- The AccessoryStockMovement.type column was created as 'text' instead of '"StockMovementType"' enum.
-- This caused Prisma queries to fail when comparing string literals to the column value.

-- Solution:
-- Alter the column type to use the StockMovementType enum.

ALTER TABLE "AccessoryStockMovement"
ALTER COLUMN type TYPE "StockMovementType"
USING type::"StockMovementType";

-- Verification query (run after migration):
-- \d "AccessoryStockMovement"
-- Expected output for type column:
-- type | "StockMovementType" | not null

-- Affected operations:
-- - Order status updates (all transitions)
-- - Accessory stock reservation (order creation)
-- - Accessory stock consumption (order delivery)
-- - Accessory stock release (order cancellation)
