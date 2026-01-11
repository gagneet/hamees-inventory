# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a comprehensive inventory and order management system built specifically for tailor shops. It manages fabric inventory, tracks orders with customer measurements, monitors stock levels with automatic reservation, and provides alerts for low stock and order delays.

**Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Prisma 7 (PostgreSQL 16), NextAuth.js v5, Tailwind CSS 4, Radix UI, Recharts

## 🎉 Recent Updates (January 2026)

### ✅ Dashboard Analytics & Charts (v0.3.0)

**What's New:**
- **Interactive Dashboard** with real-time analytics and charts
- **Revenue Trend Chart** showing 6-month revenue history
- **Order Status Distribution** pie chart
- **Top Fabrics Usage** bar chart
- **KPI Cards** with month-over-month growth indicators
- **Inventory Health Summary** with alerts

**New Files Added:**
- `app/api/dashboard/stats/route.ts` - Analytics API endpoint
- `components/dashboard/revenue-chart.tsx` - Revenue line chart
- `components/dashboard/orders-status-chart.tsx` - Order status pie chart
- `components/dashboard/top-fabrics-chart.tsx` - Fabric usage bar chart
- `components/dashboard/kpi-card.tsx` - Reusable KPI card component
- `prisma/seed-enhanced.ts` - Enhanced seed with 27 orders across 6 months

**Dependencies Added:**
```bash
pnpm add recharts date-fns
```

### ✅ Bug Fixes

**Inventory Form Validation (Fixed):**
- Issue: 400 Bad Request when adding cloth/accessory items
- Root Cause: Zod schema validation rejecting `null` values from forms
- Solution: Changed `.optional()` to `.nullish()` in validation schemas
- Files Fixed: `app/api/inventory/cloth/route.ts`, `app/api/inventory/accessories/route.ts`

### ✅ Enhanced Seed Data

Run enhanced seed for comprehensive testing:
```bash
pnpm tsx prisma/seed-enhanced.ts
```

**Seed Data Includes:**
- 2 Users (Owner, Inventory Manager)
- 2 Suppliers (ABC Fabrics, XYZ Textiles)
- 6 Cloth Items (Cotton, Silk, Linen, Wool varieties)
- 3 Accessories (Buttons, Thread, Zipper)
- 4 Garment Patterns (Shirt, Trouser, Suit, Sherwani)
- 5 Customers with complete measurements
- **27 Orders** spanning last 6 months with various statuses
- Stock movements tracking all inventory changes
- Auto-generated alerts for low/critical stock

**How to Use:**
1. Reset database: `pnpm db:reset` OR run enhanced seed: `pnpm tsx prisma/seed-enhanced.ts`
2. Login: `owner@tailorshop.com` / `admin123`
3. View dashboard at: https://hamees.gagneet.com/dashboard
4. Explore charts, KPIs, and order history

## Essential Commands

### Development
```bash
pnpm dev              # Start dev server at http://localhost:3009
pnpm build            # Build for production
pnpm start            # Start production server (port 3009)
pnpm lint             # Run ESLint
```

### Database Operations
```bash
pnpm db:push                      # Push schema changes (development only)
pnpm db:migrate                   # Create and run migrations (production-ready)
pnpm db:seed                      # Seed with basic sample data
pnpm tsx prisma/seed-enhanced.ts  # Seed with comprehensive test data (27 orders, 5 customers)
pnpm db:studio                    # Open Prisma Studio at http://localhost:5555
pnpm db:reset                     # Reset database and reseed
```

### Production Operations (PM2)
```bash
pm2 start ecosystem.config.js    # Start application with PM2
pm2 restart hamees-inventory     # Restart application
pm2 stop hamees-inventory        # Stop application
pm2 logs hamees-inventory        # View logs (real-time)
pm2 status                       # Check status
pm2 monit                        # Monitor CPU/Memory
pm2 save                         # Save process list
```

**Production URL:** https://hamees.gagneet.com (nginx reverse proxy to port 3009)

**Database Setup:** PostgreSQL must be configured first. See SETUP.md for detailed instructions.

**Production Database:**
- Database: `tailor_inventory`
- User: `hamees_user`
- Password: Set in `.env` as `DATABASE_URL`
- Connection: Direct PostgreSQL connection (not Docker)

**Default Credentials (after seeding):**
- Email: `owner@tailorshop.com` / Password: `admin123`
- Email: `inventory@tailorshop.com` / Password: `admin123`

## Architecture & Key Concepts

### Database Schema Architecture

The schema is built around a complete audit trail and stock reservation system:

1. **Inventory Management:**
   - `ClothInventory`: Tracks fabrics with `currentStock` (total meters) and `reserved` (meters reserved for orders)
   - **Available stock = currentStock - reserved**
   - When an order is created, fabric is auto-reserved via `StockMovement` records
   - `AccessoryInventory`: Manages buttons, threads, zippers with minimum stock thresholds

2. **Order Flow & Stock Reservation:**
   - Orders progress: NEW → MATERIAL_SELECTED → CUTTING → STITCHING → FINISHING → READY → DELIVERED
   - **Material Calculation:** `OrderItem.estimatedMeters` is calculated based on `GarmentPattern.baseMeters` + body type adjustment (SLIM/REGULAR/LARGE/XL)
   - When order is created with status NEW, fabric is reserved (creates `StockMovement` with type `ORDER_RESERVED`)
   - When cutting starts, `actualMetersUsed` is recorded and `wastage` is calculated
   - When order is cancelled, reservation is released (creates `StockMovement` with type `ORDER_CANCELLED`)

3. **Audit Trail:**
   - `StockMovement`: Complete history of all inventory changes with types: PURCHASE, ORDER_RESERVED, ORDER_USED, ORDER_CANCELLED, ADJUSTMENT, RETURN, WASTAGE
   - Each movement records `quantity` (positive/negative), `balanceAfter`, `userId`, and optional `orderId`

4. **Customer & Measurements:**
   - `Measurement`: Stores detailed measurements by garment type (Shirt, Trouser, Suit, Sherwani)
   - Supports history: multiple measurement records per customer for tracking changes
   - `additionalMeasurements` field (JSON) for flexible measurement storage

5. **Alerts System:**
   - Auto-generates alerts for low stock (when `currentStock - reserved < minimum`)
   - Alert types: LOW_STOCK, CRITICAL_STOCK, ORDER_DELAYED, REORDER_REMINDER
   - Severity levels: LOW, MEDIUM, HIGH, CRITICAL

6. **Supplier Management:**
   - `SupplierPrice`: Tracks price history with `effectiveFrom`/`effectiveTo` dates
   - `PurchaseOrder`: Manages restocking with status tracking (PENDING, RECEIVED, PARTIAL, CANCELLED)

### File Structure

```
app/
├── (dashboard)/              # Protected routes (route group)
│   ├── dashboard/           # Main dashboard page
│   ├── inventory/           # Inventory management (cloth + accessories)
│   ├── orders/              # Order creation, tracking, status updates
│   ├── customers/           # Customer profiles, measurements
│   ├── suppliers/           # Supplier management
│   ├── alerts/              # Alert notifications
│   └── settings/            # App configuration
├── api/                     # API routes (to be created)
│   ├── auth/[...nextauth]/ # NextAuth endpoints
│   ├── inventory/          # Inventory CRUD
│   ├── orders/             # Order management
│   └── alerts/             # Alert system
├── layout.tsx              # Root layout with fonts
├── globals.css             # Design system variables
└── page.tsx                # Landing/login page

lib/
├── db.ts                   # Prisma client singleton with PrismaPg adapter
└── utils.ts                # Utilities: formatCurrency, generateOrderNumber, calculateStockStatus

prisma/
├── schema.prisma           # Database schema (with engineType = "binary")
└── seed.ts                 # Sample data seeder (with adapter configuration)

components/                 # React components (to be organized by feature)

logs/                       # PM2 application logs
├── out.log                 # Standard output
└── err.log                 # Error output

ecosystem.config.js         # PM2 process configuration (production)
```

### Design System

Custom color scheme defined in `app/globals.css`:
- **Primary (Indigo):** `#1E3A8A` - Main brand color
- **Secondary (Burgundy):** `#991B1B` - Accent color
- **Accent (Gold):** `#F59E0B` - Highlights and warnings
- **Success (Green):** `#10B981` - Success states
- **Error (Red):** `#EF4444` - Errors
- **Info (Blue):** `#3B82F6` - Information

Currency formatting uses Indian Rupees (INR) via `formatCurrency()` in `lib/utils.ts`.

## Development Guidelines

### Working with Database

1. **Schema changes:**
   - Modify `prisma/schema.prisma`
   - Run `pnpm db:push` for development (quick iteration)
   - Run `pnpm db:migrate` for production (creates migration files)

2. **Accessing Prisma Client:**
   - Always import from `lib/db.ts`: `import { prisma } from '@/lib/db'`
   - Client is singleton to prevent connection exhaustion in development
   - **IMPORTANT:** Prisma 7 requires the PostgreSQL adapter (`@prisma/adapter-pg`)

3. **Prisma 7 Configuration:**
   - Schema uses `engineType = "binary"` in generator block
   - Client initialization requires `PrismaPg` adapter with connection pool
   - All database operations use the adapter pattern (see `lib/db.ts` and `prisma/seed.ts`)

   Example:
   ```typescript
   import { PrismaClient } from '@prisma/client'
   import { PrismaPg } from '@prisma/adapter-pg'
   import { Pool } from 'pg'

   const pool = new Pool({ connectionString: process.env.DATABASE_URL })
   const adapter = new PrismaPg(pool)
   const prisma = new PrismaClient({ adapter })
   ```

4. **Stock Reservation Pattern:**
   - When creating orders that reserve fabric, always create corresponding `StockMovement` records
   - Update `ClothInventory.reserved` field accordingly
   - Use transactions (`prisma.$transaction`) for atomic operations

### Authentication (Phase 2 - In Progress)

- NextAuth.js v5 (beta) configured for credentials provider
- User roles: OWNER, ADMIN, INVENTORY_MANAGER, SALES_MANAGER, TAILOR, VIEWER
- Passwords hashed with bcryptjs (10 salt rounds)
- Environment requires `NEXTAUTH_SECRET` and `NEXTAUTH_URL`

### Route Protection Pattern

Routes under `app/(dashboard)/` will be protected via NextAuth middleware (to be implemented).

## Important Notes

- **Body Type Calculations:** When calculating fabric requirements, use `GarmentPattern.baseMeters + GarmentPattern.[bodyType]Adjustment`
- **Stock Availability:** Always check `currentStock - reserved >= requiredAmount` before reserving fabric
- **Order Numbers:** Generate via `generateOrderNumber()` which uses timestamp + random suffix
- **SKU Generation:** Use `generateSKU(type, brand)` for new inventory items
- **Currency:** All monetary values are in INR (Indian Rupees)

## Current Development Status

- ✅ Phase 1 Complete: Database schema, seed data, project setup
- ✅ Phase 2 Complete: Authentication system (NextAuth.js v5, JWT sessions, route protection)
- ✅ Phase 3 Complete: API routes for inventory CRUD, barcode lookup, stock movements
- ✅ Phase 4 Complete: Dashboard with analytics, charts, and KPIs
- ✅ Phase 5 Complete: Landing page, inventory management page with barcode scanner
- ✅ Phase 6 Complete: Enhanced seed data with 6-month order history
- ✅ Production Deployment: PM2, nginx, database configured
- 🔄 Next: Order management pages, customer portal, measurements UI

## Production Environment

### Deployment Configuration

**Application:**
- URL: https://hamees.gagneet.com
- Port: 3009
- Process Manager: PM2 (hamees-inventory)
- Auto-restart: Enabled via PM2
- Environment: Production

**Database:**
- PostgreSQL 16 (local, not Docker)
- Database: `tailor_inventory`
- User: `hamees_user`
- Segregated from other applications on the server

**Web Server:**
- nginx reverse proxy
- Configuration: `/etc/nginx/sites-available/hamees`
- SSL: Let's Encrypt (certbot) - to be configured

**Environment Variables:**
```bash
DATABASE_URL="postgresql://hamees_user:password@localhost:5432/tailor_inventory?schema=public"
NEXTAUTH_URL="https://hamees.gagneet.com"
NEXTAUTH_SECRET="[generated with openssl rand -base64 32]"
NODE_ENV="production"
```

### Required Dependencies for Prisma 7

```json
{
  "@prisma/adapter-pg": "^7.2.0",
  "@prisma/client": "^7.2.0",
  "pg": "^8.16.3"
}
```

### Deployment Checklist

- [x] PostgreSQL database created (`tailor_inventory`)
- [x] Database user created and permissions granted (`hamees_user`)
- [x] Application configured for port 3009
- [x] Prisma 7 adapter installed and configured
- [x] Database schema pushed
- [x] Seed data loaded
- [x] Production build completed
- [x] PM2 installed globally
- [x] Application started with PM2
- [x] PM2 process list saved
- [x] nginx configuration created
- [x] nginx site enabled
- [ ] PM2 startup script configured (requires sudo)
- [ ] nginx configuration tested and reloaded (requires sudo)
- [ ] SSL certificate obtained via certbot (requires sudo)

## New Features (v0.2.0)

### Authentication System

**Location:** `lib/auth.ts`, `middleware.ts`, `app/api/auth/[...nextauth]/route.ts`

- **NextAuth.js v5** with credentials provider
- **JWT sessions** (not database sessions)
- **Password hashing** with bcryptjs (10 rounds)
- **Route protection** via middleware
- **Automatic redirects** for auth states

**Login Flow:**
1. User enters email/password on landing page (`app/page.tsx`)
2. Credentials validated against database (`lib/auth.ts`)
3. JWT token created with user ID and role
4. Session stored in cookie
5. Protected routes check session via middleware (`middleware.ts`)

**Demo Credentials:**
- `owner@tailorshop.com` / `admin123` (OWNER role)
- `inventory@tailorshop.com` / `admin123` (INVENTORY_MANAGER role)

### Barcode Scanning System

**Location:** `components/barcode-scanner.tsx`, `app/(dashboard)/inventory/page.tsx`

- **html5-qrcode library** for camera scanning
- **Dual mode:** Camera or Manual entry
- **Auto-SKU generation** for new items
- **Real-time lookup** via API

**Supported Formats:**
- QR codes
- UPC/EAN (product barcodes)
- Code128
- Any text-based SKU/barcode

**Workflow:**
1. User clicks "Scan Barcode" on inventory page
2. Choose Camera or Manual mode
3. Scanner reads barcode (or user types SKU)
4. System calls `/api/inventory/barcode?barcode={sku}`
5. If found: Display item details
6. If not found: Show form to create new item (SKU pre-filled)

**SKU Format:**
- Cloth: `CLT-{TYPE}-{BRAND}-{TIMESTAMP}`
- Accessories: `ACC-{TYPE}-{TIMESTAMP}` (schema pending update)

**Note:** Accessory barcode scanning disabled pending database schema update (requires table ownership permissions).

### API Endpoints

**Authentication:**
- `GET/POST /api/auth/[...nextauth]` - NextAuth handlers

**Dashboard:**
- `GET /api/dashboard/stats` - Comprehensive analytics data including:
  - Inventory stats (total value, low stock, critical stock)
  - Order stats (pending, delivered, monthly trends)
  - Revenue tracking (6-month trend with MoM growth)
  - Top 5 most-used fabrics
  - Recent unread alerts

**Inventory:**
- `GET /api/inventory/cloth` - List cloth inventory (supports `?lowStock=true`)
- `POST /api/inventory/cloth` - Create cloth item with auto SKU generation
- `GET /api/inventory/accessories` - List accessories (supports `?lowStock=true&type=Button`)
- `POST /api/inventory/accessories` - Create accessory item
- `GET /api/inventory/barcode?barcode={sku}` - Lookup item by barcode/SKU

**Response Format:**
```typescript
// Barcode lookup success
{
  found: true,
  type: 'cloth' | 'accessory',
  item: { /* full item object */ }
}

// Barcode lookup not found
{
  found: false,
  barcode: 'CLT-XXX-XXX-123456'
}

// Dashboard stats response
{
  inventory: {
    totalItems: number,
    lowStock: number,
    criticalStock: number,
    totalValue: number,
    totalMeters: number
  },
  orders: {
    total: number,
    pending: number,
    ready: number,
    delivered: number,
    thisMonth: number,
    lastMonth: number,
    growth: number  // percentage
  },
  revenue: {
    thisMonth: number,
    lastMonth: number,
    growth: number,  // percentage
    byMonth: Array<{ month: string, revenue: number }>
  },
  charts: {
    ordersByStatus: Array<{ status: string, count: number }>,
    topFabrics: Array<{ name: string, type: string, metersUsed: number }>,
    stockMovements: number
  },
  alerts: {
    unread: number,
    recent: Array<Alert>
  }
}
```

## Testing the Application

### Quick Walkthrough

1. **Login to Dashboard:**
   - URL: https://hamees.gagneet.com
   - Email: `owner@tailorshop.com`
   - Password: `admin123`

2. **Explore Dashboard:**
   - View KPI cards showing revenue, orders, and inventory health
   - Check revenue trend chart (last 6 months)
   - Review order status distribution
   - See top 5 most-used fabrics
   - Check low stock and critical stock alerts

3. **Inventory Management:**
   - Click "Manage Inventory" or navigate to `/inventory`
   - View all cloth items with stock levels
   - Add new items using the form (validation bug is fixed!)
   - Use barcode scanner for quick lookup
   - Check color-coded stock status indicators

4. **Test Data Available:**
   - 6 different fabric types with varied stock levels
   - 27 orders across different statuses (NEW to DELIVERED)
   - 5 customers with complete measurements
   - Historical data spanning 6 months for trend analysis

### Analytics Features to Test

- **Revenue Growth:** Compare this month vs last month
- **Order Trends:** See order volume changes over time
- **Fabric Usage:** Identify which fabrics are most popular
- **Stock Alerts:** Check which items need reordering
- **Inventory Value:** Total value of current stock

## References

- **docs/Claude-Implementation-Guide.md**: 18-step guide for building with Claude AI
- **docs/Complete-Interactive-Demo-With-Measurements.html**: Interactive demo showcasing full order workflow
- **docs/Complete-Project-Summary.md**: Complete project deliverables and business plan
- **docs/Extended-Features-Guide.md**: 28 additional features for future development
- **AUTHENTICATION_AND_BARCODE.md**: Complete guide for authentication system and barcode scanning functionality
- **SETUP.md**: Detailed PostgreSQL setup, troubleshooting, and installation steps
- **README.md**: Feature documentation, tech stack details, production deployment guide
- **prisma/schema.prisma**: Complete database schema with relationships and indexes
- **prisma/seed-enhanced.ts**: Enhanced seed script with comprehensive test data
- **ecosystem.config.js**: PM2 process configuration
