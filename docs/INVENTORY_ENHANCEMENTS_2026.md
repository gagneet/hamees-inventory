# Inventory Management System Enhancements (2026)

**Date:** January 23, 2026
**Version:** 0.23.0
**Status:** 🚧 In Implementation

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Research Findings](#research-findings)
3. [Enhancement Roadmap](#enhancement-roadmap)
4. [Phase 1: Core Fabric Specifications](#phase-1-core-fabric-specifications)
5. [Phase 2: Roll/Batch Management](#phase-2-rollbatch-management)
6. [Phase 3: Advanced Analytics](#phase-3-advanced-analytics)
7. [Phase 4: Automation & Intelligence](#phase-4-automation--intelligence)
8. [Barcode Scanner Improvements](#barcode-scanner-improvements)
9. [Implementation Guide](#implementation-guide)
10. [Testing Scenarios](#testing-scenarios)

---

## 📊 Executive Summary

Based on comprehensive research of commercial tailoring inventory systems in India and globally, this document outlines enhancements to transform the Hamees Attire inventory system from basic tracking to an industry-leading solution.

**Key Objectives:**
- ✅ Enhanced fabric specification tracking (GSM, composition, weave patterns)
- ✅ Visual fabric catalog with photo management
- ✅ Smart accessory management with compatibility matching
- ✅ Roll-level inventory tracking for precise wastage analysis
- ✅ Predictive reordering with seasonal intelligence
- ✅ Advanced consumption analytics and insights

**Business Impact:**
- 35% reduction in inventory holding costs (industry benchmark)
- 40% improvement in production efficiency
- 25-30% reduction in fabric wastage
- Improved customer experience with visual fabric selection
- Data-driven purchasing decisions

---

## 🔍 Research Findings

### Leading Systems Analyzed

**India Market:**
- **Fabriplay** - Real-time analytics, overstock prevention
- **TailoBill** - Fabric inward/outward tracking, stock reports
- **Sunrise Tailoring** - Order, inventory, and billing automation
- **Shristitch** - Fabric stock management with stitching integration

**Global Textile ERP:**
- **Digit Software** - GSM tracking, roll-level management
- **Uphance** - Textile ERP with production planning
- **Rapitek** - Roll-to-retail traceability
- **Orderry** - Measurement integration, consumption reports

### Key Features Identified

1. **Fabric Technical Specifications:**
   - GSM (Grams per Square Meter) tracking
   - Thread count and weave type
   - Fabric composition percentages
   - Shrinkage and care instructions
   - Seasonal suitability classification

2. **Roll/Batch Management:**
   - Individual roll tracking with unique IDs
   - FIFO inventory rotation
   - Defect tracking per roll
   - Quality grading (A/B/C)
   - Bin location assignment

3. **Smart Analytics:**
   - Consumption pattern analysis
   - Seasonal demand forecasting
   - Automated reorder suggestions
   - Wastage benchmarking
   - Supplier performance tracking

4. **Visual Management:**
   - Fabric photo galleries
   - Texture and drape samples
   - Color matching tools
   - Mobile inventory counting

---

## 🗺️ Enhancement Roadmap

### Phase 1: Core Fabric Specifications (Weeks 1-2) ✅ IN PROGRESS
**Priority:** HIGH
**Complexity:** LOW
**Business Value:** HIGH

**Features:**
- ✅ Fabric technical specifications (GSM, composition, weave)
- ✅ Fabric photo upload (single primary image)
- ✅ Season/occasion tags for better filtering
- ✅ Enhanced accessory details (button size, thread color codes)
- ✅ Care instructions field

**Database Changes:**
```prisma
model ClothInventory {
  // NEW FIELDS
  fabricComposition   String?   // "70% Cotton, 30% Polyester"
  gsm                 Float?    // Grams per Square Meter
  threadCount         Int?      // Threads per inch
  weaveType           String?   // Plain, Twill, Satin, Jacquard
  fabricWidth         Float?    // Width in inches (44", 58", 60")
  shrinkagePercent    Float?    // Expected shrinkage (2-5%)
  colorFastness       String?   // Excellent, Good, Fair
  seasonSuitability   String[]  // ["Summer", "Winter", "All-season"]
  occasionType        String[]  // ["Casual", "Formal", "Wedding"]
  careInstructions    String?   // "Dry clean only"
  swatchImage         String?   // Primary fabric photo
  textureImage        String?   // Close-up texture
}

model AccessoryInventory {
  // NEW FIELDS
  colorCode           String?   // Pantone/DMC color code
  buttonSize          String?   // "14L", "18L", "20L"
  holePunchSize       Int?      // 2-hole, 4-hole
  material            String?   // "Shell", "Brass", "Resin"
  finish              String?   // "Matte", "Polished", "Antique"
  threadWeight        String?   // "40wt", "50wt", "60wt"
  recommendedFor      String[]  // ["Suit", "Shirt", "Trouser"]
  productImage        String?   // Product photo
}
```

**Deliverables:**
- ✅ Updated Prisma schema
- ✅ Database migration script
- ✅ Enhanced seed data with all new fields
- ✅ Updated Excel bulk upload templates
- ✅ UI forms with new fields
- ✅ Photo upload component

---

### Phase 2: Roll/Batch Management (Weeks 3-4)
**Priority:** HIGH
**Complexity:** MEDIUM
**Business Value:** VERY HIGH

**Features:**
- Individual roll tracking with unique identifiers
- Roll usage history and traceability
- Quality grading per roll
- Defect documentation with photos
- FIFO inventory rotation enforcement
- Bin location management

**Database Schema:**
```prisma
model FabricRoll {
  id              String   @id @default(cuid())
  clothInventoryId String
  rollNumber      String   @unique  // "COTTON-BLUE-R001"
  batchNumber     String?  // Supplier batch

  // Physical Details
  startingMeters  Float    // Original roll length
  currentMeters   Float    // Remaining meters
  rollWidth       Float    // Width in inches

  // Quality & Location
  qualityGrade    String   @default("A")  // A, B, C
  binLocation     String?  // "Rack A1, Shelf 2"
  defectNotes     String?  // "Small tear at 5.5m mark"
  usableSections  Json?    // [{start: 0, end: 5.4}, {start: 5.6, end: 12}]

  // Tracking
  receivedDate    DateTime @default(now())
  firstUsedDate   DateTime?
  purchaseOrderId String?

  // Photos
  rollPhoto       String?  // Photo of roll label/tag
  inspectionPhotos String[] // Defect photos

  clothInventory  ClothInventory @relation(...)
  usageHistory    RollUsage[]

  @@index([clothInventoryId])
  @@index([rollNumber])
}

model RollUsage {
  id          String   @id @default(cuid())
  rollId      String
  orderItemId String?
  metersUsed  Float
  usedDate    DateTime @default(now())
  usedBy      String   // User ID
  notes       String?

  roll        FabricRoll @relation(...)
  @@index([rollId])
}
```

**Benefits:**
- Precise wastage tracking per roll
- Quality control by supplier batch
- Eliminate "ghost" inventory discrepancies
- Better supplier accountability
- Optimized warehouse organization

---

### Phase 3: Advanced Analytics (Weeks 5-6)
**Priority:** MEDIUM
**Complexity:** MEDIUM
**Business Value:** HIGH

**Features:**
- Consumption pattern analysis (30/60/90 days)
- Seasonal demand forecasting
- Garment type breakdown by fabric
- Wastage benchmarking vs industry standards
- Supplier performance metrics
- Reorder point suggestions

**API Endpoint:**
```typescript
GET /api/analytics/fabric-consumption?fabricId={id}&period=30

Response:
{
  "last30Days": {
    "metersUsed": 45.5,
    "ordersCount": 12,
    "averagePerOrder": 3.79,
    "wastagePercent": 8.2,
    "trend": "increasing"
  },
  "seasonalPattern": {
    "peakMonths": ["October", "November", "December"],
    "avgMonthlyConsumption": 38.5,
    "nextMonthPrediction": 52.0
  },
  "garmentTypeBreakdown": [...],
  "reorderRecommendation": {
    "suggestedQty": 150,
    "confidence": "high",
    "reasoning": "Based on wedding season peak"
  }
}
```

**Dashboard Widget:**
```
┌─────────────────────────────────────────┐
│ 📊 Fabric Intelligence: Premium Cotton │
├─────────────────────────────────────────┤
│ Current Stock: 45.5m (🔴 Low)          │
│ 30-Day Usage: 45.5m (↗ +15% vs prev)   │
│ Avg Order: 3.8m                         │
│ Wastage: 8.2% (🟢 Within target <10%)  │
│                                         │
│ ⚠️ RECOMMENDATION:                      │
│ Order 150m by Oct 15                    │
│ Reason: Wedding season peak ahead       │
└─────────────────────────────────────────┘
```

---

### Phase 4: Automation & Intelligence (Weeks 7-8)
**Priority:** LOW
**Complexity:** HIGH
**Business Value:** MEDIUM

**Features:**
- Automated purchase order creation
- Supplier price comparison
- WhatsApp reorder notifications
- Fabric similarity matching (AI)
- Customer preference learning
- Voice notes for fabric descriptions

**Smart Reordering:**
```prisma
model ReorderRule {
  id              String   @id @default(cuid())
  clothInventoryId String  @unique

  // Thresholds
  minimumStock    Float    // meters
  reorderPoint    Float    // When to trigger
  economicOrderQty Float   // Optimal order quantity

  // Automation Settings
  autoCreatePO    Boolean  @default(false)
  preferredSupplierId String?

  // Intelligence
  seasonalMultiplier Json?  // {"October": 1.5, "November": 1.8}
  leadTimeBuffer  Int     @default(7)

  lastTriggered   DateTime?
  lastOrderedQty  Float?

  clothInventory  ClothInventory @relation(...)
  supplier        Supplier? @relation(...)
}
```

**Fabric Matching Intelligence:**
```typescript
GET /api/fabrics/find-similar?fabricId={id}&tolerance=10

Response:
{
  "originalFabric": "Premium Cotton (Navy Blue)",
  "alternatives": [
    {
      "fabricId": "cloth_456",
      "name": "Cotton Blend (Navy)",
      "matchScore": 92,  // Based on GSM, composition, color
      "inStock": 45.5,
      "priceDiff": "+50/meter",
      "pros": ["Similar weight", "Better drape"],
      "cons": ["Slight color variation"]
    }
  ]
}
```

---

## 🔧 Barcode Scanner Improvements

### Current Issues Identified

1. **Detection Loop Not Triggering**
   - Issue: `isScanning` state checked inside async loop
   - Fix: Use ref-based cancellation instead of state

2. **Format Support Limited**
   - Issue: Not all barcode types detected
   - Fix: Expand supported formats list

3. **Mobile Camera Initialization**
   - Issue: Timeout might be too aggressive
   - Fix: Increase timeout, better error messages

### Enhanced Scanner Features

**1. Improved Detection Loop:**
```typescript
const detectBarcode = async () => {
  if (!videoRef.current || !isActiveRef.current) return

  try {
    const barcodes = await barcodeDetector.detect(videoRef.current)

    if (barcodes.length > 0) {
      const barcode = barcodes[0].rawValue

      // Validate barcode format
      if (isValidSKU(barcode)) {
        stopCamera()
        onScanSuccess(barcode)
        return
      } else {
        // Show invalid format warning
        setWarning(`Invalid SKU format: ${barcode}`)
      }
    }
  } catch (err) {
    console.error('Detection error:', err)
  }

  // Continue scanning with RAF
  animationFrameRef.current = requestAnimationFrame(detectBarcode)
}
```

**2. Expanded Format Support:**
```typescript
const barcodeDetector = new BarcodeDetector({
  formats: [
    'qr_code',        // QR codes
    'ean_13',         // European Article Number (13 digits)
    'ean_8',          // European Article Number (8 digits)
    'upc_a',          // Universal Product Code (12 digits)
    'upc_e',          // UPC-E (6 digits)
    'code_128',       // Code 128 (variable length)
    'code_39',        // Code 39 (variable length)
    'code_93',        // Code 93 (variable length)
    'codabar',        // Codabar (variable length)
    'itf',            // Interleaved 2 of 5
    'aztec',          // Aztec code
    'data_matrix',    // Data Matrix
    'pdf417'          // PDF417
  ]
})
```

**3. SKU Validation:**
```typescript
function isValidSKU(barcode: string): boolean {
  // Cloth: CLT-{TYPE}-{BRAND}-{TIMESTAMP}
  // Accessory: ACC-{TYPE}-{TIMESTAMP}
  const clothPattern = /^CLT-[A-Z]+-[A-Z0-9]+-\d+$/
  const accessoryPattern = /^ACC-[A-Z]+-\d+$/

  return clothPattern.test(barcode) || accessoryPattern.test(barcode)
}
```

**4. Test Mode:**
```typescript
// Enable test mode for development
const [testMode, setTestMode] = useState(false)

// Simulate successful scan without camera
const simulateScan = (testBarcode: string) => {
  if (testMode) {
    onScanSuccess(testBarcode)
  }
}
```

### Testing with Standard Barcodes

**Scanbot Test Barcodes:**
The test image includes:
- EAN-13: 4006381333931
- Code 128: 1234567890
- QR Code: "Hello World"
- PDF417: Multi-line data

**Test Workflow:**
1. Print test barcodes or display on second screen
2. Enable camera scanning mode
3. Position barcode in yellow frame
4. Verify detection and success callback
5. Check console logs for detected format
6. Validate SKU format checking

**Expected Behavior:**
- ✅ Standard barcodes detected (EAN, Code128, QR)
- ❌ Non-SKU barcodes show warning
- ✅ Valid SKU format triggers item lookup
- ✅ Manual entry always works as fallback

---

## 🛠️ Implementation Guide

### Step 1: Database Schema Update

```bash
# 1. Update Prisma schema
# Add new fields to ClothInventory and AccessoryInventory models

# 2. Create migration
pnpm db:migrate

# 3. Verify migration
pnpm db:studio
```

### Step 2: Update Seed Data

```typescript
// prisma/seed-complete.ts - Add new fields

// Cloth items with specifications
{
  fabricComposition: "100% Cotton",
  gsm: 180,
  threadCount: 100,
  weaveType: "Plain",
  fabricWidth: 58,
  shrinkagePercent: 3,
  colorFastness: "Excellent",
  seasonSuitability: ["Summer", "All-season"],
  occasionType: ["Casual", "Formal"],
  careInstructions: "Machine wash cold, tumble dry low",
  swatchImage: "/uploads/fabrics/premium-cotton-blue-swatch.jpg"
}

// Accessories with enhanced details
{
  colorCode: "PANTONE 19-4028",
  buttonSize: "18L",
  holePunchSize: 4,
  material: "Shell",
  finish: "Polished",
  recommendedFor: ["Suit", "Blazer"]
}
```

### Step 3: Update API Endpoints

**Cloth Inventory API:**
```typescript
// app/api/inventory/cloth/route.ts
// Add new fields to create/update operations

const clothItemSchema = z.object({
  // Existing fields...
  fabricComposition: z.string().optional(),
  gsm: z.number().optional(),
  threadCount: z.number().optional(),
  weaveType: z.string().optional(),
  fabricWidth: z.number().optional(),
  shrinkagePercent: z.number().optional(),
  colorFastness: z.string().optional(),
  seasonSuitability: z.array(z.string()).optional(),
  occasionType: z.array(z.string()).optional(),
  careInstructions: z.string().optional(),
  swatchImage: z.string().optional(),
  textureImage: z.string().optional()
})
```

### Step 4: Update UI Forms

**Enhanced Add/Edit Forms:**
```typescript
// New fields in inventory forms
<div className="space-y-2">
  <Label>Fabric Composition</Label>
  <Input placeholder="e.g., 70% Cotton, 30% Polyester" />
</div>

<div className="space-y-2">
  <Label>GSM (Grams per Square Meter)</Label>
  <Input type="number" placeholder="e.g., 180" />
</div>

<div className="space-y-2">
  <Label>Season Suitability</Label>
  <MultiSelect
    options={["Summer", "Winter", "Monsoon", "All-season"]}
  />
</div>
```

### Step 5: Update Excel Templates

```typescript
// scripts/export-to-excel.ts
// Add new columns to ClothInventory sheet

const clothColumns = [
  // Existing columns...
  'fabricComposition',
  'gsm',
  'threadCount',
  'weaveType',
  'fabricWidth',
  'shrinkagePercent',
  'colorFastness',
  'seasonSuitability',
  'occasionType',
  'careInstructions',
  'swatchImage',
  'textureImage'
]
```

### Step 6: Photo Upload System

**Upload Component:**
```typescript
// components/fabric-photo-upload.tsx
import { useState } from 'react'
import { Upload, X } from 'lucide-react'

export function FabricPhotoUpload({
  onUpload
}: {
  onUpload: (url: string) => void
}) {
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB')
      return
    }

    // Upload to server
    const formData = new FormData()
    formData.append('file', file)
    formData.append('category', 'fabric_swatch')

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    })

    const { url } = await response.json()
    onUpload(url)
  }

  return (
    <div className="border-2 border-dashed rounded-lg p-4">
      <input
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        id="fabric-photo"
      />
      <label htmlFor="fabric-photo" className="cursor-pointer">
        <div className="text-center">
          <Upload className="mx-auto h-8 w-8 text-slate-400" />
          <p className="text-sm text-slate-600 mt-2">
            Click to upload fabric photo
          </p>
        </div>
      </label>
    </div>
  )
}
```

---

## ✅ Testing Scenarios

### 1. Barcode Scanning Tests

**Scenario A: Camera Scanning**
```
1. Navigate to /inventory
2. Click "Scan Barcode"
3. Choose "Camera" mode
4. Allow camera permissions
5. Position test barcode (EAN-13) in frame
6. Verify: Detection occurs, barcode value shown
7. Expected: Warning about invalid SKU format
```

**Scenario B: Manual Entry**
```
1. Click "Scan Barcode"
2. Choose "Manual" mode
3. Enter valid SKU: CLT-COT-ABC-123456
4. Click "Look Up"
5. Expected: Item found or "not found" dialog
```

**Scenario C: Valid SKU Scan**
```
1. Print QR code with SKU: CLT-COT-PREMIUM-123456
2. Scan with camera
3. Expected: Item lookup successful
4. Expected: Edit dialog opens with item details
```

### 2. Fabric Specification Tests

**Scenario D: Add Cloth with Full Specs**
```
1. Navigate to /inventory
2. Click "Add Cloth Item"
3. Fill all fields including:
   - Fabric Composition: "100% Cotton"
   - GSM: 180
   - Weave Type: "Plain"
   - Season: ["Summer", "All-season"]
   - Upload swatch photo
4. Click "Create"
5. Verify: All fields saved correctly
6. Verify: Photo displays in list view
```

**Scenario E: Filter by Season**
```
1. View cloth inventory
2. Apply filter: Season = "Summer"
3. Expected: Only summer fabrics shown
4. Apply filter: Occasion = "Wedding"
5. Expected: Only wedding-suitable fabrics shown
```

### 3. Accessory Enhancement Tests

**Scenario F: Add Button with Specs**
```
1. Add accessory item
2. Type: "Button"
3. Fill enhanced fields:
   - Button Size: "18L"
   - Hole Punch: 4
   - Material: "Shell"
   - Color Code: "PANTONE 19-4028"
   - Recommended For: ["Suit", "Blazer"]
4. Create item
5. Verify: All fields saved
```

### 4. Excel Bulk Upload Tests

**Scenario G: Import with New Fields**
```
1. Export current data: pnpm tsx scripts/export-to-excel.ts
2. Verify: New columns present in ClothInventory sheet
3. Add test data with all new fields
4. Upload via /bulk-upload
5. Expected: Preview shows all fields
6. Confirm upload
7. Verify: Data imported correctly
```

### 5. Integration Tests

**Scenario H: Order Creation with Enhanced Fabric**
```
1. Create new order
2. Select fabric with full specifications
3. View order detail page
4. Expected: Fabric specs visible (GSM, composition)
5. Expected: Care instructions shown
6. Print invoice
7. Expected: Care instructions included
```

**Scenario I: Purchase Order with Roll Details**
```
1. Create PO for fabric
2. Receive PO
3. Expected: Option to add roll details
4. Add: Roll number, quality grade, bin location
5. View fabric inventory
6. Expected: Roll information displayed
```

### 6. Performance Tests

**Scenario J: Large Dataset**
```
1. Import 500+ fabric items with photos
2. Navigate inventory page
3. Measure: Page load time < 2 seconds
4. Apply filters
5. Measure: Filter response < 500ms
6. Scroll through list
7. Verify: Smooth scrolling, no lag
```

---

## 📝 Documentation Updates

Files to update:
1. ✅ `docs/INVENTORY_ENHANCEMENTS_2026.md` (This file)
2. ✅ `CLAUDE.md` - Add Phase 1 section
3. ✅ `README.md` - Update feature list
4. ✅ `prisma/schema.prisma` - Inline comments
5. ✅ `scripts/export-to-excel.ts` - Column descriptions
6. ✅ New: `docs/BARCODE_SCANNER_IMPROVEMENTS.md`
7. ✅ New: `docs/FABRIC_SPECIFICATIONS_GUIDE.md`

---

## 🚀 Deployment Checklist

**Pre-Deployment:**
- [ ] All tests pass (run test scenarios)
- [ ] Database migration script tested
- [ ] Seed data includes all new fields
- [ ] Excel templates updated and tested
- [ ] Photo upload directory created (`/uploads/fabrics/`)
- [ ] Photo upload size limits configured
- [ ] Documentation complete

**Deployment Steps:**
```bash
# 1. Backup database
pg_dump tailor_inventory > backup_pre_v0.23.0.sql

# 2. Run migration
pnpm db:migrate

# 3. Update seed data
pnpm tsx prisma/seed-complete.ts

# 4. Build production
pnpm build

# 5. Restart PM2
pm2 restart hamees-inventory

# 6. Verify deployment
curl https://hamees.gagneet.com/api/inventory/cloth
```

**Post-Deployment:**
- [ ] Verify all new fields visible in UI
- [ ] Test barcode scanner (camera + manual)
- [ ] Test photo upload
- [ ] Test Excel import/export
- [ ] Monitor error logs (pm2 logs)
- [ ] User acceptance testing

---

## 📞 Support & Troubleshooting

**Common Issues:**

**Issue 1: Camera not initializing**
```
Error: "Camera access denied"
Solution: Check browser permissions, use manual entry
```

**Issue 2: Barcode not detected**
```
Error: No detection after 10 seconds
Solution:
1. Ensure good lighting
2. Hold barcode steady
3. Try manual entry with barcode number
```

**Issue 3: Photo upload fails**
```
Error: "Upload failed"
Solution:
1. Check file size < 5MB
2. Ensure /uploads/fabrics/ directory exists
3. Check file permissions (755)
```

**Issue 4: Excel import fails with new fields**
```
Error: "Validation error on row X"
Solution:
1. Re-download latest template
2. Check data types (number for GSM, array for seasons)
3. Verify season names match: Summer/Winter/Monsoon/All-season
```

---

## 🎯 Success Metrics

**Phase 1 Success Criteria:**
- ✅ All fabric items have GSM and composition
- ✅ 80%+ fabrics have swatch photos
- ✅ Barcode scanner 95%+ success rate (manual + camera)
- ✅ Season/occasion filters functional
- ✅ Excel import/export works with all new fields
- ✅ Zero regression bugs in existing features

**Long-term KPIs:**
- Inventory valuation accuracy: 98%+
- Fabric wastage: < 10% (vs 12.5% industry avg)
- Stockout incidents: < 5 per month
- Reorder lead time: < 3 days
- Customer satisfaction with fabric selection: 4.5/5

---

## 📚 References

**Industry Standards:**
- GSM Chart: https://www.thetshirtco.com/fabric-gsm-guide/
- Thread Count: https://www.textileschool.com/thread-count/
- Button Sizing (Ligne): https://www.jaycotts.co.uk/button-size-guide
- Pantone Color Codes: https://www.pantone.com/color-finder
- Indian Textile Standards: BIS IS 1964:2017

**Commercial Systems:**
- Fabriplay: https://www.fabriplay.com/
- TailoBill: http://www.tailobill.com/
- Orderry: https://orderry.com/tailor-shop-software/
- Rapitek: https://rapitek.com/

**Technical Documentation:**
- Barcode Detection API: https://developer.mozilla.org/en-US/docs/Web/API/Barcode_Detection_API
- Prisma Arrays: https://www.prisma.io/docs/concepts/components/prisma-schema/data-model#scalar-list-arrays
- Image Upload Best Practices: https://web.dev/image-optimization/

---

**Document Version:** 1.0
**Last Updated:** January 23, 2026
**Next Review:** February 23, 2026
