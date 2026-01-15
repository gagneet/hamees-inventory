# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.5.2]: https://github.com/gagneet/hamees-inventory/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/gagneet/hamees-inventory/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/gagneet/hamees-inventory/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/gagneet/hamees-inventory/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/gagneet/hamees-inventory/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/gagneet/hamees-inventory/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/gagneet/hamees-inventory/releases/tag/v0.1.0
