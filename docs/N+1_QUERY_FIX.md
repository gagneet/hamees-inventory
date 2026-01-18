# N+1 Query Fix Documentation

## Overview
This document describes the fix for the N+1 query problem in the alert generation system.

## Problem Description

### Original Issue
The `generateStockAlerts()` function in `lib/generate-alerts.ts` had a critical performance issue where it was making individual database queries inside a loop for each inventory item.

**Original Code Pattern (lines 44-57):**
```typescript
for (const item of clothItems) {
  // This query was executed for EVERY cloth item
  const existingAlert = await prisma.alert.findFirst({
    where: {
      relatedId: item.id,
      relatedType: 'cloth',
      isDismissed: false,
      type: { in: [AlertType.LOW_STOCK, AlertType.CRITICAL_STOCK] }
    }
  })
  // ... process alert
}
```

### Performance Impact
- **100 inventory items** → 100+ individual database queries
- **Each query** requires a full database round-trip
- **Total time** grows linearly with inventory size (O(n))
- **Real-world impact**: For a shop with 200+ fabric types, this could take several seconds

## Solution

### Implementation
The fix implements a **batch query pattern** with **lookup maps** for O(1) access:

**New Code Pattern (lines 43-61):**
```typescript
// Step 1: Batch query all existing alerts for all items at once
const clothItemIds = clothItems.map(item => item.id)
const existingClothAlerts = await prisma.alert.findMany({
  where: {
    relatedId: { in: clothItemIds },  // Use 'in' operator for batch query
    relatedType: 'cloth',
    isDismissed: false,
    type: { in: [AlertType.LOW_STOCK, AlertType.CRITICAL_STOCK] }
  }
})

// Step 2: Create lookup map for O(1) access
const clothAlertsMap = new Map(
  existingClothAlerts.map(alert => [alert.relatedId, alert])
)

// Step 3: Use map for instant lookups
for (const item of clothItems) {
  const existingAlert = clothAlertsMap.get(item.id)  // O(1) lookup
  // ... process alert
}
```

### Key Changes

1. **Batch Query for Cloth Items (lines 43-54)**
   - Single `findMany` query fetches all cloth alerts at once
   - Uses Prisma's `in` operator: `relatedId: { in: clothItemIds }`
   - Query time: O(1) regardless of inventory size

2. **Batch Query for Accessory Items (lines 109-120)**
   - Same pattern applied to accessory inventory
   - Separate query maintains type safety and clarity

3. **Lookup Maps (lines 57, 123)**
   - `Map<string, Alert>` data structure for instant lookups
   - Maps item ID to its alert (if exists)
   - Lookup time: O(1) instead of O(n)

## Performance Improvement

### Query Reduction
| Inventory Size | Before (Queries) | After (Queries) | Improvement |
|----------------|------------------|-----------------|-------------|
| 10 items       | 10               | 1               | 10x         |
| 50 items       | 50               | 1               | 50x         |
| 100 items      | 100              | 2               | 50x         |
| 500 items      | 500              | 2               | 250x        |

### Execution Time Estimate
Assuming 10ms per database query:
- **Before**: 100 items × 10ms = 1000ms (1 second)
- **After**: 2 queries × 10ms = 20ms (0.02 seconds)
- **Speedup**: ~50x faster

## Technical Details

### Database Query Changes

**Before:**
```sql
-- Executed 100 times (once per item)
SELECT * FROM "Alert" 
WHERE "relatedId" = 'cloth_1' 
  AND "relatedType" = 'cloth' 
  AND "isDismissed" = false 
  AND "type" IN ('LOW_STOCK', 'CRITICAL_STOCK')
LIMIT 1;
```

**After:**
```sql
-- Executed once for all items
SELECT * FROM "Alert" 
WHERE "relatedId" IN ('cloth_1', 'cloth_2', ..., 'cloth_100')
  AND "relatedType" = 'cloth' 
  AND "isDismissed" = false 
  AND "type" IN ('LOW_STOCK', 'CRITICAL_STOCK');
```

### Data Structures

**Map Usage:**
```typescript
// Creating the map from query results
const clothAlertsMap = new Map(
  existingClothAlerts.map(alert => [alert.relatedId, alert])
)

// Map structure in memory:
// {
//   'cloth_1' => { id: 'alert_1', type: 'LOW_STOCK', ... },
//   'cloth_2' => { id: 'alert_2', type: 'CRITICAL_STOCK', ... },
//   ...
// }

// O(1) lookup during processing
const existingAlert = clothAlertsMap.get(item.id)
```

## Testing

### Verification Steps
1. **Functional Testing**: Alerts should be created/resolved correctly
   - Critical stock alerts when `available < minimum`
   - Low stock alerts when `available < minimum × 1.1`
   - Alerts resolved when stock becomes healthy

2. **Performance Testing**: Measure execution time
   - Before: ~1-2 seconds for 100 items
   - After: ~20-50ms for 100 items

3. **Integration Testing**: Test with existing API endpoints
   - `POST /api/alerts/generate` - Manual alert generation
   - Dashboard stats loading - Async alert generation
   - Alert display and dismissal still works

### Test Commands
```bash
# Test alert generation via API
curl -X POST https://hamees.gagneet.com/api/alerts/generate

# Monitor performance in logs
pm2 logs hamees-inventory --lines 50
```

## Affected Files

### Modified
- `lib/generate-alerts.ts` - Fixed N+1 query problem
  - Lines 43-107: Cloth inventory processing
  - Lines 109-173: Accessory inventory processing

### No Changes Required
- `app/api/alerts/generate/route.ts` - API interface unchanged
- `app/api/dashboard/enhanced-stats/route.ts` - Async call unchanged
- `app/api/dashboard/stats/route.ts` - Async call unchanged

## Migration Notes

### Backward Compatibility
✅ **No breaking changes**
- Function signature unchanged
- Return value format unchanged
- Business logic unchanged
- All existing API endpoints work without modification

### Deployment
No special deployment steps required:
1. Deploy code update
2. Restart application
3. Alert generation automatically uses new optimized queries

## Monitoring

### What to Monitor
1. **Alert Generation Time**: Should drop significantly
2. **Database Query Count**: Should see ~50-100x reduction
3. **Alert Accuracy**: Verify alerts are still generated correctly

### Metrics to Track
```
Before:
- Average execution time: ~1000ms
- Database queries: ~100+ per run

After:
- Average execution time: ~20-50ms
- Database queries: 2 per run (1 for cloth, 1 for accessories)
```

## Related Issues

- Original PR: #38
- Review Comment: https://github.com/gagneet/hamees-inventory/pull/38#discussion_r2702233909
- Fix Commit: 9f064a0

## References

- [N+1 Query Problem Explained](https://stackoverflow.com/questions/97197/what-is-the-n1-selects-problem)
- [Prisma Batch Queries](https://www.prisma.io/docs/concepts/components/prisma-client/crud#read)
- [JavaScript Map Performance](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map)
