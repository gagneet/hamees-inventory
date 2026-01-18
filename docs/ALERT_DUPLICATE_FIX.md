# Alert System Duplicate Fix - v0.18.3

**Date:** January 18, 2026
**Version:** v0.18.3
**Status:** ✅ Production Ready

## Overview

Fixed critical issues with the alert system that caused duplicate alerts and confusion about low vs critical stock counts.

## Issues Identified

### 1. Duplicate Alerts
- **Problem**: Multiple alerts created for the same inventory item
- **Impact**: Some items had up to 4 duplicate alerts
- **Total Duplicates Found**: 14 duplicate alerts across 3 items
- **Root Cause**: No unique constraint on Alert model

### 2. Inconsistent relatedType Values
- **Problem**: Mixed usage of "INVENTORY" and "cloth" for relatedType
- **Impact**: Confusion in alert filtering and display
- **Affected Alerts**: 12 alerts with wrong relatedType

### 3. Stock Count Display Confusion
- **Problem**: Duplicate alerts inflated the count shown on dashboard
- **Actual Data**: 3 critical items, 0 low stock items
- **Displayed Before Fix**: Numbers appeared incorrect due to duplicates

## Solutions Implemented

### 1. Database Cleanup (One-time)

**SQL Operations:**
```sql
-- Fix relatedType inconsistency
UPDATE "Alert"
SET "relatedType" = 'cloth'
WHERE "relatedType" = 'INVENTORY';
-- Result: 12 rows updated

-- Delete duplicate alerts (keep oldest)
DELETE FROM "Alert" a
USING (
  SELECT "relatedId", type, MIN(id) as keep_id
  FROM "Alert"
  WHERE "isDismissed" = false
    AND type IN ('LOW_STOCK', 'CRITICAL_STOCK')
    AND "relatedType" IN ('cloth', 'accessory')
  GROUP BY "relatedId", type
  HAVING COUNT(*) > 1
) b
WHERE a."relatedId" = b."relatedId"
  AND a.type = b.type
  AND a.id != b.keep_id;
-- Result: 14 rows deleted
```

### 2. Schema Changes

**File:** `prisma/schema.prisma`

Added unique constraint to prevent duplicate alerts:

```prisma
model Alert {
  id            String        @id @default(cuid())
  type          AlertType
  severity      AlertSeverity
  title         String
  message       String
  relatedId     String?       // ID of related entity (inventory, order, etc.)
  relatedType   String?       // Type of related entity ('cloth', 'accessory', 'order', etc.)
  isRead        Boolean       @default(false)
  isDismissed   Boolean       @default(false)
  dismissedUntil DateTime?    // When the alert should reappear (null = not dismissed)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  @@index([isRead])
  @@index([isDismissed])
  @@index([dismissedUntil])
  @@index([createdAt])
  @@index([severity])
  @@unique([relatedId, relatedType, type, isDismissed]) // NEW: Prevent duplicate alerts
}
```

**Database Migration:**
```sql
CREATE UNIQUE INDEX "Alert_relatedId_relatedType_type_isDismissed_key"
ON "Alert"("relatedId", "relatedType", type, "isDismissed");
```

### 3. Diagnostic Tools Created

**File:** `scripts/diagnose-stock-issues.ts`

Diagnostic script to analyze stock levels and detect duplicate alerts:
- Scans all active cloth inventory
- Calculates low vs critical stock correctly
- Identifies duplicate alerts
- Provides detailed reporting

**File:** `scripts/cleanup-duplicate-alerts.ts`

Cleanup script with Prisma client (for future use):
- Identifies duplicate alerts
- Keeps oldest alert for each item
- Fixes relatedType inconsistencies
- Provides detailed logging

**Usage:**
```bash
# Diagnostic (requires DATABASE_URL in .env)
npx tsx scripts/diagnose-stock-issues.ts

# Note: cleanup-duplicate-alerts.ts is available for reference
# but manual SQL was used for production cleanup
```

## Stock Level Logic (Verified Correct)

### Low Stock Criteria
```
Available < (Minimum × 1.1) AND Available > Minimum
```
**Example:** Minimum = 10m, Available = 10.5m → LOW STOCK
**Purpose:** 10% buffer warning zone above minimum

### Critical Stock Criteria
```
Available <= Minimum
```
**Example:** Minimum = 10m, Available = 9m → CRITICAL STOCK
**Purpose:** At or below minimum threshold (urgent action needed)

### Available Stock Calculation
```
Available = Current Stock - Reserved Stock
```

## Results After Fix

### Alert Counts
- **Before:** Inflated counts due to duplicates
- **After:** Exactly 3 CRITICAL_STOCK alerts (matches actual inventory)
- **Duplicates:** 0 (unique constraint prevents future duplicates)

### Database State
```sql
SELECT COUNT(*) as total_alerts, type, severity
FROM "Alert"
WHERE "isDismissed" = false
GROUP BY type, severity;

 total_alerts |      type      | severity
--------------+----------------+----------
            3 | CRITICAL_STOCK | CRITICAL
```

### Actual Inventory State
```sql
SELECT
  COUNT(*) as total_items,
  SUM(CASE WHEN (currentStock - reserved) <= minimum THEN 1 ELSE 0 END) as critical,
  SUM(CASE WHEN (currentStock - reserved) < (minimum * 1.1)
            AND (currentStock - reserved) > minimum THEN 1 ELSE 0 END) as low
FROM "ClothInventory"
WHERE active = true;

 total_items | critical | low
-------------+----------+-----
          12 |        3 |   0
```

**✅ Alert counts now match actual inventory state perfectly**

## Files Modified

1. **prisma/schema.prisma**
   - Added unique constraint to Alert model
   - Updated relatedType comment for clarity

2. **Database**
   - Cleaned up 14 duplicate alerts
   - Fixed 12 alerts with wrong relatedType
   - Created unique index

## Files Created

1. **scripts/diagnose-stock-issues.ts**
   - Diagnostic tool for stock and alert analysis

2. **scripts/cleanup-duplicate-alerts.ts**
   - Automated cleanup tool (for reference)

3. **docs/ALERT_DUPLICATE_FIX.md**
   - This documentation file

## Testing Checklist

- [x] Verify no duplicate alerts in database
- [x] Verify alert counts match inventory state
- [x] Test Low Stock card on dashboard (should show 0)
- [x] Test Critical Stock card on dashboard (should show 3)
- [x] Test clickable stock cards show correct items
- [x] Verify alerts page shows no duplicates
- [x] Test alert generation doesn't create duplicates
- [x] Build succeeds without errors
- [x] Application restart successful
- [x] Unique constraint prevents new duplicates

## User Impact

### Before Fix
- ❌ Dashboard showed incorrect stock counts
- ❌ Multiple duplicate alerts for same items
- ❌ Confusing alert notifications
- ❌ Mixed relatedType values causing filtering issues

### After Fix
- ✅ Dashboard shows accurate stock counts (3 critical, 0 low)
- ✅ Exactly 1 alert per unique item + type combination
- ✅ Clean alert notifications
- ✅ Consistent relatedType values ('cloth', 'accessory')
- ✅ Future duplicates prevented by unique constraint

## Production Deployment

**Steps Taken:**
1. Cleaned up duplicate alerts via SQL
2. Added unique index to database
3. Updated Prisma schema
4. Regenerated Prisma client
5. Built production bundle
6. Restarted PM2 application

**Deployment Command History:**
```bash
# Database cleanup
PGPASSWORD=hamees_secure_2026 psql -h localhost -U hamees_user -d tailor_inventory < cleanup.sql

# Add unique constraint
PGPASSWORD=hamees_secure_2026 psql -h localhost -U hamees_user -d tailor_inventory \
  -c "CREATE UNIQUE INDEX \"Alert_relatedId_relatedType_type_isDismissed_key\"
      ON \"Alert\"(\"relatedId\", \"relatedType\", type, \"isDismissed\");"

# Regenerate Prisma client
npx prisma generate

# Build and restart
NODE_ENV=production npm run build
pm2 restart hamees-inventory
```

## Breaking Changes

None. All changes are backward compatible.

## Future Enhancements

1. **Alert Deduplication on Creation**: Update `lib/generate-alerts.ts` to use upsert pattern
2. **Alert Expiry Cleanup**: Scheduled job to clean expired dismissed alerts
3. **Alert Audit Trail**: Track when duplicates were attempted and prevented
4. **relatedType Enum**: Consider adding enum type for relatedType values

## References

- **Stock Logic:** `lib/generate-alerts.ts:64-86` (Critical), `lib/generate-alerts.ts:86-101` (Low)
- **Dashboard Stats:** `app/api/dashboard/stats/route.ts:43-58`
- **Low Stock API:** `app/api/inventory/low-stock/route.ts:60-86`
- **Alert Model:** `prisma/schema.prisma:566-586`

## Version History

- **v0.18.3** (Jan 18, 2026) - Fixed duplicate alerts and added unique constraint
- **v0.18.2** (Jan 18, 2026) - Barcode scanner fixes
- **v0.18.1** (Jan 18, 2026) - Accessory SKU support
- **v0.18.0** (Jan 17, 2026) - WhatsApp integration
