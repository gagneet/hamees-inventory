# Stock Threshold Boundary Condition Fix

## Issue

Items with available stock exactly equal to the minimum threshold were being miscategorized.

### Problem Statement

The stock categorization logic had a boundary condition issue:

**Previous Logic (Incorrect):**
- **Low Stock:** `available < (minimum × 1.1)` AND `available >= minimum`
- **Critical Stock:** `available < minimum`

**Issue:** When `available === minimum` (exactly at threshold):
- Low Stock check: `minimum < (minimum × 1.1)` ✓ AND `minimum >= minimum` ✓ → **Counted as Low Stock**
- Critical Stock check: `minimum < minimum` ✗ → **NOT counted as Critical Stock**

### Why This Is Wrong

From a business perspective:
- **Minimum threshold** = The lowest acceptable stock level before urgent action needed
- If stock is **AT** minimum, it's a critical situation requiring immediate attention
- It should NOT be treated as just a "warning" (low stock)

### Example Scenario

Suppose we have a fabric with:
- Minimum threshold: 10 meters
- Current stock: 12 meters
- Reserved: 2 meters
- **Available: 10 meters** (exactly at minimum)

**Old Behavior:**
- Dashboard shows in "Low Stock" card (yellow/warning)
- Staff might not treat it as urgent
- No immediate action triggered

**New Behavior:**
- Dashboard shows in "Critical Stock" card (red/urgent)
- Staff knows immediate reordering needed
- Alerts system treats it as high priority

## Solution

**Corrected Logic:**
- **Low Stock:** `available < (minimum × 1.1)` AND `available > minimum` (changed `>=` to `>`)
- **Critical Stock:** `available <= minimum` (changed `<` to `<=`)

### Stock Category Ranges

Now stock is categorized as:

| Category | Range | Color | Priority |
|----------|-------|-------|----------|
| **Normal** | `available > minimum × 1.1` | Green | None |
| **Low Stock** (Warning) | `minimum < available < minimum × 1.1` | Yellow | Monitor |
| **Critical Stock** (Urgent) | `available <= minimum` | Red | Immediate Action |

### Test Cases

| Available | Minimum | Threshold (1.1×) | Old Category | New Category | Correct? |
|-----------|---------|------------------|--------------|--------------|----------|
| 12.0 | 10 | 11.0 | Normal | Normal | ✅ |
| 11.0 | 10 | 11.0 | Low | Normal | ✅ (at threshold, just safe) |
| 10.5 | 10 | 11.0 | Low | Low | ✅ |
| 10.0 | 10 | 11.0 | **Low** | **Critical** | ✅ Fixed! |
| 9.5 | 10 | 11.0 | Critical | Critical | ✅ |
| 5.0 | 10 | 11.0 | Critical | Critical | ✅ |

## Files Changed

### 1. Dashboard Stats API
**File:** `app/api/dashboard/stats/route.ts`

**Lines Changed:**
- Line 40-41: Updated comments to clarify "above threshold" vs "at or below threshold"
- Line 46: Changed `available >= item.minimum` to `available > item.minimum` (cloth low stock)
- Line 53: Changed `available < item.minimum` to `available <= item.minimum` (cloth critical)
- Line 74: Changed `currentStock >= item.minimum` to `currentStock > item.minimum` (accessory low stock)
- Line 79: Changed `currentStock < item.minimum` to `currentStock <= item.minimum` (accessory critical)

**Impact:** Dashboard cards now correctly count items at minimum as Critical, not Low Stock

### 2. Low Stock API
**File:** `app/api/inventory/low-stock/route.ts`

**Lines Changed:**
- Line 54-56: Updated comments to clarify thresholds
- Line 61: Comment updated to "At or below minimum threshold"
- Line 65: Changed `available < item.minimum` to `available <= item.minimum` (cloth critical)
- Line 68: Changed `currentStock < item.minimum` to `currentStock <= item.minimum` (accessory critical)
- Line 71: Comment updated to "Above minimum but below 1.1× minimum"
- Line 77: Changed `available >= item.minimum` to `available > item.minimum` (cloth low stock)
- Line 82: Changed `currentStock >= item.minimum` to `currentStock > item.minimum` (accessory low stock)

**Impact:** Low stock inventory API now returns correct categorization for items at threshold

### 3. Documentation
**File:** `docs/REGRESSION_FIXES_AND_ENHANCEMENTS.md`

**Changes:**
- Section 5 (Low/Critical Stock Logic) updated with v2 corrected logic
- Added boundary issue explanation
- Added before/after comparison
- Noted that items at minimum are now Critical, not Low

## Testing

### Manual Testing Steps

1. **Find or create an item at exactly minimum:**
   ```sql
   -- Create test scenario: Item with available stock = minimum
   UPDATE cloth_inventory 
   SET current_stock = 10.0, reserved = 0.0, minimum = 10.0 
   WHERE id = 'test-item-id';
   ```

2. **Check Dashboard Stats:**
   - Visit `/api/dashboard/stats`
   - Item should be counted in `criticalStockItems`, NOT `lowStockItems`
   - Response should show: `{ ..., lowStockItems: X, criticalStockItems: Y+1, ... }`

3. **Check Low Stock API:**
   - Visit `/api/inventory/low-stock?type=critical`
   - Item should appear in the results
   - Visit `/api/inventory/low-stock?type=low`
   - Item should NOT appear in the results

4. **Check Dashboard UI:**
   - Visit `/dashboard`
   - Item should appear in "Critical Stock" card (red)
   - Should NOT appear in "Low Stock" card (yellow)

### Expected Results

**Scenario: Item with available = 10, minimum = 10**

| Endpoint/UI | Old Behavior | New Behavior |
|-------------|--------------|--------------|
| Dashboard Stats API `lowStockItems` | Included | ❌ Not included |
| Dashboard Stats API `criticalStockItems` | ❌ Not included | Included |
| Low Stock API `?type=low` | Included | ❌ Not included |
| Low Stock API `?type=critical` | ❌ Not included | Included |
| Dashboard "Low Stock" card | Shows item | ❌ Doesn't show |
| Dashboard "Critical Stock" card | ❌ Doesn't show | Shows item |

## Business Impact

### Before Fix
- Items at minimum threshold treated as "just a warning"
- Risk of stockouts before action taken
- Inconsistent with business definition of "minimum"

### After Fix
- Items at minimum threshold immediately flagged as critical
- Faster response to restock urgent items
- Consistent with business logic: minimum = threshold for action
- Better inventory management and fewer stockouts

## Technical Notes

### Why `>` instead of `>=`?

The key insight is understanding what "minimum" means:
- Minimum = The lowest acceptable level
- AT minimum = Already at the danger threshold
- BELOW minimum = Emergency situation

Therefore:
- Low Stock = Above minimum but approaching it (`minimum < available < 1.1 × minimum`)
- Critical Stock = At or below minimum (`available <= minimum`)

### Edge Case: Exact Threshold Value

When `available === minimum × 1.1`:
- Low Stock: `(minimum × 1.1) < (minimum × 1.1)` ✗ → Not counted (correct)
- Critical Stock: `(minimum × 1.1) <= minimum` ✗ → Not counted (correct)
- Result: Treated as Normal stock (just barely safe)

This is correct behavior - at exactly 110% of minimum, stock is just barely in the safe zone.

## Related Issues

- Original PR: #29
- Review comment: #2702197606
- Referenced feedback: #2702183257

## Deployment

No database migration required. Changes are code-only and backward compatible.

**Steps:**
1. Pull changes
2. Build application: `pnpm build`
3. Restart server: `pm2 restart hamees-inventory`
4. Test boundary conditions with items at minimum threshold
5. Verify dashboard cards show correct categorization

## Future Enhancements

Consider adding:
1. Visual indicator when item is exactly at minimum (distinct from "just below")
2. Automated tests for boundary conditions
3. Configuration for threshold multiplier (currently hardcoded to 1.1)
4. Historical tracking of how long items stay in each category
