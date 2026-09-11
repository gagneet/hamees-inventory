-- Phase 1 Data Update: Add fabric specifications and accessory details
-- Date: January 23, 2026

-- ====================================
-- UPDATE CLOTH INVENTORY
-- ====================================

-- Premium Cotton
UPDATE "ClothInventory"
SET
  "fabricComposition" = '100% Cotton',
  "gsm" = 180,
  "threadCount" = 100,
  "weaveType" = 'Plain',
  "fabricWidth" = 58,
  "shrinkagePercent" = 3,
  "colorFastness" = 'Excellent',
  "seasonSuitability" = ARRAY['Summer', 'All-season'],
  "occasionType" = ARRAY['Casual', 'Formal', 'Business'],
  "careInstructions" = 'Machine wash cold, tumble dry low. Iron on medium heat.'
WHERE "name" = 'Premium Cotton';

-- Cotton Blend
UPDATE "ClothInventory"
SET
  "fabricComposition" = '65% Cotton, 35% Polyester',
  "gsm" = 160,
  "threadCount" = 85,
  "weaveType" = 'Plain',
  "fabricWidth" = 58,
  "shrinkagePercent" = 2,
  "colorFastness" = 'Good',
  "seasonSuitability" = ARRAY['Summer', 'All-season'],
  "occasionType" = ARRAY['Casual', 'Semi-formal'],
  "careInstructions" = 'Machine wash cold. No bleach. Tumble dry low.'
WHERE "name" = 'Cotton Blend';

-- Pure Silk
UPDATE "ClothInventory"
SET
  "fabricComposition" = '100% Silk',
  "gsm" = 90,
  "threadCount" = 150,
  "weaveType" = 'Plain',
  "fabricWidth" = 44,
  "shrinkagePercent" = 1.5,
  "colorFastness" = 'Excellent',
  "seasonSuitability" = ARRAY['Summer', 'All-season'],
  "occasionType" = ARRAY['Formal', 'Wedding', 'Party', 'Festival'],
  "careInstructions" = 'Dry clean only. Do not wring. Iron on silk setting.'
WHERE "name" = 'Pure Silk';

-- Silk Blend
UPDATE "ClothInventory"
SET
  "fabricComposition" = '60% Silk, 40% Cotton',
  "gsm" = 110,
  "threadCount" = 120,
  "weaveType" = 'Satin',
  "fabricWidth" = 44,
  "shrinkagePercent" = 2,
  "colorFastness" = 'Good',
  "seasonSuitability" = ARRAY['All-season'],
  "occasionType" = ARRAY['Formal', 'Wedding', 'Party'],
  "careInstructions" = 'Dry clean recommended. Hand wash in cold water if needed.'
WHERE "name" = 'Silk Blend';

-- Linen Pure
UPDATE "ClothInventory"
SET
  "fabricComposition" = '100% Linen',
  "gsm" = 200,
  "threadCount" = 70,
  "weaveType" = 'Plain',
  "fabricWidth" = 60,
  "shrinkagePercent" = 4,
  "colorFastness" = 'Good',
  "seasonSuitability" = ARRAY['Summer'],
  "occasionType" = ARRAY['Casual', 'Formal', 'Beach-wear'],
  "careInstructions" = 'Machine wash warm. High shrinkage on first wash. Iron while damp.'
WHERE "name" = 'Linen Pure';

-- Linen Blend
UPDATE "ClothInventory"
SET
  "fabricComposition" = '55% Linen, 45% Cotton',
  "gsm" = 170,
  "threadCount" = 80,
  "weaveType" = 'Plain',
  "fabricWidth" = 58,
  "shrinkagePercent" = 3,
  "colorFastness" = 'Good',
  "seasonSuitability" = ARRAY['Summer', 'All-season'],
  "occasionType" = ARRAY['Casual', 'Semi-formal'],
  "careInstructions" = 'Machine wash warm. Medium iron.'
WHERE "name" = 'Linen Blend';

-- Wool Premium
UPDATE "ClothInventory"
SET
  "fabricComposition" = '100% Merino Wool',
  "gsm" = 280,
  "threadCount" = 60,
  "weaveType" = 'Twill',
  "fabricWidth" = 60,
  "shrinkagePercent" = 1,
  "colorFastness" = 'Excellent',
  "seasonSuitability" = ARRAY['Winter'],
  "occasionType" = ARRAY['Formal', 'Business', 'Wedding'],
  "careInstructions" = 'Dry clean only. Store with moth protection.'
WHERE "name" = 'Wool Premium';

-- Wool Blend
UPDATE "ClothInventory"
SET
  "fabricComposition" = '70% Wool, 30% Polyester',
  "gsm" = 240,
  "threadCount" = 65,
  "weaveType" = 'Twill',
  "fabricWidth" = 60,
  "shrinkagePercent" = 1.5,
  "colorFastness" = 'Good',
  "seasonSuitability" = ARRAY['Winter'],
  "occasionType" = ARRAY['Formal', 'Business'],
  "careInstructions" = 'Dry clean recommended. Can be hand washed gently in cold water.'
WHERE "name" = 'Wool Blend';

-- Polyester Blend
UPDATE "ClothInventory"
SET
  "fabricComposition" = '65% Polyester, 35% Viscose',
  "gsm" = 150,
  "threadCount" = 90,
  "weaveType" = 'Plain',
  "fabricWidth" = 58,
  "shrinkagePercent" = 1,
  "colorFastness" = 'Fair',
  "seasonSuitability" = ARRAY['All-season'],
  "occasionType" = ARRAY['Casual', 'Daily-wear'],
  "careInstructions" = 'Machine wash cold. Low iron. Do not bleach.'
WHERE "name" = 'Polyester Blend';

-- Brocade Silk
UPDATE "ClothInventory"
SET
  "fabricComposition" = '100% Silk',
  "gsm" = 200,
  "threadCount" = 140,
  "weaveType" = 'Jacquard',
  "fabricWidth" = 44,
  "shrinkagePercent" = 1,
  "colorFastness" = 'Excellent',
  "seasonSuitability" = ARRAY['All-season'],
  "occasionType" = ARRAY['Wedding', 'Festival', 'Traditional', 'Ceremonial'],
  "careInstructions" = 'Dry clean only. Store flat to prevent crushing pattern.'
WHERE "name" = 'Brocade Silk';

-- ====================================
-- UPDATE ACCESSORY INVENTORY
-- ====================================

-- Pearl Buttons
UPDATE "AccessoryInventory"
SET
  "colorCode" = 'PANTONE 11-4001',
  "buttonSize" = '18L',
  "holePunchSize" = 4,
  "material" = 'Shell',
  "finish" = 'Polished',
  "recommendedFor" = ARRAY['Shirt', 'Kurta', 'Blazer'],
  "styleCategory" = 'Formal'
WHERE "name" = 'Pearl Buttons';

-- Metal Buttons
UPDATE "AccessoryInventory"
SET
  "colorCode" = 'PANTONE 16-1257',
  "buttonSize" = '20L',
  "holePunchSize" = 2,
  "material" = 'Brass',
  "finish" = 'Polished',
  "recommendedFor" = ARRAY['Suit', 'Blazer', 'Coat'],
  "styleCategory" = 'Formal'
WHERE "name" = 'Metal Buttons';

-- Black Buttons
UPDATE "AccessoryInventory"
SET
  "colorCode" = 'PANTONE 19-0303',
  "buttonSize" = '18L',
  "holePunchSize" = 4,
  "material" = 'Resin',
  "finish" = 'Matte',
  "recommendedFor" = ARRAY['Shirt', 'Trouser', 'Suit'],
  "styleCategory" = 'Formal'
WHERE "name" = 'Black Buttons';

-- Polyester Thread
UPDATE "AccessoryInventory"
SET
  "colorCode" = 'PANTONE 11-0601',
  "threadWeight" = '40wt',
  "recommendedFor" = ARRAY['Shirt', 'Trouser', 'Kurta', 'All'],
  "styleCategory" = 'All'
WHERE "name" = 'Polyester Thread';

-- Cotton Thread
UPDATE "AccessoryInventory"
SET
  "colorCode" = 'PANTONE 19-0303',
  "threadWeight" = '50wt',
  "recommendedFor" = ARRAY['Suit', 'Formal-wear', 'Embroidery'],
  "styleCategory" = 'Formal'
WHERE "name" = 'Cotton Thread';

-- Metal Zipper
UPDATE "AccessoryInventory"
SET
  "material" = 'Brass',
  "finish" = 'Polished',
  "recommendedFor" = ARRAY['Trouser', 'Jacket', 'Coat'],
  "styleCategory" = 'All'
WHERE "name" = 'Metal Zipper';

-- ====================================
-- VERIFICATION
-- ====================================

-- Verify cloth updates
SELECT
  "name",
  "fabricComposition",
  "gsm",
  "weaveType",
  array_length("seasonSuitability", 1) as season_count,
  array_length("occasionType", 1) as occasion_count
FROM "ClothInventory"
WHERE "fabricComposition" IS NOT NULL
ORDER BY "name";

-- Verify accessory updates
SELECT
  "name",
  "type",
  "buttonSize",
  "threadWeight",
  "material",
  array_length("recommendedFor", 1) as recommendation_count
FROM "AccessoryInventory"
WHERE "colorCode" IS NOT NULL OR "material" IS NOT NULL
ORDER BY "name";

-- Summary
SELECT
  'Data Update Complete' as status,
  (SELECT COUNT(*) FROM "ClothInventory" WHERE "fabricComposition" IS NOT NULL) as cloth_with_specs,
  (SELECT COUNT(*) FROM "AccessoryInventory" WHERE ("colorCode" IS NOT NULL OR "material" IS NOT NULL)) as accessories_with_specs,
  NOW() as updated_at;
