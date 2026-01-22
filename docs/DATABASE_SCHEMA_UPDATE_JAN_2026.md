# Database Schema Update - January 2026

**Date**: January 22, 2026
**Version**: v0.20.0
**Status**: ✅ Completed

## Overview

This document details the comprehensive database schema update that added missing fields to align seed data and Excel export with the current Prisma schema. All changes are **backward compatible** and enhance existing functionality.

---

## Schema Changes

### 1. Customer Model - B2B/B2C Support

**New Fields Added:**

| Field | Type | Description | Default | Nullable |
|-------|------|-------------|---------|----------|
| `gstin` | String | GST Identification Number for business customers | - | Yes |
| `customerType` | String | Customer classification: "B2B" or "B2C" | "B2C" | No |

**Purpose:**
- Distinguish between business (B2B) and individual (B2C) customers
- Track GSTIN for GST-compliant invoicing and tax reporting
- Enable different pricing strategies and credit terms

**Seed Data Pattern:**
- 20% of customers are B2B (have GSTIN)
- 80% of customers are B2C (no GSTIN)
- GSTIN format: `{StateCode}AABCU{4digits}R{1digit}Z{1digit}`
- Example: `36AABCU5921R1Z5` (Maharashtra state code 27-36)

**Usage Examples:**
```typescript
// Create B2B customer
await prisma.customer.create({
  data: {
    name: 'ABC Retail Pvt Ltd',
    customerType: 'B2B',
    gstin: '27AABCU9603R1ZM',
    // ... other fields
  }
})

// Create B2C customer
await prisma.customer.create({
  data: {
    name: 'Rahul Sharma',
    customerType: 'B2C',
    gstin: null, // No GSTIN for individuals
    // ... other fields
  }
})

// Query B2B customers only
const b2bCustomers = await prisma.customer.findMany({
  where: { customerType: 'B2B' }
})
```

---

### 2. OrderItem Model - Tailor Assignment

**New Field Added:**

| Field | Type | Description | Default | Nullable |
|-------|------|-------------|---------|----------|
| `assignedTailorId` | String | User ID of assigned tailor (FK to User) | - | Yes |

**Purpose:**
- Track which tailor is responsible for each order item
- Enable workload distribution and performance tracking
- Support multi-tailor workshops with task assignment

**Seed Data Pattern:**
- 33% of order items have assigned tailors
- Remaining 67% are unassigned (can be auto-assigned or manually assigned later)
- Only links to users with `TAILOR` role

**Relationships:**
```prisma
model OrderItem {
  assignedTailorId  String?
  assignedTailor    User?     @relation("OrderItemAssignedTailor", fields: [assignedTailorId], references: [id])
}

model User {
  assignedOrderItems OrderItem[] @relation("OrderItemAssignedTailor")
}
```

**Usage Examples:**
```typescript
// Assign tailor to order item
await prisma.orderItem.update({
  where: { id: orderItemId },
  data: { assignedTailorId: tailorUserId }
})

// Get tailor's assigned work
const assignedWork = await prisma.orderItem.findMany({
  where: { assignedTailorId: tailorId },
  include: {
    order: { include: { customer: true } },
    garmentPattern: true,
    clothInventory: true
  }
})

// Get workload distribution
const workloadByTailor = await prisma.orderItem.groupBy({
  by: ['assignedTailorId'],
  _count: { id: true },
  where: { assignedTailorId: { not: null } }
})
```

---

### 3. PurchaseOrder Model - Complete GST & ITC Tracking

**New Fields Added:**

| Field | Type | Description | Default | Nullable |
|-------|------|-------------|---------|----------|
| `subTotal` | Float | Amount before GST | 0 | No |
| `gstRate` | Float | GST rate percentage (5%, 12%, 18%, 28%) | 0 | No |
| `cgst` | Float | Central GST amount (intra-state) | 0 | No |
| `sgst` | Float | State GST amount (intra-state) | 0 | No |
| `igst` | Float | Integrated GST amount (inter-state) | 0 | No |
| `gstAmount` | Float | Total GST charged (CGST + SGST or IGST) | 0 | No |
| `isInputTaxCredit` | Boolean | Eligible for Input Tax Credit | true | No |
| `itcClaimed` | Boolean | ITC claimed in GST returns | false | No |
| `supplierInvoiceNumber` | String | Supplier's invoice number | - | Yes |
| `supplierInvoiceDate` | DateTime | Supplier's invoice date | - | Yes |

**Purpose:**
- Complete GST compliance for purchase orders
- Track Input Tax Credit eligibility and claims
- Maintain supplier invoice references for audit trail
- Calculate accurate tax liability and credits

**Seed Data Pattern:**
- All POs use 18% GST rate (standard for fabric purchases)
- All POs are eligible for Input Tax Credit (`isInputTaxCredit: true`)
- 33% of received POs have claimed ITC (`itcClaimed: true`)
- All received POs have supplier invoice numbers and dates
- Pending POs don't have invoice details yet

**GST Calculation Logic:**
```typescript
const subTotal = 143918.96
const gstRate = 18 // 18% for fabrics
const gstAmount = (subTotal * gstRate) / 100 // 25905.41

// For intra-state purchase (same state)
const cgst = gstAmount / 2 // 12962.70 (9%)
const sgst = gstAmount / 2 // 12962.71 (9%)
const igst = 0

// For inter-state purchase (different state)
const cgst = 0
const sgst = 0
const igst = gstAmount // 25905.41 (18%)

const totalAmount = subTotal + gstAmount // 169824.37
```

**Usage Examples:**
```typescript
// Create PO with complete GST breakdown
const subTotal = 100000
const gstRate = 18
const gstAmount = (subTotal * gstRate) / 100 // 18000
const totalAmount = subTotal + gstAmount // 118000

await prisma.purchaseOrder.create({
  data: {
    poNumber: 'PO-2026-0001',
    supplierId: supplierId,
    subTotal: subTotal,
    gstRate: gstRate,
    cgst: gstAmount / 2, // 9000 (9%)
    sgst: gstAmount / 2, // 9000 (9%)
    igst: 0, // Intra-state
    gstAmount: gstAmount,
    totalAmount: totalAmount,
    isInputTaxCredit: true,
    itcClaimed: false, // Will claim after receiving goods
    // ... other fields
  }
})

// Claim ITC when filing GST returns
await prisma.purchaseOrder.update({
  where: { id: poId },
  data: { itcClaimed: true }
})

// Calculate total claimable ITC
const claimableITC = await prisma.purchaseOrder.aggregate({
  _sum: { gstAmount: true },
  where: {
    isInputTaxCredit: true,
    itcClaimed: false,
    status: 'RECEIVED'
  }
})
```

---

## Seed Data Updates

### File: `prisma/seed-complete.ts`

**Changes Made:**

1. **Customer Creation (Lines 328-347)**
   ```typescript
   // Before
   const customer = await prisma.customer.create({
     data: {
       name: customerNames[i],
       phone: `+91 ${90000 + i}00000`,
       // ... basic fields only
     }
   })

   // After
   const isB2B = i % 5 === 0 // 20% are B2B
   const customer = await prisma.customer.create({
     data: {
       name: customerNames[i],
       phone: `+91 ${90000 + i}00000`,
       customerType: isB2B ? 'B2B' : 'B2C',
       gstin: isB2B ? `${randomInt(10, 37)}AABCU${randomInt(1000, 9999)}R${randomInt(1, 9)}Z${randomInt(1, 9)}` : null,
       // ... other fields
     }
   })
   ```

2. **Order Item Creation (Lines 437-455)**
   ```typescript
   // Before
   itemsData.push({
     garmentPatternId: pattern.id,
     clothInventoryId: cloth.id,
     measurementId: measurement?.id,
     // ... other fields
   })

   // After
   itemsData.push({
     garmentPatternId: pattern.id,
     clothInventoryId: cloth.id,
     measurementId: measurement?.id,
     assignedTailorId: randomChoice([tailor.id, null, null]), // 33% assigned
     // ... other fields
   })
   ```

3. **Purchase Order Creation (Lines 519-557)**
   ```typescript
   // Before
   const totalAmount = randomFloat(50000, 200000)
   await prisma.purchaseOrder.create({
     data: {
       totalAmount: totalAmount,
       paidAmount: paidAmount,
       balanceAmount: balanceAmount,
       // ... basic fields only
     }
   })

   // After
   const subTotal = randomFloat(50000, 200000)
   const gstRate = 18
   const gstAmount = parseFloat(((subTotal * gstRate) / 100).toFixed(2))
   const totalAmount = parseFloat((subTotal + gstAmount).toFixed(2))

   await prisma.purchaseOrder.create({
     data: {
       subTotal: subTotal,
       gstRate: gstRate,
       cgst: parseFloat((gstAmount / 2).toFixed(2)),
       sgst: parseFloat((gstAmount / 2).toFixed(2)),
       igst: 0,
       gstAmount: gstAmount,
       isInputTaxCredit: true,
       itcClaimed: isReceived && i % 3 === 0, // 33% claimed
       supplierInvoiceNumber: isReceived ? `SINV-${supplier.name.substring(0, 3).toUpperCase()}-${randomInt(1000, 9999)}` : null,
       supplierInvoiceDate: isReceived ? poDate : null,
       totalAmount: totalAmount,
       // ... other fields
     }
   })
   ```

---

## Excel Export Updates

### File: `scripts/export-to-excel.ts`

**Changes Made:**

1. **Customer Sheet (Lines 210-251)**
   - Added `gstin` column (width: 20)
   - Added `customerType` column (width: 15)
   - Added notes: "Customer Type: B2B (has GSTIN) or B2C (individual)"

2. **OrderItem Sheet (Lines 462-512)**
   - Added `assignedTailorId` column (width: 30)
   - Updated notes: "Body Type: SLIM, REGULAR, LARGE, XL | Assigned Tailor: Optional User ID (TAILOR role)"

3. **PurchaseOrder Sheet (Lines 508-576)**
   - Added 9 new columns:
     - `subTotal` (Subtotal Before GST)
     - `gstRate` (GST Rate %)
     - `cgst` (CGST)
     - `sgst` (SGST)
     - `igst` (IGST)
     - `gstAmount` (GST Amount)
     - `isInputTaxCredit` (ITC Eligible)
     - `itcClaimed` (ITC Claimed)
     - `supplierInvoiceNumber` (Supplier Invoice #)
     - `supplierInvoiceDate` (Supplier Invoice Date)
   - Updated notes: "Status: PENDING, RECEIVED, PARTIAL, CANCELLED | GST: 18% standard for fabric purchases | ITC: Input Tax Credit tracking"

**Export Command:**
```bash
pnpm tsx scripts/export-to-excel.ts
# Generates: exports/hamees-inventory-export-{date}.xlsx
```

---

## Excel Upload Compatibility

### File: `lib/excel-processor.ts`

**Automatic Handling:**

The Excel processor uses a dynamic `insertData` pattern that automatically includes all fields from the uploaded Excel file:

```typescript
const { id, createdAt, updatedAt, ...insertData } = data

// All fields in insertData are automatically passed to Prisma
await prisma.customer.create({ data: insertData })
```

**What This Means:**
- ✅ No code changes needed for new fields
- ✅ Excel uploads automatically handle `gstin`, `customerType`, `assignedTailorId`, etc.
- ✅ Validation happens at Prisma level (schema enforces constraints)
- ✅ Forward compatible with future schema additions

---

## Database Statistics (After Seed)

### Current Production Data:

| Table | Records | New Fields Populated |
|-------|---------|---------------------|
| User | 6 | N/A (no new fields) |
| Supplier | 3 | N/A (no new fields) |
| ClothInventory | 10 | N/A (no new fields) |
| AccessoryInventory | 6 | N/A (no new fields) |
| GarmentPattern | 4 | N/A (no new fields) |
| **Customer** | 25 | ✅ 5 B2B (with GSTIN), 20 B2C |
| Measurement | 100 | N/A (no new fields) |
| Order | 232 | N/A (no new fields) |
| **OrderItem** | ~465 | ✅ ~155 with assigned tailors (33%) |
| **PurchaseOrder** | 15 | ✅ All with GST breakdown, 5 with claimed ITC |
| Expense | 20 | N/A (no new fields) |

### Sample Data Verification:

**Customers:**
```sql
SELECT name, customerType, gstin
FROM "Customer"
WHERE customerType = 'B2B'
LIMIT 3;

-- Results:
-- Rahul Verma    | B2B | 36AABCU5921R1Z5
-- Sanjay Sharma  | B2B | 37AABCU1507R3Z5
-- Rohan Kapoor   | B2B | 14AABCU3892R4Z2
```

**Order Items with Assigned Tailors:**
```sql
SELECT oi.id, o."orderNumber", u.name as tailor
FROM "OrderItem" oi
JOIN "Order" o ON oi."orderId" = o.id
JOIN "User" u ON oi."assignedTailorId" = u.id
WHERE oi."assignedTailorId" IS NOT NULL
LIMIT 3;

-- Results:
-- {id} | ORD-202507-0001 | Mohammed Akram (Tailor)
-- {id} | ORD-202507-0002 | Mohammed Akram (Tailor)
-- {id} | ORD-202507-0003 | Mohammed Akram (Tailor)
```

**Purchase Orders with GST:**
```sql
SELECT "poNumber", "subTotal", "gstAmount", "totalAmount", "itcClaimed"
FROM "PurchaseOrder"
WHERE "gstAmount" > 0
LIMIT 3;

-- Results:
-- PO-2025-0001 | 143918.96 | 25905.41 | 169824.37 | true
-- PO-2025-0002 |  88740.76 | 15973.34 | 104714.10 | false
-- PO-2025-0003 |  78212.50 | 14078.25 |  92290.75 | false
```

---

## Business Impact

### 1. Customer Management
**Before:**
- No distinction between business and individual customers
- No GSTIN tracking for tax compliance

**After:**
- ✅ Clear B2B/B2C segmentation
- ✅ GSTIN capture for compliant invoicing
- ✅ Support for different pricing strategies
- ✅ Better credit term management

### 2. Tailor Workload Management
**Before:**
- No visibility into who's working on what
- Manual task assignment and tracking

**After:**
- ✅ Clear tailor assignments per order item
- ✅ Workload distribution analytics
- ✅ Performance tracking by tailor
- ✅ Support for multi-tailor operations

### 3. Purchase Order GST Compliance
**Before:**
- Basic total amount tracking
- No GST breakdown or ITC tracking
- Manual tax calculations for returns

**After:**
- ✅ Complete GST breakdown (CGST/SGST/IGST)
- ✅ Automated ITC eligibility tracking
- ✅ Supplier invoice reference linking
- ✅ Accurate tax credit claims
- ✅ Audit-ready purchase records

---

## API Usage Examples

### Customer API - B2B vs B2C

```typescript
// GET /api/customers?customerType=B2B
const b2bCustomers = await prisma.customer.findMany({
  where: { customerType: 'B2B' },
  select: {
    id: true,
    name: true,
    gstin: true,
    phone: true,
    email: true
  }
})

// Create B2B customer with GSTIN validation
const customer = await prisma.customer.create({
  data: {
    name: 'Corporate Client Ltd',
    customerType: 'B2B',
    gstin: '27AABCU9603R1ZM', // Validated format
    phone: '+91 98765 43210',
    email: 'accounts@corporateclient.com'
  }
})
```

### OrderItem API - Tailor Assignment

```typescript
// Assign tailor to order item
// PATCH /api/orders/[id]/items/[itemId]
await prisma.orderItem.update({
  where: { id: itemId },
  data: { assignedTailorId: tailorUserId }
})

// Get tailor's workload
// GET /api/users/[tailorId]/workload
const workload = await prisma.orderItem.findMany({
  where: {
    assignedTailorId: tailorId,
    order: { status: { notIn: ['DELIVERED', 'CANCELLED'] } }
  },
  include: {
    order: { select: { orderNumber: true, deliveryDate: true } },
    garmentPattern: { select: { name: true } }
  }
})
```

### PurchaseOrder API - GST & ITC

```typescript
// Create PO with GST breakdown
// POST /api/purchase-orders
const po = await prisma.purchaseOrder.create({
  data: {
    poNumber: 'PO-2026-0100',
    supplierId: supplierId,
    subTotal: 100000,
    gstRate: 18,
    cgst: 9000,
    sgst: 9000,
    igst: 0,
    gstAmount: 18000,
    totalAmount: 118000,
    isInputTaxCredit: true,
    itcClaimed: false
  }
})

// Claim ITC for received goods
// PATCH /api/purchase-orders/[id]/claim-itc
await prisma.purchaseOrder.update({
  where: { id: poId },
  data: { itcClaimed: true }
})

// Calculate total unclaimed ITC
// GET /api/reports/itc-unclaimed
const unclaimedITC = await prisma.purchaseOrder.aggregate({
  _sum: { gstAmount: true },
  where: {
    isInputTaxCredit: true,
    itcClaimed: false,
    status: 'RECEIVED'
  }
})
```

---

## Migration & Deployment

### Schema Migration (Already Applied)

The schema changes were applied via Prisma migrations:

```bash
# Generate migration (already done)
pnpm db:push

# Or create formal migration
npx prisma migrate dev --name add_customer_po_orderitem_fields
```

### Seed Database

```bash
# Run complete production seed
pnpm tsx prisma/seed-complete.ts

# Or reset and reseed
pnpm db:reset
```

### Export Current Data

```bash
# Generate Excel export with all new fields
pnpm tsx scripts/export-to-excel.ts

# Output: exports/hamees-inventory-export-{date}.xlsx
```

---

## Testing Checklist

- [x] Customer `gstin` field accepts valid GST format
- [x] Customer `customerType` defaults to "B2C"
- [x] OrderItem `assignedTailorId` accepts valid User ID (TAILOR role)
- [x] OrderItem `assignedTailorId` can be null (unassigned)
- [x] PurchaseOrder GST calculations are accurate (subTotal × rate = gstAmount)
- [x] PurchaseOrder CGST + SGST = gstAmount (intra-state)
- [x] PurchaseOrder `isInputTaxCredit` defaults to true
- [x] PurchaseOrder `itcClaimed` defaults to false
- [x] PurchaseOrder `supplierInvoiceNumber` is nullable
- [x] Excel export includes all new columns
- [x] Excel import processes new fields correctly
- [x] Seed script populates realistic data for all new fields

---

## Future Enhancements

### Short Term (v0.20.1)
- [ ] Add GSTIN validation regex in Customer form
- [ ] Create tailor assignment UI in order detail page
- [ ] Add ITC claim workflow with date tracking
- [ ] Generate GSTR-2A reconciliation report

### Medium Term (v0.21.0)
- [ ] Automated ITC calculation for GST returns
- [ ] B2B customer credit limit management
- [ ] Tailor performance analytics dashboard
- [ ] Supplier invoice auto-import from email

### Long Term (v0.22.0)
- [ ] E-Way Bill generation for inter-state purchases
- [ ] GST return auto-filing integration
- [ ] Customer portal for B2B clients
- [ ] Multi-location tailor workshop management

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| v0.20.0 | 2026-01-22 | Added Customer B2B/B2C fields, OrderItem tailor assignment, PurchaseOrder complete GST & ITC tracking |
| v0.19.2 | 2026-01-22 | Fixed critical stock calculation & interactive stock health chart |
| v0.19.1 | 2026-01-22 | Visual measurement history & stock health chart |
| v0.19.0 | 2026-01-22 | Visual measurement system with bilingual support |

---

## Support & Documentation

**Related Docs:**
- `CLAUDE.md` - Complete project documentation
- `README.md` - Setup and deployment guide
- `docs/VISUAL_MEASUREMENT_SYSTEM.md` - Measurement tool documentation
- `prisma/schema.prisma` - Complete database schema

**Database Queries:**
```bash
# Check customer types distribution
psql -d tailor_inventory -c "SELECT \"customerType\", COUNT(*) FROM \"Customer\" GROUP BY \"customerType\";"

# Check assigned vs unassigned order items
psql -d tailor_inventory -c "SELECT COUNT(CASE WHEN \"assignedTailorId\" IS NOT NULL THEN 1 END) as assigned, COUNT(CASE WHEN \"assignedTailorId\" IS NULL THEN 1 END) as unassigned FROM \"OrderItem\";"

# Check ITC claimed vs unclaimed
psql -d tailor_inventory -c "SELECT \"itcClaimed\", COUNT(*), SUM(\"gstAmount\") as total_itc FROM \"PurchaseOrder\" WHERE \"isInputTaxCredit\" = true GROUP BY \"itcClaimed\";"
```

**Troubleshooting:**
- If GSTIN validation fails, check format: `{2-digit-state}{10-char-PAN}{1-digit-entity}{1-char-Z}{1-digit-checksum}`
- If tailor assignment fails, ensure user has `TAILOR` role
- If GST calculations don't match, verify: `subTotal × (gstRate/100) = gstAmount`

---

**Document Version**: 1.0
**Last Updated**: January 22, 2026
**Author**: Hamees Inventory System
**Status**: Production Ready ✅
