# Hamees Attire — Tailor Shop Inventory Management System

**Version 0.51.0** | Production: [hamees.gagneet.com](https://hamees.gagneet.com)

A full-featured inventory and order management system purpose-built for bespoke tailoring. Manages fabric and accessory stock with automatic reservation, tracks orders through the complete production workflow, handles GST-compliant invoicing, and supports multiple staff roles from owner to tailor.

The deployment serves two audiences from one application: **`/` is the shop's public website** (four languages, indexable, no database access) and everything else is the staff system behind a login at **`/login`**.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16.3 (App Router, React Server Components) |
| Language | TypeScript 5 (strict mode) |
| UI | React 19, Tailwind CSS 4, Radix UI, Recharts |
| Auth | NextAuth.js v5 (JWT sessions, Credentials provider) |
| ORM | Prisma 7.10 + @prisma/adapter-pg (PostgreSQL adapter) |
| Database | PostgreSQL 16 |
| Process Manager | PM2 (fork mode) |
| Package Manager | pnpm 10 |
| Reverse Proxy | nginx + Cloudflare Tunnel |

---

## Features

### Inventory Management
- Cloth and accessory inventory with automatic stock reservation
- Low stock and critical stock alerts with configurable thresholds
- Phase 1 fabric specifications: GSM, composition, weave type, thread count, shrinkage, color fastness, season and occasion tags, care instructions
- Accessory specs: Pantone color codes, button sizes (Ligne), thread weights, material, finish
- Barcode/QR code generation and scanning (native Barcode Detection API + manual entry fallback)
- Bulk import/export via Excel (ExcelJS)
- Stock movement audit trail for every inventory change

### Order Management
- Multi-step order creation with customer selection, garment specification, and pricing
- Premium pricing tiers: BASIC / PREMIUM / LUXURY stitching charges per garment type
- Workmanship add-ons: hand stitching, full canvas, rush order, complex design, additional fittings, premium lining
- Designer consultation fee and fabric wastage factor
- Order status workflow: NEW → MATERIAL_SELECTED → CUTTING → STITCHING → FINISHING → READY → DELIVERED
- Automatic fabric reservation on order creation; release on cancellation
- Order splitting for independent management of individual garments
- Tailor assignment per order item

### Financial & Payments
- GST-compliant: 12% (6% CGST + 6% SGST) on all orders
- Advance payment tracking separate from balance installments
- Payment recording: Cash, UPI, Card, Bank Transfer, Cheque
- Proportional cost distribution for multi-item invoices
- Discount system (amount or percentage) with mandatory reason
- Arrears detection and management for delivered orders with outstanding balance
- Print professional A4 invoices (one page per garment item)

### Customer Management
- Complete customer profiles with contact information
- Measurement history by garment type (Shirt, Trouser, Suit, Sherwani)
- Visual measurement tool with bilingual English/Punjabi labels
- Customer retention and order history analytics

### Reports & Analytics
- Role-specific dashboards: Owner, Sales Manager, Inventory Manager, Tailor, Viewer
- Revenue trend charts, order status distribution, fabric usage analysis
- Fabric efficiency and wastage tracking with financial impact
- Customer retention analysis (returning customers metric)
- Revenue forecasting based on delivered + pending orders
- Expense reports with category breakdown and GST tracking
- Financial P&L reports

### WhatsApp Notifications
- Automated order confirmation sent on order creation
- Pickup notification sent when order status moves to READY
- Template-based messaging via Meta WhatsApp Business API
- Development mode: logs messages to console when API credentials are not set

### Public Website
- Marketing site at `/` — static, indexable and with no database access, so it renders from the build and cannot expose business data
- Four languages (English, Hindi, Punjabi, Japanese), switched client-side on a single URL; all copy lives in `components/marketing/strings.ts`
- `ClothingStore` JSON-LD (address, opening hours, phone, Instagram) plus OpenGraph and Twitter cards, overriding the app-wide `noindex` that keeps the dashboard out of search
- Public order enquiry at `/order` — garment type *names* only, no prices or stock; rate limited, honeypot-protected, and it never creates an order or reserves stock
- Staff sign-in at `/login`, linked from the site header and footer

### Other
- Barcode scanning for inventory lookup (camera or manual entry)
- Bulk upload via Excel with validation, duplicate detection, and audit trail
- Purchase order management with multi-payment support
- Supplier management with price history
- Alert system for low stock, critical stock, and delayed orders

---

## Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL 16
- (Optional) PM2 for production process management

---

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd hamees

# Install dependencies
pnpm install

# Generate Prisma client
pnpm prisma generate
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

**Required variables:**

```env
# PostgreSQL connection string
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"

# NextAuth — generate with: openssl rand -base64 32
NEXTAUTH_SECRET="your-secure-secret-key"

# Application URL (used by NextAuth for redirects)
NEXTAUTH_URL="http://localhost:3009"

# Node environment
NODE_ENV="development"
```

**Optional — public site origin:**

```env
# Canonical, OpenGraph and JSON-LD origin for the marketing site at "/".
# NEXT_PUBLIC_* values are baked into the build: redeploy after changing this.
# Defaults to https://hameesattire.com when unset.
NEXT_PUBLIC_SITE_URL="https://hamees.gagneet.com"
```

**Optional — WhatsApp Business API:**

```env
# Meta WhatsApp Business API credentials
# Without these, the service runs in dev mode (logs messages to console)
WHATSAPP_API_KEY="your-api-key"
WHATSAPP_PHONE_NUMBER_ID="your-phone-number-id"
WHATSAPP_API_URL="https://graph.facebook.com/v17.0"
WHATSAPP_BUSINESS_ACCOUNT_ID="your-business-account-id"
```

---

## Database Setup

### First-time setup

```bash
# Push schema to database (development only — no migration files created)
pnpm db:push

# Seed with sample data (6 users, 10 cloth items, 6 accessories, 4 garment patterns)
pnpm db:seed

# Or seed with comprehensive production-like data (232 orders, 25 customers, seasonal patterns)
pnpm tsx prisma/seed-complete.ts
```

### Development workflow

```bash
# After modifying prisma/schema.prisma:
pnpm db:migrate       # Create and apply a migration (commit prisma/migrations/<name>/)
pnpm prisma generate  # Regenerate Prisma client

# Open Prisma Studio to inspect data
pnpm db:studio
```

Money columns are `BigInt` minor units (paise/cents). Code works with decimal amounts: the Prisma client from `lib/db.ts` (or `createPrismaClient()` in scripts) converts at the database boundary. Aggregates and raw SQL stay in minor units — see `lib/money.ts`.

### Production migrations

Schema changes are tracked in `prisma/migrations` (`0_init` baseline) and applied by `scripts/deploy.sh` with `prisma migrate deploy` after a `pg_dump` backup. Never use `db push` on production.

---

## Running Locally

```bash
# Development server (port 3009)
pnpm dev

# Production build and start
pnpm build
pnpm start
```

The application runs on port 3009 by default.

---

## Default Credentials

After running the seed script, these accounts are available (all use password `admin123`):

| Email | Role | Access Level |
|-------|------|-------------|
| `owner@hameesattire.com` | OWNER | Full access except user management and delete operations |
| `admin@hameesattire.com` | ADMIN | Full access including user management, delete, and bulk upload |
| `inventory@hameesattire.com` | INVENTORY_MANAGER | Inventory, purchase orders, garment types, suppliers, alerts |
| `sales@hameesattire.com` | SALES_MANAGER | Orders, customers, measurements, garment types, reports, alerts |
| `master@hameesattire.com` | MASTER_TAILOR | All orders, tailor assignment, production workload and report (placeholder — rename to the real person) |
| `tailor@hameesattire.com` | TAILOR | Status of items assigned to them, measurements, view inventory |
| `viewer@hameesattire.com` | VIEWER | Read-only access to dashboard, inventory, orders, customers, alerts |

**Change all passwords before any production deployment.**

---

## Role-Based Access Control

The system has 6 roles with 38 granular permissions. Key distinctions:

- **OWNER** — Can manage everything but cannot delete records or manage user accounts. Cannot perform bulk uploads.
- **ADMIN** — Has all OWNER permissions plus: delete records, manage user accounts, application settings, bulk upload/delete.
- **INVENTORY_MANAGER** — Focused on stock: inventory, purchase orders, garment patterns, suppliers. No access to orders, customers, or expenses.
- **SALES_MANAGER** — Focused on customer-facing work: orders, customers, measurements. No access to inventory or expenses.
- **TAILOR** — Can update order status, view assigned orders, manage measurements. Cannot see pricing on orders.
- **VIEWER** — Read-only across dashboard, inventory, orders, and customers.

See `lib/permissions.ts` for the complete permission matrix.

---

## Routes

Three routes are reachable without a session; everything else redirects to `/login` (`proxy.ts`, then the
server-side guards in `app/(dashboard)/layout.tsx` and `lib/page-guard.ts`).

| Route | Access | Notes |
|-------|--------|-------|
| `/` | Public, indexed | Marketing site. Static, no database access, four languages |
| `/login` | Public, `noindex` | Staff sign-in. `pages.signIn` in `lib/auth.ts` points here |
| `/order` | Public, indexed | Order enquiry. Garment names only — no prices, stock or customer data |
| `/api/health` | Public | Database health probe |
| everything else | Session + permission | Redirects to `/login` signed out, `/dashboard?denied=1` without the permission |

---

## API Overview

All API routes are under `/api/`. Authentication is required for all non-auth endpoints (session cookie via NextAuth).

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/[...nextauth]` | NextAuth credential login |

### Inventory
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET, POST | `/api/inventory/cloth` | List or create cloth items |
| GET, PATCH, DELETE | `/api/inventory/cloth/[id]` | Single cloth item CRUD |
| POST | `/api/inventory/cloth/[id]/adjust-stock` | Manual stock adjustment |
| GET | `/api/inventory/cloth/[id]/history` | Stock movement history |
| GET, POST | `/api/inventory/accessories` | List or create accessories |
| GET, PATCH, DELETE | `/api/inventory/accessories/[id]` | Single accessory CRUD |
| GET | `/api/inventory/barcode` | Look up item by barcode/SKU |
| GET | `/api/inventory/low-stock` | Items below minimum threshold |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET, POST | `/api/orders` | List orders or create new order |
| GET, PATCH | `/api/orders/[id]` | Order detail or update (discount, advance) |
| PATCH | `/api/orders/[id]/status` | Update order status (manages stock automatically) |
| POST | `/api/orders/[id]/split` | Split order items into separate orders |
| POST | `/api/orders/[id]/payments` | Record payment installment |
| GET | `/api/orders/[id]/installments` | List payment installments |
| PATCH | `/api/orders/[id]/items/[itemId]` | Update order item (garment or fabric) |

### Customers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET, POST | `/api/customers` | List or create customers |
| GET, PATCH, DELETE | `/api/customers/[id]` | Customer CRUD |
| GET, POST | `/api/customers/[id]/measurements` | Measurements for a customer |
| GET | `/api/customers/returning` | Customers with 3+ orders across different months |

### Purchase Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET, POST | `/api/purchase-orders` | List or create purchase orders |
| GET, PATCH, DELETE | `/api/purchase-orders/[id]` | PO CRUD |
| POST | `/api/purchase-orders/[id]/receive` | Record items received |
| POST | `/api/purchase-orders/[id]/payment` | Record payment to supplier |

### Reports & Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/enhanced-stats` | All dashboard metrics for all roles |
| GET | `/api/reports/financial` | P&L statement and trend data |
| GET | `/api/reports/expenses` | Expense analytics with category breakdown |
| GET | `/api/reports/customers` | Customer analytics and segmentation |

### Other
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET, POST | `/api/expenses` | Expense records |
| GET, PATCH, DELETE | `/api/expenses/[id]` | Single expense CRUD |
| GET, POST | `/api/alerts` | System alerts |
| GET, POST | `/api/garment-patterns` | Garment pattern definitions |
| GET, POST | `/api/suppliers` | Supplier management |
| GET | `/api/bulk-upload/history` | Bulk upload audit history |
| POST | `/api/bulk-upload/preview` | Preview upload before committing |
| POST | `/api/bulk-upload/process` | Process bulk upload |
| GET | `/api/bulk-upload/download-template` | Download Excel template |
| POST | `/api/whatsapp/send` | Send WhatsApp message |
| GET, POST | `/api/whatsapp/templates` | Manage message templates |
| GET | `/api/whatsapp/history` | Message delivery history |
| POST | `/api/barcode/generate` | Generate QR code for inventory item |
| GET | `/api/admin/users` | List users (ADMIN only) |
| POST | `/api/admin/users` | Create user (ADMIN only) |
| PATCH | `/api/admin/users/[id]` | Update user (ADMIN only) |

---

## Architecture Overview

```
Browser/Mobile
      |
      v
Cloudflare (DNS + WAF + DDoS protection)
      |
      v
Cloudflare Tunnel (encrypted)
      |
      v
nginx (port 80/443, reverse proxy)
      |
      v
PM2 → Next.js App (port 3009, fork mode)
      |
      +-- App Router (React Server Components)
      |      |
      |      +-- (dashboard)/ — Protected routes
      |      +-- api/        — API route handlers
      |
      +-- Prisma ORM + @prisma/adapter-pg
             |
             v
      PostgreSQL 16 (Unix socket, tailor_inventory DB)
```

### Key architectural patterns

**Authentication:** NextAuth v5 with JWT sessions. The `auth()` function is wrapped with `React.cache()` for per-request deduplication. User role is embedded in the JWT token.

**Permission checks:** All API routes call `requirePermission()` or `requireAnyPermission()` from `lib/api-permissions.ts`. UI navigation is filtered dynamically based on the user's role permissions.

**Stock reservation:** When an order is created, fabric is reserved by incrementing `ClothInventory.reserved`. Available stock is always `currentStock - reserved`. Stock movements are logged to `StockMovement` for every change. The same pattern applies to accessories via `AccessoryStockMovement`.

**Database access:** A singleton Prisma client is created via the `PrismaPg` adapter using a connection pool (`pg.Pool`). Imported from `lib/db.ts`.

---

## Project Structure

```
hamees/
├── app/
│   ├── (dashboard)/          # All protected pages (route group)
│   │   ├── dashboard/        # Role-specific dashboard views
│   │   ├── orders/           # Order listing, creation, detail
│   │   ├── inventory/        # Cloth and accessory management
│   │   ├── customers/        # Customer profiles and measurements
│   │   ├── purchase-orders/  # Supplier purchase orders
│   │   ├── expenses/         # Business expense tracking
│   │   ├── reports/          # Financial and analytics reports
│   │   ├── alerts/           # System alerts
│   │   ├── garment-types/    # Garment pattern management
│   │   ├── suppliers/        # Supplier management
│   │   ├── bulk-upload/      # Excel import/export
│   │   └── admin/            # User management (ADMIN only)
│   ├── api/                  # API route handlers
│   ├── login/                # Staff login (public, noindex)
│   ├── order/                # Public order enquiry (public, indexable)
│   ├── layout.tsx            # Root layout (fonts, providers)
│   ├── page.tsx              # Public marketing site (static, indexable)
│   └── globals.css           # Tailwind CSS and design tokens
├── components/
│   ├── marketing/            # Public site component + EN/HI/PA/JA copy
│   ├── dashboard/            # Dashboard widgets and charts
│   ├── orders/               # Order-specific components
│   ├── inventory/            # Inventory edit forms, dialogs
│   ├── customers/            # Customer-related components
│   ├── measurements/         # Visual measurement tool
│   ├── ui/                   # Base Radix UI components
│   ├── DashboardLayout.tsx   # Sidebar navigation with RBAC
│   └── ...
├── lib/
│   ├── auth.ts               # NextAuth configuration
│   ├── db.ts                 # Prisma client singleton
│   ├── permissions.ts        # RBAC permission matrix (38 permissions, 6 roles)
│   ├── api-permissions.ts    # API route auth helpers
│   ├── whatsapp/             # WhatsApp Business API service
│   ├── barcode/              # QR code generation service
│   └── utils.ts              # formatCurrency, generateOrderNumber, etc.
├── prisma/
│   ├── schema.prisma         # Database schema (25 models)
│   ├── seed.ts               # Basic seed data
│   ├── seed-complete.ts      # Production seed (232 orders, 25 customers)
│   └── migrations/           # Manual SQL fix scripts (no Prisma migrations)
├── scripts/                  # Utility and maintenance scripts
├── docs/                     # Technical documentation
├── types/
│   └── next-auth.d.ts        # NextAuth type extensions
├── ecosystem.config.js       # PM2 configuration
├── prisma.config.ts          # Prisma datasource configuration
├── next.config.ts            # Next.js configuration
└── clean-build.sh            # Build helper script
```

---

## Deployment

### Production (PM2 + Cloudflare Tunnel)

```bash
# 1. Build the application
pnpm build

# 2. Start with PM2
pm2 start ecosystem.config.js

# 3. Save PM2 process list for auto-restart on reboot
pm2 save

# 4. View logs
pm2 logs hamees-inventory

# Restart after code changes
pm2 restart hamees-inventory
```

### Updating in production

```bash
git pull
./scripts/deploy.sh
```

**Run it as the user PM2 runs the app as — never with `sudo`.** PM2 keeps a separate process list per
user, so a deploy run as root talks to root's PM2 daemon, which knows nothing about the running app: it
stops nothing, swaps `.next` underneath a live server, and then fails to bind port 3009. The symptom is
`ChunkLoadError` in the browser (the old page asking for chunks the new build renamed) and
`EADDRINUSE :::3009` in the logs. A root build also leaves `.next` root-owned, so the app can no longer
write its prerender cache (`EACCES`).

Do not run `pnpm install`, `prisma generate` or `pnpm build` by hand in the live directory: the running server loads the Prisma client from `node_modules`. `deploy.sh` builds the release in a temporary copy first, stops the app only when dependencies, the Prisma client or the database schema change, backs up the database, migrates, builds, restarts and checks `/api/health`. On failure it prints how to recover (including restoring the backup if migrations ran).

### Stack verification

```bash
# 1. App responding locally
curl -I http://localhost:3009
# Expected: HTTP/1.1 200 OK

# 2. nginx proxy working
curl -I -H "Host: hamees.gagneet.com" http://localhost
# Expected: HTTP/1.1 200 OK

# 3. Public URL
curl -I https://hamees.gagneet.com
# Expected: HTTP/2 200

# 4. PM2 status
pm2 status
# Expected: hamees-inventory | online
```

### Port allocation (this server)

| Port | Application |
|------|-------------|
| 3002 | healthapp.gagneet.com |
| 3003 | expenses.gagneet.com |
| **3009** | **hamees.gagneet.com (this app)** |
| 8000 | eastgate-backend |
| 8001 | property backend |

### Cloudflare Tunnel

The application is exposed via a Cloudflare Tunnel. The system configuration file is at `/etc/cloudflared/config.yml` (not `~/.cloudflared/config.yml`).

```bash
# Restart Cloudflare tunnel after config changes
sudo systemctl restart cloudflared
sudo systemctl status cloudflared
```

---

## Development Commands

```bash
pnpm dev              # Dev server on port 3009
pnpm build            # Production build
pnpm start            # Start production server on port 3009
pnpm lint             # Run ESLint

pnpm db:push          # Push schema changes (dev only)
pnpm db:migrate       # Create and run Prisma migrations
pnpm db:seed          # Seed database with sample data
pnpm db:studio        # Open Prisma Studio on port 5555
pnpm db:reset         # Reset database and reseed

./clean-build.sh      # Full clean build (removes .next, reinstalls if package.json changed)
```

---

## Database Schema

25 Prisma models covering the full domain:

**Core business:** `User`, `Customer`, `Measurement`, `Order`, `OrderItem`, `OrderHistory`, `PaymentInstallment`

**Inventory:** `ClothInventory`, `AccessoryInventory`, `StockMovement`, `AccessoryStockMovement`

**Garments:** `GarmentPattern`, `GarmentAccessory`

**Suppliers & Purchasing:** `Supplier`, `SupplierPrice`, `PurchaseOrder`, `POItem`

**System:** `Alert`, `Settings`, `BusinessSettings`, `UploadHistory`

**Business:** `Expense`, `DesignUpload`, `WhatsAppMessage`, `WhatsAppTemplate`

---

## Known Issues

See `docs/GAPS_AND_ISSUES.md` for a comprehensive catalogue of technical debt, missing infrastructure, and security concerns. Key items:

- `next-auth` is on an old beta (`5.0.0-beta.30`) pending upgrade to stable
- Rate limiting covers sign-in only (in memory, one app instance); other API endpoints are not rate-limited
- Marketing site: the imagery in `public/marketing/` is placeholder (Instagram screenshots, ~19 MB in total) and the prices, testimonials and celebrity credits in `strings.ts` are drafts
- Marketing site: order tracking and customer sign-in have no route yet — both tabs hand off to `/order`; its enquiry and fitting forms hand off to WhatsApp rather than submitting
- No `app/robots.ts` or `app/sitemap.ts`; the public pages set their own `robots` metadata instead

---

## Contributing

1. Create a feature branch from `master`
2. Make changes following the existing code style (TypeScript strict, Zod validation for all API inputs)
3. Run `pnpm lint` and `pnpm build` to verify there are no errors
4. Open a PR with a clear description

For schema changes, create a Prisma migration with `pnpm db:migrate` and commit the generated folder under `prisma/migrations/`; production applies it with `prisma migrate deploy` via `scripts/deploy.sh`. One-off data-fix SQL belongs in `prisma/manual-sql/` — never put loose `.sql` files in `prisma/migrations/`.

---

## License

See [LICENSE](LICENSE) file.
