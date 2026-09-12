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
pnpm db:migrate       # Create + apply a migration in development (prisma migrate dev); commit the folder
pnpm db:push          # Quick dev-only schema sync — creates drift against prisma/migrations; prefer db:migrate
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

- `app/page.tsx` — Public marketing site (indexable, `force-static`, no database access). It renders `components/marketing/marketing-site.tsx`, a client component holding all four languages of copy in `components/marketing/strings.ts`; imagery lives in `public/marketing/`. Its canonical/OG origin comes from `NEXT_PUBLIC_SITE_URL`
- `app/login/page.tsx` — Staff login (public, `noindex`). `pages.signIn` in `lib/auth.ts` and every signed-out `redirect()` point here, **not** at `/`
- `app/order/page.tsx` — Public order-enquiry page (indexable, names only — no prices or stock). `POST /api/public/enquiries` takes both kinds of enquiry: `ORDER_ENQUIRY` and `FITTING` (`EnquiryKind` on `CustomerEnquiry`; a fitting shares the table and its abuse controls rather than duplicating them)
- `app/track/[token]/page.tsx` — One order's production stage, opened from the signed link `POST /api/public/track-request` sends over WhatsApp to the number on the customer's record. The token (`lib/order-tracking.ts`) is a stateless HMAC over `orderId.expiresAt`, valid 30 minutes, and is the only credential — so the page shows stages, dates and garment names and **never** money or measurements. The request endpoint answers every caller identically and does its lookup in `after()`, so neither body nor timing says whether an order exists
- `app/(dashboard)/` — All protected routes. `proxy.ts` redirects signed-out visitors to `/login`; `app/(dashboard)/layout.tsx` requires a session and mounts `SettingsProvider`; each section has a `layout.tsx` calling `requirePagePermission()` (`lib/page-guard.ts`)
  - `dashboard/`, `inventory/`, `orders/`, `customers/`, `garment-types/`, `purchase-orders/`, `expenses/`, `alerts/`, `reports/`, `bulk-upload/`, `admin/`
- `app/api/` — API routes (Next.js route handlers)

### Key Libraries

- **`lib/db.ts`** — the app's Prisma singleton. Always import from here: `import { prisma } from '@/lib/db'`. Scripts, seeds and integration tests create their own client with `createPrismaClient()` (`lib/prisma-client.ts`), never `new PrismaClient()`, so they get the adapter and the money extension
- **Money** (`lib/money.ts`, `lib/money-codec.ts`, `lib/prisma-client.ts`) — amounts are stored as whole minor units (`BigInt`, `MONEY_SCALE = 100`, i.e. paise/cents) while code works with decimal numbers: the Prisma extension converts every money field in results (nested includes too) and in `where` / `data` / nested writes / `having`. A `number` is always a decimal amount; a `bigint` is already minor units and passes through. **Not converted:** `aggregate`/`groupBy` results and raw SQL — wrap sums with `sumFromMinor()` / `fromMinor()` and compare raw SQL columns in minor units. Do arithmetic with `addMoney`, `subtractMoney`, `sumMoney`, `percentOf`, `multiplyMoney`, `roundMoney`, `moneyEquals`, `allocateMoney` (exact, in minor units). A new money column must be `BigInt` and added to `moneyResultFields` (a unit test compares it with the schema)
- **`lib/auth.ts`** — NextAuth v5 config; `auth()` is wrapped in `React.cache()` for request deduplication. Sessions re-check role, active flag and password fingerprint every 60 s; failed logins are rate-limited in memory (`lib/rate-limit.ts`)
- **`lib/password.ts`** — `hashPassword()` (bcrypt cost 12 everywhere), dummy hash for unknown emails, rehash-on-login, `passwordFingerprint()`
- **`lib/order-finance.ts`** — `computeOrderBalance()` (the one balance formula), `lockOrder()` / `lockPurchaseOrder()` (`SELECT … FOR UPDATE` before any balance check), legacy duplicate-advance handling (`isLegacyAdvanceInstallment`, `safeInstallmentNote`)
- **`lib/stock.ts`** — every stock write (reserve, release, consume, receive, set level): atomic SQL, rounded, never negative or below reserved
- **`lib/purchase-order-items.ts`** — PO lines linked to inventory: line names/units derived from the item on the server, `onOrderFor()`, `nextPoNumber()`, `OPEN_PO_STATUSES`
- **`lib/reorder.ts`** — reorder check: `computeReorderPositions()` (pure) and `runReorderCheck()` (advisory-locked; reorder alerts, auto-drafted POs when `autoReorderEnabled`). Background callers use `runReorderCheckQuietly()` in `after()`
- **`lib/permissions.ts`** — RBAC permission matrix. All 7 roles and their permissions defined here. `hasPermission(role, permission)` is the main utility
- **`lib/api-permissions.ts`** — API route helpers: `requirePermission()`, `requireAnyPermission()`, `requireAuth()`
- **`lib/authz.ts`** — object-level (ABAC) scopes: `orderScope`, `orderItemScope`, `customerScope`, `measurementScope`, `scopedWhere`, `requireOrderAccess`, `checkStatusTransition`, `isAssignableTailor`
- **`lib/item-status.ts`** — per-item production stages: `checkItemStatusTransition()`, `deriveOrderStatus()`, `syncOrderStatus()` (client-safe: imports only types from `lib/authz`)
- **`lib/field-acl.ts`** — financial field visibility per role; `filterObjectByRole` deep-strips financial keys for restricted roles
- **`lib/settings.ts`** (server) / **`lib/app-settings.ts`** (isomorphic) — the singleton `BusinessSettings` row: branding, currency, locale, time zone, tax, production limits. Client components use `useAppSettings()` from `components/providers/settings-provider.tsx`
- **`lib/locale.ts`** — `formatCurrency()`, `formatDate()`, `currencySymbol()`, `shopStartOfDay()` etc. using the shop's currency/locale/time zone (re-exported from `lib/utils.ts`). Never hard-code `₹`, `INR` or `en-IN`, and use `shopStartOfDay()` (not date-fns `startOfDay`) for "today" — the server runs in UTC. Amounts are stored without a currency and are **never converted**; the settings API refuses a currency change once amounts exist unless `acknowledgeNoConversion: true` is sent. An optional **secondary currency** (Admin Settings → Currency & Locale) is display-only: `<Money amount={…} />` (`components/ui/money.tsx`) shows the amount plus an indicative conversion at the shop-entered `exchangeRate` (main-currency units per 1 secondary unit). Use `<Money>` for totals and KPIs; plain `formatCurrency()` for chart axes, inputs, customer messages and exports
- **`lib/tax.ts`** — `computeTax(subTotal, taxConfigFrom(settings), { customerRegion })` for new orders in SPLIT (CGST+SGST / IGST), SINGLE (VAT-style) and NONE modes; `recomputeOrderTax()` when re-pricing an **existing** order (keeps its stored rate and structure); `taxLines()` for display
- **`lib/phone.ts`** (+ `lib/phone-schema.ts`, `lib/phone-lookup.ts`, `components/ui/phone-input.tsx`) — international phone numbers (libphonenumber-js, full metadata): `normalizePhone(input, region)` → E.164 for storage, `phoneSchema(region)` for zod, `formatPhone()` / `<PhoneText>` for display (national format for the shop's own calling code), `phoneHref()` / `whatsappDigits()`. Store phones only in E.164; numbers typed without a country code are read in the shop's `phoneRegion`. A duplicate customer phone returns 409 `DUPLICATE_PHONE` (the forms offer "Save anyway")
- **`instrumentation.ts`** — loads the shop settings at server start so formatting is correct from the first request
- **`lib/utils.ts`** — `generateOrderNumber()`, `generateSKU()`, `calculateStockStatus()` plus the locale formatters

### Prisma 7 Configuration

Prisma 7 uses `prisma.config.ts` (not `prisma.schema`) for the datasource URL. The schema's datasource block has **no `url` field** — it reads from `prisma.config.ts`. Clients use the `@prisma/adapter-pg` adapter plus the money extension; outside the app, create one with:

```typescript
import { createPrismaClient } from '../lib/prisma-client'
const prisma = createPrismaClient() // DATABASE_URL, or { connectionString } / { pool } / { log }
```

Money columns are `BigInt` minor units (see **Money** above); quantities, rates and percentages stay `Float`/`Int`.

Enum values in WHERE clauses must use **string literals**, not enum references (e.g., `type: 'ORDER_RESERVED'` not `type: StockMovementType.ORDER_RESERVED`).

### Authentication

NextAuth v5 with JWT sessions. The user's `role` (UserRole enum) is stored in the JWT token and available as `session.user.role`. Session loading state matters: always check `status === 'loading'` before rendering permission-gated UI (race condition where `userRole` is `undefined` before session loads).

```typescript
const { data: session, status } = useSession()
if (status === 'loading') return <Loading />
```

### Role-Based Access Control

7 roles: `OWNER`, `ADMIN`, `INVENTORY_MANAGER`, `SALES_MANAGER`, `MASTER_TAILOR`, `TAILOR`, `VIEWER`

Key constraints:
- **OWNER** has full CRUD but **cannot delete** any data and cannot manage users/settings
- **ADMIN** has all delete permissions, user management and settings
- **MASTER_TAILOR** sees all orders, assigns tailors (`assign_tailors`), sees production workload/reports; no pricing or payments
- **TAILOR** sees **only orders with an item assigned to them** (no `view_all_orders`) and moves only **their own items** through production (back at most one stage); cannot create orders, deliver/cancel, or see expenses
- Only OWNER/ADMIN have `record_payment` (advance, discount, installments)
- `DELIVERED`/`CANCELLED` are terminal and require `update_order` (`checkStatusTransition`)
- Every API route must check a permission **and** apply the `lib/authz` scope for order/customer data; out-of-scope records return 404. The only public route is `GET /api/health`
- Payment-reminder alerts (type `PAYMENT_REMINDER`; `REORDER_REMINDER` is a stock reorder) quote balances: apply `alertVisibilityScope(role)` (`lib/alert-scope.ts`) to every alert query or action
- Navigation items in `DashboardLayout.tsx` are filtered by permission (a single permission or an any-of list)
- One app instance (and database) per shop — there is no multi-tenant model

### Stock Reservation Model

`ClothInventory` and `AccessoryInventory` both have a `reserved` field. **Available stock = `currentStock - reserved`**. Stock status thresholds: `available >= minimum` → healthy; `available >= minimum * 0.5` → low; below that → critical.

When orders are created: fabric is reserved (`StockMovement` type `ORDER_RESERVED`). On delivery: stock is consumed (`ORDER_USED`). On cancellation: reservation released (`ORDER_CANCELLED`). Always use `prisma.$transaction()` for atomic stock operations.

Every purchase-order line links to one item (`POItem.clothInventoryId` for CLOTH lines, `accessoryInventoryId` for ACCESSORY lines); receiving credits that item. Only a legacy unlinked line may name the item at receipt, which links it permanently. **Reorder**: an item needs one when `available + quantity on approved POs ≤ minimum`. A PO awaiting approval (`PENDING_APPROVAL`/`PENDING`) keeps the alert open but is subtracted from the suggested quantity, so nothing is ordered twice; the quantity is `reorderQuantity`, else enough to reach 2 × minimum. The check runs after orders, stock and PO changes, from alert generation and from `POST /api/inventory/reorder/run`; it keeps one `REORDER_REMINDER` alert per item and, when Admin Settings → *Auto-reorder* is on, adds lines to one `PENDING_APPROVAL` draft PO per supplier (`autoGenerated`) — never approved automatically.

### Order Financial Structure

Orders are broken down into:
- **Item level**: fabric cost + accessories cost (`OrderItem.totalPrice`)
- **Order level**: stitching tier (BASIC/PREMIUM/LUXURY), workmanship premiums, designer fees, fabric wastage
- **Tax**: configured in Admin Settings (default India GST 12% split into CGST + SGST; IGST when the customer's region differs from the shop's). Always compute with `lib/tax.ts`; amounts are stored in the `cgst`/`sgst`/`igst`/`gstAmount` columns regardless of the tax name
- **Balance**: `totalAmount - advancePaid - discount - paymentInstallments`

Advance payment is stored **only** in `Order.advancePaid`, NOT duplicated as a `PaymentInstallment`. Subsequent balance payments are stored as installments only. Orders created before v0.28.4 may still have a duplicate installment #1 (note starting "Advance payment", amount = advance); `lib/order-finance.ts` excludes it — never detect it by amount alone. Any route that checks or changes a balance must call `lockOrder()` / `lockPurchaseOrder()` first inside its transaction.

### Production Status (per item)

Each `OrderItem` has its own `status` (NEW → MATERIAL_SELECTED → CUTTING → STITCHING → FINISHING → READY), moved with `PATCH /api/orders/[id]/items/[itemId]/status`; the kanban shows one card per garment. While in production the **order status is derived**: the least advanced item's stage (`syncOrderStatus()` inside the order lock), so an order is READY only when every garment is. DELIVERED/CANCELLED stay order-level (front office) and are copied onto every item. Item moves write `OrderHistory` rows with `orderItemId`. Count production work by item status, not order status.

### Multi-Item Invoice Cost Distribution

For multi-item orders, costs (stitching, premiums, etc.) are distributed **proportionally** by each item's fabric+accessories cost. This pattern is used in both the split-order and print-invoice features.

### Testing Setup

`vitest.setup.ts` globally mocks:
- `@/lib/db` — Prisma proxy (all model methods return `null` by default)
- `@/lib/auth` — Returns an OWNER session
- `next/server` — Stubs `after()`
- `@/lib/whatsapp/whatsapp-service` — No-op

Tests may override a model or `$transaction` by assignment or with `vi.mocked(...).mockResolvedValue()`; call history is cleared between tests (`clearMocks`). Integration tests that unmock `@/lib/db` or create a `PrismaClient` are detected by content and only run when `TEST_DATABASE_URL` points to a **disposable** database (never production). Unit tests should never hit the database.

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
- **Migrations**: tracked in `prisma/migrations` (`0_init` baseline). One-off data-fix SQL lives in `prisma/manual-sql/`, never in `prisma/migrations/`. Do not use `db push` on production. The schema engine needs the socket URL rewritten to `@localhost/` (the deploy script does this)
- **Deploy**: `./scripts/deploy.sh` — verification build in a temporary copy (nothing live changes if it fails) → read-only plan (pending migrations, dependency or Prisma client changes) → if any, `pm2 stop` → `pg_dump` backup → install / generate / baseline / `prisma migrate deploy` / drift check → build into `.next` (previous build kept in `.next-prev`) → PM2 restart → exits 1 unless `/api/health` returns 200. A failure before anything live changed starts the old app again
- **The live directory is the running app**: the server loads the generated Prisma client from `node_modules` at runtime, so never run `pnpm install`, `prisma generate`, a build or a branch checkout there by hand while it runs — develop in a separate clone or worktree. Rehearse a deploy on a copy with `DEPLOY_APP_NAME`, `DEPLOY_PORT` and `DEPLOY_PM2_SAVE=0`
- **Health check**: `GET /api/health` (public; checks the database)

## Demo Credentials (password: `admin123`)

Seed/demo accounts for local development only. The login hint is hidden in production; change these passwords on any real deployment. `master@hameesattire.com` is a placeholder Master Tailor — rename it to the real person in Admin Settings → Users. On a live shop, `pnpm tsx scripts/create-master-tailor.ts` creates one (only if none is active) with a random password printed once.

| Email | Role |
|-------|------|
| owner@hameesattire.com | OWNER |
| admin@hameesattire.com | ADMIN |
| inventory@hameesattire.com | INVENTORY_MANAGER |
| sales@hameesattire.com | SALES_MANAGER |
| master@hameesattire.com | MASTER_TAILOR |
| tailor@hameesattire.com | TAILOR |
| viewer@hameesattire.com | VIEWER |
