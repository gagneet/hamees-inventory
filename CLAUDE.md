# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a comprehensive inventory and order management system built specifically for tailor shops. It manages fabric inventory, tracks orders with customer measurements, monitors stock levels with automatic reservation, and provides alerts for low stock and order delays.

**Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Prisma 7 (PostgreSQL 16), NextAuth.js v5, Tailwind CSS 4, Radix UI

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
pnpm db:push          # Push schema changes (development only)
pnpm db:migrate       # Create and run migrations (production-ready)
pnpm db:seed          # Seed with sample data (2 users, suppliers, inventory, etc.)
pnpm db:studio        # Open Prisma Studio at http://localhost:5555
pnpm db:reset         # Reset database and reseed
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
- ✅ Production Deployment: PM2, nginx, database configured
- ⏳ Phase 2 In Progress: Authentication system (NextAuth.js)
- 📋 Phase 3: API routes for CRUD operations
- 📋 Phase 4: UI components (shadcn/ui integration)
- 📋 Phase 5: Dashboard and feature pages

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

## References

- **SETUP.md**: Detailed PostgreSQL setup, troubleshooting, and installation steps
- **README.md**: Feature documentation, tech stack details, production deployment guide
- **prisma/schema.prisma**: Complete database schema with relationships and indexes
- **ecosystem.config.js**: PM2 process configuration
