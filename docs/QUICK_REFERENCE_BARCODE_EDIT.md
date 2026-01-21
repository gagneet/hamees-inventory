# Quick Reference: Interactive Barcode Scanning (v0.18.3)

## Overview
Barcode scanning now opens actionable dialogs instead of just showing toast messages.

## User Flow

### Item Found
```
Scan → API Lookup → Item Found → Edit Dialog Opens → User Edits → Save → Refresh
```

### Item Not Found
```
Scan → API Lookup → Not Found → Add Form Opens (SKU pre-filled) → User Creates → Refresh
```

## Key Components

### ItemEditDialog
**Location:** `components/inventory/item-edit-dialog.tsx`

**Props:**
```typescript
{
  isOpen: boolean
  onClose: () => void
  itemType: 'cloth' | 'accessory'
  item: ClothItem | AccessoryItem
  userRole?: string
}
```

**Features:**
- Stock summary (Current, Reserved, Available)
- Color-coded status badges
- Inline field editing
- Role-based field visibility (hides pricing for TAILOR)
- Save validation
- "View Full Details" navigation

### Stock Status Logic
```typescript
Available = Current Stock - Reserved

if (available <= 0) → "Out of Stock" (red)
else if (available < minimum * 0.5) → "Critical" (red)
else if (available < minimum) → "Low Stock" (amber)
else → "In Stock" (green)
```

## API Endpoints

### Barcode Lookup
```
GET /api/inventory/barcode?barcode={sku}
```
**Response:**
```json
{
  "found": true,
  "type": "cloth" | "accessory",
  "item": { /* full item object */ }
}
```

### Update Cloth
```
PATCH /api/inventory/cloth/[id]
```
**Body:**
```json
{
  "name": "string",
  "type": "string",
  "brand": "string",
  "color": "string",
  "colorHex": "#hex",
  "pattern": "string",
  "quality": "string",
  "pricePerMeter": number,
  "currentStock": number,
  "minimum": number,
  "location": "string"
}
```
**Permission:** `manage_inventory`

### Update Accessory
```
PATCH /api/inventory/accessories/[id]
```
**Body:**
```json
{
  "type": "string",
  "name": "string",
  "color": "string",
  "currentStock": number,
  "pricePerUnit": number,
  "minimum": number
}
```
**Permission:** `manage_inventory`

## Permissions

| Action | Permission | Roles |
|--------|-----------|-------|
| Lookup | `view_inventory` | OWNER, ADMIN, INVENTORY_MGR, SALES_MGR, TAILOR |
| Edit | `manage_inventory` | OWNER, ADMIN, INVENTORY_MGR |
| Delete | `delete_inventory` | ADMIN only |

## Testing Quick Start

### Test Edit Flow
```bash
1. Go to /inventory
2. Click "Scan Barcode"
3. Enter: CLT-COT-ABC-158925
4. Edit dialog opens
5. Change "Current Stock" to 200.00
6. Click "Save Changes"
7. Verify: Toast shows "Success", list refreshes
```

### Test Create Flow
```bash
1. Click "Scan Barcode"
2. Enter: CLT-NEW-TEST-999
3. Add form opens with SKU pre-filled
4. Fill: Name, Type, Brand, Color, Stock, Price
5. Click "Create Cloth Item"
6. Verify: Toast shows "Success", new item in list
```

## Common Code Patterns

### Handle Scan Success
```typescript
const handleScanSuccess = async (barcode: string) => {
  const response = await fetch(`/api/inventory/barcode?barcode=${encodeURIComponent(barcode)}`)
  const result = await response.json()

  if (result.found) {
    setEditItem({ type: result.type, item: result.item })
    setShowEditDialog(true)
  } else {
    setActiveTab(barcode.startsWith('CLT-') ? 'cloth' : 'accessory')
    setShowAddForm(true)
  }
}
```

### Stock Status Badge
```tsx
const status = getStockStatus(item.currentStock, item.reserved, item.minimum)
<Badge variant={status.variant}>{status.label}</Badge>
```

### Role-Based Field Visibility
```tsx
{!isTailor && (
  <div>
    <Label>Price per Meter (₹)</Label>
    <Input type="number" {...} />
  </div>
)}
```

## Troubleshooting

### Dialog doesn't open
- Check: `showEditDialog` state is true
- Check: `editItem` is not null
- Verify: TypeScript types match interface

### 403 Forbidden on save
- Check: User has `manage_inventory` permission
- Roles allowed: OWNER, ADMIN, INVENTORY_MANAGER
- Not allowed: SALES_MANAGER, TAILOR, VIEWER

### Wrong status badge color
- Debug: `console.log({ currentStock, reserved, minimum, available })`
- Verify: Available = Current - Reserved
- Check: Badge variant matches stock calculation

## Files Modified

- `components/InventoryPageClient.tsx` - Main inventory page
- `components/inventory/item-edit-dialog.tsx` - Edit dialog component (NEW)
- `app/api/inventory/cloth/[id]/route.ts` - Cloth CRUD API (NEW)
- `app/api/inventory/accessories/[id]/route.ts` - Accessory CRUD API (NEW)
- `lib/permissions.ts` - Exported UserRole type

## Documentation

- Full docs: `docs/INTERACTIVE_BARCODE_SCANNING.md`
- Project overview: `CLAUDE.md`
- API reference: See full docs for complete API details

## Version Info

- **Version:** v0.18.3
- **Date:** January 21, 2026
- **Status:** ✅ Production Ready
- **Deployment:** https://hamees.gagneet.com
