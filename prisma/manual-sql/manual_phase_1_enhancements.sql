-- Migration: Phase 1 Inventory Enhancements (v0.23.0)
-- Date: January 23, 2026
-- Description: Add fabric specifications and accessory details

-- ====================================
-- CLOTH INVENTORY ENHANCEMENTS
-- ====================================

-- Fabric Technical Specifications
ALTER TABLE "ClothInventory" ADD COLUMN IF NOT EXISTS "fabricComposition" TEXT;
ALTER TABLE "ClothInventory" ADD COLUMN IF NOT EXISTS "gsm" DOUBLE PRECISION;
ALTER TABLE "ClothInventory" ADD COLUMN IF NOT EXISTS "threadCount" INTEGER;
ALTER TABLE "ClothInventory" ADD COLUMN IF NOT EXISTS "weaveType" TEXT;
ALTER TABLE "ClothInventory" ADD COLUMN IF NOT EXISTS "fabricWidth" DOUBLE PRECISION;
ALTER TABLE "ClothInventory" ADD COLUMN IF NOT EXISTS "shrinkagePercent" DOUBLE PRECISION;
ALTER TABLE "ClothInventory" ADD COLUMN IF NOT EXISTS "colorFastness" TEXT;

-- Business Classification (Arrays)
ALTER TABLE "ClothInventory" ADD COLUMN IF NOT EXISTS "seasonSuitability" TEXT[];
ALTER TABLE "ClothInventory" ADD COLUMN IF NOT EXISTS "occasionType" TEXT[];
ALTER TABLE "ClothInventory" ADD COLUMN IF NOT EXISTS "careInstructions" TEXT;

-- Visual Assets
ALTER TABLE "ClothInventory" ADD COLUMN IF NOT EXISTS "swatchImage" TEXT;
ALTER TABLE "ClothInventory" ADD COLUMN IF NOT EXISTS "textureImage" TEXT;

-- ====================================
-- ACCESSORY INVENTORY ENHANCEMENTS
-- ====================================

-- Thread-Specific Fields
ALTER TABLE "AccessoryInventory" ADD COLUMN IF NOT EXISTS "colorCode" TEXT;
ALTER TABLE "AccessoryInventory" ADD COLUMN IF NOT EXISTS "threadWeight" TEXT;

-- Button-Specific Fields
ALTER TABLE "AccessoryInventory" ADD COLUMN IF NOT EXISTS "buttonSize" TEXT;
ALTER TABLE "AccessoryInventory" ADD COLUMN IF NOT EXISTS "holePunchSize" INTEGER;
ALTER TABLE "AccessoryInventory" ADD COLUMN IF NOT EXISTS "material" TEXT;
ALTER TABLE "AccessoryInventory" ADD COLUMN IF NOT EXISTS "finish" TEXT;

-- Compatibility & Recommendations (Arrays)
ALTER TABLE "AccessoryInventory" ADD COLUMN IF NOT EXISTS "recommendedFor" TEXT[];
ALTER TABLE "AccessoryInventory" ADD COLUMN IF NOT EXISTS "styleCategory" TEXT;

-- Visual Assets
ALTER TABLE "AccessoryInventory" ADD COLUMN IF NOT EXISTS "productImage" TEXT;
ALTER TABLE "AccessoryInventory" ADD COLUMN IF NOT EXISTS "closeUpImage" TEXT;

-- ====================================
-- VERIFICATION QUERIES
-- ====================================

-- Verify ClothInventory columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ClothInventory'
  AND column_name IN (
    'fabricComposition', 'gsm', 'threadCount', 'weaveType', 'fabricWidth',
    'shrinkagePercent', 'colorFastness', 'seasonSuitability', 'occasionType',
    'careInstructions', 'swatchImage', 'textureImage'
  )
ORDER BY column_name;

-- Verify AccessoryInventory columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'AccessoryInventory'
  AND column_name IN (
    'colorCode', 'threadWeight', 'buttonSize', 'holePunchSize', 'material',
    'finish', 'recommendedFor', 'styleCategory', 'productImage', 'closeUpImage'
  )
ORDER BY column_name;

-- Summary
SELECT
  'Migration Complete' as status,
  (SELECT COUNT(*) FROM "ClothInventory") as cloth_items,
  (SELECT COUNT(*) FROM "AccessoryInventory") as accessory_items,
  NOW() as executed_at;
