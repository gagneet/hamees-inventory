# Interactive Barcode Scanning with Actionable Dialogs

**Version:** v0.18.3
**Date:** January 21, 2026
**Status:** ✅ Production Ready

## Overview

The Interactive Barcode Scanning system transforms the barcode lookup experience from informational toast messages to fully actionable dialogs. When users scan or manually enter a barcode:

- **Item Found** → Opens comprehensive edit dialog with all item details and inline editing capability
- **Item Not Found** → Opens add form with barcode pre-filled, ready to create new inventory item

This eliminates the previous "dead-end" experience where users saw a toast message but couldn't take immediate action.

---

## Table of Contents

1. [User Workflows](#user-workflows)
2. [Feature Highlights](#feature-highlights)
3. [Technical Architecture](#technical-architecture)
4. [API Documentation](#api-documentation)
5. [Component Documentation](#component-documentation)
6. [Database Schema](#database-schema)
7. [Permission Requirements](#permission-requirements)
8. [Testing Guide](#testing-guide)
9. [Troubleshooting](#troubleshooting)
10. [Future Enhancements](#future-enhancements)

---

## User Workflows

### Workflow 1: Edit Existing Item via Barcode Scan

```
User Action: Click "Scan Barcode" → Scan/Enter SKU (e.g., "CLT-COT-ABC-123456")
     ↓
System: Lookup barcode via API → Item found in database
     ↓
UI: Toast: "Item Found - Found cloth item: Premium Cotton Fabric. Opening editor..."
     ↓
Dialog Opens: ItemEditDialog with complete item details
     ↓
User: Edit fields (name, stock, price, location, etc.)
     ↓
User: Click "Save Changes"
     ↓
System: PATCH /api/inventory/cloth/[id] → Update database
     ↓
UI: Toast: "Success - Cloth item updated successfully"
     ↓
Result: Dialog closes, inventory list refreshes with updated data
```

**Use Cases:**
- Quick stock adjustment after physical count
- Update price when supplier changes pricing
- Change storage location after reorganization
- Correct data entry errors (typos in name, color, etc.)
- Update minimum stock thresholds

---

### Workflow 2: Create New Item via Barcode Scan

```
User Action: Click "Scan Barcode" → Scan/Enter new SKU (e.g., "CLT-SLK-XYZ-789")
     ↓
System: Lookup barcode via API → Item not found
     ↓
UI: Toast: "Item Not Found - No item found with barcode: CLT-SLK-XYZ-789. Opening form to create new item..."
     ↓
System: Auto-detect item type from barcode prefix
     - CLT-* → Switch to "Cloth" tab
     - ACC-* → Switch to "Accessories" tab
     ↓
Dialog Opens: Add Item form with SKU pre-filled
     ↓
User: Fill in item details (name, type, brand, color, stock, price, etc.)
     ↓
User: Click "Create Cloth Item" / "Create Accessory"
     ↓
System: POST /api/inventory/cloth or /api/inventory/accessories → Create in database
     ↓
UI: Toast: "Success - Cloth item created successfully"
     ↓
Result: Form closes, inventory list refreshes with new item
```

**Use Cases:**
- Add new fabric roll just received from supplier
- Register new accessory type not previously in system
- Onboard inventory during initial setup
- Quick data entry during receiving process

---

## Feature Highlights

### 1. **Comprehensive Edit Dialog**

**Visual Design:**
- **Header**: Item type icon, title, "View Full Details" button
- **Summary Section**:
  - SKU in monospace font
  - Status badge (In Stock/Low Stock/Critical/Out of Stock)
  - Stock metrics in 3-column grid:
    - Current Stock (total meters/units)
    - Reserved (meters reserved for orders)
    - Available (color-coded: green/amber/red)
- **Edit Form**: All editable fields with real-time validation
- **Supplier Info**: Read-only supplier card (blue background)
- **Actions**: Save Changes (green) and Cancel (gray)

**For Cloth Items:**
- Name, Type, Brand, Pattern, Quality
- Color (text + color picker with live preview)
- Current Stock, Minimum Stock (meters)
- Price per Meter (hidden for TAILOR role)
- Storage Location (Rack A1, Shelf B2, etc.)

**For Accessories:**
- Type (Button/Thread/Zipper/etc.), Name, Color
- Current Stock, Minimum Stock (units)
- Price per Unit (hidden for TAILOR role)

**Stock Status Indicators:**
```typescript
Available <= 0               → "Out of Stock" (red, destructive variant)
Available < Minimum * 0.5    → "Critical" (red, destructive variant)
Available < Minimum          → "Low Stock" (amber, default variant)
Available >= Minimum         → "In Stock" (green, default variant)
```

---

### 2. **Intelligent Add Form**

**Auto-Detection:**
- Barcode prefix `CLT-` → Auto-switches to "Cloth" tab
- Barcode prefix `ACC-` → Auto-switches to "Accessories" tab
- SKU field pre-filled with scanned barcode
- Form ready for data entry (name field auto-focused)

**Validation:**
- All required fields marked with asterisk (*)
- Numeric fields enforce step values (0.01 for prices, 1 for units)
- Color picker with hex code display
- Real-time form validation (Zod schemas on backend)

---

### 3. **Role-Based Field Visibility**

**TAILOR Role Restrictions:**
- Cannot see "Price per Meter" field
- Cannot see "Price per Unit" field
- Cannot see "Supplier" dropdown
- Can view and edit stock quantities
- Can view and edit storage locations

**All Other Roles:**
- Full access to all fields
- Pricing information visible
- Supplier selection available

---

### 4. **Enhanced Toast Notifications**

**Before (v0.18.2 and earlier):**
```
Toast: "Item Found"
Description: "Found cloth item: Premium Cotton Fabric"
User Action: None (message dismissed, no next step)
```

**After (v0.18.3):**
```
Toast: "Item Found"
Description: "Found cloth item: Premium Cotton Fabric. Opening editor..."
User Action: Edit dialog opens automatically, user can take immediate action
```

---

## Technical Architecture

### Component Hierarchy

```
InventoryPageClient.tsx (Main Page)
├── BarcodeScannerImproved.tsx (Scanner Modal)
│   ├── Camera Mode (Native Barcode Detection API)
│   └── Manual Entry Mode (Text Input)
├── ItemEditDialog.tsx (Edit Dialog - NEW)
│   ├── Cloth Edit Form
│   └── Accessory Edit Form
└── Add Item Form (Modal)
    ├── Cloth Tab
    └── Accessory Tab
```

### State Management Flow

**InventoryPageClient.tsx** manages:

```typescript
// Scanner state
const [showScanner, setShowScanner] = useState(false)
const [scannedBarcode, setScannedBarcode] = useState<string | null>(null)
const [isLoading, setIsLoading] = useState(false)

// Edit dialog state
const [showEditDialog, setShowEditDialog] = useState(false)
const [editItem, setEditItem] = useState<{
  type: 'cloth' | 'accessory'
  item: ClothInventoryItem | AccessoryInventoryItem
} | null>(null)

// Add form state
const [showAddForm, setShowAddForm] = useState(false)
const [activeTab, setActiveTab] = useState<'cloth' | 'accessory'>('cloth')

// Inventory data
const [clothInventory, setClothInventory] = useState<ClothInventoryItem[]>([])
const [accessoryInventory, setAccessoryInventory] = useState<AccessoryInventoryItem[]>([])
```

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ User scans barcode: "CLT-COT-ABC-123456"                        │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
        ┌────────────────────────────────────────┐
        │ handleScanSuccess(barcode)             │
        │ - setScannedBarcode(barcode)           │
        │ - setShowScanner(false)                │
        │ - setIsLoading(true)                   │
        └────────────────┬───────────────────────┘
                         ↓
        ┌────────────────────────────────────────┐
        │ API Call:                              │
        │ GET /api/inventory/barcode?barcode=... │
        └────────────────┬───────────────────────┘
                         ↓
              ┌──────────┴──────────┐
              ↓                     ↓
    ┌─────────────────┐   ┌─────────────────┐
    │ Item Found      │   │ Item Not Found  │
    │ result.found=true│  │ result.found=false│
    └────────┬────────┘   └────────┬────────┘
             ↓                     ↓
    ┌─────────────────┐   ┌─────────────────┐
    │ setEditItem()   │   │ Detect type:    │
    │ setShowEditDialog│  │ CLT-* → 'cloth' │
    │ Toast: Found    │   │ ACC-* → 'accessory'│
    └────────┬────────┘   └────────┬────────┘
             ↓                     ↓
    ┌─────────────────┐   ┌─────────────────┐
    │ ItemEditDialog  │   │ setActiveTab()  │
    │ opens with data │   │ setShowAddForm()│
    │                 │   │ Toast: Not Found│
    └─────────────────┘   └─────────────────┘
```

---

## API Documentation

### 1. Barcode Lookup API

**Endpoint:** `GET /api/inventory/barcode`

**Query Parameters:**
- `barcode` (required): The SKU/barcode to lookup

**Response (Item Found - Cloth):**
```json
{
  "found": true,
  "type": "cloth",
  "item": {
    "id": "cm59ew0fl0002mgp5c8nvgz2t",
    "sku": "CLT-COT-ABC-123456",
    "name": "Premium Cotton Fabric",
    "type": "Cotton",
    "brand": "ABC Fabrics",
    "color": "Blue",
    "colorHex": "#0000FF",
    "pattern": "Plain",
    "quality": "Premium",
    "pricePerMeter": 250.00,
    "currentStock": 150.50,
    "reserved": 25.00,
    "minimum": 20.00,
    "supplier": "sup_123",
    "location": "Rack A1",
    "supplierRel": {
      "id": "sup_123",
      "name": "ABC Fabrics Ltd.",
      "email": "contact@abcfabrics.com",
      "phone": "+91-9876543210"
    },
    "createdAt": "2025-07-01T10:30:00.000Z",
    "updatedAt": "2026-01-15T14:22:00.000Z"
  }
}
```

**Response (Item Found - Accessory):**
```json
{
  "found": true,
  "type": "accessory",
  "item": {
    "id": "cm59ew0fl0003acc5xyz",
    "sku": "ACC-BUT-001",
    "type": "Button",
    "name": "Premium Metal Button",
    "color": "Gold",
    "currentStock": 500,
    "pricePerUnit": 5.00,
    "minimum": 100,
    "supplier": "sup_456",
    "supplierRel": {
      "id": "sup_456",
      "name": "XYZ Accessories",
      "email": "sales@xyzacc.com"
    },
    "createdAt": "2025-08-10T09:00:00.000Z",
    "updatedAt": "2026-01-10T11:30:00.000Z"
  }
}
```

**Response (Item Not Found):**
```json
{
  "found": false,
  "barcode": "CLT-NEW-TEST-999"
}
```

**Error Responses:**
```json
// 400 Bad Request
{
  "error": "Barcode parameter is required"
}

// 401 Unauthorized
{
  "error": "Unauthorized"
}

// 500 Internal Server Error
{
  "error": "Failed to lookup barcode"
}
```

---

### 2. Get Cloth Item API

**Endpoint:** `GET /api/inventory/cloth/[id]`

**Path Parameters:**
- `id` (required): Cloth inventory item ID

**Response:**
```json
{
  "id": "cm59ew0fl0002mgp5c8nvgz2t",
  "sku": "CLT-COT-ABC-123456",
  "name": "Premium Cotton Fabric",
  "type": "Cotton",
  "brand": "ABC Fabrics",
  "color": "Blue",
  "colorHex": "#0000FF",
  "pattern": "Plain",
  "quality": "Premium",
  "pricePerMeter": 250.00,
  "currentStock": 150.50,
  "reserved": 25.00,
  "minimum": 20.00,
  "supplier": "sup_123",
  "location": "Rack A1",
  "notes": null,
  "supplierRel": {
    "id": "sup_123",
    "name": "ABC Fabrics Ltd.",
    "email": "contact@abcfabrics.com",
    "phone": "+91-9876543210",
    "address": "123 Textile Street, Mumbai",
    "rating": 5
  },
  "stockMovements": [
    {
      "id": "sm_001",
      "type": "PURCHASE",
      "quantity": 50.00,
      "balanceAfter": 150.50,
      "createdAt": "2026-01-15T10:00:00.000Z",
      "user": { "name": "Inventory Manager" }
    },
    // ... last 10 stock movements
  ],
  "createdAt": "2025-07-01T10:30:00.000Z",
  "updatedAt": "2026-01-15T14:22:00.000Z"
}
```

**Error Responses:**
```json
// 401 Unauthorized
{ "error": "Unauthorized" }

// 404 Not Found
{ "error": "Item not found" }

// 500 Internal Server Error
{ "error": "Failed to fetch item" }
```

---

### 3. Update Cloth Item API

**Endpoint:** `PATCH /api/inventory/cloth/[id]`

**Path Parameters:**
- `id` (required): Cloth inventory item ID

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <session-token>
```

**Request Body:**
```json
{
  "name": "Premium Cotton Fabric - Updated",
  "type": "Cotton Blend",
  "brand": "ABC Fabrics",
  "color": "Navy Blue",
  "colorHex": "#000080",
  "pattern": "Plain",
  "quality": "Premium",
  "pricePerMeter": 275.00,
  "currentStock": 180.50,
  "minimum": 25.00,
  "location": "Rack B1",
  "notes": "Updated stock after physical count"
}
```

**Validation Schema (Zod):**
```typescript
const updateClothSchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  brand: z.string().optional(),
  color: z.string().optional(),
  colorHex: z.string().optional(),
  pattern: z.string().optional(),
  quality: z.string().optional(),
  pricePerMeter: z.number().optional(),
  currentStock: z.number().optional(),
  minimum: z.number().optional(),
  location: z.string().nullish(),
  notes: z.string().nullish(),
})
```

**Response (Success):**
```json
{
  "id": "cm59ew0fl0002mgp5c8nvgz2t",
  "sku": "CLT-COT-ABC-123456",
  "name": "Premium Cotton Fabric - Updated",
  "type": "Cotton Blend",
  "brand": "ABC Fabrics",
  "color": "Navy Blue",
  "colorHex": "#000080",
  "pattern": "Plain",
  "quality": "Premium",
  "pricePerMeter": 275.00,
  "currentStock": 180.50,
  "reserved": 25.00,
  "minimum": 25.00,
  "supplier": "sup_123",
  "location": "Rack B1",
  "notes": "Updated stock after physical count",
  "supplierRel": {
    "id": "sup_123",
    "name": "ABC Fabrics Ltd."
  },
  "updatedAt": "2026-01-21T16:45:00.000Z"
}
```

**Error Responses:**
```json
// 400 Bad Request (Validation Failed)
{
  "error": "Validation failed",
  "details": [
    {
      "code": "invalid_type",
      "expected": "number",
      "received": "string",
      "path": ["pricePerMeter"],
      "message": "Expected number, received string"
    }
  ]
}

// 401 Unauthorized
{ "error": "Unauthorized" }

// 403 Forbidden (No manage_inventory permission)
{ "error": "Forbidden" }

// 404 Not Found
{ "error": "Item not found" }

// 500 Internal Server Error
{ "error": "Failed to update item" }
```

**Permission Required:** `manage_inventory`

**Accessible to Roles:**
- OWNER ✅
- ADMIN ✅
- INVENTORY_MANAGER ✅
- SALES_MANAGER ❌
- TAILOR ❌
- VIEWER ❌

---

### 4. Delete Cloth Item API

**Endpoint:** `DELETE /api/inventory/cloth/[id]`

**Path Parameters:**
- `id` (required): Cloth inventory item ID

**Response (Success):**
```json
{
  "success": true
}
```

**Error Responses:**
```json
// 400 Bad Request (Item used in orders)
{
  "error": "Cannot delete item that is used in orders"
}

// 401 Unauthorized
{ "error": "Unauthorized" }

// 403 Forbidden (No delete_inventory permission)
{ "error": "Forbidden" }

// 404 Not Found
{ "error": "Item not found" }

// 500 Internal Server Error
{ "error": "Failed to delete item" }
```

**Permission Required:** `delete_inventory`

**Accessible to Roles:**
- OWNER ❌ (No delete permissions)
- ADMIN ✅ (Only role with delete permissions)
- INVENTORY_MANAGER ❌
- SALES_MANAGER ❌
- TAILOR ❌
- VIEWER ❌

**Protection Logic:**
- System checks if item is referenced in any `OrderItem` records
- If `orderItems.length > 0`, deletion is blocked
- Prevents data integrity issues and broken order references

---

### 5. Update Accessory Item API

**Endpoint:** `PATCH /api/inventory/accessories/[id]`

**Path Parameters:**
- `id` (required): Accessory inventory item ID

**Request Body:**
```json
{
  "type": "Button",
  "name": "Premium Metal Button - Gold Plated",
  "color": "Gold",
  "currentStock": 650,
  "pricePerUnit": 6.50,
  "minimum": 150,
  "notes": "Increased minimum due to high demand"
}
```

**Validation Schema (Zod):**
```typescript
const updateAccessorySchema = z.object({
  type: z.string().optional(),
  name: z.string().optional(),
  color: z.string().nullish(),
  currentStock: z.number().int().optional(),
  pricePerUnit: z.number().optional(),
  minimum: z.number().int().optional(),
  notes: z.string().nullish(),
})
```

**Response (Success):**
```json
{
  "id": "cm59ew0fl0003acc5xyz",
  "sku": "ACC-BUT-001",
  "type": "Button",
  "name": "Premium Metal Button - Gold Plated",
  "color": "Gold",
  "currentStock": 650,
  "pricePerUnit": 6.50,
  "minimum": 150,
  "supplier": "sup_456",
  "notes": "Increased minimum due to high demand",
  "supplierRel": {
    "id": "sup_456",
    "name": "XYZ Accessories"
  },
  "updatedAt": "2026-01-21T16:50:00.000Z"
}
```

**Error Responses:** (Same as cloth update API)

**Permission Required:** `manage_inventory`

---

### 6. Delete Accessory Item API

**Endpoint:** `DELETE /api/inventory/accessories/[id]`

**Path Parameters:**
- `id` (required): Accessory inventory item ID

**Response (Success):**
```json
{
  "success": true
}
```

**Error Responses:** (Same as cloth delete API, except no order check)

**Permission Required:** `delete_inventory`

**Protection Logic:**
- Deletes accessory item
- Cascade deletes related `GarmentAccessory` records (via Prisma cascade)
- No order check (accessories not directly linked to orders)

---

## Component Documentation

### ItemEditDialog Component

**Location:** `components/inventory/item-edit-dialog.tsx`

**Props Interface:**
```typescript
interface ItemEditDialogProps {
  isOpen: boolean                  // Dialog visibility state
  onClose: () => void              // Close handler (cleanup function)
  itemType: 'cloth' | 'accessory'  // Item type to determine form layout
  item: ClothItem | AccessoryItem  // Item data to edit
  userRole?: string                // User role for field visibility
}
```

**Item Type Definitions:**
```typescript
interface ClothItem {
  id: string
  sku: string
  name: string
  type: string
  brand: string
  color: string
  colorHex: string
  pattern: string
  quality: string
  pricePerMeter: number
  currentStock: number
  reserved: number
  minimum: number
  supplier: string
  location?: string
  supplierRel?: { name: string; id: string }
}

interface AccessoryItem {
  id: string
  sku: string
  type: string
  name: string
  color?: string
  currentStock: number
  pricePerUnit: number
  minimum: number
  supplier: string
  supplierRel?: { name: string; id: string }
}
```

**Usage Example:**
```tsx
import { ItemEditDialog } from '@/components/inventory/item-edit-dialog'

// In parent component
const [showEditDialog, setShowEditDialog] = useState(false)
const [editItem, setEditItem] = useState<{
  type: 'cloth' | 'accessory'
  item: ClothInventoryItem | AccessoryInventoryItem
} | null>(null)

// When barcode scan returns an item
const handleItemFound = (result) => {
  setEditItem({
    type: result.type,
    item: result.item
  })
  setShowEditDialog(true)
}

// In JSX
{showEditDialog && editItem && (
  <ItemEditDialog
    isOpen={showEditDialog}
    onClose={() => {
      setShowEditDialog(false)
      setEditItem(null)
      fetchInventory() // Refresh list
    }}
    itemType={editItem.type}
    item={editItem.item}
    userRole={session?.user?.role}
  />
)}
```

**Component Features:**

1. **Stock Status Calculation**
```typescript
const getStockStatus = (current: number, reserved: number, minimum: number) => {
  const available = current - (reserved || 0)
  if (available <= 0) return {
    label: "Out of Stock",
    variant: "destructive",
    color: "text-red-600"
  }
  if (available < minimum * 0.5) return {
    label: "Critical",
    variant: "destructive",
    color: "text-red-600"
  }
  if (available < minimum) return {
    label: "Low Stock",
    variant: "default",
    color: "text-amber-600"
  }
  return {
    label: "In Stock",
    variant: "default",
    color: "text-green-600"
  }
}
```

2. **Form State Management**
```typescript
const [isLoading, setIsLoading] = useState(false)
const [formData, setFormData] = useState(item) // Initialize with item data

const handleFieldChange = (field: string, value: string | number) => {
  setFormData(prev => ({ ...prev, [field]: value }))
}
```

3. **Form Submission**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setIsLoading(true)

  try {
    const endpoint = itemType === 'cloth'
      ? `/api/inventory/cloth/${item.id}`
      : `/api/inventory/accessories/${item.id}`

    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })

    if (!response.ok) throw new Error('Failed to update item')

    toast({ title: "Success", description: "Item updated successfully" })
    onClose()
    router.refresh()
  } catch (error) {
    toast({ variant: "destructive", title: "Error", description: "Failed to update item" })
  } finally {
    setIsLoading(false)
  }
}
```

4. **Navigation to Full Details**
```typescript
const handleViewDetails = () => {
  const detailPath = itemType === 'cloth'
    ? `/inventory/cloth/${item.id}`
    : `/inventory/accessories/${item.id}`
  router.push(detailPath)
  onClose()
}
```

**Accessibility:**
- Keyboard navigation (Tab, Shift+Tab, Enter, Escape)
- ARIA labels for form fields
- Focus management (auto-focus on first field)
- Screen reader friendly status badges
- High contrast colors for status indicators (WCAG AAA compliant)

**Responsive Design:**
- Max width: 3xl (768px) for cloth, 2xl (672px) for accessories
- Max height: 90vh with vertical scroll
- Mobile-friendly form layout (grid collapses to single column)
- Touch-friendly button sizes (44px minimum)

---

## Database Schema

### ClothInventory Table

```prisma
model ClothInventory {
  id              String            @id @default(cuid())
  sku             String            @unique
  name            String
  type            String            // Cotton, Silk, Wool, etc.
  brand           String
  color           String
  colorHex        String            @default("#000000")
  pattern         String            // Plain, Striped, Checked, etc.
  quality         String            // Premium, Standard, Economy
  pricePerMeter   Float
  currentStock    Float             // Total meters in warehouse
  reserved        Float             @default(0) // Meters reserved for orders
  minimum         Float             // Reorder threshold
  supplier        String
  location        String?           // Storage location (Rack A1, etc.)
  notes           String?

  // Relations
  supplierRel     Supplier          @relation(fields: [supplier], references: [id])
  orderItems      OrderItem[]
  stockMovements  StockMovement[]

  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@index([sku])
  @@index([type])
  @@index([supplier])
  @@map("cloth_inventory")
}
```

**Key Fields for Edit Dialog:**
- `currentStock` - Total inventory
- `reserved` - Amount allocated to pending orders
- `minimum` - Low stock threshold for alerts
- `location` - Physical storage location (helpful for tailors)
- `supplierRel` - Populated via include for supplier name display

**Available Stock Calculation:**
```typescript
const available = currentStock - reserved
```

---

### AccessoryInventory Table

```prisma
model AccessoryInventory {
  id              String            @id @default(cuid())
  sku             String            @unique
  type            String            // Button, Thread, Zipper, etc.
  name            String
  color           String?
  currentStock    Int               // Total units in warehouse
  pricePerUnit    Float
  minimum         Int               // Reorder threshold
  supplier        String
  notes           String?

  // Relations
  supplierRel     Supplier          @relation(fields: [supplier], references: [id])
  garmentAccessories GarmentAccessory[]

  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@index([sku])
  @@index([type])
  @@index([supplier])
  @@map("accessory_inventory")
}
```

**Key Differences from Cloth:**
- `currentStock` is `Int` (units) vs `Float` (meters)
- No `reserved` field (accessories not directly reserved for orders)
- Linked to `GarmentAccessory` (garment patterns) instead of orders

---

## Permission Requirements

### Permission Matrix

| Action | Permission | Roles Allowed |
|--------|-----------|---------------|
| **View** barcode scanner | `view_inventory` | OWNER, ADMIN, INVENTORY_MANAGER, SALES_MANAGER, TAILOR |
| **Scan** barcode (lookup) | `view_inventory` | OWNER, ADMIN, INVENTORY_MANAGER, SALES_MANAGER, TAILOR |
| **Edit** inventory item | `manage_inventory` | OWNER, ADMIN, INVENTORY_MANAGER |
| **Delete** inventory item | `delete_inventory` | ADMIN only |
| **View** pricing fields | Not TAILOR role | OWNER, ADMIN, INVENTORY_MANAGER, SALES_MANAGER |
| **Create** new item | `add_inventory` | OWNER, ADMIN, INVENTORY_MANAGER |

### Permission Checks in Code

**Frontend (UI Visibility):**
```tsx
// Hide pricing fields for TAILOR
{!isTailor && (
  <div className="space-y-2">
    <Label htmlFor="pricePerMeter">Price per Meter (₹) *</Label>
    <Input
      id="pricePerMeter"
      type="number"
      step="0.01"
      value={formData.pricePerMeter}
      onChange={(e) => handleFieldChange('pricePerMeter', parseFloat(e.target.value))}
      required
    />
  </div>
)}
```

**Backend (API Endpoints):**
```typescript
// PATCH /api/inventory/cloth/[id]
const session = await auth()
if (!session?.user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

if (!hasPermission(session.user.role as UserRole, 'manage_inventory')) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

---

## Testing Guide

### Manual Testing Scenarios

#### Test 1: Edit Existing Cloth Item

**Prerequisites:**
- Login as OWNER, ADMIN, or INVENTORY_MANAGER
- Navigate to https://hamees.gagneet.com/inventory

**Steps:**
1. Click "Scan Barcode" button
2. Switch to "Manual" mode
3. Enter existing SKU: `CLT-COT-ABC-158925`
4. Click "Look Up"

**Expected Results:**
- ✅ Toast: "Item Found - Found cloth item: Premium Cotton. Opening editor..."
- ✅ Edit dialog opens with all item details
- ✅ Stock summary shows: Current Stock, Reserved, Available
- ✅ Status badge shows correct stock status (In Stock/Low/Critical)
- ✅ All fields populated with current values
- ✅ Color picker shows current color with hex code
- ✅ Supplier card shows supplier name (read-only, blue background)
- ✅ "Save Changes" and "Cancel" buttons visible
- ✅ "View Full Details" button visible in header

**Modify Data:**
5. Change "Current Stock" from 150.50 to 180.00
6. Change "Minimum Stock" from 20.00 to 25.00
7. Change "Location" from "Rack A1" to "Rack B2"
8. Click "Save Changes"

**Expected Results:**
- ✅ Loading state shows "Saving..." on button
- ✅ API call: `PATCH /api/inventory/cloth/[id]`
- ✅ Toast: "Success - Cloth item updated successfully"
- ✅ Dialog closes
- ✅ Inventory list refreshes
- ✅ Updated item shows new values in table
- ✅ Status badge updates if stock status changed

---

#### Test 2: Edit Existing Accessory Item

**Steps:**
1. Click "Scan Barcode"
2. Enter existing accessory SKU: `ACC-BUT-178925`
3. Click "Look Up"

**Expected Results:**
- ✅ Toast: "Item Found - Found accessory item: Premium Metal Button. Opening editor..."
- ✅ Edit dialog opens with accessory form layout
- ✅ Type dropdown shows current type (Button/Thread/Zipper/etc.)
- ✅ Stock summary shows: Current Stock (units), Minimum Stock (units)
- ✅ No "Reserved" field (accessories don't have reservation)
- ✅ Price per Unit field visible (unless TAILOR role)

**Modify Data:**
4. Change "Current Stock" from 500 to 650
5. Change "Minimum Stock" from 100 to 150
6. Change "Price per Unit" from ₹5.00 to ₹6.50
7. Click "Save Changes"

**Expected Results:**
- ✅ API call: `PATCH /api/inventory/accessories/[id]`
- ✅ Toast: "Success - Accessory item updated successfully"
- ✅ Dialog closes and list refreshes

---

#### Test 3: Create New Item (Item Not Found)

**Steps:**
1. Click "Scan Barcode"
2. Enter non-existent SKU: `CLT-NEW-TEST-999`
3. Click "Look Up"

**Expected Results:**
- ✅ Toast: "Item Not Found - No item found with barcode: CLT-NEW-TEST-999. Opening form to create new item..."
- ✅ Add Item form modal opens
- ✅ Active tab auto-switches to "Cloth" (detected from CLT- prefix)
- ✅ SKU field pre-filled with "CLT-NEW-TEST-999"
- ✅ Name field auto-focused (cursor ready for typing)

**Fill Form:**
4. Name: "Test Cotton Fabric"
5. Type: "Cotton"
6. Brand: "Test Brand"
7. Color: "Red", Color Code: #FF0000
8. Pattern: "Plain"
9. Quality: "Standard"
10. Current Stock: 50.00
11. Minimum Stock: 10.00
12. Price per Meter: ₹200.00
13. Supplier: "ABC Fabrics"
14. Location: "Rack C1"
15. Click "Create Cloth Item"

**Expected Results:**
- ✅ API call: `POST /api/inventory/cloth`
- ✅ Toast: "Success - Cloth item created successfully"
- ✅ Form closes
- ✅ Inventory list refreshes
- ✅ New item appears in table with SKU "CLT-NEW-TEST-999"

---

#### Test 4: TAILOR Role - Hidden Pricing Fields

**Prerequisites:**
- Login as TAILOR role
- Email: `tailor@hameesattire.com`
- Password: `admin123`

**Steps:**
1. Navigate to /inventory
2. Click "Scan Barcode"
3. Enter: `CLT-COT-ABC-158925`
4. Click "Look Up"

**Expected Results (Edit Dialog):**
- ✅ Edit dialog opens
- ✅ All non-pricing fields visible and editable:
  - Name, Type, Brand, Color, Pattern, Quality ✅
  - Current Stock, Minimum Stock, Location ✅
- ✅ Pricing fields HIDDEN:
  - "Price per Meter" field not visible ❌
  - Supplier dropdown not visible ❌
- ✅ Supplier info card still visible (read-only)
- ✅ Can modify stock and location
- ✅ Can save changes successfully

**Steps (Add Form):**
5. Close dialog
6. Click "Add Item" button
7. Verify form layout

**Expected Results (Add Form):**
- ✅ "Price per Meter" field HIDDEN ❌
- ✅ "Supplier" dropdown HIDDEN ❌
- ✅ All other fields visible ✅
- ✅ Can create item without pricing (backend auto-fills or validates)

---

#### Test 5: Permission Denied Scenarios

**Test 5a: SALES_MANAGER tries to edit inventory**

**Prerequisites:**
- Login as SALES_MANAGER
- Email: `sales@hameesattire.com`
- Password: `admin123`

**Steps:**
1. Navigate to /inventory
2. Click "Scan Barcode"
3. Enter: `CLT-COT-ABC-158925`
4. Click "Look Up"

**Expected Results:**
- ✅ API call succeeds (lookup allowed for all roles with view_inventory)
- ✅ Edit dialog opens
- ✅ User can VIEW all item details
- ✅ User can modify form fields
- ✅ Click "Save Changes"
- ❌ API call: `PATCH /api/inventory/cloth/[id]` returns 403 Forbidden
- ✅ Toast: "Error - Failed to update item"
- ❌ Changes NOT saved

**Reason:** SALES_MANAGER does not have `manage_inventory` permission

---

**Test 5b: ADMIN tries to delete item**

**Prerequisites:**
- Login as ADMIN
- Email: `admin@hameesattire.com`
- Password: `admin123`

**Steps:**
1. Navigate to /inventory/cloth/[id] (full detail page)
2. Click "Delete Item" button (if exists)

**Expected Results:**
- ✅ API call: `DELETE /api/inventory/cloth/[id]` succeeds
- ✅ Toast: "Success - Item deleted"
- ✅ Redirect to inventory list
- ✅ Item removed from database

**Test 5c: OWNER tries to delete item**

**Prerequisites:**
- Login as OWNER
- Email: `owner@hameesattire.com`
- Password: `admin123`

**Steps:**
1. Navigate to /inventory/cloth/[id]
2. Try to delete item

**Expected Results:**
- ❌ API call: `DELETE /api/inventory/cloth/[id]` returns 403 Forbidden
- ✅ Toast: "Error - Forbidden"
- ❌ Item NOT deleted

**Reason:** OWNER does not have `delete_inventory` permission (only ADMIN has delete permissions)

---

#### Test 6: Stock Status Badge Accuracy

**Test Data Setup:**
Create or modify items with different stock levels:

| Item | Current Stock | Reserved | Minimum | Available | Expected Status |
|------|--------------|----------|---------|-----------|-----------------|
| A    | 100.00       | 0.00     | 20.00   | 100.00    | In Stock (green) |
| B    | 25.00        | 5.00     | 20.00   | 20.00     | In Stock (green) |
| C    | 18.00        | 3.00     | 20.00   | 15.00     | Low Stock (amber) |
| D    | 12.00        | 4.00     | 20.00   | 8.00      | Critical (red) |
| E    | 5.00         | 5.00     | 20.00   | 0.00      | Out of Stock (red) |

**Steps:**
1. Scan each item's barcode
2. Verify status badge color and text

**Expected Results:**
- ✅ Item A: Badge shows "In Stock" with default variant (gray/blue outline)
- ✅ Item B: Badge shows "In Stock" (exactly at threshold)
- ✅ Item C: Badge shows "Low Stock" with default variant (amber text)
- ✅ Item D: Badge shows "Critical" with destructive variant (red bg)
- ✅ Item E: Badge shows "Out of Stock" with destructive variant (red bg)

---

#### Test 7: Validation Errors

**Test 7a: Invalid numeric input**

**Steps:**
1. Scan item: `CLT-COT-ABC-158925`
2. Edit dialog opens
3. Change "Current Stock" to "abc" (non-numeric text)
4. Click "Save Changes"

**Expected Results:**
- ✅ Browser validation: "Please enter a number" (HTML5 input validation)
- ❌ Form does NOT submit
- ❌ No API call made

**Test 7b: Negative stock values**

**Steps:**
1. Change "Current Stock" to "-50.00"
2. Click "Save Changes"

**Expected Results:**
- ✅ Form submits (client-side allows negative for adjustment)
- ✅ API call made
- ✅ Backend accepts (business logic allows adjustments)
- ✅ Stock updated to negative value
- ✅ Status badge shows "Out of Stock"

**Test 7c: Missing required fields**

**Steps:**
1. Scan: `CLT-NEW-TEST-888` (not found)
2. Add form opens
3. Fill only "Name" field
4. Leave all other required fields empty
5. Click "Create Cloth Item"

**Expected Results:**
- ✅ Browser validation: "Please fill out this field"
- ❌ Form does NOT submit
- ❌ No API call made

---

#### Test 8: Network Error Handling

**Test 8a: API timeout simulation**

**Steps:**
1. Open browser DevTools → Network tab
2. Throttle network to "Slow 3G"
3. Click "Scan Barcode"
4. Enter: `CLT-COT-ABC-158925`
5. Click "Look Up"

**Expected Results:**
- ✅ Loading state shows in scanner
- ✅ Toast eventually appears (after delay)
- ✅ If timeout (>10s): Toast shows "Network error: Failed to fetch"
- ✅ User can retry by clicking "Look Up" again

**Test 8b: Server error (500)**

**Steps:**
1. Use API testing tool (Postman/Insomnia)
2. Call: `PATCH /api/inventory/cloth/invalid-id-here`
3. Send invalid data to trigger 500 error

**Expected Results:**
- ✅ Response: 500 Internal Server Error
- ✅ Body: `{ "error": "Failed to update item" }`
- ✅ Frontend toast: "Error - Failed to update item"
- ✅ Dialog remains open (user can retry)

---

### Automated Testing Examples

#### Unit Test: Stock Status Calculation

```typescript
// File: __tests__/components/inventory/item-edit-dialog.test.tsx

import { describe, it, expect } from '@jest/globals'

const getStockStatus = (current: number, reserved: number, minimum: number) => {
  const available = current - (reserved || 0)
  if (available <= 0) return { label: "Out of Stock", variant: "destructive" }
  if (available < minimum * 0.5) return { label: "Critical", variant: "destructive" }
  if (available < minimum) return { label: "Low Stock", variant: "default" }
  return { label: "In Stock", variant: "default" }
}

describe('Stock Status Calculation', () => {
  it('should return "In Stock" when available >= minimum', () => {
    expect(getStockStatus(100, 0, 20)).toEqual({
      label: "In Stock",
      variant: "default"
    })
  })

  it('should return "Low Stock" when available < minimum but >= minimum * 0.5', () => {
    expect(getStockStatus(18, 3, 20)).toEqual({
      label: "Low Stock",
      variant: "default"
    })
  })

  it('should return "Critical" when available < minimum * 0.5 but > 0', () => {
    expect(getStockStatus(12, 4, 20)).toEqual({
      label: "Critical",
      variant: "destructive"
    })
  })

  it('should return "Out of Stock" when available <= 0', () => {
    expect(getStockStatus(5, 5, 20)).toEqual({
      label: "Out of Stock",
      variant: "destructive"
    })
  })
})
```

---

#### Integration Test: Barcode Lookup Flow

```typescript
// File: __tests__/api/inventory/barcode.test.ts

import { describe, it, expect, beforeEach } from '@jest/globals'
import { createMocks } from 'node-mocks-http'
import { GET } from '@/app/api/inventory/barcode/route'

describe('Barcode Lookup API', () => {
  it('should return item when found', async () => {
    const { req } = createMocks({
      method: 'GET',
      url: '/api/inventory/barcode?barcode=CLT-COT-ABC-158925',
    })

    const response = await GET(req as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.found).toBe(true)
    expect(data.type).toBe('cloth')
    expect(data.item).toHaveProperty('id')
    expect(data.item).toHaveProperty('sku', 'CLT-COT-ABC-158925')
  })

  it('should return not found when item does not exist', async () => {
    const { req } = createMocks({
      method: 'GET',
      url: '/api/inventory/barcode?barcode=CLT-NONEXISTENT-999',
    })

    const response = await GET(req as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.found).toBe(false)
    expect(data.barcode).toBe('CLT-NONEXISTENT-999')
  })

  it('should return 400 when barcode parameter is missing', async () => {
    const { req } = createMocks({
      method: 'GET',
      url: '/api/inventory/barcode',
    })

    const response = await GET(req as any)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Barcode parameter is required')
  })
})
```

---

## Troubleshooting

### Common Issues

#### Issue 1: Edit dialog doesn't open after barcode scan

**Symptoms:**
- Toast shows "Item Found"
- Dialog does not appear
- No errors in console

**Possible Causes:**
1. State not updated correctly
2. `editItem` is null or undefined
3. TypeScript type mismatch

**Solution:**
```typescript
// Check in handleScanSuccess
console.log('Result:', result)
console.log('Edit item:', editItem)

// Ensure setEditItem is called correctly
setEditItem({
  type: result.type as 'cloth' | 'accessory',
  item: result.item as ClothInventoryItem | AccessoryInventoryItem
})
setShowEditDialog(true)
```

**Verification:**
- Open React DevTools
- Check component state for `showEditDialog` (should be true)
- Check component state for `editItem` (should have type and item)

---

#### Issue 2: API returns 403 Forbidden on save

**Symptoms:**
- User edits item
- Clicks "Save Changes"
- Toast: "Error - Failed to update item"
- Console: `403 Forbidden`

**Possible Causes:**
1. User role does not have `manage_inventory` permission
2. Session expired
3. Auth token invalid

**Solution:**
```typescript
// Check user role and permissions
import { hasPermission } from '@/lib/permissions'

console.log('User role:', session?.user?.role)
console.log('Has manage_inventory:', hasPermission(session?.user?.role, 'manage_inventory'))
```

**Verification:**
- Login as OWNER, ADMIN, or INVENTORY_MANAGER
- SALES_MANAGER, TAILOR, VIEWER cannot edit inventory

---

#### Issue 3: Stock status badge shows wrong color

**Symptoms:**
- Item has available stock > minimum
- Badge shows "Low Stock" or "Critical"

**Possible Causes:**
1. Reserved stock not calculated correctly
2. Minimum threshold incorrect
3. UI not refreshing after edit

**Solution:**
```typescript
// Debug stock calculation
const { currentStock, reserved, minimum } = item
const available = currentStock - reserved

console.log({
  currentStock,
  reserved,
  minimum,
  available,
  threshold50: minimum * 0.5
})

// Verify badge logic
if (available >= minimum) {
  // Should be "In Stock"
} else if (available >= minimum * 0.5) {
  // Should be "Low Stock"
} else if (available > 0) {
  // Should be "Critical"
} else {
  // Should be "Out of Stock"
}
```

**Verification:**
- Manually calculate: Available = Current Stock - Reserved
- Compare with minimum threshold
- Check badge variant matches expected value

---

#### Issue 4: Form validation errors not showing

**Symptoms:**
- User enters invalid data (e.g., text in number field)
- Form submits without validation
- Server returns 400 error

**Possible Causes:**
1. HTML5 validation disabled
2. Input type not set correctly
3. Client-side validation bypassed

**Solution:**
```tsx
// Ensure proper input types
<Input
  id="currentStock"
  type="number"           // ✅ Must be "number" for numeric fields
  step="0.01"             // ✅ Allow decimals for cloth (meters)
  min="0"                 // ✅ Optional: Prevent negative values
  required                // ✅ HTML5 required validation
  value={formData.currentStock}
  onChange={(e) => handleFieldChange('currentStock', parseFloat(e.target.value))}
/>
```

**Verification:**
- Try entering "abc" in "Current Stock" field
- Browser should show: "Please enter a number"
- Form should NOT submit

---

#### Issue 5: Barcode scanner hangs on mobile

**Symptoms:**
- User clicks "Scan Barcode"
- Switches to "Camera" mode
- Black screen appears
- App hangs or crashes

**Possible Causes:**
1. Camera permission denied
2. Camera in use by another app
3. Browser does not support Barcode Detection API
4. Timeout not working

**Solution:**
```typescript
// Use manual entry mode as fallback
// Scanner defaults to "Manual" mode in v0.18.2+

// If camera needed, grant permissions:
// 1. Go to browser settings
// 2. Site settings → hamees.gagneet.com
// 3. Permissions → Camera → Allow
```

**Verification:**
- Check browser console for camera errors
- Try different browser (Chrome recommended)
- Use manual entry mode (100% reliable)

---

## Future Enhancements

### Short-Term (1-2 weeks)

1. **Bulk Edit Mode**
   - Select multiple items from inventory list
   - Edit common fields (supplier, location, minimum stock) in one action
   - Bulk delete for ADMIN role

2. **Stock Adjustment History**
   - Show stock movement history in edit dialog
   - Display who made last changes and when
   - Filter by movement type (PURCHASE, ORDER_RESERVED, ORDER_USED, etc.)

3. **Quick Actions Menu**
   - Right-click context menu on table rows
   - Quick actions: Edit, View Details, Reorder, Delete
   - Keyboard shortcuts (E for Edit, D for Delete, etc.)

4. **Enhanced Validation**
   - Client-side Zod validation before API call
   - Real-time field validation (show errors as user types)
   - Duplicate SKU detection on create

---

### Medium-Term (1-2 months)

5. **Photo Upload**
   - Add "Upload Photo" button in edit dialog
   - Store fabric/accessory images
   - Display thumbnail in edit dialog
   - Cloudinary or local storage integration

6. **Barcode Label Printing**
   - Generate printable barcode labels (80mm x 40mm)
   - Include SKU, name, location, and barcode image
   - Print to thermal printer or regular printer
   - Batch printing for multiple items

7. **Stock Alerts Configuration**
   - Edit minimum threshold with "Set Alert Level" button
   - Visual indicator when stock approaches minimum
   - Custom alert rules per item (e.g., "Alert when < 30 days supply")

8. **Audit Trail Visualization**
   - Timeline view of all changes to item
   - Show: User name, timestamp, fields changed, old/new values
   - Export audit log to CSV

---

### Long-Term (3-6 months)

9. **Multi-Warehouse Support**
   - Edit location with warehouse dropdown
   - Transfer stock between warehouses
   - Warehouse-specific stock levels and reservations

10. **Batch Import/Export**
    - Export filtered items to Excel
    - Bulk edit in Excel
    - Import changes back (with validation and preview)

11. **Mobile App Integration**
    - Native barcode scanning (camera + flashlight)
    - Offline mode with sync
    - Voice-to-text for data entry

12. **AI-Powered Suggestions**
    - Auto-suggest minimum stock based on usage patterns
    - Recommend reorder quantity based on lead time
    - Predict stock-out dates

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v0.18.3 | 2026-01-21 | Initial release of interactive barcode scanning with edit dialogs |
| v0.18.2 | 2026-01-18 | Barcode scanner improvements (Native API, timeout, manual mode default) |
| v0.18.1 | 2026-01-16 | Accessory SKU & barcode support added |
| v0.18.0 | 2026-01-15 | WhatsApp integration & QR code system |

---

## Support & Feedback

**Report Issues:**
- GitHub Issues: https://github.com/gagneet/hamees-inventory/issues
- Email: support@hameesattire.com

**Documentation:**
- Complete project docs: `/home/gagneet/hamees/docs/`
- API reference: `/home/gagneet/hamees/docs/API_REFERENCE.md`
- User guide: `/home/gagneet/hamees/docs/USER_GUIDE.md`

**Testing Environment:**
- Production: https://hamees.gagneet.com
- Test accounts: See `docs/USER_ROLES_AND_PERMISSIONS.md`

---

## Conclusion

The Interactive Barcode Scanning feature transforms the inventory management workflow from passive information display to active data management. Users can now:

1. **Scan** → **Edit** in one seamless flow (no context switching)
2. **Scan** → **Create** with pre-filled data (faster onboarding)
3. **View** complete item details with stock health indicators
4. **Update** multiple fields without leaving the dialog
5. **Navigate** to full detail page for advanced operations

This enhancement significantly improves operational efficiency and reduces time spent on inventory management tasks.

---

**Document Version:** 1.0
**Last Updated:** January 21, 2026
**Maintained By:** Hamees Attire Development Team
