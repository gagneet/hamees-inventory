# Measurement Edit/Update with History & Audit Trail

**Version:** 0.5.0
**Date:** January 15, 2026
**Developer:** Claude Code (Anthropic)

## Overview

This document outlines the implementation of the measurement edit/update functionality with comprehensive version history and audit trail capabilities. The feature allows users to edit customer measurements while preserving complete historical records of all changes.

## Business Requirements

- Allow editing of customer measurements without losing historical data
- Track who made changes and when
- Provide visual comparison between different versions
- Prevent deletion of measurements used in orders
- Maintain data integrity with soft deletes
- Support mobile and desktop interfaces

## Technical Architecture

### 1. Database Schema Changes

**File:** `prisma/schema.prisma`

#### Added Fields to `Measurement` Model

```prisma
model Measurement {
  // ... existing fields ...

  // NEW: Body type classification
  bodyType      BodyType?

  // NEW: History tracking fields
  replacesId    String?   // ID of the measurement this replaces
  isActive      Boolean   @default(true) // Current active version

  // NEW: Self-referencing relations for version history
  replaces      Measurement?  @relation("MeasurementHistory", fields: [replacesId], references: [id], onDelete: SetNull)
  replacedBy    Measurement[] @relation("MeasurementHistory")

  // NEW: Indexes for performance
  @@index([replacesId])
  @@index([isActive])
}
```

#### Key Design Decisions

1. **Self-Referencing Relation**: Uses a linked-list pattern where each measurement points to its predecessor via `replacesId`
2. **Soft Delete Pattern**: `isActive` flag ensures data is never truly deleted
3. **OnDelete: SetNull**: Prevents cascade deletion, preserving the full history chain
4. **Indexes**: Added for efficient querying of active measurements and history chains

### 2. API Endpoints

#### 2.1 Individual Measurement Operations

**File:** `app/api/customers/[id]/measurements/[measurementId]/route.ts`

##### GET - Retrieve Single Measurement
```typescript
GET /api/customers/:id/measurements/:measurementId
```

**Response:**
```json
{
  "measurement": {
    "id": "cm123",
    "garmentType": "SHIRT",
    "bodyType": "REGULAR",
    "chest": 102,
    "waist": 90,
    // ... all measurement fields
    "isActive": true,
    "createdBy": { "id": "user1", "name": "John Doe" },
    "replaces": { "id": "cm122" },
    "replacedBy": []
  }
}
```

##### PATCH - Update Measurement (Creates New Version)
```typescript
PATCH /api/customers/:id/measurements/:measurementId
```

**Request Body:**
```json
{
  "chest": 104,
  "waist": 92,
  "notes": "Customer gained weight"
}
```

**Process:**
1. Validates input with Zod schema
2. Marks existing measurement as `isActive: false`
3. Creates new measurement with:
   - Updated values from request
   - Unchanged values from existing measurement
   - `replacesId` pointing to old version
   - `isActive: true`
   - `userId` of current user

**Response:**
```json
{
  "measurement": { /* new version */ },
  "message": "Measurement updated successfully. Previous version preserved in history."
}
```

##### DELETE - Soft Delete Measurement
```typescript
DELETE /api/customers/:id/measurements/:measurementId
```

**Protection Logic:**
- Checks if measurement is referenced by any `Order` or `OrderItem`
- If referenced, returns 400 error with usage count
- If not referenced, sets `isActive: false`

**Error Response (if in use):**
```json
{
  "error": "Cannot delete measurement that is used in orders",
  "ordersCount": 3,
  "orderItemsCount": 5
}
```

#### 2.2 Measurement History

**File:** `app/api/customers/[id]/measurements/[measurementId]/history/route.ts`

##### GET - Retrieve Full Version History
```typescript
GET /api/customers/:id/measurements/:measurementId/history
```

**Algorithm:**
1. Fetches the specified measurement
2. Follows `replacesId` chain backwards (up to 100 iterations for safety)
3. Fetches newer versions that replaced this measurement
4. Returns complete timeline

**Response:**
```json
{
  "current": { /* current measurement */ },
  "history": [
    { /* version 3 (current) */ },
    { /* version 2 */ },
    { /* version 1 (original) */ }
  ],
  "newerVersions": [ /* if viewing old version */ ],
  "totalVersions": 3
}
```

#### 2.3 Updated List Endpoint

**File:** `app/api/customers/[id]/measurements/route.ts`

##### GET - List Measurements (Updated)
```typescript
GET /api/customers/:id/measurements?includeInactive=true
```

**Changes:**
- Added `includeInactive` query parameter
- By default, only returns `isActive: true` measurements
- Includes `createdBy` user details in response

**Updated Response:**
```json
{
  "measurements": [
    {
      "id": "cm123",
      "garmentType": "SHIRT",
      "isActive": true,
      "createdBy": {
        "id": "user1",
        "name": "John Doe",
        "email": "john@example.com"
      },
      // ... measurement fields
    }
  ]
}
```

##### POST - Create Measurement (Updated)
- Added `bodyType` to validation schema
- Added all new measurement fields (knee, bottomOpening, jacketLength, lapelWidth)
- Sets `isActive: true` by default
- Includes `createdBy` in response

### 3. UI Components

#### 3.1 MeasurementEditDialog

**File:** `components/measurement-edit-dialog.tsx`

**Purpose:** Unified dialog for creating and editing measurements

**Features:**
- Dual mode: `create` or `edit`
- Auto-populates form when editing
- Dynamic fields based on garment type (jacket fields for suits/sherwanis)
- Real-time number input handling
- Client-side form state management

**Key Props:**
```typescript
interface MeasurementEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: string
  measurement?: MeasurementData | null
  mode: 'create' | 'edit'
}
```

**Form Layout:**
1. **Garment Type & Body Type** (2-column grid)
2. **Common Measurements** (3-column grid)
   - Neck, Chest, Waist, Hip, Shoulder, Sleeve Length
   - Shirt Length, Inseam, Outseam, Thigh, Knee, Bottom Opening
3. **Suit/Sherwani Specific** (conditional)
   - Jacket Length, Lapel Width
4. **Notes** (full width textarea)

**API Integration:**
- **Create Mode**: `POST /api/customers/:id/measurements`
- **Edit Mode**: `PATCH /api/customers/:id/measurements/:measurementId`

**Error Handling:**
- Network errors displayed in alert box
- Form validation prevents submission of invalid data
- Loading states with spinner icon

#### 3.2 MeasurementHistoryDialog

**File:** `components/measurement-history-dialog.tsx`

**Purpose:** Visual timeline of measurement version history

**Features:**
- Vertical timeline with expandable cards
- Visual diff highlighting (changed values in orange with strikethrough of old value)
- Shows who created each version and when
- Collapsible sections to reduce cognitive load

**Timeline Design:**
```
● Current Version (green badge, filled circle)
│
● Version 2 (hollow circle)
│
● Version 1 (hollow circle)
```

**Change Highlighting:**
- **Changed fields**: Yellow background highlight
- **New value**: Orange text
- **Old value**: Gray strikethrough next to new value

**Example Change Display:**
```
Chest: 104 cm (previous: 102 cm)
       ↑         ↑
    orange    strikethrough
```

**Data Fetching:**
- Calls `/api/customers/:id/measurements/:measurementId/history` on open
- Caches results until dialog closes
- Shows loading spinner during fetch

**Expandable Sections:**
- Click anywhere on card header to expand/collapse
- Default: Current version expanded, others collapsed
- Stored in `Set<string>` for efficient lookup

#### 3.3 CustomerMeasurementsSection

**File:** `components/customer-measurements-section.tsx`

**Purpose:** Measurements section for customer detail page with CRUD operations

**Features:**
- Displays all active measurements
- Action buttons: History, Edit, Delete
- Delete confirmation dialog
- Permission-based button visibility
- Responsive grid layout

**Component Structure:**
```tsx
<Card>
  <CardHeader>
    <Title + "Add" Button>
  </CardHeader>
  <CardContent>
    {measurements.map(measurement => (
      <MeasurementCard>
        <Header: Type, Date, Body Type Badge>
        <Grid: Measurement Values>
        <Notes>
        <Actions: History | Edit | Delete>
      </MeasurementCard>
    ))}
  </CardContent>
</Card>

<MeasurementEditDialog />
<MeasurementHistoryDialog />
<AlertDialog /> {/* Delete confirmation */}
```

**State Management:**
```typescript
const [editDialogOpen, setEditDialogOpen] = useState(false)
const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
const [selectedMeasurement, setSelectedMeasurement] = useState<Measurement | null>(null)
```

**Delete Flow:**
1. User clicks "Delete" button
2. `AlertDialog` opens with confirmation
3. If confirmed, calls `DELETE /api/customers/:id/measurements/:measurementId`
4. If measurement is in use, shows error in dialog
5. If successful, closes dialog and refreshes page

**Permission Checks:**
- `canManage` prop controls visibility of action buttons
- Derived from `hasPermission(role, 'manage_customers')`

#### 3.4 AlertDialog (shadcn Component)

**File:** `components/ui/alert-dialog.tsx`

**Purpose:** Reusable confirmation dialog component

**Sub-Components:**
- `AlertDialog`: Root component
- `AlertDialogTrigger`: Button that opens dialog
- `AlertDialogContent`: Modal content container
- `AlertDialogHeader`: Title and description section
- `AlertDialogFooter`: Action buttons section
- `AlertDialogTitle`: Title text
- `AlertDialogDescription`: Descriptive text
- `AlertDialogAction`: Confirm button
- `AlertDialogCancel`: Cancel button

**Usage Example:**
```tsx
<AlertDialog open={open} onOpenChange={setOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleConfirm}>
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### 4. Customer Detail Page Integration

**File:** `app/(dashboard)/customers/[id]/page.tsx`

**Changes:**

1. **Imports:**
   - Added `CustomerMeasurementsSection` component
   - Added `hasPermission` utility
   - Removed `Ruler` icon (moved to child component)

2. **Data Fetching:**
   ```typescript
   measurements: {
     where: { isActive: true }, // ← NEW: Only fetch active measurements
     orderBy: { createdAt: 'desc' },
     include: {
       createdBy: { /* user details */ } // ← NEW: Include creator info
     }
   }
   ```

3. **Permission Check:**
   ```typescript
   const canManageMeasurements = hasPermission(
     session.user.role as any,
     'manage_customers'
   )
   ```

4. **Render:**
   - Replaced inline measurements JSX with:
   ```tsx
   <CustomerMeasurementsSection
     customerId={customer.id}
     measurements={customer.measurements as any}
     canManage={canManageMeasurements}
     highlight={highlight}
   />
   ```

5. **Removed:**
   - `garmentTypeLabels` constant (moved to child component)
   - Inline measurement display code (~110 lines)

### 5. Dependencies Added

**File:** `package.json`

```json
{
  "dependencies": {
    "@radix-ui/react-alert-dialog": "^1.1.15"
  }
}
```

**Reason:** Required for the `AlertDialog` component used in delete confirmations.

## Data Flow Diagrams

### Edit Measurement Flow

```
User clicks "Edit" on measurement
         ↓
CustomerMeasurementsSection sets selectedMeasurement and opens MeasurementEditDialog
         ↓
MeasurementEditDialog pre-fills form with existing values
         ↓
User modifies fields and clicks "Update Measurement"
         ↓
PATCH /api/customers/:id/measurements/:measurementId
         ↓
API Transaction:
  1. Mark old measurement isActive: false
  2. Create new measurement with:
     - Updated fields
     - replacesId → old measurement ID
     - isActive: true
     - userId: current user
         ↓
Dialog closes, router.refresh() reloads page
         ↓
Updated measurement displayed (old version hidden)
```

### View History Flow

```
User clicks "History" on measurement
         ↓
CustomerMeasurementsSection sets selectedMeasurement and opens MeasurementHistoryDialog
         ↓
MeasurementHistoryDialog fetches: GET /api/.../history
         ↓
API follows replacesId chain backwards:
  cm125 → cm124 → cm123 → cm122 → null
         ↓
Returns array: [cm125, cm124, cm123, cm122]
         ↓
Dialog renders timeline with:
  - Current version at top (expanded)
  - Previous versions below (collapsed)
  - Changed fields highlighted
         ↓
User expands a version to see all values
         ↓
Visual diff shows: New Value (Old Value strikethrough)
```

### Delete Measurement Flow

```
User clicks "Delete" on measurement
         ↓
AlertDialog opens with confirmation
         ↓
User confirms deletion
         ↓
DELETE /api/customers/:id/measurements/:measurementId
         ↓
API checks:
  - Is measurement used in orders?
  - Is measurement used in order items?
         ↓
If YES: Return 400 error with usage count
  ↓
  Display error in AlertDialog
         ↓
If NO: Set isActive: false
  ↓
  Close dialog, refresh page
  ↓
  Measurement no longer visible (soft deleted)
```

## Database Migration

### Migration Commands

```bash
# Development (schema changes only)
pnpm db:push

# Production (creates migration file)
pnpm db:migrate

# Regenerate Prisma Client
pnpm prisma generate
```

### Schema Changes Applied

1. Added `bodyType` field (enum: SLIM, REGULAR, LARGE, XL)
2. Added `replacesId` field (nullable string)
3. Added `isActive` field (boolean, default: true)
4. Added `replaces` relation (self-referencing)
5. Added `replacedBy` relation (self-referencing)
6. Added index on `replacesId`
7. Added index on `isActive`

### Data Migration Notes

**Existing Data:**
- All existing measurements will have `isActive: true` by default
- `replacesId` will be `null` (no history)
- `bodyType` will be `null` (nullable field)

**No Breaking Changes:**
- All existing API calls continue to work
- New fields are optional/nullable
- Default values prevent null errors

## API Compatibility

### Backwards Compatibility

All existing API endpoints remain functional:

1. **GET /api/customers/:id/measurements**
   - Old behavior: Returns all measurements
   - New behavior: Returns only active measurements
   - Migration: Add `?includeInactive=true` to get old behavior

2. **POST /api/customers/:id/measurements**
   - Old behavior: Creates measurement
   - New behavior: Creates measurement with `isActive: true`
   - Migration: None required (handled automatically)

### New Endpoints (No Breaking Changes)

- `GET /api/customers/:id/measurements/:measurementId` (new)
- `PATCH /api/customers/:id/measurements/:measurementId` (new)
- `DELETE /api/customers/:id/measurements/:measurementId` (new)
- `GET /api/customers/:id/measurements/:measurementId/history` (new)

## Testing Strategy

### Manual Testing Checklist

#### Create Measurement
- [ ] Open customer detail page
- [ ] Click "Add" button in measurements section
- [ ] Fill in measurement details
- [ ] Verify all fields save correctly
- [ ] Check measurement appears in list

#### Edit Measurement
- [ ] Click "Edit" on existing measurement
- [ ] Modify several fields
- [ ] Save changes
- [ ] Verify updated values display
- [ ] Click "History" and confirm 2 versions exist
- [ ] Verify changed fields are highlighted
- [ ] Verify old values shown as strikethrough

#### View History
- [ ] Edit measurement multiple times (3-4 edits)
- [ ] Click "History" button
- [ ] Verify all versions appear in timeline
- [ ] Expand each version
- [ ] Verify changed values highlighted
- [ ] Verify creator name and timestamp shown

#### Delete Measurement
- [ ] Create new measurement (not used in orders)
- [ ] Click "Delete" button
- [ ] Confirm deletion
- [ ] Verify measurement disappears
- [ ] Check database: `isActive` should be `false`

#### Delete Protection
- [ ] Find measurement used in an order
- [ ] Click "Delete" button
- [ ] Confirm deletion
- [ ] Verify error message displayed
- [ ] Verify measurement NOT deleted

#### Permission Checks
- [ ] Login as VIEWER role
- [ ] Navigate to customer detail page
- [ ] Verify "Add", "Edit", "Delete" buttons are hidden
- [ ] Verify can still view measurements

### API Testing

```bash
# List active measurements
curl http://localhost:3009/api/customers/{id}/measurements

# List all measurements (including inactive)
curl http://localhost:3009/api/customers/{id}/measurements?includeInactive=true

# Get single measurement
curl http://localhost:3009/api/customers/{id}/measurements/{measurementId}

# Update measurement
curl -X PATCH http://localhost:3009/api/customers/{id}/measurements/{measurementId} \
  -H "Content-Type: application/json" \
  -d '{"chest": 104, "waist": 92}'

# Get history
curl http://localhost:3009/api/customers/{id}/measurements/{measurementId}/history

# Delete measurement
curl -X DELETE http://localhost:3009/api/customers/{id}/measurements/{measurementId}
```

## Performance Considerations

### Database Queries

1. **History Chain Traversal:**
   - Iterative query pattern (N queries for N versions)
   - Safety limit: 100 iterations
   - Typical use case: 2-5 versions per measurement
   - Optimization: Could be improved with recursive CTE in future

2. **Index Usage:**
   - `isActive` index: Used in WHERE clause for list queries
   - `replacesId` index: Used in history traversal
   - `customerId` index: Existing, used in all queries

3. **Includes vs Joins:**
   - Uses Prisma's `include` for related data
   - N+1 query issue: Mitigated by Prisma's query optimization
   - `createdBy` user data: Selective fields reduce payload size

### Client-Side Performance

1. **Component Rendering:**
   - Measurements list: O(n) where n = number of measurements
   - History timeline: O(m) where m = number of versions
   - React.useState for local state (no Redux overhead)

2. **Dialog Optimization:**
   - Lazy loading: Dialogs only render when open
   - Data fetching: Only on dialog open
   - Cleanup: State reset on dialog close

3. **Network Optimization:**
   - Edit operation: Single PATCH request
   - History: Single GET request
   - Delete: Single DELETE request
   - No unnecessary re-fetches

## Security Considerations

### Authentication & Authorization

1. **API Protection:**
   - All endpoints use `requireAnyPermission()` middleware
   - View endpoints: Require `view_customers` permission
   - Modify endpoints: Require `manage_customers` permission

2. **Permission Matrix:**
   ```
   Role                | View | Create | Edit | Delete
   --------------------|------|--------|------|-------
   OWNER               | ✓    | ✓      | ✓    | ✓
   ADMIN               | ✓    | ✓      | ✓    | ✓
   INVENTORY_MANAGER   | ✓    | ✗      | ✗    | ✗
   SALES_MANAGER       | ✓    | ✓      | ✓    | ✓
   TAILOR              | ✓    | ✗      | ✗    | ✗
   VIEWER              | ✓    | ✗      | ✗    | ✗
   ```

3. **Data Validation:**
   - Zod schemas validate all input
   - Type checking prevents injection
   - Number fields: Float validation
   - String fields: Sanitized by Prisma

### Data Integrity

1. **Referential Integrity:**
   - `customerId` foreign key constraint
   - `userId` foreign key constraint
   - `replacesId` self-referencing constraint
   - `onDelete: SetNull` prevents orphaned records

2. **Transaction Safety:**
   - Edit operation uses `prisma.$transaction()`
   - Atomic update: Mark old inactive + Create new
   - Rollback on failure

3. **Soft Delete Protection:**
   - Checks for order usage before deletion
   - Returns error instead of deleting
   - Preserves data integrity

### Audit Trail

1. **Who:**
   - `userId` field tracks creator
   - `createdBy` relation provides user details
   - Displayed in history timeline

2. **What:**
   - Complete measurement data in each version
   - Changed fields visible in diff view
   - Notes field for context

3. **When:**
   - `createdAt` timestamp (auto-generated)
   - `updatedAt` timestamp (auto-updated)
   - Displayed in ISO format with timezone

## Future Enhancements

### Potential Improvements

1. **Performance Optimization:**
   - Use recursive CTE for history retrieval (single query)
   - Implement caching for frequently accessed measurements
   - Add pagination for customers with many measurements

2. **Feature Additions:**
   - Compare two versions side-by-side
   - Restore previous version (set as active)
   - Export measurement history to PDF
   - Add measurement templates for common garment types

3. **UX Improvements:**
   - Inline editing (no dialog)
   - Bulk edit multiple measurements
   - Visual measurement diagram
   - Unit conversion (cm ↔ inches)

4. **Audit Enhancements:**
   - Track IP address of changes
   - Add reason/notes field for edits
   - Email notifications on changes
   - Activity log for all customer-related changes

## Troubleshooting

### Common Issues

**Issue:** TypeScript error on `session.user.role`
```typescript
// Error: Type 'string' is not assignable to parameter of type 'UserRole'
hasPermission(session.user.role, 'manage_customers')

// Fix: Cast to any
hasPermission(session.user.role as any, 'manage_customers')
```

**Issue:** Prisma JSON field type error
```typescript
// Error: Type 'null' is not assignable to 'InputJsonValue'
additionalMeasurements: someValue ?? existingValue

// Fix: Convert null to undefined
additionalMeasurements: (someValue ?? existingValue) || undefined
```

**Issue:** Build fails with "Module not found: alert-dialog"
```bash
# Solution: Install missing dependency
pnpm add @radix-ui/react-alert-dialog

# Then create the component file
# components/ui/alert-dialog.tsx
```

**Issue:** Circular reference in history chain
```typescript
// Symptom: Infinite loop when fetching history
// Cause: Measurement A → B → A (circular)

// Prevention: Safety limit in loop
for (let i = 0; i < 100 && nextId; i++) {
  // ... fetch logic
}
```

## References

### Files Modified/Created

**Schema:**
- `prisma/schema.prisma` (modified)

**API Routes:**
- `app/api/customers/[id]/measurements/route.ts` (modified)
- `app/api/customers/[id]/measurements/[measurementId]/route.ts` (new)
- `app/api/customers/[id]/measurements/[measurementId]/history/route.ts` (new)

**UI Pages:**
- `app/(dashboard)/customers/[id]/page.tsx` (modified)

**Components:**
- `components/customer-measurements-section.tsx` (new)
- `components/measurement-edit-dialog.tsx` (new)
- `components/measurement-history-dialog.tsx` (new)
- `components/ui/alert-dialog.tsx` (new)

**Dependencies:**
- `package.json` (modified)
- `pnpm-lock.yaml` (modified)

### Related Documentation

- [Prisma Self Relations](https://www.prisma.io/docs/concepts/components/prisma-schema/relations/self-relations)
- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Radix UI Alert Dialog](https://www.radix-ui.com/docs/primitives/components/alert-dialog)
- [Zod Validation](https://zod.dev/)

### Useful Queries

```sql
-- Find all measurements for a customer (including history)
SELECT id, "garmentType", "isActive", "replacesId", "createdAt"
FROM "Measurement"
WHERE "customerId" = 'customer-id'
ORDER BY "createdAt" DESC;

-- Count versions per garment type
SELECT "garmentType", COUNT(*) as version_count
FROM "Measurement"
WHERE "customerId" = 'customer-id'
GROUP BY "garmentType";

-- Find measurements used in orders
SELECT m.id, COUNT(o.id) as order_count, COUNT(oi.id) as item_count
FROM "Measurement" m
LEFT JOIN "Order" o ON o."measurementId" = m.id
LEFT JOIN "OrderItem" oi ON oi."measurementId" = m.id
WHERE m."customerId" = 'customer-id'
GROUP BY m.id;
```

---

**Document Version:** 1.0
**Last Updated:** January 15, 2026
**Maintained By:** Development Team
