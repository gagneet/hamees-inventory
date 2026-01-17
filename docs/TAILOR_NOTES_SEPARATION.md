# Tailor Notes Separation - Data Loss Prevention

## Problem

The tailor notes save functionality was appending to the `order.notes` field, which already contained customer instructions. While not directly overwriting, this mixed two different types of information in one field, making it difficult to:
- Edit tailor notes without affecting customer instructions
- Display them separately in the UI
- Maintain clear separation of concerns

## Solution

Added a separate `tailorNotes` field to the Order model to store tailor observations independently from customer instructions.

## Implementation Details

### Database Schema Changes

**File:** `prisma/schema.prisma`

```prisma
model Order {
  // ... other fields ...
  
  notes           String?   // Customer instructions and special requests
  tailorNotes     String?   // Tailor's observations and modifications (separate from customer notes)
  
  // ... other fields ...
}
```

### API Changes

**File:** `app/api/orders/[id]/route.ts`

1. **Validation Schema:**
```typescript
const orderEditSchema = z.object({
  // ... other fields ...
  notes: z.string().nullish(),
  tailorNotes: z.string().nullish(),  // Added
  // ... other fields ...
})
```

2. **Audit Tracking:**
```typescript
if (data.tailorNotes !== undefined && data.tailorNotes !== order.tailorNotes) {
  changes.push({
    field: 'tailorNotes',
    oldValue: order.tailorNotes || '(empty)',
    newValue: data.tailorNotes || '(empty)',
    description: 'Tailor notes updated',
  })
}
```

3. **Order Update:**
```typescript
await tx.order.update({
  where: { id },
  data: {
    // ... other fields ...
    notes: data.notes !== undefined ? data.notes : order.notes,
    tailorNotes: data.tailorNotes !== undefined ? data.tailorNotes : order.tailorNotes,
    // ... other fields ...
  },
})
```

### Component Changes

**File:** `components/orders/order-item-detail-dialog.tsx`

1. **Interface Update:**
```typescript
order: {
  id: string
  orderNumber: string
  // ... other fields ...
  notes?: string
  tailorNotes?: string  // Added
  // ... other fields ...
}
```

2. **State Initialization:**
```typescript
// Before:
const [tailorNotes, setTailorNotes] = useState('')

// After:
const [tailorNotes, setTailorNotes] = useState(orderItem.order.tailorNotes || '')
```

3. **Save Handler:**
```typescript
// Before: Appended to notes field
const existingNotes = orderItem.order.notes || ''
const separator = existingNotes ? '\n\n--- Tailor Notes ---\n' : ''
const updatedNotes = existingNotes + separator + tailorNotes
body: JSON.stringify({ notes: updatedNotes })

// After: Saves directly to tailorNotes field
body: JSON.stringify({ tailorNotes })
```

### Page Changes

**File:** `app/(dashboard)/orders/[id]/page.tsx`

Added `tailorNotes` to Prisma select query:
```typescript
const order = await prisma.order.findUnique({
  where: { id },
  select: {
    // ... other fields ...
    notes: true,
    tailorNotes: true,  // Added
    // ... other fields ...
  },
})
```

## UI Display

### Before
- Single section mixing customer instructions and tailor notes
- Difficult to distinguish between the two

### After
Two separate sections:

1. **Customer Instructions** (Amber Card)
   - Label: "Customer Instructions"
   - Field: `order.notes`
   - Read-only display
   - Never modified by tailor actions

2. **Tailor's Observations** (Green Card)
   - Label: "Tailor's Observations"
   - Field: `order.tailorNotes`
   - Editable textarea
   - Save button (requires `update_order` permission)

## Database Migration

⚠️ **Important:** Before deploying this change, run the database migration:

### Option 1: Using Prisma CLI
```bash
npx prisma db push
```

### Option 2: Using SQL (Production)
```sql
ALTER TABLE "Order" ADD COLUMN "tailorNotes" TEXT;
```

### Option 3: Create Migration File
```bash
npx prisma migrate dev --name add_tailor_notes_to_order
```

## Benefits

✅ **No Data Loss:** Customer instructions remain untouched when tailor saves notes
✅ **Clear Separation:** Two distinct fields for two different purposes
✅ **Better UI:** Separate visual sections with appropriate styling
✅ **Audit Trail:** Separate tracking for changes to each field
✅ **Backward Compatible:** Existing notes field unchanged, new field is optional

## Testing Checklist

- [ ] Run database migration in development
- [ ] Create a new order with customer instructions
- [ ] Add tailor notes and save
- [ ] Verify customer instructions remain unchanged
- [ ] Edit tailor notes multiple times
- [ ] Check order history shows separate entries for notes vs tailorNotes changes
- [ ] Test with users having different permissions
- [ ] Verify empty state handling (no notes, no tailorNotes)
- [ ] Test with existing orders (tailorNotes should be null/empty)

## Rollback Plan

If issues arise, revert by:
1. Remove `tailorNotes` field from schema
2. Restore previous component logic (append to notes)
3. Downgrade API to previous version
4. Optionally: `ALTER TABLE "Order" DROP COLUMN "tailorNotes";`

## Related Files

- `prisma/schema.prisma` - Database schema
- `app/api/orders/[id]/route.ts` - Order update API
- `components/orders/order-item-detail-dialog.tsx` - Dialog component
- `app/(dashboard)/orders/[id]/page.tsx` - Order detail page

## Commit Reference

- Commit: 21492d2
- PR: #19 (sub-PR)
- Review Comment: https://github.com/gagneet/hamees-inventory/pull/19#discussion_r2700712661
