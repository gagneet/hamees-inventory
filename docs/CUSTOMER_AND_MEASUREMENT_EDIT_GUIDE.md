# Customer & Measurement Edit Features - User Guide

**Version:** 0.5.1
**Date:** January 15, 2026
**Status:** ✅ Fully Implemented

## Overview

This guide covers the newly implemented edit functionality for both **Customer Details** and **Customer Measurements**. Both features are now fully functional and accessible from the customer detail page.

## Features Implemented

### ✅ 1. Customer Details Edit
- Edit customer contact information
- Update name, phone, email, address
- Update city, state, pincode
- Add/edit notes
- Protected by `manage_customers` permission

### ✅ 2. Measurement Edit with History
- Edit customer measurements (creates new version)
- View complete history timeline
- Visual diff of changes
- Delete measurements (with protection)
- Protected by `manage_customers` permission

## How to Use

### Editing Customer Details

#### Step 1: Navigate to Customer
1. Go to **Customers** page (`/customers`)
2. Click on any customer to view their details
3. You'll see an **"Edit"** button in the top-right corner (if you have permission)

#### Step 2: Open Edit Dialog
1. Click the **"Edit"** button
2. A dialog will open showing all customer fields

#### Step 3: Make Changes
Edit any of the following fields:
- **Name** (required) - Customer's full name
- **Phone** (required) - Contact number
- **Email** (optional) - Email address
- **Address** (optional) - Street address
- **City** (optional) - City name
- **State** (optional) - State/Province
- **Pincode** (optional) - ZIP/Postal code
- **Notes** (optional) - Any special notes

#### Step 4: Save Changes
1. Click **"Save Changes"** button
2. Wait for confirmation
3. Page will automatically refresh with updated data

**API Call:** `PATCH /api/customers/[id]`

---

### Editing Measurements

#### Step 1: Navigate to Measurements Section
1. On customer detail page, scroll to the right column
2. Find the **"Measurements"** card
3. You'll see all active measurements listed

#### Step 2: Choose Action

**Option A: Add New Measurement**
1. Click **"Add"** button at the top of the measurements card
2. Fill in the form (see fields below)
3. Click **"Add Measurement"**

**Option B: Edit Existing Measurement**
1. Find the measurement you want to edit
2. Click the **"Edit"** button at the bottom of that measurement card
3. Modify the fields you want to change
4. Click **"Update Measurement"**

**Option C: View History**
1. Click the **"History"** button on any measurement
2. See timeline of all versions
3. Expand each version to see details
4. Changed values are highlighted in orange

**Option D: Delete Measurement**
1. Click the **"Delete"** button on any measurement
2. Confirm deletion in the dialog
3. **Note:** Cannot delete measurements used in orders

#### Step 3: Measurement Form Fields

**Required:**
- **Garment Type** - Select: Shirt, Trouser, Suit, or Sherwani

**Optional:**
- **Body Type** - Select: Slim, Regular, Large, or XL
- **Neck** (cm) - Neck circumference
- **Chest** (cm) - Chest circumference
- **Waist** (cm) - Waist circumference
- **Hip** (cm) - Hip circumference
- **Shoulder** (cm) - Shoulder width
- **Sleeve Length** (cm) - Sleeve measurement
- **Shirt Length** (cm) - Shirt length
- **Inseam** (cm) - Inseam length
- **Outseam** (cm) - Outseam length
- **Thigh** (cm) - Thigh circumference
- **Knee** (cm) - Knee circumference
- **Bottom Opening** (cm) - Bottom opening width

**For Suits/Sherwanis Only:**
- **Jacket Length** (cm) - Jacket length
- **Lapel Width** (cm) - Lapel width

**Additional:**
- **Notes** - Any special notes or preferences

---

## Visual Guide

### Customer Detail Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Breadcrumb: Home > Customers > John Doe                   │
│                                                             │
│  ← Back     John Doe                          [Edit] ←---- │
│             Customer since Jan 10, 2026                     │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────┬─────────────────────────────────┐
│  Contact Information     │  Measurements                   │
│  ┌────────────────────┐  │  ┌───────────────────────────┐  │
│  │ Phone: +91 98765…  │  │  │ Shirt                     │  │
│  │ Email: john@…      │  │  │ Chest: 102 cm Waist: 90…  │  │
│  │ Address: 123 Main… │  │  │ [History] [Edit] [Delete] │  │
│  └────────────────────┘  │  └───────────────────────────┘  │
│                          │                                 │
│  Orders (5)              │  Quick Stats                    │
│  [List of orders…]       │  Total Orders: 5                │
│                          │  Total Spent: ₹45,000           │
└──────────────────────────┴─────────────────────────────────┘
```

### Edit Customer Dialog

```
┌─────────────────────────────────────────────────────────┐
│  Edit Customer Details                              [X] │
│  Update customer information. All fields except…        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Name *          Phone *                                │
│  [John Doe    ] [+91 98765 43210]                      │
│                                                         │
│  Email                                                  │
│  [john@example.com                                  ]   │
│                                                         │
│  Address                                                │
│  [123 Main Street                                   ]   │
│  [Apartment 4B                                      ]   │
│                                                         │
│  City            State          Pincode                 │
│  [Mumbai      ] [Maharashtra] [400001]                 │
│                                                         │
│  Notes                                                  │
│  [Prefers evening appointments                      ]   │
│  [                                                  ]   │
│  [                                                  ]   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                            [Cancel] [Save Changes]      │
└─────────────────────────────────────────────────────────┘
```

### Edit Measurement Dialog

```
┌─────────────────────────────────────────────────────────┐
│  Edit Measurement                                   [X] │
│  Update measurements. This will create a new version…  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Garment Type *     Body Type                           │
│  [Shirt        ▼]  [Regular     ▼]                     │
│                                                         │
│  Common Measurements (cm)                               │
│  Neck    Chest   Waist   Hip     Shoulder  Sleeve      │
│  [38  ] [102  ] [90  ] [98  ] [45      ] [65    ]     │
│                                                         │
│  Shirt Length  Inseam   Outseam  Thigh   Knee  Bottom  │
│  [75        ] [80   ] [105   ] [55  ] [38 ] [40   ]   │
│                                                         │
│  Notes                                                  │
│  [Customer prefers slim fit                         ]   │
│  [                                                  ]   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                            [Cancel] [Update Measurement]│
└─────────────────────────────────────────────────────────┘
```

### Measurement History Timeline

```
┌─────────────────────────────────────────────────────────┐
│  Measurement History                                [X] │
│  View all versions. Changed values are highlighted.     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ● Shirt [Current]                           ▼         │
│  │ Jan 15, 2026, 2:30 PM    Created by: John Doe      │
│  │                                                     │
│  │ Chest: 104 cm (was: 102 cm) ← highlighted          │
│  │ Waist: 92 cm (was: 90 cm)   ← highlighted          │
│  │ Shoulder: 45 cm                                     │
│  │ [... other measurements ...]                        │
│  │                                                     │
│  ○ Shirt                                     ▶         │
│  │ Jan 10, 2026, 10:00 AM   Created by: Jane Smith    │
│  │                                                     │
│  ○ Shirt (Original)                          ▶         │
│    Jan 5, 2026, 3:00 PM    Created by: John Doe       │
│                                                         │
│  📊 Total Versions: 3                                   │
│  ℹ️  Changed values highlighted with previous value    │
│     shown as strikethrough.                            │
└─────────────────────────────────────────────────────────┘
```

## Permission Requirements

### View Permissions
- **Permission Required:** `view_customers`
- **Roles with Access:** OWNER, ADMIN, INVENTORY_MANAGER, SALES_MANAGER, TAILOR, VIEWER
- **What They Can Do:** View customer details and measurements

### Edit Permissions
- **Permission Required:** `manage_customers`
- **Roles with Access:** OWNER, ADMIN, SALES_MANAGER
- **What They Can Do:**
  - Edit customer details
  - Add new measurements
  - Edit existing measurements
  - Delete measurements (if not in use)
  - View measurement history

## Technical Details

### Customer Edit
- **Endpoint:** `PATCH /api/customers/[id]`
- **Validation:** Zod schema validation
- **Required Fields:** name, phone
- **Optional Fields:** email, address, city, state, pincode, notes
- **Response:** Updated customer object

### Measurement Edit
- **Endpoint:** `PATCH /api/customers/[id]/measurements/[measurementId]`
- **Behavior:** Creates new version, marks old as inactive
- **Version Linking:** Uses `replacesId` field
- **Audit Trail:** Tracks creator (`userId`) and timestamp
- **Response:** New measurement version with message

### Measurement History
- **Endpoint:** `GET /api/customers/[id]/measurements/[measurementId]/history`
- **Algorithm:** Follows `replacesId` chain backwards
- **Response:** Array of all versions (newest to oldest)

### Measurement Delete
- **Endpoint:** `DELETE /api/customers/[id]/measurements/[measurementId]`
- **Protection:** Prevents deletion if used in orders
- **Behavior:** Soft delete (sets `isActive: false`)
- **Response:** Success message or error with usage count

## Error Handling

### Customer Edit Errors
- **Validation Failed:** Required fields missing or invalid format
- **Customer Not Found:** Invalid customer ID
- **Permission Denied:** User lacks `manage_customers` permission
- **Network Error:** Connection issue

### Measurement Edit Errors
- **Validation Failed:** Invalid measurement values
- **Measurement Not Found:** Invalid measurement ID
- **Permission Denied:** User lacks `manage_customers` permission
- **Network Error:** Connection issue

### Measurement Delete Errors
- **In Use:** Measurement referenced by orders (shows count)
- **Permission Denied:** User lacks `manage_customers` permission
- **Network Error:** Connection issue

## Troubleshooting

### "Edit button not visible"
**Problem:** User cannot see the Edit button on customer detail page

**Solutions:**
1. Check user role - must have `manage_customers` permission
2. Allowed roles: OWNER, ADMIN, SALES_MANAGER
3. Contact administrator to update role if needed

### "Cannot delete measurement"
**Problem:** Delete button shows error "Cannot delete measurement that is used in orders"

**Explanation:** This is a protective feature. Measurements linked to orders cannot be deleted to maintain data integrity.

**Solutions:**
1. This is expected behavior - measurement is being used
2. Instead of deleting, create a new measurement
3. Old measurements remain in history but won't show in active list

### "Changes not saving"
**Problem:** Edit dialog shows loading but doesn't save

**Solutions:**
1. Check browser console for errors (F12)
2. Verify network connection
3. Check if session is still valid (try refreshing page)
4. Ensure all required fields are filled (name, phone for customer)

### "History not showing"
**Problem:** Click History button but nothing happens

**Solutions:**
1. Check browser console for errors
2. Verify measurement has history (newly created won't have versions)
3. Refresh the page and try again

## Best Practices

### Customer Information
1. **Always provide phone number** - Critical for communication
2. **Use email when available** - Enables digital communication
3. **Complete address** - Helps with delivery coordination
4. **Add notes** - Record preferences, special requirements

### Measurements
1. **Create measurement before first order** - Speeds up order creation
2. **Update measurements regularly** - Customer sizes change over time
3. **Use body type field** - Helps with fabric calculations
4. **Add notes** - Record fit preferences, adjustments
5. **Review history before new orders** - Check for recent changes

### Version History
1. **Check history before editing** - See what changed previously
2. **Use edit for corrections** - Don't delete and recreate
3. **Keep old versions** - History is valuable for customer service
4. **Add notes when editing** - Explain why measurement changed

## Mobile Usage

Both edit features are fully responsive and work on mobile devices:

### Mobile Optimizations
- **Touch-friendly buttons** - Large tap targets
- **Scrollable dialogs** - Content fits small screens
- **Number keyboards** - Auto-shows for measurement inputs
- **Form layout** - Stacks vertically on mobile
- **Easy navigation** - Clear back buttons and cancel options

### Mobile Tips
1. Use landscape orientation for measurement forms (more fields visible)
2. Scroll to see all form fields
3. Tap outside dialog to close (or use X button)
4. Use browser back button if needed

## FAQ

**Q: Can I undo a measurement edit?**
A: No, but you can view the history and manually create a new measurement with the old values.

**Q: Are old measurements deleted?**
A: No, they're preserved with `isActive: false`. Only active measurements show by default.

**Q: Can I compare two measurement versions?**
A: Yes, the history dialog shows changed values highlighted with the old value in strikethrough.

**Q: What happens to orders when I edit a measurement?**
A: Existing orders keep their original measurement. New orders use the updated version.

**Q: Can I delete a customer?**
A: Not through the edit dialog, but there's a DELETE API endpoint that prevents deletion if orders exist.

**Q: How do I bulk edit measurements?**
A: Currently not supported. You must edit each measurement individually.

**Q: Can I export measurement history?**
A: Not currently, but the API returns full JSON that could be used for export.

---

## Summary

✅ **Customer Edit:** Fully functional - click Edit button on customer page
✅ **Measurement Edit:** Fully functional - click Edit on any measurement
✅ **Measurement History:** Click History to view all versions
✅ **Delete Protection:** Cannot delete measurements in use
✅ **Permission Control:** Only authorized users see edit buttons
✅ **Mobile Ready:** Works perfectly on all devices

**Need Help?** Contact your system administrator or refer to the API documentation.
