# Orders Page - URL Search Parameter Fix

**Date:** 2026-01-15
**Issue:** Clicking order links from Expenses page with search parameters (e.g., `/orders?search=ORD-123`) was not filtering the orders list on the Orders page.

## Problem

When navigating from the Expenses page to Orders page with URL query parameters like `?search=ORD-1768160880118-027`, the Orders page was ignoring these parameters and showing all orders instead of filtering by the search term.

## Root Cause

The Orders page component did not read URL search parameters on initial load. It only maintained internal state for filters without checking the URL.

## Solution

**File Modified:** `app/(dashboard)/orders/page.tsx`

### Changes Made:

1. **Added React Suspense and useSearchParams**
   - Imported `Suspense` from React
   - Imported `useSearchParams` from `next/navigation`

2. **Refactored Component Structure**
   - Renamed main component from `OrdersPage` to `OrdersContent`
   - Created new `OrdersPage` wrapper with Suspense boundary (required for `useSearchParams()`)

3. **URL Parameter Initialization**
   - Added `useEffect` hook to read URL search parameters on component mount
   - Initializes all filter states (status, search, fabricId, etc.) from URL params
   - Properly handles client-side hydration to prevent server-client mismatch

### Technical Details

The fix uses `useEffect` with `searchParams` dependency to initialize filter states after the component mounts on the client side. This prevents hydration errors that would occur if we tried to read search params during initial render.

```typescript
useEffect(() => {
  setStatus(searchParams.get('status') || '')
  setSearchTerm(searchParams.get('search') || '')
  setDebouncedSearch(searchParams.get('search') || '')
  setFabricId(searchParams.get('fabricId') || '')
  setMinAmount(searchParams.get('minAmount') || '')
  setMaxAmount(searchParams.get('maxAmount') || '')
  setDeliveryDateFrom(searchParams.get('deliveryDateFrom') || '')
  setDeliveryDateTo(searchParams.get('deliveryDateTo') || '')
  setIsOverdue(searchParams.get('isOverdue') === 'true')
}, [searchParams])
```

## Result

Now when users click order links from the Expenses page (or any other page with search parameters), the Orders page will:
- Read the URL parameters
- Initialize the search/filter fields with those values
- Automatically fetch and display filtered results

## Supported URL Parameters

- `status` - Filter by order status
- `search` - Search by order number or customer name
- `fabricId` - Filter by fabric ID
- `minAmount` / `maxAmount` - Filter by amount range
- `deliveryDateFrom` / `deliveryDateTo` - Filter by delivery date range
- `isOverdue` - Show only overdue orders (true/false)

## Testing

1. Navigate to Expenses page
2. Click any order link (e.g., `ORD-1768160880118-027`)
3. Verify Orders page shows only that specific order
4. Verify search field is populated with the order number
5. Verify URL contains the search parameter
