# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.15.4] - 2026-01-16

### Added - Quick Wins Implementation (Option A)

#### Clickable Expense Cards with Detailed Breakdowns
- **All 4 Summary Cards Now Clickable** (`app/(dashboard)/expenses/page.tsx`)
  - **Total Revenue Card** - Shows breakdown of all delivered orders with order numbers, customer names, amounts, and delivery dates
  - **Total Expenses Card** - Shows breakdown of operational expenses and purchase order payments with categories and amounts
  - **Net Profit Card** - Shows calculation formula (Revenue - Expenses) with component breakdown
  - **Net GST Card** - Shows CGST, SGST breakdown with total GST collected
- **Dialog Implementation**: Each card wrapped in Dialog component with detailed tables
- **User Experience**: Hover effects, click indicators, scroll support for large datasets
- **Mobile Optimized**: `max-h-[80vh] overflow-y-auto` for mobile and desktop

#### Split Order Functionality Restored
- **Fixed Type Mismatch** (`app/(dashboard)/orders/[id]/page.tsx`)
  - Explicit item mapping to match `SplitOrderDialog` interface
  - Split order button now appears for orders with 2+ items (not delivered/cancelled)
  ```typescript
  items={order.items.map(item => ({
    id: item.id,
    garmentPattern: { name: item.garmentPattern.name },
    clothInventory: { name: item.clothInventory.name, color: item.clothInventory.color },
    quantity: item.quantity,
    estimatedMeters: item.estimatedMeters,
    totalPrice: item.totalPrice
  }))}
  ```

#### Record Payment for Customer Orders
- **NEW Component:** `RecordPaymentDialog` (`components/orders/record-payment-dialog.tsx`)
  - **5 Payment Modes**: Cash, UPI, Card, Bank Transfer, Cheque
  - **Payment Amount Validation**: Cannot exceed balance due
  - **Transaction Reference**: Optional field for non-cash payments
  - **Payment Notes**: Optional notes field
  - **Real-time Balance Display**: Shows current balance in blue info box
  - **Auto-populated Amount**: Pre-filled with full balance amount
- **Integration**: Uses existing `/api/orders/[id]/installments` endpoint
  - Creates installment with `status: 'PAID'` immediately
  - Sets `paidAmount`, `paidDate` to current values
  - Appends notes with payment mode
- **Location**: Order detail page, shown when `balanceAmount > 0.01`
- **Permissions**: Requires `manage_orders` permission

#### Print Invoice Functionality
- **NEW Component:** `PrintInvoiceButton` (`components/orders/print-invoice-button.tsx`)
  - **Professional GST-Compliant Invoice Template**
  - **Company Branding**: HAMEES ATTIRE header with tagline
  - **Complete Invoice Details**:
    - Bill To: Customer name, phone, email, address, city
    - Invoice Number, Order Date, Delivery Date, Status
    - Itemized table: S.No, Description, Fabric Details, Qty, Meters, Rate, Amount
    - GST Breakdown: CGST (6%), SGST (6%), Total GST
    - Discount display (if applicable)
    - Advance Paid and Balance Due
  - **Print Optimization**:
    - A4 page size with proper margins
    - Print-friendly CSS (border removal, margin: 1cm)
    - Auto-close window after print
    - 250ms delay for content loading
  - **Implementation**: Uses `window.open()` + `window.print()` (no PDF library needed)
  - **Location**: Order detail page, available for all orders

### Fixed

#### Expense Cards Not Clickable
- **Issue**: User reported expense page cards were not clickable
- **Root Cause**: Cards were plain Card components without Dialog wrappers
- **Fix**: Wrapped each Card in Dialog with DialogTrigger and DialogContent
- **Impact**: All 4 cards now show detailed breakdowns on click

#### Split Order Button Missing
- **Issue**: Button not appearing on order with 2+ items
- **Root Cause**: TypeScript type mismatch between database query result and component interface
- **Fix**: Explicit mapping of order items to match expected interface
- **Impact**: Split order functionality fully restored

### Technical

#### Component Architecture
- **Reusable Payment Dialog**: Self-contained component with validation
- **Invoice Generation**: Client-side HTML template with inline CSS
- **Dialog Pattern**: Consistent use of shadcn/ui Dialog across all new features
- **Type Safety**: Explicit type mapping to prevent future regressions

#### No New Dependencies
- All features implemented using existing libraries
- No PDF library needed (browser print API)
- No payment gateway integration (placeholder for future)
- Uses existing shadcn/ui components

#### Performance
- Dialog lazy rendering (only when opened)
- Efficient data fetching (existing API endpoints)
- No additional database queries
- Client-side template generation

### Documentation
- **NEW:** `docs/QUICK_WINS_v0.15.4.md` - Complete technical documentation with implementation details, testing procedures, troubleshooting

---

## [0.14.0] - 2026-01-16

### Added - Purchase Order Payment System

#### Separate Payment Recording for Suppliers
- **NEW API Endpoint:** `POST /api/purchase-orders/[id]/payment` (`app/api/purchase-orders/[id]/payment/route.ts`)
  - Record supplier payments independent of item receipt
  - Supports 6 payment modes: CASH, UPI, CARD, BANK_TRANSFER, CHEQUE, NET_BANKING
  - Optional transaction reference and notes
  - Auto-updates PO status based on payment completion
  - Permission required: `manage_purchase_orders`
- **Payment Dialog UI** (`app/(dashboard)/purchase-orders/[id]/page.tsx`)
  - "Make Payment" button appears when balance > 0
  - Payment amount input (pre-filled with balance)
  - Payment mode dropdown with 6 options
  - Transaction reference field
  - Notes textarea
  - Balance summary card in blue
  - Real-time new balance calculation

#### Enhanced PO Status Logic
- **Status Now Considers BOTH Items AND Payment:**
  - `PENDING`: No items received AND no payment made
  - `PARTIAL`: Some items received OR partial payment made
  - `RECEIVED`: All items received AND full payment made
- **Applies to Both Endpoints:**
  - `POST /api/purchase-orders/[id]/receive` - Receive items + optional payment
  - `POST /api/purchase-orders/[id]/payment` - Payment only

### Fixed

#### Payment Addition Bug in Receive Endpoint
- **Issue**: Payment amount was being REPLACED instead of ADDED when receiving items
- **Root Cause**: Direct assignment `paidAmount = newPayment` instead of addition
- **Fix** (`app/api/purchase-orders/[id]/receive/route.ts`):
  ```typescript
  // OLD (Bug):
  paidAmount: paidAmount !== undefined ? paidAmount : purchaseOrder.paidAmount

  // NEW (Fixed):
  const additionalPayment = paidAmount !== undefined ? paidAmount : 0
  const newPaidAmount = purchaseOrder.paidAmount + additionalPayment
  const newBalanceAmount = purchaseOrder.totalAmount - newPaidAmount
  ```
- **Impact**: Payments now accumulate correctly across multiple transactions

#### PO Status Prematurely Closing
- **Issue**: PO marked as "RECEIVED" when all items received, even with outstanding payment
- **Root Cause**: Status logic only checked item receipt, ignored payment status
- **Fix**: Updated status determination to require BOTH conditions:
  ```typescript
  const allItemsReceived = items.every((item) => item.receivedQuantity >= item.quantity)
  const paymentComplete = balanceAmount <= 0.01

  if (allItemsReceived && paymentComplete) {
    newStatus = 'RECEIVED' // Both complete
  } else if (anyPartiallyReceived || paidAmount > 0) {
    newStatus = 'PARTIAL' // Partial progress
  }
  ```
- **Impact**: POs remain in PARTIAL status until both items received AND payment made

### Changed

#### PO Detail Page UI Enhancements
- Added "Make Payment" button next to "Receive Items"
- Payment dialog with 6 payment mode options
- Balance summary card for quick reference
- Payment history visible in notes (appended with timestamp)

### Technical

#### Validation Schemas
```typescript
const paymentSchema = z.object({
  amount: z.number().positive(),
  paymentMode: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'NET_BANKING']).optional(),
  transactionRef: z.string().nullish(),
  notes: z.string().nullish(),
})
```

#### Audit Trail
- All payment transactions append to PO notes with timestamp
- Format: "Payment of ₹X made via [MODE] on [DATE]"
- Transaction references preserved in notes

#### Permission Guards
- Both endpoints require `manage_purchase_orders` permission
- Status returned in API response for UI updates
- Validation prevents negative payments or overpayment

### Documentation
- **NEW:** `docs/PURCHASE_ORDER_PAYMENT_SYSTEM.md` - Complete documentation with API reference, workflows, testing scenarios

---

## [0.8.2] - 2026-01-16

### Added - GST Integration & Interactive Dashboard

#### GST Calculation & Display (Order Workflow)
- **Frontend GST Display** (`app/(dashboard)/orders/new/page.tsx:244-287`)
  - Order Summary now shows complete GST breakdown
  - Displays:
    - Subtotal (before GST)
    - CGST (6.00%) - Central Goods and Services Tax
    - SGST (6.00%) - State Goods and Services Tax
    - Total GST (12.00%)
    - Total Amount (inclusive of GST)
    - Balance calculation based on total with GST
  - Real-time calculation as order items are added
- **Backend GST Calculation** (`app/api/orders/route.ts:159-238`)
  - Calculates 12% GST on all order components:
    - Fabric cost (meters × price per meter)
    - Accessories cost (quantity × price per unit)
    - Stitching charges (₹1500 per garment)
  - Stores complete GST breakdown in database:
    - `subTotal`: Amount before GST
    - `gstRate`: 12% (standard rate for garments)
    - `gstAmount`: Total GST charged
    - `cgst`: 6% (for intra-state transactions)
    - `sgst`: 6% (for intra-state transactions)
    - `igst`: 0% (reserved for inter-state)
    - `taxableAmount`: Base for GST calculation
    - `totalAmount`: subTotal + gstAmount
  - All values stored with 2 decimal precision
- **Compliance**: Follows Indian GST regulations for garment industry

### Added - Interactive Dashboard & Production Data

#### Interactive Financial Cards
- **Revenue Card** (`components/dashboard/owner-dashboard.tsx:248-284`)
  - Clickable with Dialog showing all delivered orders
  - Breakdown by order number, customer, amount
  - Direct link to filtered orders page
- **Expenses Card** (lines 286-334)
  - Shows breakdown of operational expenses + Purchase Order payments
  - Includes links to Expenses page and Purchase Orders page
  - Accurate total including inventory purchases
- **Profit Card** (lines 336-374)
  - Displays calculation formula (Revenue - Expenses)
  - Shows component breakdown
  - Visual representation of profit margin
- **Outstanding Payments Card** (lines 376-439)
  - Lists all customers with pending balances
  - Shows total balance due per customer
  - Direct links to customer profiles

#### Customer Retention Analysis
- **Clickable Chart** (`components/dashboard/customer-retention-chart.tsx`)
  - "View returning customers" button added
  - Shows customers with 3+ orders across different months (not same month)
  - Dialog displays:
    - Total orders count
    - Months active (e.g., "Jul 2025, Oct 2025, Dec 2025")
    - First and last order dates
    - Direct link to customer profile
- **API Endpoint** (`app/api/customers/returning/route.ts`)
  - `GET /api/customers/returning`
  - Filters customers with 3+ orders spanning at least 2 different months
  - Sorted by total orders descending

#### Production Seed Data
- **Comprehensive Script** (`prisma/seed-production.ts`)
  - 192 orders from July-December 2025
  - Seasonal patterns:
    - July: 40 orders (high season)
    - August: 12 orders (slow)
    - September: 10 orders (slow)
    - October: 50 orders (huge spurt)
    - November: 35 orders (80% delivered)
    - December: 45 orders (80% delivered)
  - 20 customers with realistic repeat patterns (60% repeat customer rate)
  - 20 purchase orders with varied payment statuses
  - 10 cloth items (Linen, Cotton, Silk, Wool, Synthetic)
  - 10 accessory items (Zippers, Buttons, Threads, etc.)
  - Average fulfillment time: 7.5 days (all under 14 days)
  - Usage: `pnpm tsx prisma/seed-production.ts`

### Changed - Enhanced Charts & Precision

#### Orders by Status Chart
- **Increased Size** (`components/dashboard/orders-status-chart.tsx:70`)
  - outerRadius increased from 80 to 100 pixels
- **White Background** (line 59)
  - Added `bg-white rounded-lg` for consistency with other charts
- **Simplified Labels** (lines 67-68)
  - Changed from "New (15%)" to just "15%"
  - Full names remain in Legend for reference

#### Decimal Precision Standardization
- **All Currency Values**: Exactly 2 decimal places (₹1,234.56)
  - Applied `.toFixed(2)` across all components
- **All Meter Values**: Exactly 2 decimal places (3.53m)
  - Fixed in inventory pages, dashboard, alerts, expenses
- **All Percentages**: Changed from 1 to 2 decimal places (15.52%)
  - Updated KPI cards, charts, growth indicators

Files modified for precision:
- `components/InventoryPageClient.tsx` - Inventory listing meters
- `components/dashboard/inventory-summary.tsx` - Dashboard popup meters
- `app/(dashboard)/inventory/cloth/[id]/page.tsx` - Detail page meters
- `app/(dashboard)/alerts/[id]/page.tsx` - Alert details
- `app/(dashboard)/expenses/page.tsx` - Expense items
- `app/(dashboard)/orders/page.tsx` - Order amounts
- `app/(dashboard)/orders/new/page.tsx` - Price displays
- `components/dashboard/kpi-card.tsx` - Growth percentages
- `components/dashboard/sales-manager-dashboard.tsx` - Stats percentages

#### Expense Tracking Enhancement
- **Purchase Order Payments** (`app/api/dashboard/enhanced-stats/route.ts:100-159`)
  - Added parallel queries for PO payments
  - Monthly expenses now include: Operational + PO payments
  - 6-month financial trend includes PO payments
  - Accurate expense totals for profit calculation

### Fixed

#### GST Not Displaying on New Orders
- **Issue**: GST breakdown was not shown on order creation form
- **Root Cause**: Frontend `calculateEstimate()` returned single total, backend didn't populate GST fields
- **Fix** (`app/(dashboard)/orders/new/page.tsx`):
  - Changed `calculateEstimate()` to return object with GST breakdown
  - Updated Order Summary to display all GST components
  - Modified balance calculation to use total amount with GST
- **Fix** (`app/api/orders/route.ts`):
  - Added GST calculation logic (12% rate)
  - Split GST into CGST/SGST (6% each) for intra-state
  - Store all GST fields in Order model during creation
- **Impact**: New orders now show complete GST breakdown and store accurate tax information
- **User Report**: https://hamees.gagneet.com/orders/new

#### Expenses Filter Error
- **Issue**: Radix UI SelectItem error with empty string values
- **Fix** (`components/expenses-filter.tsx:127, 150`)
  - Removed `<SelectItem value="">` entries
  - Category and Payment Mode filters now work correctly
- **Error**: "A <Select.Item /> must have a value prop that is not an empty string"

#### Expenses Card Not Populating
- **Issue**: Only showed operational expenses, missing PO payments
- **Root Cause**: Dashboard API only queried Expense table
- **Fix**: Added Purchase Order payment aggregation
- **Impact**: Expenses card now shows accurate totals

#### TypeScript Strict Type Checking
- Fixed implicit `any` type errors in 10+ files:
  - `app/api/customers/returning/route.ts` - Added explicit types for array callbacks
  - `app/api/dashboard/enhanced-stats/route.ts` - 8+ type annotations added
  - `app/api/orders/[id]/installments/route.ts` - Installment calculations typed
- Added type aliases using `typeof` for better type inference
- Fixed nullable email field in returning customers interface

### Technical

#### Type Safety Improvements
- Added explicit TypeScript type annotations for all:
  - `.map()` callbacks
  - `.filter()` callbacks
  - `.reduce()` callbacks
  - `.sort()` callbacks
- Pattern used: `typeof array[number]` for type inference
- Improved compilation speed and IDE auto complete

#### Build Process
- Clean build from scratch (removed node_modules)
- Fresh `pnpm install` of all dependencies
- Regenerated Prisma Client
- All TypeScript errors resolved
- Production bundle built successfully

### Performance
- Parallel query execution in enhanced-stats API
- Efficient type inference without manual type definitions
- Optimized Dashboard rendering with memoized calculations

---

## [0.5.2] - 2026-01-15

### Enhanced - Measurement Edit UX Improvements

#### Changed

**Measurement Edit Dialog Behavior** (`components/measurement-edit-dialog.tsx`)
- **Auto-population:** Previous measurement values now auto-populate when editing
- **All Fields Visible:** All measurement fields are now visible in edit mode (reverted from field hiding)
- **Garment Type Locked:** Garment type dropdown is disabled in edit mode to prevent accidental changes
- **Helper Text:** Added clarification that garment type cannot be changed during edit
- **Improved Description:** Updated dialog description to clarify auto-population behavior

#### Rationale

Users need the ability to add measurements that may have been missed in previous sessions. By showing all fields (even if previously empty), users can:
- Add missed measurements during edit operations
- Update incomplete records without creating new measurements
- See the full measurement template for reference

Previous values are automatically populated from the last active measurement, providing:
- Quick reference to existing data
- Easy identification of what needs updating
- Reduced data entry errors

Garment type remains locked to maintain data integrity:
- Prevents accidental conversion of SHIRT measurements to TROUSER
- Ensures measurement fields remain appropriate for garment type
- Users must use "Add Measurements" for new garment types

#### Developer Notes

The auto-population works through the existing state initialization:
```typescript
const [formData, setFormData] = useState<MeasurementData>({
  garmentType: measurement?.garmentType || 'SHIRT',
  bodyType: measurement?.bodyType || 'REGULAR',
  neck: measurement?.neck || null,
  // ... all other fields populated from measurement prop
})
```

When `mode === 'edit'`, the `measurement` prop contains the current active measurement, and all fields are initialized with those values. Empty fields show as blank (null) and can be filled during edit.

---

## [0.5.1] - 2026-01-15

### Added - Customer Details Edit Functionality

#### Features
- Enable editing of customer basic information (name, email, phone, address)
- Edit button added to customer detail page header
- Inline editing with save/cancel actions
- Real-time validation and error handling

#### UI/UX
- Seamless transition between view and edit modes
- Form validation with error messages
- Loading states during save operations
- Success feedback on completion

---

## [0.5.0] - 2026-01-15

### Added - Measurement Edit/Update with History & Audit Trail

#### Database Schema
- **NEW Field:** `bodyType` enum field to `Measurement` model (SLIM/REGULAR/LARGE/XL)
- **NEW Field:** `replacesId` for version linking (self-referencing foreign key)
- **NEW Field:** `isActive` boolean for tracking active/inactive versions
- **NEW Relation:** Self-referencing `MeasurementHistory` relation for version chain
- **NEW Index:** `replacesId` index for efficient history traversal
- **NEW Index:** `isActive` index for filtering active measurements

#### API Endpoints
- **NEW Route:** `GET /api/customers/[id]/measurements/[measurementId]` - Retrieve single measurement
- **NEW Route:** `PATCH /api/customers/[id]/measurements/[measurementId]` - Update measurement (creates new version)
- **NEW Route:** `DELETE /api/customers/[id]/measurements/[measurementId]` - Soft delete measurement
- **NEW Route:** `GET /api/customers/[id]/measurements/[measurementId]/history` - Retrieve version history
- **ENHANCED:** `GET /api/customers/[id]/measurements` now supports `?includeInactive=true` parameter
- **ENHANCED:** `GET /api/customers/[id]/measurements` now includes `createdBy` user details
- **ENHANCED:** `POST /api/customers/[id]/measurements` now includes `bodyType` field

#### UI Components
- **NEW Component:** `MeasurementEditDialog` - Unified create/edit dialog with full form
- **NEW Component:** `MeasurementHistoryDialog` - Timeline view with visual diff
- **NEW Component:** `CustomerMeasurementsSection` - Refactored measurements section with CRUD operations
- **NEW Component:** `ui/AlertDialog` - Radix UI alert dialog for confirmations

#### Features
- ✅ **Version Control:** Each edit creates new version, preserving old data
- ✅ **Audit Trail:** Tracks who created/modified each measurement with timestamps
- ✅ **History Timeline:** Visual comparison of changes across versions with diff highlighting
- ✅ **Soft Delete:** Prevents deletion of measurements used in orders
- ✅ **Active/Inactive Status:** Only active measurements shown by default
- ✅ **Permission-Based Access:** Respects `manage_customers` permission
- ✅ **Mobile Responsive:** All components optimized for mobile devices
- ✅ **Visual Diff:** Changed values highlighted with strikethrough of old values

#### Developer Experience
- **NEW Documentation:** Complete technical documentation in `docs/MEASUREMENT_HISTORY_FEATURE.md`
- **Type Safety:** Full TypeScript support with Zod validation
- **Transaction Safety:** Atomic updates using Prisma transactions
- **Error Handling:** Comprehensive error messages for all edge cases

### Changed

#### Customer Detail Page (`app/(dashboard)/customers/[id]/page.tsx`)
- Refactored inline measurements JSX to use `CustomerMeasurementsSection` component
- Added filter to fetch only active measurements by default: `where: { isActive: true }`
- Added permission check: `hasPermission(session.user.role, 'manage_customers')`
- Removed `Ruler` icon import (moved to child component)
- Removed `garmentTypeLabels` constant (moved to child component)

### Fixed

#### Type Safety Issues
- Fixed TypeScript error with `session.user.role` type casting
- Fixed Prisma JSON field type errors with null handling
- Fixed circular reference prevention in history chain (100 iteration limit)

### Dependencies

#### Added
- `@radix-ui/react-alert-dialog@^1.1.15` - Alert dialog component for confirmations

### Database Migration

```bash
# Development
pnpm db:push

# Production
pnpm db:migrate
pnpm prisma generate
```

### Breaking Changes

⚠️ **Behavior Change:** `GET /api/customers/[id]/measurements` now returns only active measurements by default. To get all measurements (including inactive), add `?includeInactive=true` parameter.

**Migration Path:**
```typescript
// Old behavior (returns all measurements)
const measurements = await fetch('/api/customers/123/measurements')

// New behavior (returns only active measurements)
const measurements = await fetch('/api/customers/123/measurements')

// Get old behavior
const allMeasurements = await fetch('/api/customers/123/measurements?includeInactive=true')
```

### Security

- All new endpoints protected with `requireAnyPermission()` middleware
- View operations require `view_customers` permission
- Modify operations require `manage_customers` permission
- Input validation with Zod schemas
- Delete protection for measurements in use

### Performance

- Added database indexes on `isActive` and `replacesId`
- Optimized queries to fetch only active measurements by default
- Lazy loading of dialogs (render only when open)
- Selective field fetching for `createdBy` relation

---

## [0.4.0] - 2026-01-14

### Added - Role-Based Access Control & Order Management
- Complete RBAC system with 6 roles (OWNER, ADMIN, INVENTORY_MANAGER, SALES_MANAGER, TAILOR, VIEWER)
- Customer management module with full CRUD operations
- Order management with complete workflow and stock reservation
- Mobile-first design across all pages
- Permission guards for UI and API endpoints
- Automatic stock management (fabric reservation and release)

---

## [0.3.0] - 2026-01-13

### Added - Dashboard Analytics & Charts
- Interactive dashboard with real-time analytics
- Revenue trend chart (6-month history)
- Order status distribution pie chart
- Top fabrics usage bar chart
- KPI cards with month-over-month growth indicators
- Inventory health summary with alerts
- Enhanced seed data with 27 orders across 6 months

### Dependencies Added
- `recharts` - Charting library
- `date-fns` - Date manipulation

---

## [0.2.0] - 2026-01-12

### Added - Authentication System
- NextAuth.js v5 with credentials provider
- JWT sessions (not database sessions)
- Password hashing with bcryptjs (10 rounds)
- Route protection via middleware
- Automatic redirects for auth states

### Added - Barcode Scanning System
- html5-qrcode library for camera scanning
- Dual mode: Camera or Manual entry
- Auto-SKU generation for new items
- Real-time lookup via API
- Support for QR codes, UPC/EAN, Code128

### API Endpoints Added
- `GET/POST /api/auth/[...nextauth]` - NextAuth handlers
- `GET /api/dashboard/stats` - Dashboard analytics
- `GET/POST /api/inventory/cloth` - Cloth inventory CRUD
- `GET/POST /api/inventory/accessories` - Accessories CRUD
- `GET /api/inventory/barcode?barcode={sku}` - Barcode lookup

---

## [0.1.0] - 2026-01-10

### Added - Initial Project Setup
- Next.js 16 (App Router) with React 19
- TypeScript 5 configuration
- Prisma 7 with PostgreSQL 16
- Tailwind CSS 4
- Complete database schema with 15+ models
- Seed data for testing
- PM2 production configuration
- nginx reverse proxy setup

### Database Models
- User, Customer, Measurement
- ClothInventory, AccessoryInventory
- GarmentPattern, GarmentAccessory
- Order, OrderItem, OrderHistory
- StockMovement, Alert
- Supplier, SupplierPrice, PurchaseOrder, POItem
- Settings

---

[0.15.4]: https://github.com/gagneet/hamees-inventory/compare/v0.14.0...v0.15.4
[0.14.0]: https://github.com/gagneet/hamees-inventory/compare/v0.8.2...v0.14.0
[0.8.2]: https://github.com/gagneet/hamees-inventory/compare/v0.5.2...v0.8.2
[0.5.2]: https://github.com/gagneet/hamees-inventory/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/gagneet/hamees-inventory/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/gagneet/hamees-inventory/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/gagneet/hamees-inventory/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/gagneet/hamees-inventory/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/gagneet/hamees-inventory/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/gagneet/hamees-inventory/releases/tag/v0.1.0
