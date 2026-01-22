-- Premium Pricing System Migration (v0.22.0)
-- Date: January 22, 2026
-- Description: Add itemized cost breakdown, workmanship premiums, and manual override fields

-- ============================================================================
-- PART 1: Create StitchingTier ENUM
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE "StitchingTier" AS ENUM ('BASIC', 'PREMIUM', 'LUXURY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

COMMENT ON TYPE "StitchingTier" IS 'Stitching quality tiers: BASIC (entry-level), PREMIUM (mid-range), LUXURY (high-end bespoke)';


-- ============================================================================
-- PART 2: Add Stitching Charge Fields to GarmentPattern
-- ============================================================================

-- Add basicStitchingCharge (default: 1500)
ALTER TABLE "GarmentPattern"
ADD COLUMN IF NOT EXISTS "basicStitchingCharge" DOUBLE PRECISION NOT NULL DEFAULT 1500;

COMMENT ON COLUMN "GarmentPattern"."basicStitchingCharge" IS 'Basic tier stitching charge (entry-level quality)';

-- Add premiumStitchingCharge (default: 3000)
ALTER TABLE "GarmentPattern"
ADD COLUMN IF NOT EXISTS "premiumStitchingCharge" DOUBLE PRECISION NOT NULL DEFAULT 3000;

COMMENT ON COLUMN "GarmentPattern"."premiumStitchingCharge" IS 'Premium tier stitching charge (mid-range quality)';

-- Add luxuryStitchingCharge (default: 5000)
ALTER TABLE "GarmentPattern"
ADD COLUMN IF NOT EXISTS "luxuryStitchingCharge" DOUBLE PRECISION NOT NULL DEFAULT 5000;

COMMENT ON COLUMN "GarmentPattern"."luxuryStitchingCharge" IS 'Luxury tier stitching charge (high-end bespoke quality)';


-- ============================================================================
-- PART 3: Add Premium Pricing Fields to Order Table
-- ============================================================================

-- Cost Breakdown Fields
ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "fabricCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

COMMENT ON COLUMN "Order"."fabricCost" IS 'Total fabric cost (excluding wastage)';

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "fabricWastagePercent" DOUBLE PRECISION NOT NULL DEFAULT 0;

COMMENT ON COLUMN "Order"."fabricWastagePercent" IS 'Fabric wastage percentage (10-15% typical for bespoke)';

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "fabricWastageAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

COMMENT ON COLUMN "Order"."fabricWastageAmount" IS 'Fabric wastage amount in rupees';

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "accessoriesCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

COMMENT ON COLUMN "Order"."accessoriesCost" IS 'Total accessories cost (buttons, thread, zipper, etc.)';

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "stitchingCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

COMMENT ON COLUMN "Order"."stitchingCost" IS 'Base stitching cost (before workmanship premiums)';

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "stitchingTier" "StitchingTier" NOT NULL DEFAULT 'BASIC';

COMMENT ON COLUMN "Order"."stitchingTier" IS 'Stitching quality tier: BASIC, PREMIUM, or LUXURY';

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "workmanshipPremiums" DOUBLE PRECISION NOT NULL DEFAULT 0;

COMMENT ON COLUMN "Order"."workmanshipPremiums" IS 'Total workmanship premiums (hand stitching, canvas, etc.)';

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "designerConsultationFee" DOUBLE PRECISION NOT NULL DEFAULT 0;

COMMENT ON COLUMN "Order"."designerConsultationFee" IS 'Designer consultation charges (style guidance, fabric selection)';


-- Workmanship Premium: Hand Stitching
ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "isHandStitched" BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN "Order"."isHandStitched" IS 'Hand stitching enabled (20-50 hours artisan work)';

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "handStitchingCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

COMMENT ON COLUMN "Order"."handStitchingCost" IS 'Hand stitching premium cost (+30-40% or fixed amount)';


-- Workmanship Premium: Full Canvas Construction
ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "isFullCanvas" BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN "Order"."isFullCanvas" IS 'Full canvas construction enabled (superior drape, 6 weeks crafting)';

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "fullCanvasCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

COMMENT ON COLUMN "Order"."fullCanvasCost" IS 'Full canvas construction cost (+₹3,000-₹5,000)';


-- Workmanship Premium: Rush Order
ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "isRushOrder" BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN "Order"."isRushOrder" IS 'Rush order enabled (<7 days delivery, priority scheduling)';

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "rushOrderCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

COMMENT ON COLUMN "Order"."rushOrderCost" IS 'Rush order premium cost (+50% of base cost)';


-- Workmanship Premium: Complex Design
ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "hasComplexDesign" BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN "Order"."hasComplexDesign" IS 'Complex design enabled (peak lapels, working buttonholes, special vents)';

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "complexDesignCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

COMMENT ON COLUMN "Order"."complexDesignCost" IS 'Complex design premium cost (+20-30% or fixed amount)';


-- Workmanship Premium: Additional Fittings
ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "additionalFittings" INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN "Order"."additionalFittings" IS 'Number of additional fittings (beyond standard 2 fittings)';

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "additionalFittingsCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

COMMENT ON COLUMN "Order"."additionalFittingsCost" IS 'Additional fittings cost (+₹1,500 per fitting)';


-- Workmanship Premium: Premium Lining
ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "hasPremiumLining" BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN "Order"."hasPremiumLining" IS 'Premium lining enabled (silk, custom monograms)';

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "premiumLiningCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

COMMENT ON COLUMN "Order"."premiumLiningCost" IS 'Premium lining cost (+₹2,000-₹5,000)';


-- Manual Override Fields: Fabric Cost
ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "isFabricCostOverridden" BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN "Order"."isFabricCostOverridden" IS 'Flag indicating fabric cost was manually overridden';

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "fabricCostOverride" DOUBLE PRECISION;

COMMENT ON COLUMN "Order"."fabricCostOverride" IS 'Manually overridden fabric cost (if different from calculated)';

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "fabricCostOverrideReason" TEXT;

COMMENT ON COLUMN "Order"."fabricCostOverrideReason" IS 'Mandatory reason for fabric cost override (audit trail)';


-- Manual Override Fields: Stitching Cost
ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "isStitchingCostOverridden" BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN "Order"."isStitchingCostOverridden" IS 'Flag indicating stitching cost was manually overridden';

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "stitchingCostOverride" DOUBLE PRECISION;

COMMENT ON COLUMN "Order"."stitchingCostOverride" IS 'Manually overridden stitching cost (if different from calculated)';

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "stitchingCostOverrideReason" TEXT;

COMMENT ON COLUMN "Order"."stitchingCostOverrideReason" IS 'Mandatory reason for stitching cost override (audit trail)';


-- Manual Override Fields: Accessories Cost
ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "isAccessoriesCostOverridden" BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN "Order"."isAccessoriesCostOverridden" IS 'Flag indicating accessories cost was manually overridden';

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "accessoriesCostOverride" DOUBLE PRECISION;

COMMENT ON COLUMN "Order"."accessoriesCostOverride" IS 'Manually overridden accessories cost (if different from calculated)';

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "accessoriesCostOverrideReason" TEXT;

COMMENT ON COLUMN "Order"."accessoriesCostOverrideReason" IS 'Mandatory reason for accessories cost override (audit trail)';


-- Pricing Notes Field
ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "pricingNotes" TEXT;

COMMENT ON COLUMN "Order"."pricingNotes" IS 'Complete pricing notes and adjustments for transparency';


-- ============================================================================
-- PART 4: Update Existing Data (Set Defaults for Existing Orders)
-- ============================================================================

-- Update existing GarmentPattern records with realistic stitching charges based on garment type
UPDATE "GarmentPattern"
SET
    "basicStitchingCharge" = CASE
        WHEN "name" ILIKE '%suit%' AND "name" ILIKE '%3%piece%' THEN 10000
        WHEN "name" ILIKE '%suit%' THEN 8000
        WHEN "name" ILIKE '%sherwani%' THEN 12000
        WHEN "name" ILIKE '%jacket%' OR "name" ILIKE '%blazer%' THEN 5000
        WHEN "name" ILIKE '%trouser%' OR "name" ILIKE '%pant%' THEN 2500
        WHEN "name" ILIKE '%shirt%' THEN 2000
        ELSE 1500
    END,
    "premiumStitchingCharge" = CASE
        WHEN "name" ILIKE '%suit%' AND "name" ILIKE '%3%piece%' THEN 15000
        WHEN "name" ILIKE '%suit%' THEN 12000
        WHEN "name" ILIKE '%sherwani%' THEN 18000
        WHEN "name" ILIKE '%jacket%' OR "name" ILIKE '%blazer%' THEN 7500
        WHEN "name" ILIKE '%trouser%' OR "name" ILIKE '%pant%' THEN 3500
        WHEN "name" ILIKE '%shirt%' THEN 3000
        ELSE 3000
    END,
    "luxuryStitchingCharge" = CASE
        WHEN "name" ILIKE '%suit%' AND "name" ILIKE '%3%piece%' THEN 20000
        WHEN "name" ILIKE '%suit%' THEN 16000
        WHEN "name" ILIKE '%sherwani%' THEN 25000
        WHEN "name" ILIKE '%jacket%' OR "name" ILIKE '%blazer%' THEN 10000
        WHEN "name" ILIKE '%trouser%' OR "name" ILIKE '%pant%' THEN 5000
        WHEN "name" ILIKE '%shirt%' THEN 4000
        ELSE 5000
    END
WHERE "basicStitchingCharge" = 1500;  -- Only update if still at default


-- ============================================================================
-- PART 5: Create Indexes for Performance
-- ============================================================================

-- Index on stitchingTier for filtering
CREATE INDEX IF NOT EXISTS "Order_stitchingTier_idx" ON "Order"("stitchingTier");

-- Index on workmanship premium flags for reporting
CREATE INDEX IF NOT EXISTS "Order_isHandStitched_idx" ON "Order"("isHandStitched") WHERE "isHandStitched" = true;
CREATE INDEX IF NOT EXISTS "Order_isFullCanvas_idx" ON "Order"("isFullCanvas") WHERE "isFullCanvas" = true;
CREATE INDEX IF NOT EXISTS "Order_isRushOrder_idx" ON "Order"("isRushOrder") WHERE "isRushOrder" = true;
CREATE INDEX IF NOT EXISTS "Order_hasComplexDesign_idx" ON "Order"("hasComplexDesign") WHERE "hasComplexDesign" = true;

-- Index on override flags for audit queries
CREATE INDEX IF NOT EXISTS "Order_isFabricCostOverridden_idx" ON "Order"("isFabricCostOverridden") WHERE "isFabricCostOverridden" = true;
CREATE INDEX IF NOT EXISTS "Order_isStitchingCostOverridden_idx" ON "Order"("isStitchingCostOverridden") WHERE "isStitchingCostOverridden" = true;


-- ============================================================================
-- PART 6: Verification Queries
-- ============================================================================

-- Verify StitchingTier enum creation
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StitchingTier') THEN
        RAISE NOTICE '✓ StitchingTier enum created successfully';
    ELSE
        RAISE EXCEPTION '✗ StitchingTier enum not found';
    END IF;
END $$;

-- Verify GarmentPattern columns
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'GarmentPattern' AND column_name = 'basicStitchingCharge') THEN
        RAISE NOTICE '✓ GarmentPattern.basicStitchingCharge added';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'GarmentPattern' AND column_name = 'premiumStitchingCharge') THEN
        RAISE NOTICE '✓ GarmentPattern.premiumStitchingCharge added';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'GarmentPattern' AND column_name = 'luxuryStitchingCharge') THEN
        RAISE NOTICE '✓ GarmentPattern.luxuryStitchingCharge added';
    END IF;
END $$;

-- Count new Order columns
SELECT
    COUNT(*) FILTER (WHERE column_name IN (
        'fabricCost', 'fabricWastagePercent', 'fabricWastageAmount',
        'accessoriesCost', 'stitchingCost', 'stitchingTier',
        'workmanshipPremiums', 'designerConsultationFee',
        'isHandStitched', 'handStitchingCost',
        'isFullCanvas', 'fullCanvasCost',
        'isRushOrder', 'rushOrderCost',
        'hasComplexDesign', 'complexDesignCost',
        'additionalFittings', 'additionalFittingsCost',
        'hasPremiumLining', 'premiumLiningCost',
        'isFabricCostOverridden', 'fabricCostOverride', 'fabricCostOverrideReason',
        'isStitchingCostOverridden', 'stitchingCostOverride', 'stitchingCostOverrideReason',
        'isAccessoriesCostOverridden', 'accessoriesCostOverride', 'accessoriesCostOverrideReason',
        'pricingNotes'
    )) AS new_order_columns_count
FROM information_schema.columns
WHERE table_name = 'Order';

-- Display sample GarmentPattern stitching charges
SELECT
    "name",
    "basicStitchingCharge",
    "premiumStitchingCharge",
    "luxuryStitchingCharge"
FROM "GarmentPattern"
ORDER BY "basicStitchingCharge" DESC
LIMIT 10;


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Premium Pricing System Migration (v0.22.0)';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Status: COMPLETE';
    RAISE NOTICE 'Date: January 22, 2026';
    RAISE NOTICE '';
    RAISE NOTICE 'Changes Applied:';
    RAISE NOTICE '  - StitchingTier enum created';
    RAISE NOTICE '  - GarmentPattern: 3 new stitching charge fields';
    RAISE NOTICE '  - Order: 30 new pricing fields';
    RAISE NOTICE '  - Indexes created for performance';
    RAISE NOTICE '  - Existing data updated with realistic defaults';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '  1. Run: pnpm prisma generate';
    RAISE NOTICE '  2. Update order creation API';
    RAISE NOTICE '  3. Update order form UI';
    RAISE NOTICE '  4. Test complete pricing workflow';
    RAISE NOTICE '================================================';
END $$;
