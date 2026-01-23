# Inventory Edit Integration Guide (v0.24.0)

## Overview

This guide explains how to integrate the newly created inventory edit functionality into your existing inventory detail pages.

## What's Been Completed

✅ **Backend APIs** - All API endpoints created and tested
✅ **UI Components** - All edit forms and history viewer components created
✅ **Permissions** - Role-based access control configured
✅ **Documentation** - Complete API and component documentation

## What Needs Integration (UI Wiring)

The following detail pages can now integrate the edit functionality:

### 1. Cloth Detail Page (`app/(dashboard)/inventory/cloth/[id]/page.tsx`)

**Add Edit Button:**
```tsx
import { ClothEditForm } from '@/components/inventory/cloth-edit-form'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Pencil } from 'lucide-react'

// In the page component, add state
const [editOpen, setEditOpen] = useState(false)

// Add button in the header actions section
<Dialog open={editOpen} onOpenChange={setEditOpen}>
  <DialogTrigger asChild>
    <Button variant="outline" size="sm">
      <Pencil className="h-4 w-4 mr-2" />
      Edit Item
    </Button>
  </DialogTrigger>
  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Edit Cloth Item</DialogTitle>
    </DialogHeader>
    <ClothEditForm
      clothId={cloth.id}
      onSuccess={() => {
        setEditOpen(false)
        // Refresh page or refetch data
        router.refresh()
      }}
      onCancel={() => setEditOpen(false)}
    />
  </DialogContent>
</Dialog>
```

**Add Stock Movement History:**
```tsx
import { StockMovementHistory } from '@/components/inventory/stock-movement-history'

// Add as a new section in the page
<Card>
  <CardHeader>
    <CardTitle>Stock Movement History</CardTitle>
    <CardDescription>Complete audit trail of all stock changes</CardDescription>
  </CardHeader>
  <CardContent>
    <StockMovementHistory clothId={cloth.id} />
  </CardContent>
</Card>
```

### 2. Accessory Detail Page (`app/(dashboard)/inventory/accessories/[id]/page.tsx`)

**Add Edit Button:**
```tsx
import { AccessoryEditForm } from '@/components/inventory/accessory-edit-form'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Pencil } from 'lucide-react'

// In the page component, add state
const [editOpen, setEditOpen] = useState(false)

// Add button in the header actions section
<Dialog open={editOpen} onOpenChange={setEditOpen}>
  <DialogTrigger asChild>
    <Button variant="outline" size="sm">
      <Pencil className="h-4 w-4 mr-2" />
      Edit Item
    </Button>
  </DialogTrigger>
  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Edit Accessory Item</DialogTitle>
    </DialogHeader>
    <AccessoryEditForm
      accessoryId={accessory.id}
      onSuccess={() => {
        setEditOpen(false)
        router.refresh()
      }}
      onCancel={() => setEditOpen(false)}
    />
  </DialogContent>
</Dialog>
```

**Note:** Accessories don't have stock movements (they're tracked by units, not meters), so the history viewer is only applicable to cloth items.

### 3. Inventory List Page (`app/(dashboard)/inventory/page.tsx`)

**Optional: Add Quick Edit Actions:**
```tsx
// In the inventory item card/row, add an edit icon button
<Button
  variant="ghost"
  size="icon"
  onClick={() => {
    setEditingItem(item)
    setEditOpen(true)
  }}
>
  <Pencil className="h-4 w-4" />
</Button>

// Use the same dialog pattern as above
```

### 4. Manual Stock Adjustment UI (Optional)

Create a dedicated component for inventory managers to adjust stock:

```tsx
// components/inventory/stock-adjustment-dialog.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'

export function StockAdjustmentDialog({
  clothId,
  currentStock,
  open,
  onOpenChange
}: {
  clothId: string
  currentStock: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [quantity, setQuantity] = useState(0)
  const [type, setType] = useState<'PURCHASE' | 'ADJUSTMENT' | 'RETURN' | 'WASTAGE'>('ADJUSTMENT')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch(`/api/inventory/cloth/${clothId}/adjust-stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity, type, notes })
      })

      if (!response.ok) throw new Error('Failed to adjust stock')

      toast.success('Stock adjusted successfully')
      onOpenChange(false)
      // Trigger refresh
    } catch (error) {
      toast.error('Failed to adjust stock')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Current Stock: {currentStock.toFixed(2)}m</Label>
          </div>

          <div>
            <Label htmlFor="quantity">Quantity (meters)</Label>
            <Input
              id="quantity"
              type="number"
              step="0.01"
              value={quantity}
              onChange={e => setQuantity(parseFloat(e.target.value))}
              placeholder="Enter positive for add, negative for reduce"
              required
            />
            <p className="text-sm text-slate-500 mt-1">
              New stock: {(currentStock + quantity).toFixed(2)}m
            </p>
          </div>

          <div>
            <Label htmlFor="type">Adjustment Type</Label>
            <Select value={type} onValueChange={(value: any) => setType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PURCHASE">Purchase (new stock from supplier)</SelectItem>
                <SelectItem value="ADJUSTMENT">Adjustment (correction/recount)</SelectItem>
                <SelectItem value="RETURN">Return (customer returned)</SelectItem>
                <SelectItem value="WASTAGE">Wastage (damaged/lost)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Reason for adjustment"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adjusting...' : 'Adjust Stock'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

## Permission-Based UI Display

Always check permissions before showing edit buttons:

```tsx
import { useSession } from 'next-auth/react'
import { hasPermission } from '@/lib/permissions'

// In your component
const { data: session } = useSession()
const canEdit = session?.user?.role && hasPermission(session.user.role, 'manage_inventory')

// Conditional rendering
{canEdit && (
  <Button onClick={() => setEditOpen(true)}>
    <Pencil className="h-4 w-4 mr-2" />
    Edit Item
  </Button>
)}
```

## Changes That Could Affect Other Features

### 1. Inventory List Refresh ✅ No Impact
The existing inventory list page doesn't need changes. The edit functionality is self-contained in dialogs.

### 2. Order Creation ✅ No Impact
Order creation still uses the same cloth inventory data. The new Phase 1 fields don't affect order calculations.

### 3. Purchase Orders ✅ No Impact
Purchase order receiving can continue to use the existing flow. The manual stock adjustment API is an additional option, not a replacement.

### 4. Reports & Analytics ✅ No Impact
All reports use aggregate queries that work with the existing schema. Phase 1 fields are optional and don't break any calculations.

### 5. Excel Export/Import ✅ Already Updated
The bulk upload system was already updated in v0.23.0 to support all Phase 1 fields, so it's compatible with the edit functionality.

### 6. Barcode Scanner ✅ No Impact
The barcode scanner can continue to use the existing item edit dialog or be updated to use the new forms.

## Recommended Integration Order

1. **Start with Cloth Detail Page** - Add edit button and history viewer
2. **Test thoroughly** - Verify edit form saves correctly and creates stock movements
3. **Add Accessory Detail Page** - Similar edit button integration
4. **Optional: Add Quick Actions** - Edit icons in inventory list cards
5. **Optional: Stock Adjustment UI** - For inventory managers to manually adjust stock

## Testing Checklist

- [ ] Edit button appears for ADMIN, INVENTORY_MANAGER, OWNER
- [ ] Edit button hidden for SALES_MANAGER, TAILOR, VIEWER
- [ ] Edit form loads current item data correctly
- [ ] All Phase 1 fields save properly
- [ ] Stock changes create StockMovement records
- [ ] Stock movement history displays correctly
- [ ] Toast notifications show on success/error
- [ ] Page refreshes after successful edit
- [ ] Mobile responsive layout works
- [ ] Dialog scrolls on small screens

## Support

For issues or questions:
- See complete API documentation: `docs/INVENTORY_EDIT_WITH_HISTORY.md`
- Check component source: `components/inventory/`
- Review API implementation: `app/api/inventory/`

All components are production-ready and follow existing codebase patterns!
