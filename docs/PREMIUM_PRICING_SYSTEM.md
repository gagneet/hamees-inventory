# Premium Pricing System - Complete Documentation

**Version:** 0.22.0
**Date:** January 22, 2026
**Status:** In Development

---

## Table of Contents

1. [Overview](#overview)
2. [Business Context](#business-context)
3. [Industry Research](#industry-research)
4. [Pricing Components](#pricing-components)
5. [Database Schema](#database-schema)
6. [API Reference](#api-reference)
7. [UI Components](#ui-components)
8. [Calculation Logic](#calculation-logic)
9. [User Workflows](#user-workflows)
10. [Testing Guide](#testing-guide)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The Premium Pricing System implements industry-standard bespoke tailoring pricing for Hamees Attire, transforming the order creation process from a simple flat-rate stitching charge (₹1,500) to a comprehensive, itemized pricing model that accurately reflects the value of premium men's suiting.

### Key Features

- **Itemized Cost Breakdown**: Separate display for Fabric, Accessories, Tailoring, Workmanship Premiums
- **Three-Tier Stitching Charges**: Basic, Premium, Luxury pricing levels
- **Workmanship Premiums**: Hand stitching, full canvas, rush orders, complex designs, additional fittings, premium lining
- **Fabric Wastage Factor**: Optional 10-15% margin for bespoke work
- **Manual Override Capability**: Adjust any line item with mandatory audit trail
- **Designer Consultation Fee**: Add consultation charges for style guidance
- **Complete Transparency**: Every cost component visible and editable

### Problem Statement

**Before v0.22.0:**
- ❌ Fixed ₹1,500 stitching charge for ALL garments (shirt, suit, sherwani)
- ❌ No differentiation between basic and luxury work
- ❌ No workmanship premiums for hand stitching, canvas construction
- ❌ No fabric wastage accounting
- ❌ Single "Total" field - no cost breakdown
- ❌ Impossible to justify premium pricing to customers

**After v0.22.0:**
- ✅ Dynamic stitching charges (₹2K-₹25K based on garment and tier)
- ✅ Three quality tiers with clear value propositions
- ✅ 6 workmanship premiums with industry-standard pricing
- ✅ 10-15% fabric wastage factor
- ✅ Complete itemized breakdown
- ✅ Transparent, justifiable pricing for premium bespoke work

---

## Business Context

### Target Market

**Hamees Attire** specializes in **premium men's suiting** - exclusive, bespoke garments for discerning customers. Each piece is treated as a unique creation, not mass production.

### Industry Position

- **Premium Bespoke**: ₹100,000+ orders (including fabric)
- **Labor Component**: 30-50% of total order value
- **Artisan Work**: 20-50 hours per suit
- **Quality Focus**: Hand stitching, full canvas construction, multiple fittings

### Business Goals

1. **Accurate Pricing**: Reflect true cost of premium workmanship
2. **Transparency**: Show customers exactly what they're paying for
3. **Flexibility**: Adapt to custom requirements and rush orders
4. **Profitability**: Ensure adequate margins on artisan labor
5. **Competitiveness**: Align with global bespoke tailoring standards

---

## Industry Research

### Global Bespoke Pricing Standards (2024)

| Category | Price Range (USD) | Price Range (INR) | Labor % | Fabric % |
|----------|------------------|-------------------|---------|----------|
| Entry Bespoke | $1,200 - $2,500 | ₹1L - ₹2L | 30% | 60% |
| Mid-Range Bespoke | $2,500 - $5,000 | ₹2L - ₹4L | 40% | 50% |
| Premium Bespoke | $5,000 - $10,000+ | ₹4L - ₹8L+ | 50% | 40% |

### India-Specific Findings

**Premium Tailoring Market:**
- Basic Tailored Suit: ₹5,000-₹8,500
- Premium Bespoke: ₹100,000+ (including luxury fabric)
- Labor Component: ₹30,000-₹50,000 per suit
- Timeline: 4-6 weeks for bespoke

**Key Cost Drivers:**
1. **Fabric Quality** (40-60%): Loro Piana, Zegna, Dormeuil, Cerruti
2. **Artisan Labor** (30-50%): Hand stitching, pattern making, fittings
3. **Construction Method** (5-15%): Fused vs. Half-Canvas vs. Full-Canvas
4. **Design Complexity** (5-15%): Peak lapels, working buttonholes, special vents

### Sources

- [Don Morphy: Bespoke Suit Cost 2024](https://donmorphy.com/blogs/blog-posts/how-much-does-a-bespoke-suit-cost-in-2024)
- [Carl Axen: Custom Suit Pricing Guide](https://carlaxenclothier.com/custom-suit-pricing-how-much-does-a-tailored-suit-cost-full-guide/)
- [Silailor: Delhi Tailoring Price List](https://www.silailor.in/stitching-price-list-cost-charges-rate/)
- [Sacred Weaves: Suit Customisation](https://www.sacredweaves.com/products/suit-customisation)

---

## Pricing Components

### 1. Dynamic Stitching Charges by Garment Type

**Recommended Pricing (per garment):**

| Garment Type | Basic Tier | Premium Tier | Luxury Tier |
|--------------|-----------|-------------|-------------|
| **3-Piece Suit** | ₹10,000 | ₹15,000 | ₹20,000+ |
| **2-Piece Suit** | ₹8,000 | ₹12,000 | ₹16,000+ |
| **Jacket/Blazer** | ₹5,000 | ₹7,500 | ₹10,000+ |
| **Trouser** | ₹2,500 | ₹3,500 | ₹5,000 |
| **Shirt** | ₹2,000 | ₹3,000 | ₹4,000 |
| **Sherwani** | ₹12,000 | ₹18,000 | ₹25,000+ |

**Tier Definitions:**

- **BASIC**: Entry-level bespoke
  - Machine stitching with hand finishing
  - Fused or half-canvas construction
  - Standard fit and design
  - 2 fittings included
  - 14-day delivery

- **PREMIUM**: Mid-range quality
  - Combination of machine and hand stitching
  - Half-canvas or full-canvas construction
  - Custom design elements
  - 3 fittings included
  - Premium fabrics recommended
  - 21-day delivery

- **LUXURY**: High-end bespoke
  - Extensive hand stitching (80%+ by hand)
  - Full-canvas construction standard
  - Completely custom design
  - 4+ fittings included
  - Luxury fabrics only
  - 28-42 day delivery
  - Master tailor assignment

### 2. Workmanship Premiums

**A) Hand Stitching (+30-40% of base stitching cost)**

- **Justification**: 20-50 hours of artisan work
- **Benefits**: Superior fit, durability, shapability
- **Example**: Premium Suit (₹12,000 base) + Hand Stitching (₹4,800) = ₹16,800

**Calculation:**
```typescript
handStitchingCost = baseStitchingCost * 0.40
```

**B) Full Canvas Construction (+₹3,000 - ₹5,000)**

- **Justification**: 6 weeks crafting time, superior drape
- **Benefits**: Shapes to body over time, breathable, prestigious
- **Example**: Jacket with Full Canvas (+₹5,000)

**Calculation:**
```typescript
fullCanvasCost = 5000 // Fixed premium for complexity
```

**C) Rush Order (<7 days delivery) (+50% of total base cost)**

- **Justification**: Priority scheduling, overtime labor
- **Benefits**: Expedited delivery for urgent events
- **Example**: Suit (₹12,000) + Rush (+₹6,000) = ₹18,000

**Calculation:**
```typescript
rushOrderCost = baseStitchingCost * 0.50
```

**D) Complex Design (+20-30% of base stitching cost)**

- **Justification**: Peak lapels, working buttonholes, special vents, unique details
- **Benefits**: Distinctive, personalized garment
- **Example**: Suit (₹12,000) + Complex Design (₹3,600) = ₹15,600

**Calculation:**
```typescript
complexDesignCost = baseStitchingCost * 0.30
```

**E) Additional Fittings (+₹1,500 per fitting beyond 2)**

- **Justification**: Extra appointments, pattern adjustments
- **Benefits**: Perfect fit for difficult body types
- **Example**: 2 extra fittings = +₹3,000

**Calculation:**
```typescript
additionalFittingsCost = additionalFittings * 1500
```

**F) Premium Lining (+₹2,000 - ₹5,000)**

- **Justification**: Silk lining, custom monograms, hand-finished
- **Benefits**: Luxury feel, personalization, comfort
- **Example**: Silk lining with monogram = +₹5,000

**Calculation:**
```typescript
premiumLiningCost = 5000 // Based on material and customization
```

### 3. Fabric Wastage Factor (10-15%)

**Industry Standard**: Bespoke tailoring requires 10-15% fabric wastage due to:
- Pattern matching for stripes/checks
- Grain alignment for drape
- Cutting precision for complex designs
- Allowance for alterations

**Calculation:**
```typescript
fabricWastageAmount = fabricCost * (fabricWastagePercent / 100)
// Example: ₹45,000 fabric × 15% = ₹6,750 wastage
```

### 4. Designer Consultation Fee (₹3,000 - ₹8,000)

**Services Included:**
- Style guidance and design recommendations
- Fabric selection advice
- Color and pattern coordination
- Wardrobe planning
- Personal styling session

**Typical Charges:**
- Basic Consultation: ₹3,000 (30 minutes)
- Standard Consultation: ₹5,000 (1 hour)
- Premium Consultation: ₹8,000 (2+ hours, wardrobe planning)

### 5. Manual Override Capability

**Purpose**: Allow custom pricing adjustments for special circumstances

**Use Cases:**
- Bulk order discounts
- Loyal customer pricing
- Price matching for competition
- Error correction
- Special material sourcing

**Audit Requirements:**
- Override reason MANDATORY for every adjustment
- Original calculated value preserved
- Override highlighted in UI with amber badge
- Complete history tracked in `pricingNotes` field

**Example:**
```
Fabric Cost (Calculated): ₹45,000
Fabric Cost (Override): ₹40,000
Reason: "Bulk order discount - customer ordering 5 suits"
```

---

## Database Schema

### New Enum: StitchingTier

```prisma
enum StitchingTier {
  BASIC       // Entry-level bespoke
  PREMIUM     // Mid-range quality
  LUXURY      // High-end bespoke
}
```

### Updated GarmentPattern Model

```prisma
model GarmentPattern {
  id            String    @id @default(cuid())
  name          String    // Men's Shirt, Men's Trouser, etc.
  description   String?
  baseMeters    Float     // Base fabric requirement

  // Body type adjustments
  slimAdjustment     Float @default(0)
  regularAdjustment  Float @default(0)
  largeAdjustment    Float @default(0.3)
  xlAdjustment       Float @default(0.5)

  // ✨ NEW: Stitching charge tiers
  basicStitchingCharge    Float @default(1500)
  premiumStitchingCharge  Float @default(3000)
  luxuryStitchingCharge   Float @default(5000)

  active        Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accessories   GarmentAccessory[]
  orderItems    OrderItem[]

  @@index([active])
}
```

**Default Values:**
- Men's Sherwani: ₹12K / ₹18K / ₹25K
- Men's Suit: ₹8K / ₹12K / ₹16K
- Men's Trouser: ₹2.5K / ₹3.5K / ₹5K
- Men's Shirt: ₹2K / ₹3K / ₹4K

### Updated Order Model (30 New Fields)

```prisma
model Order {
  // ... existing fields ...

  // ✨ Cost Breakdown Fields (8 fields)
  fabricCost              Float         @default(0)
  fabricWastagePercent    Float         @default(0)
  fabricWastageAmount     Float         @default(0)
  accessoriesCost         Float         @default(0)
  stitchingCost           Float         @default(0)
  stitchingTier           StitchingTier @default(BASIC)
  workmanshipPremiums     Float         @default(0)
  designerConsultationFee Float         @default(0)

  // ✨ Workmanship Premium Flags (12 fields)
  isHandStitched          Boolean       @default(false)
  handStitchingCost       Float         @default(0)

  isFullCanvas            Boolean       @default(false)
  fullCanvasCost          Float         @default(0)

  isRushOrder             Boolean       @default(false)
  rushOrderCost           Float         @default(0)

  hasComplexDesign        Boolean       @default(false)
  complexDesignCost       Float         @default(0)

  additionalFittings      Int           @default(0)
  additionalFittingsCost  Float         @default(0)

  hasPremiumLining        Boolean       @default(false)
  premiumLiningCost       Float         @default(0)

  // ✨ Manual Override Fields (10 fields)
  isFabricCostOverridden      Boolean   @default(false)
  fabricCostOverride          Float?
  fabricCostOverrideReason    String?

  isStitchingCostOverridden   Boolean   @default(false)
  stitchingCostOverride       Float?
  stitchingCostOverrideReason String?

  isAccessoriesCostOverridden Boolean   @default(false)
  accessoriesCostOverride     Float?
  accessoriesCostOverrideReason String?

  pricingNotes                String?   @db.Text

  // ... rest of model ...
}
```

### Migration Script

**Location**: `/prisma/migrations/manual_premium_pricing_system.sql`

**Execution**:
```bash
PGPASSWORD=hamees_secure_2026 psql -h /var/run/postgresql -U hamees_user -d tailor_inventory -f prisma/migrations/manual_premium_pricing_system.sql
```

**Verification**:
```sql
-- Verify StitchingTier enum
SELECT typname FROM pg_type WHERE typname = 'StitchingTier';

-- Count new Order columns (should return 30)
SELECT COUNT(*)
FROM information_schema.columns
WHERE table_name = 'Order'
  AND column_name IN (
    'fabricCost', 'fabricWastagePercent', 'fabricWastageAmount',
    'accessoriesCost', 'stitchingCost', 'stitchingTier',
    'workmanshipPremiums', 'designerConsultationFee',
    -- ... all 30 fields
  );

-- View GarmentPattern stitching charges
SELECT name, basicStitchingCharge, premiumStitchingCharge, luxuryStitchingCharge
FROM "GarmentPattern"
ORDER BY basicStitchingCharge DESC;
```

---

## API Reference

### POST /api/orders (Enhanced)

**Create order with itemized pricing calculation**

**Request Body**:
```typescript
{
  customerId: string
  deliveryDate: string
  advancePaid: number
  notes?: string

  // ✨ NEW: Pricing configuration
  stitchingTier: 'BASIC' | 'PREMIUM' | 'LUXURY'
  fabricWastagePercent: number  // 0-15
  designerConsultationFee: number

  // ✨ NEW: Workmanship premiums
  isHandStitched: boolean
  isFullCanvas: boolean
  isRushOrder: boolean
  hasComplexDesign: boolean
  additionalFittings: number
  hasPremiumLining: boolean

  // ✨ NEW: Manual overrides
  fabricCostOverride?: number
  fabricCostOverrideReason?: string
  stitchingCostOverride?: number
  stitchingCostOverrideReason?: string
  accessoriesCostOverride?: number
  accessoriesCostOverrideReason?: string
  pricingNotes?: string

  items: [{
    garmentPatternId: string
    clothInventoryId: string
    quantity: number
    bodyType: 'SLIM' | 'REGULAR' | 'LARGE' | 'XL'
    accessories: [{ accessoryId: string, quantity: number }]
  }]
}
```

**Response**:
```typescript
{
  order: {
    id: string
    orderNumber: string

    // ✨ Itemized cost breakdown
    fabricCost: 45000.00
    fabricWastagePercent: 15.00
    fabricWastageAmount: 6750.00
    accessoriesCost: 2400.00
    stitchingCost: 15000.00
    stitchingTier: "PREMIUM"
    workmanshipPremiums: 11000.00
    designerConsultationFee: 5000.00

    // ✨ Workmanship details
    isHandStitched: true
    handStitchingCost: 6000.00
    isFullCanvas: true
    fullCanvasCost: 5000.00
    // ... other premiums

    // Standard totals
    subTotal: 78400.00
    gstAmount: 9408.00  // 12%
    totalAmount: 87808.00
    advancePaid: 30000.00
    balanceAmount: 57808.00

    // ... other order fields
  }
}
```

### Calculation Flow

```typescript
// 1. Calculate fabric cost
let fabricCost = 0
for (const item of items) {
  const meters = (pattern.baseMeters + bodyTypeAdjustment) * item.quantity
  fabricCost += meters * cloth.pricePerMeter
}

// 2. Apply fabric wastage
const fabricWastageAmount = fabricCost * (fabricWastagePercent / 100)

// 3. Calculate accessories cost
let accessoriesCost = 0
for (const accessory of item.accessories) {
  accessoriesCost += accessory.quantity * item.quantity * accessory.pricePerUnit
}

// 4. Calculate stitching cost (based on tier)
let stitchingCost = 0
for (const item of items) {
  const pattern = garmentPatterns.find(p => p.id === item.garmentPatternId)

  if (stitchingTier === 'BASIC') {
    stitchingCost += pattern.basicStitchingCharge * item.quantity
  } else if (stitchingTier === 'PREMIUM') {
    stitchingCost += pattern.premiumStitchingCharge * item.quantity
  } else if (stitchingTier === 'LUXURY') {
    stitchingCost += pattern.luxuryStitchingCharge * item.quantity
  }
}

// 5. Calculate workmanship premiums
let workmanshipPremiums = 0

if (isHandStitched) {
  const handStitchingCost = stitchingCost * 0.40  // 40% premium
  workmanshipPremiums += handStitchingCost
}

if (isFullCanvas) {
  const fullCanvasCost = 5000  // Fixed premium
  workmanshipPremiums += fullCanvasCost
}

if (isRushOrder) {
  const rushOrderCost = stitchingCost * 0.50  // 50% premium
  workmanshipPremiums += rushOrderCost
}

if (hasComplexDesign) {
  const complexDesignCost = stitchingCost * 0.30  // 30% premium
  workmanshipPremiums += complexDesignCost
}

if (additionalFittings > 0) {
  const additionalFittingsCost = additionalFittings * 1500
  workmanshipPremiums += additionalFittingsCost
}

if (hasPremiumLining) {
  const premiumLiningCost = 5000  // Fixed premium
  workmanshipPremiums += premiumLiningCost
}

// 6. Apply manual overrides (if any)
if (isFabricCostOverridden && fabricCostOverride != null) {
  fabricCost = fabricCostOverride
}

if (isStitchingCostOverridden && stitchingCostOverride != null) {
  stitchingCost = stitchingCostOverride
}

if (isAccessoriesCostOverridden && accessoriesCostOverride != null) {
  accessoriesCost = accessoriesCostOverride
}

// 7. Calculate subtotal
const subTotal =
  fabricCost +
  fabricWastageAmount +
  accessoriesCost +
  stitchingCost +
  workmanshipPremiums +
  designerConsultationFee

// 8. Calculate GST (12%)
const gstRate = 12
const gstAmount = (subTotal * gstRate) / 100
const cgst = gstAmount / 2
const sgst = gstAmount / 2

// 9. Calculate total
const totalAmount = subTotal + gstAmount
const balanceAmount = totalAmount - advancePaid
```

---

## UI Components

### 1. Itemized Cost Breakdown Display

**Location**: Step 3 of order form (Order Details & Summary)

**Layout**:
```
┌─────────────────────────────────────────────────┐
│ COST BREAKDOWN                                  │
├─────────────────────────────────────────────────┤
│                                                 │
│ Fabric Cost:                      ₹45,000.00   │
│   - Premium Cotton (Blue)                       │
│   - 3.2m × ₹14,062.50/m                        │
│   - Wastage (15%):               ₹6,750.00     │
│                                                 │
│ Accessories Cost:                  ₹2,400.00   │
│   - Buttons (20 units)            ₹1,600.00    │
│   - Thread (2 spools)               ₹400.00    │
│   - Zipper (1 unit)                 ₹400.00    │
│                                                 │
│ Tailoring Cost:                   ₹15,000.00   │
│   - Base (Premium tier)           ₹15,000.00   │
│                                                 │
│ Workmanship Premiums:             ₹11,000.00   │
│   - Hand Stitching                 ₹6,000.00   │
│   - Full Canvas                    ₹5,000.00   │
│                                                 │
│ Designer Consultation:             ₹5,000.00   │
│                                                 │
│ ─────────────────────────────────────────────  │
│ Subtotal (before GST):            ₹78,400.00   │
│ CGST (6%):                         ₹4,704.00   │
│ SGST (6%):                         ₹4,704.00   │
│ Total GST (12%):                   ₹9,408.00   │
│ ─────────────────────────────────────────────  │
│ Total Amount:                     ₹87,808.00   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 2. Stitching Tier Selector

**Component**: Radio button group

```tsx
<div className="space-y-2">
  <label className="font-semibold">Stitching Quality Tier</label>
  <div className="grid grid-cols-3 gap-4">
    <div className={`border-2 p-4 rounded-lg cursor-pointer ${
      stitchingTier === 'BASIC' ? 'border-blue-600 bg-blue-50' : 'border-slate-300'
    }`}>
      <input type="radio" name="tier" value="BASIC" />
      <div className="font-bold">BASIC</div>
      <div className="text-sm text-slate-600">₹2K-₹10K</div>
      <div className="text-xs">Machine stitching, 14-day delivery</div>
    </div>

    <div className={`border-2 p-4 rounded-lg cursor-pointer ${
      stitchingTier === 'PREMIUM' ? 'border-blue-600 bg-blue-50' : 'border-slate-300'
    }`}>
      <input type="radio" name="tier" value="PREMIUM" />
      <div className="font-bold">PREMIUM</div>
      <div className="text-sm text-slate-600">₹3K-₹18K</div>
      <div className="text-xs">Mixed stitching, 21-day delivery</div>
    </div>

    <div className={`border-2 p-4 rounded-lg cursor-pointer ${
      stitchingTier === 'LUXURY' ? 'border-blue-600 bg-blue-50' : 'border-slate-300'
    }`}>
      <input type="radio" name="tier" value="LUXURY" />
      <div className="font-bold">LUXURY</div>
      <div className="text-sm text-slate-600">₹4K-₹25K</div>
      <div className="text-xs">Hand stitching, 28-42 day delivery</div>
    </div>
  </div>
</div>
```

### 3. Workmanship Premium Checkboxes

**Component**: Checkbox grid with cost preview

```tsx
<div className="space-y-4 border-2 border-amber-200 p-4 rounded-lg bg-amber-50">
  <h3 className="font-bold text-lg">Workmanship Premiums</h3>

  <div className="grid grid-cols-2 gap-4">
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        checked={isHandStitched}
        onChange={(e) => setIsHandStitched(e.target.checked)}
      />
      <div>
        <div className="font-semibold">Hand Stitching</div>
        <div className="text-sm text-slate-600">+₹{handStitchingCost.toFixed(2)}</div>
        <div className="text-xs text-slate-500">20-50 hours artisan work</div>
      </div>
    </label>

    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        checked={isFullCanvas}
        onChange={(e) => setIsFullCanvas(e.target.checked)}
      />
      <div>
        <div className="font-semibold">Full Canvas Construction</div>
        <div className="text-sm text-slate-600">+₹5,000.00</div>
        <div className="text-xs text-slate-500">Superior drape, 6 weeks</div>
      </div>
    </label>

    {/* ... more checkboxes ... */}
  </div>
</div>
```

### 4. Fabric Wastage Toggle

**Component**: Slider with percentage input

```tsx
<div className="space-y-2 border-2 border-purple-200 p-4 rounded-lg bg-purple-50">
  <div className="flex items-center justify-between">
    <label className="font-semibold">Fabric Wastage Factor</label>
    <div className="flex items-center gap-2">
      <input
        type="number"
        min="0"
        max="15"
        step="0.5"
        value={fabricWastagePercent}
        onChange={(e) => setFabricWastagePercent(parseFloat(e.target.value))}
        className="w-20 px-2 py-1 border rounded"
      />
      <span>%</span>
    </div>
  </div>

  <input
    type="range"
    min="0"
    max="15"
    step="0.5"
    value={fabricWastagePercent}
    onChange={(e) => setFabricWastagePercent(parseFloat(e.target.value))}
    className="w-full"
  />

  <div className="text-sm text-slate-600">
    Wastage Amount: ₹{fabricWastageAmount.toFixed(2)}
  </div>
  <div className="text-xs text-slate-500">
    Industry standard: 10-15% for bespoke work
  </div>
</div>
```

### 5. Manual Override Dialog

**Component**: Modal with override form

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button variant="outline" size="sm">
      Override Fabric Cost
    </Button>
  </DialogTrigger>

  <DialogContent>
    <DialogHeader>
      <DialogTitle>Override Fabric Cost</DialogTitle>
    </DialogHeader>

    <div className="space-y-4">
      <div className="p-3 bg-blue-50 border border-blue-200 rounded">
        <div className="text-sm text-slate-600">Calculated Cost:</div>
        <div className="font-bold text-lg">₹{fabricCost.toFixed(2)}</div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Override Amount
        </label>
        <input
          type="number"
          step="0.01"
          value={fabricCostOverride}
          onChange={(e) => setFabricCostOverride(parseFloat(e.target.value))}
          className="w-full px-4 py-2 border rounded"
          placeholder="Enter override amount"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Reason for Override (Required)
        </label>
        <textarea
          value={fabricCostOverrideReason}
          onChange={(e) => setFabricCostOverrideReason(e.target.value)}
          rows={3}
          className="w-full px-4 py-2 border rounded"
          placeholder="Explain why you're overriding the calculated cost..."
          required
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={closeDialog}>Cancel</Button>
        <Button
          onClick={applyOverride}
          disabled={!fabricCostOverrideReason}
        >
          Apply Override
        </Button>
      </div>
    </div>
  </DialogContent>
</Dialog>
```

---

## Calculation Logic

### Complete Pricing Algorithm

```typescript
function calculateOrderPricing(orderData) {
  // Step 1: Initialize totals
  let fabricCost = 0
  let accessoriesCost = 0
  let stitchingCost = 0

  // Step 2: Calculate fabric cost for each item
  for (const item of orderData.items) {
    const pattern = getGarmentPattern(item.garmentPatternId)
    const cloth = getClothInventory(item.clothInventoryId)

    // Calculate meters needed
    const bodyTypeAdjustment = getBodyTypeAdjustment(pattern, item.bodyType)
    const metersPerGarment = pattern.baseMeters + bodyTypeAdjustment
    const totalMeters = metersPerGarment * item.quantity

    // Add to fabric cost
    fabricCost += totalMeters * cloth.pricePerMeter

    // Calculate accessories cost
    for (const acc of item.accessories) {
      const accessory = getAccessory(acc.accessoryId)
      const totalUnits = acc.quantity * item.quantity
      accessoriesCost += totalUnits * accessory.pricePerUnit
    }

    // Calculate stitching cost based on tier
    const tierCharge = getTierCharge(pattern, orderData.stitchingTier)
    stitchingCost += tierCharge * item.quantity
  }

  // Step 3: Apply fabric wastage
  const fabricWastageAmount = fabricCost * (orderData.fabricWastagePercent / 100)

  // Step 4: Calculate workmanship premiums
  let workmanshipPremiums = 0

  if (orderData.isHandStitched) {
    const handStitchingCost = stitchingCost * 0.40
    workmanshipPremiums += handStitchingCost
  }

  if (orderData.isFullCanvas) {
    const fullCanvasCost = 5000
    workmanshipPremiums += fullCanvasCost
  }

  if (orderData.isRushOrder) {
    const rushOrderCost = stitchingCost * 0.50
    workmanshipPremiums += rushOrderCost
  }

  if (orderData.hasComplexDesign) {
    const complexDesignCost = stitchingCost * 0.30
    workmanshipPremiums += complexDesignCost
  }

  if (orderData.additionalFittings > 0) {
    const additionalFittingsCost = orderData.additionalFittings * 1500
    workmanshipPremiums += additionalFittingsCost
  }

  if (orderData.hasPremiumLining) {
    const premiumLiningCost = 5000
    workmanshipPremiums += premiumLiningCost
  }

  // Step 5: Apply manual overrides
  if (orderData.isFabricCostOverridden) {
    fabricCost = orderData.fabricCostOverride
  }

  if (orderData.isStitchingCostOverridden) {
    stitchingCost = orderData.stitchingCostOverride
  }

  if (orderData.isAccessoriesCostOverridden) {
    accessoriesCost = orderData.accessoriesCostOverride
  }

  // Step 6: Calculate subtotal
  const subTotal =
    fabricCost +
    fabricWastageAmount +
    accessoriesCost +
    stitchingCost +
    workmanshipPremiums +
    (orderData.designerConsultationFee || 0)

  // Step 7: Calculate GST (12% for garments)
  const gstRate = 12
  const gstAmount = (subTotal * gstRate) / 100
  const cgst = gstAmount / 2
  const sgst = gstAmount / 2

  // Step 8: Calculate total and balance
  const totalAmount = subTotal + gstAmount
  const balanceAmount = totalAmount - orderData.advancePaid

  // Step 9: Return complete breakdown
  return {
    fabricCost,
    fabricWastagePercent: orderData.fabricWastagePercent,
    fabricWastageAmount,
    accessoriesCost,
    stitchingCost,
    stitchingTier: orderData.stitchingTier,
    workmanshipPremiums,
    designerConsultationFee: orderData.designerConsultationFee || 0,

    isHandStitched: orderData.isHandStitched,
    handStitchingCost: orderData.isHandStitched ? stitchingCost * 0.40 : 0,

    isFullCanvas: orderData.isFullCanvas,
    fullCanvasCost: orderData.isFullCanvas ? 5000 : 0,

    isRushOrder: orderData.isRushOrder,
    rushOrderCost: orderData.isRushOrder ? stitchingCost * 0.50 : 0,

    hasComplexDesign: orderData.hasComplexDesign,
    complexDesignCost: orderData.hasComplexDesign ? stitchingCost * 0.30 : 0,

    additionalFittings: orderData.additionalFittings,
    additionalFittingsCost: orderData.additionalFittings * 1500,

    hasPremiumLining: orderData.hasPremiumLining,
    premiumLiningCost: orderData.hasPremiumLining ? 5000 : 0,

    isFabricCostOverridden: orderData.isFabricCostOverridden,
    fabricCostOverride: orderData.fabricCostOverride,
    fabricCostOverrideReason: orderData.fabricCostOverrideReason,

    isStitchingCostOverridden: orderData.isStitchingCostOverridden,
    stitchingCostOverride: orderData.stitchingCostOverride,
    stitchingCostOverrideReason: orderData.stitchingCostOverrideReason,

    isAccessoriesCostOverridden: orderData.isAccessoriesCostOverridden,
    accessoriesCostOverride: orderData.accessoriesCostOverride,
    accessoriesCostOverrideReason: orderData.accessoriesCostOverrideReason,

    pricingNotes: orderData.pricingNotes,

    subTotal,
    gstRate,
    cgst,
    sgst,
    gstAmount,
    totalAmount,
    balanceAmount
  }
}

function getTierCharge(pattern, tier) {
  switch (tier) {
    case 'BASIC':
      return pattern.basicStitchingCharge
    case 'PREMIUM':
      return pattern.premiumStitchingCharge
    case 'LUXURY':
      return pattern.luxuryStitchingCharge
    default:
      return pattern.basicStitchingCharge
  }
}

function getBodyTypeAdjustment(pattern, bodyType) {
  switch (bodyType) {
    case 'SLIM':
      return pattern.slimAdjustment
    case 'REGULAR':
      return pattern.regularAdjustment
    case 'LARGE':
      return pattern.largeAdjustment
    case 'XL':
      return pattern.xlAdjustment
    default:
      return pattern.regularAdjustment
  }
}
```

---

## User Workflows

### Workflow 1: Create Premium Bespoke Suit Order

**Scenario**: Customer wants a luxury 3-piece suit with hand stitching and full canvas construction for a wedding.

**Steps**:

1. **Login**: owner@hameesattire.com / admin123

2. **Navigate**: Dashboard → Orders → New Order

3. **Step 1: Select Customer**
   - Choose existing customer or create new
   - Click "Next: Add Items"

4. **Step 2: Configure Order Items**
   - Add Item 1: 3-Piece Suit
   - Select Garment: "Men's Suit"
   - Select Fabric: "Premium Silk Blend (Navy Blue)" - ₹18,000/m
   - Body Type: REGULAR
   - Quantity: 1
   - Auto-loads accessories: Buttons (12), Thread (3), Zipper (1)
   - Click "Next: Order Details"

5. **Step 3: Configure Pricing**

   A. **Stitching Tier**:
   - Select "LUXURY" (₹16,000 for suit)

   B. **Workmanship Premiums**:
   - ✓ Hand Stitching (+40% = ₹6,400)
   - ✓ Full Canvas Construction (+₹5,000)
   - ✓ Complex Design (peak lapels, working buttonholes) (+30% = ₹4,800)
   - ✓ Premium Lining (silk with monogram) (+₹5,000)
   - Additional Fittings: 1 (+₹1,500)

   C. **Fabric Wastage**:
   - Set to 15% (industry standard for premium work)

   D. **Designer Consultation**:
   - Add ₹8,000 (2-hour wardrobe planning session)

   E. **Review Cost Breakdown**:
   ```
   Fabric Cost:                 ₹54,000.00
     - Silk Blend: 3.0m × ₹18,000/m
     - Wastage (15%):           ₹8,100.00

   Accessories Cost:            ₹3,200.00
     - Buttons (12): ₹2,400
     - Thread (3): ₹600
     - Zipper (1): ₹200

   Tailoring Cost:              ₹16,000.00
     - Base (Luxury tier)

   Workmanship Premiums:        ₹21,700.00
     - Hand Stitching:          ₹6,400.00
     - Full Canvas:             ₹5,000.00
     - Complex Design:          ₹4,800.00
     - Premium Lining:          ₹5,000.00
     - Additional Fittings (1): ₹1,500.00

   Designer Consultation:       ₹8,000.00

   ──────────────────────────────────────
   Subtotal (before GST):      ₹102,900.00
   CGST (6%):                   ₹6,174.00
   SGST (6%):                   ₹6,174.00
   Total GST (12%):            ₹12,348.00
   ──────────────────────────────────────
   Total Amount:               ₹115,248.00
   ```

6. **Set Delivery Date**: 42 days from today (luxury timeline)

7. **Advance Payment**: ₹50,000

8. **Balance**: ₹65,248.00

9. **Click "Create Order"**

10. **Result**:
    - Order created: ORD-202601-0245
    - WhatsApp confirmation sent to customer
    - Fabric reserved (3.45m including wastage)
    - Invoice generated with complete breakdown
    - All pricing fields saved to database

### Workflow 2: Override Pricing for Bulk Order

**Scenario**: Repeat customer ordering 5 shirts, wants bulk discount.

**Steps**:

1. Create order with 5 shirt items (Premium tier, ₹3,000 each = ₹15,000 total stitching)

2. In pricing section, calculated costs:
   - Fabric: ₹35,000
   - Accessories: ₹5,000
   - Stitching: ₹15,000

3. **Apply Override**:
   - Click "Override Stitching Cost"
   - Original: ₹15,000
   - Override: ₹12,000 (20% bulk discount)
   - Reason: "Loyal customer bulk order - 5 shirts, 20% discount applied"
   - Save Override

4. **Review Updated Breakdown**:
   - Stitching cost shows amber badge: "Overridden: ₹12,000 (was ₹15,000)"
   - Hover to see reason
   - Total reduced by ₹3,000

5. Complete order with overridden pricing

### Workflow 3: Rush Order Premium

**Scenario**: Customer needs suit in 5 days for urgent business trip.

**Steps**:

1. Create order with suit (Premium tier, ₹12,000 base)

2. In workmanship premiums:
   - ✓ Rush Order (<7 days) - adds +50% = ₹6,000

3. Adjusted delivery date: 5 days from today

4. Total stitching with rush: ₹18,000

5. Communicate to customer: "Rush order premium of ₹6,000 applied for 5-day delivery vs. standard 21 days"

---

## Testing Guide

### Test Scenario 1: Basic Tier Shirt

**Input**:
- Garment: Men's Shirt
- Fabric: Cotton (₹500/m), 2.5m needed
- Accessories: Buttons (10 × ₹80)
- Tier: BASIC (₹2,000)
- Premiums: None
- Wastage: 0%

**Expected Output**:
```
Fabric Cost: ₹1,250.00
Accessories: ₹800.00
Stitching: ₹2,000.00
Workmanship: ₹0.00
Subtotal: ₹4,050.00
GST (12%): ₹486.00
Total: ₹4,536.00
```

### Test Scenario 2: Luxury Sherwani with All Premiums

**Input**:
- Garment: Men's Sherwani
- Fabric: Brocade Silk (₹25,000/m), 4m needed
- Tier: LUXURY (₹25,000)
- Premiums:
  - Hand Stitching: ✓
  - Full Canvas: ✓
  - Complex Design: ✓
  - Premium Lining: ✓
  - Additional Fittings: 2
  - Rush Order: ✓
- Wastage: 15%
- Designer Fee: ₹8,000

**Expected Calculation**:
```
Fabric: 4m × ₹25,000 = ₹100,000
Wastage (15%): ₹15,000
Accessories: ₹5,000 (estimate)
Stitching (Luxury): ₹25,000

Workmanship Premiums:
  - Hand Stitching (40%): ₹10,000
  - Full Canvas: ₹5,000
  - Complex Design (30%): ₹7,500
  - Premium Lining: ₹5,000
  - Additional Fittings (2): ₹3,000
  - Rush Order (50%): ₹12,500
  Total Workmanship: ₹43,000

Designer Fee: ₹8,000

Subtotal: ₹196,000
GST (12%): ₹23,520
Total: ₹219,520
```

### Test Scenario 3: Manual Override

**Input**:
- Start with calculated fabric cost: ₹45,000
- Override to: ₹40,000
- Reason: "Customer provided own fabric, charging handling fee only"

**Verification**:
- `isFabricCostOverridden`: true
- `fabricCostOverride`: 40000
- `fabricCostOverrideReason`: "Customer provided..."
- UI shows amber badge with override indicator
- Subtotal reduced by ₹5,000
- Original value preserved in database comments

### Database Verification Queries

```sql
-- Test 1: Verify tier charges loaded correctly
SELECT name, basicStitchingCharge, premiumStitchingCharge, luxuryStitchingCharge
FROM "GarmentPattern"
WHERE name IN ('Men''s Shirt', 'Men''s Suit', 'Men''s Sherwani');

-- Expected:
-- Men's Shirt:    2000,  3000,  4000
-- Men's Suit:     8000, 12000, 16000
-- Men's Sherwani: 12000, 18000, 25000

-- Test 2: Verify order pricing breakdown
SELECT
  "orderNumber",
  "fabricCost",
  "accessoriesCost",
  "stitchingCost",
  "stitchingTier",
  "workmanshipPremiums",
  "subTotal",
  "totalAmount"
FROM "Order"
WHERE "orderNumber" = 'ORD-202601-0245';

-- Test 3: Verify workmanship premiums
SELECT
  "orderNumber",
  "isHandStitched",
  "handStitchingCost",
  "isFullCanvas",
  "fullCanvasCost",
  "isRushOrder",
  "rushOrderCost"
FROM "Order"
WHERE "isHandStitched" = true OR "isFullCanvas" = true;

-- Test 4: Verify overrides
SELECT
  "orderNumber",
  "fabricCost",
  "isFabricCostOverridden",
  "fabricCostOverride",
  "fabricCostOverrideReason"
FROM "Order"
WHERE "isFabricCostOverridden" = true;
```

---

## Troubleshooting

### Issue 1: Stitching charges not loading

**Symptoms**:
- Order form shows ₹0.00 for stitching cost
- All garment patterns show default ₹1,500

**Cause**: Migration not executed or GarmentPattern table not updated

**Solution**:
```bash
# Re-run migration
PGPASSWORD=hamees_secure_2026 psql -h /var/run/postgresql -U hamees_user -d tailor_inventory -f prisma/migrations/manual_premium_pricing_system.sql

# Verify
psql -h /var/run/postgresql -U hamees_user -d tailor_inventory -c "SELECT name, basicStitchingCharge FROM \"GarmentPattern\";"
```

### Issue 2: Workmanship premiums not calculating

**Symptoms**:
- Checkboxes enabled but cost stays at ₹0
- `workmanshipPremiums` field always 0

**Cause**: Frontend calculation not updating state or API not receiving premium flags

**Debug**:
```typescript
// Add console logging in calculateEstimate()
console.log('isHandStitched:', isHandStitched)
console.log('stitchingCost:', stitchingCost)
console.log('handStitchingCost:', stitchingCost * 0.40)

// Check API request body
console.log('Request body:', JSON.stringify(orderData, null, 2))
```

**Solution**: Ensure all premium states are included in API request

### Issue 3: Manual override not saving

**Symptoms**:
- Override dialog saves successfully
- Database shows override fields as NULL
- Cost reverts to calculated value

**Cause**: Override fields not included in Prisma create/update data object

**Solution**:
```typescript
// In app/api/orders/route.ts, ensure all override fields are included:
await prisma.order.create({
  data: {
    // ... other fields ...
    isFabricCostOverridden: validatedData.isFabricCostOverridden || false,
    fabricCostOverride: validatedData.fabricCostOverride,
    fabricCostOverrideReason: validatedData.fabricCostOverrideReason,
    // ... rest of override fields
  }
})
```

### Issue 4: Prisma client not recognizing new fields

**Symptoms**:
- TypeScript errors: "Property 'stitchingTier' does not exist on type 'Order'"
- Runtime errors: "Unknown field 'fabricCost'"

**Cause**: Prisma client not regenerated after schema changes

**Solution**:
```bash
# Regenerate Prisma client
pnpm prisma generate

# Restart Next.js development server
pnpm dev
```

### Issue 5: GST calculation mismatch

**Symptoms**:
- Total doesn't match subtotal + GST
- GST percentage off by small amount

**Cause**: Floating-point precision errors in JavaScript

**Solution**:
```typescript
// Always use parseFloat() and toFixed(2) for currency
const gstAmount = parseFloat(((subTotal * gstRate) / 100).toFixed(2))
const cgst = parseFloat((gstAmount / 2).toFixed(2))
const sgst = parseFloat((gstAmount / 2).toFixed(2))
const totalAmount = parseFloat((subTotal + gstAmount).toFixed(2))
```

---

## Future Enhancements

### Phase 1: Advanced Pricing (v0.23.0)

- **Dynamic Pricing Rules Engine**: Configure pricing rules per customer segment
- **Seasonal Pricing**: Adjust premiums based on demand (wedding season, festive season)
- **Multi-Currency Support**: Display prices in USD, EUR for international clients
- **Tax Flexibility**: Support for different GST rates, inter-state IGST

### Phase 2: Customer Experience (v0.24.0)

- **Price Calculator Widget**: Let customers estimate costs on website
- **Comparison Tool**: Compare Basic vs. Premium vs. Luxury side-by-side
- **Package Deals**: Pre-configured bundles (3 Shirts + 2 Trousers = 10% off)
- **Loyalty Discounts**: Automatic discounts for repeat customers

### Phase 3: Analytics (v0.25.0)

- **Pricing Analytics Dashboard**: Track average order value, popular tiers, premium adoption
- **Profitability Reports**: Margin analysis per garment type, per stitching tier
- **Workmanship Utilization**: How often each premium is used
- **Override Audit Reports**: Track all manual overrides with reasons

### Phase 4: Integrations (v0.26.0)

- **Payment Gateway Integration**: Accept online payments for advance
- **Invoice Automation**: Email GST-compliant invoices automatically
- **Accounting Export**: Export to Tally, QuickBooks with itemized breakdown
- **WhatsApp Pricing Notifications**: Send pricing breakdown to customer via WhatsApp

---

## Appendix

### A. Glossary

- **Bespoke**: Fully custom-made garment from scratch, unique pattern
- **Full Canvas**: Jacket construction with horsehair canvas, hand-stitched
- **Half Canvas**: Partial canvas in chest/lapel area only
- **Fused**: Jacket with glued interlining (cheapest construction)
- **Peak Lapels**: V-shaped lapels pointing upward (vs. notch lapels)
- **Working Buttonholes**: Functional sleeve buttons (vs. decorative)
- **Monogram**: Personalized embroidered initials

### B. Standard Fabric Requirements

| Garment | Base Meters | Slim | Regular | Large | XL |
|---------|-------------|------|---------|-------|-----|
| Shirt | 2.5m | -0.2m | 0m | +0.3m | +0.5m |
| Trouser | 2.0m | -0.2m | 0m | +0.3m | +0.5m |
| 2-Piece Suit | 3.5m | -0.3m | 0m | +0.5m | +0.8m |
| 3-Piece Suit | 4.5m | -0.5m | 0m | +0.7m | +1.0m |
| Sherwani | 4.0m | -0.3m | 0m | +0.5m | +0.8m |

### C. Typical Lead Times

| Stitching Tier | Standard | Rush (<7 days) |
|---------------|----------|----------------|
| BASIC | 14 days | 5 days (+50%) |
| PREMIUM | 21 days | 7 days (+50%) |
| LUXURY | 28-42 days | 10-14 days (+50%) |

### D. Sample Order Calculations

**Example 1: Basic Shirt**
```
Fabric: Cotton 2.5m × ₹500 = ₹1,250
Accessories: Buttons 10 × ₹80 = ₹800
Stitching (Basic): ₹2,000
Subtotal: ₹4,050
GST (12%): ₹486
Total: ₹4,536
```

**Example 2: Premium Suit with Hand Stitching**
```
Fabric: Wool 3.5m × ₹8,000 = ₹28,000
Wastage (15%): ₹4,200
Accessories: ₹3,000
Stitching (Premium): ₹12,000
Hand Stitching (40%): ₹4,800
Subtotal: ₹52,000
GST (12%): ₹6,240
Total: ₹58,240
```

**Example 3: Luxury Sherwani - All Premiums**
```
Fabric: Brocade 4m × ₹25,000 = ₹100,000
Wastage (15%): ₹15,000
Accessories: ₹5,000
Stitching (Luxury): ₹25,000
Hand Stitching (40%): ₹10,000
Full Canvas: ₹5,000
Complex Design (30%): ₹7,500
Premium Lining: ₹5,000
Additional Fittings (2): ₹3,000
Rush Order (50%): ₹12,500
Designer Fee: ₹8,000
Subtotal: ₹196,000
GST (12%): ₹23,520
Total: ₹219,520
```

---

**Document Version**: 1.0
**Last Updated**: January 22, 2026
**Author**: Premium Pricing System Development Team
**Contact**: dev@hameesattire.com
