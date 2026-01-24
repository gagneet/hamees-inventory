# Schema Field Name Audit & Improvements

**Date:** January 24, 2026
**Version:** v0.26.0
**Status:** In Progress

## Executive Summary

This document outlines ambiguous field names in the Prisma schema and proposes clearer, more explicit alternatives to prevent confusion and improve code maintainability.

## Audit Findings

### Critical Ambiguities (HIGH PRIORITY)

These fields cause actual confusion in the codebase:

#### 1. **OrderItem.quantity** → **quantityOrdered**
- **Current:** `quantity Int @default(1)` - Number of garments ordered
- **Problem:** Confused with `GarmentAccessory.quantityPerGarment`, `POItem.quantity`, etc.
- **Solution:** `quantityOrdered` - Explicitly "how many garments the customer ordered"
- **Impact:** High - affects order creation, pricing calculations, accessory reservations

#### 2. **StockMovement.quantity** → **quantityMeters**
- **Current:** `quantity Float` - Amount of fabric moved (in meters)
- **Problem:** Type is Float (meters) but name doesn't indicate unit
- **Solution:** `quantityMeters` - Explicitly fabric meters moved
- **Impact:** High - affects stock reservation, audit trail

#### 3. **AccessoryStockMovement.quantity** → **quantityUnits**
- **Current:** `quantity Int` - Amount of accessories moved (units)
- **Problem:** Same name as StockMovement but different unit (Int vs Float, units vs meters)
- **Solution:** `quantityUnits` - Explicitly accessory units moved
- **Impact:** High - affects accessory tracking v0.25.0 system

#### 4. **POItem.quantity** → **orderedQuantity**
- **Current:** `quantity Float` - Amount ordered from supplier
- **Problem:** Doesn't match `receivedQuantity` pattern (one has prefix, one doesn't)
- **Solution:** `orderedQuantity` - Matches `receivedQuantity` naming pattern
- **Impact:** Medium - affects purchase order workflows

#### 5. **PaymentInstallment.amount** → **installmentAmount**
- **Current:** `amount Float` - Expected installment payment amount
- **Problem:** Too generic, confused with `paidAmount`, `totalAmount`, etc.
- **Solution:** `installmentAmount` or `dueAmount` - Matches `paidAmount` pattern
- **Impact:** Medium - affects payment tracking

### Moderate Ambiguities (MEDIUM PRIORITY)

#### 6. **ClothInventory.minimum** → **minimumStockMeters**
- **Current:** `minimum Float` - Minimum stock level in meters
- **Problem:** Doesn't indicate unit (meters)
- **Solution:** `minimumStockMeters` - Explicit unit specification
- **Impact:** Low - mostly used in stock alerts

#### 7. **AccessoryInventory.minimum** → **minimumStockUnits**
- **Current:** `minimum Int` - Minimum stock level in units
- **Problem:** Same as ClothInventory but different unit
- **Solution:** `minimumStockUnits` - Matches ClothInventory pattern
- **Impact:** Low - consistency with ClothInventory

#### 8. **OrderItem.wastage** → **wastageMeters**
- **Current:** `wastage Float?` - Fabric wastage (actual - estimated)
- **Problem:** Doesn't indicate unit
- **Solution:** `wastageMeters` - Explicit meters unit
- **Impact:** Low - used in variance analysis

#### 9. **StockMovement.balanceAfter** → **balanceAfterMeters**
- **Current:** `balanceAfter Float` - Stock balance after movement
- **Problem:** Doesn't indicate unit
- **Solution:** `balanceAfterMeters` - Explicit meters unit
- **Impact:** Low - audit trail clarity

#### 10. **AccessoryStockMovement.balanceAfter** → **balanceAfterUnits**
- **Current:** `balanceAfter Int` - Stock balance after movement
- **Problem:** Same as StockMovement but different unit
- **Solution:** `balanceAfterUnits` - Explicit units specification
- **Impact:** Low - consistency with StockMovement

### Minor Improvements (LOW PRIORITY)

#### 11. **GarmentPattern Body Adjustments** → Add "Meters" suffix
- `slimAdjustment` → `slimAdjustmentMeters`
- `regularAdjustment` → `regularAdjustmentMeters`
- `largeAdjustment` → `largeAdjustmentMeters`
- `xlAdjustment` → `xlAdjustmentMeters`
- **Impact:** Very Low - rarely referenced directly

## Implementation Plan

### Phase 1: Critical Fixes (Immediate)
1. ✅ `GarmentAccessory.quantity` → `quantityPerGarment` (Already done)
2. `OrderItem.quantity` → `quantityOrdered`
3. `StockMovement.quantity` → `quantityMeters`
4. `AccessoryStockMovement.quantity` → `quantityUnits`
5. `POItem.quantity` → `orderedQuantity`

### Phase 2: Payment & Stock Clarity (Next)
6. `PaymentInstallment.amount` → `installmentAmount`
7. `ClothInventory.minimum` → `minimumStockMeters`
8. `AccessoryInventory.minimum` → `minimumStockUnits`
9. `OrderItem.wastage` → `wastageMeters`

### Phase 3: Audit Trail Clarity (Optional)
10. `StockMovement.balanceAfter` → `balanceAfterMeters`
11. `AccessoryStockMovement.balanceAfter` → `balanceAfterUnits`

### Phase 4: Pattern Adjustments (Future Enhancement)
12. `GarmentPattern.*Adjustment` → `*AdjustmentMeters`

## Files Requiring Updates

### Schema Changes
- `prisma/schema.prisma` - All field renames

### Seed Files
- `prisma/seed.ts`
- `prisma/seed-complete.ts`
- `prisma/seed-production.ts`

### API Routes
- `app/api/orders/route.ts` - OrderItem.quantity usage
- `app/api/orders/[id]/items/[itemId]/route.ts` - OrderItem.quantity
- `app/api/orders/[id]/status/route.ts` - StockMovement.quantity, AccessoryStockMovement.quantity
- `app/api/orders/[id]/split/route.ts` - OrderItem.quantity
- `app/api/purchase-orders/*/route.ts` - POItem.quantity
- `app/api/installments/*/route.ts` - PaymentInstallment.amount
- `app/api/inventory/*/route.ts` - minimum field usage
- `app/api/dashboard/enhanced-stats/route.ts` - Multiple quantity references

### UI Components
- `app/(dashboard)/orders/new/page.tsx` - OrderItem.quantity
- `app/(dashboard)/orders/[id]/page.tsx` - All quantity fields
- `components/orders/*.tsx` - Order item displays
- `components/inventory/*.tsx` - Stock displays
- `components/dashboard/*.tsx` - Metrics displays

### Excel Export/Import
- `scripts/export-to-excel.ts` - All column headers
- `lib/excel-processor.ts` - Field mapping
- `lib/excel-upload.ts` - Validation schemas

### Database Migration
- Create migration: `rename_ambiguous_fields_to_explicit_names`
- Estimated migration time: ~30 seconds (column renames only, no data changes)

## Testing Checklist

- [ ] All API endpoints respond correctly with new field names
- [ ] Order creation workflow works end-to-end
- [ ] Stock reservation system functions correctly
- [ ] Payment installments calculate properly
- [ ] Excel export generates correct headers
- [ ] Excel import validates and maps fields correctly
- [ ] Dashboard displays accurate metrics
- [ ] No TypeScript compilation errors
- [ ] Clean build completes successfully

## Breaking Changes

**None** - This is a database schema refactor with code updates. Old database columns will be renamed via migration.

## Rollback Plan

If issues occur:
1. Revert migration: `pnpm prisma migrate resolve --rolled-back <migration_name>`
2. Revert code: `git revert <commit_hash>`
3. Regenerate Prisma client: `pnpm prisma generate`
4. Rebuild: `pnpm build`

## Estimated Time

- Schema updates: 10 minutes
- Code updates (API routes): 30 minutes
- Code updates (UI components): 20 minutes
- Seed file updates: 15 minutes
- Excel script updates: 15 minutes
- Testing: 20 minutes
- Documentation: 10 minutes
- **Total: ~2 hours**

## Benefits

1. **Clarity:** Field names self-document their purpose and unit
2. **Type Safety:** Reduce confusion between Int (units) and Float (meters) fields
3. **Maintainability:** New developers understand field purpose immediately
4. **Fewer Bugs:** Explicit names prevent copy-paste errors
5. **Better IDE Support:** Autocomplete shows field context
6. **Documentation:** Code reads like documentation

## Related Issues

- Original issue: `seed.ts:409` used `quantityPerGarment` but schema had `quantity`
- Root cause: Generic field names across multiple models
- This audit prevents future similar issues

---

**Author:** Claude Code Assistant
**Reviewed By:** Pending
**Approved By:** Pending
