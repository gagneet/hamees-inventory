# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Inventory and order management system for a bespoke tailor shop (Hamees Attire, Amritsar). Manages fabric inventory with stock reservation, customer orders, measurements, and purchase orders. Live at https://hamees.gagneet.com.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript 5 · Prisma 7 + PostgreSQL 16 · NextAuth.js v5 (JWT) · Tailwind CSS 4 · Radix UI · Recharts · Vitest

## Essential Commands

```bash
# Development
pnpm dev              # Dev server at http://localhost:3009
pnpm build            # Production build
pnpm start            # Start prod server (port 3009)
pnpm lint             # ESLint

# Database
pnpm db:push          # Push schema changes (dev only, no migration files)
pnpm db:migrate       # Create + run migration (production-ready)
pnpm db:seed          # Basic sample data (prisma/seed.ts)
pnpm db:reset         # Reset database and reseed
pnpm db:studio        # Prisma Studio at http://localhost:5555
pnpm tsx prisma/seed-complete.ts  # Full production seed (232 orders, 7-month history)

# Testing
pnpm test             # Run all tests
pnpm test:watch       # Watch mode
pnpm test:unit        # Unit tests only (tests/unit/)
pnpm test:integration # Integration tests only (tests/integration/)
pnpm test:coverage    # Coverage report (v8)

# Production (PM2)
pm2 start ecosystem.config.js
pm2 restart hamees-inventory
pm2 logs hamees-inventory
```

To run a single test file: `pnpm vitest run tests/unit/lib/permissions.test.ts`

## Architecture

### Route Structure

- `app/page.tsx` — Login page (public)
- `app/(dashboard)/` — All protected routes (middleware guards this path group)
  - `dashboard/`, `inventory/`, `orders/`, `customers/`, `garment-types/`, `purchase-orders/`, `expenses/`, `alerts/`, `reports/`, `bulk-upload/`, `admin/`
- `app/api/` — API routes (Next.js route handlers)

### Key Libraries

- **`lib/db.ts`** — Prisma singleton using `@prisma/adapter-pg` (required for Prisma 7). Always import from here: `import { prisma } from '@/lib/db'`
- **`lib/auth.ts`** — NextAuth v5 config; `auth()` is wrapped in `React.cache()` for request deduplication
- **`lib/permissions.ts`** — RBAC permission matrix. All 6 roles and 39+ permissions defined here. `hasPermission(role, permission)` is the main utility
- **`lib/api-permissions.ts`** — API route helpers: `requirePermission()`, `requireAnyPermission()`, `requireAuth()`
- **`lib/utils.ts`** — `formatCurrency()` (INR), `generateOrderNumber()`, `generateSKU()`, `calculateStockStatus()`

### Prisma 7 Configuration

Prisma 7 uses `prisma.config.ts` (not `prisma.schema`) for the datasource URL. The schema's datasource block has **no `url` field** — it reads from `prisma.config.ts`. Always use `@prisma/adapter-pg` adapter pattern:

```typescript
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
```

Enum values in WHERE clauses must use **string literals**, not enum references (e.g., `type: 'ORDER_RESERVED'` not `type: StockMovementType.ORDER_RESERVED`).

### Authentication

NextAuth v5 with JWT sessions. The user's `role` (UserRole enum) is stored in the JWT token and available as `session.user.role`. Session loading state matters: always check `status === 'loading'` before rendering permission-gated UI (race condition where `userRole` is `undefined` before session loads).

```typescript
const { data: session, status } = useSession()
if (status === 'loading') return <Loading />
```

### Role-Based Access Control

6 roles: `OWNER`, `ADMIN`, `INVENTORY_MANAGER`, `SALES_MANAGER`, `TAILOR`, `VIEWER`

Key constraints:
- **OWNER** has full CRUD but **cannot delete** any data and cannot manage users/settings
- **ADMIN** has all delete permissions and user management
- **TAILOR** can update order status and view most data, but not expenses
- Navigation items in `DashboardLayout.tsx` are filtered by `hasPermission(userRole, permission)`

### Stock Reservation Model

`ClothInventory` and `AccessoryInventory` both have a `reserved` field. **Available stock = `currentStock - reserved`**. Stock status thresholds: `available >= minimum` → healthy; `available >= minimum * 0.5` → low; below that → critical.

When orders are created: fabric is reserved (`StockMovement` type `ORDER_RESERVED`). On delivery: stock is consumed (`ORDER_USED`). On cancellation: reservation released (`ORDER_CANCELLED`). Always use `prisma.$transaction()` for atomic stock operations.

### Order Financial Structure

Orders are broken down into:
- **Item level**: fabric cost + accessories cost (`OrderItem.totalPrice`)
- **Order level**: stitching tier (BASIC/PREMIUM/LUXURY), workmanship premiums, designer fees, fabric wastage
- **GST**: 12% on subtotal (6% CGST + 6% SGST, stored separately; IGST = 0 for intra-state)
- **Balance**: `totalAmount - advancePaid - discount - paymentInstallments`

Advance payment is stored **only** in `Order.advancePaid`, NOT duplicated as a `PaymentInstallment`. Subsequent balance payments are stored as installments only.

### Multi-Item Invoice Cost Distribution

For multi-item orders, costs (stitching, premiums, etc.) are distributed **proportionally** by each item's fabric+accessories cost. This pattern is used in both the split-order and print-invoice features.

### Testing Setup

`vitest.setup.ts` globally mocks:
- `@/lib/db` — Prisma proxy (all model methods return `null` by default)
- `@/lib/auth` — Returns an OWNER session
- `next/server` — Stubs `after()`
- `@/lib/whatsapp/whatsapp-service` — No-op

Integration tests override the db mock with `vi.unmock()` and use a real test database. Unit tests should never hit the database.

### UI Component Patterns

- Shadcn UI components in `components/ui/` use explicit Tailwind classes (`bg-white text-slate-900`), not CSS variable-based colors (prevents dark mode inheritance issues in dialogs)
- Toast notifications: two systems in parallel — `@radix-ui/react-toast` (via `components/ui/toaster`) and `sonner` (for newer components)
- Recharts `<ResponsiveContainer>` must be wrapped in a fixed-height `div` to prevent SSR hydration warnings: `<div className="w-full h-[350px]"><ResponsiveContainer width="100%" height="100%">…`

### Bulk Upload

`lib/excel-processor.ts` handles Excel import with safe-fail (continues on invalid rows). `scripts/export-to-excel.ts` exports current DB data. Orders/Order Items/POs are export-only (no import) due to stock reservation complexity.

## Deployment Notes

- **Port**: 3009 (other apps on server: 3002, 3003, 8000, 8001 — no conflicts)
- **PM2**: Use `exec_mode: 'fork'` (not cluster) for Next.js 16 compatibility
- **Cloudflare Tunnel**: Config at `/etc/cloudflared/config.yml` (not `~/.cloudflared/config.yml`)
- **Database**: PostgreSQL 16 local, user `hamees_user`, database `tailor_inventory`

## Demo Credentials (password: `admin123`)

| Email | Role |
|-------|------|
| owner@hameesattire.com | OWNER |
| admin@hameesattire.com | ADMIN |
| inventory@hameesattire.com | INVENTORY_MANAGER |
| sales@hameesattire.com | SALES_MANAGER |
| tailor@hameesattire.com | TAILOR |
| viewer@hameesattire.com | VIEWER |
