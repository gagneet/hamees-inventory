# System Overview

## What It Is

Hamees Inventory System is a comprehensive inventory and order management platform built specifically for tailor shops. It manages fabric inventory, tracks customer orders through a production pipeline, monitors stock levels with automatic reservation, calculates GST-compliant pricing, sends WhatsApp notifications, and provides analytics dashboards for each staff role.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js App Router | 16.2.3 |
| UI Library | React | 19.2.3 |
| Language | TypeScript | 5 |
| ORM | Prisma | 7.7.0 |
| DB Adapter | @prisma/adapter-pg | 7.7.0 |
| Database | PostgreSQL | 16 |
| Auth | NextAuth.js | v5 beta.30 |
| Styling | Tailwind CSS | 4 |
| Components | Radix UI | latest |
| Charts | Recharts | latest |
| Toasts | Sonner | 2.0.7 |
| Package Mgr | pnpm | 10.28.0 |
| Process Mgr | PM2 | latest |
| Excel | exceljs | latest |
| QR Codes | qrcode | 1.5.4 |

## High-Level Architecture

```mermaid
flowchart TD
    subgraph Client["Browser / Mobile"]
        UI[Next.js React UI<br/>App Router / RSC]
    end

    subgraph Server["Application Server — port 3009"]
        NEXT[Next.js 16 Server<br/>API Routes + RSC]
        AUTH[NextAuth v5<br/>JWT Sessions]
        PRISMA[Prisma 7 Client<br/>adapter-pg]
        WA[WhatsApp Service<br/>Meta Graph API]
    end

    subgraph Data["Data Layer"]
        PG[(PostgreSQL 16<br/>tailor_inventory)]
        FS[Local FS<br/>/uploads/designs/]
    end

    subgraph Infra["Infrastructure"]
        PM2[PM2 Fork Mode<br/>hamees-inventory]
        NGINX[nginx<br/>Reverse Proxy]
        CF[Cloudflare Tunnel<br/>cloudflared]
        DNS[Cloudflare DNS<br/>hamees.gagneet.com]
    end

    UI -->|HTTPS| DNS
    DNS -->|Tunnel| CF
    CF --> NGINX
    NGINX -->|proxy_pass :3009| PM2
    PM2 --> NEXT
    NEXT --> AUTH
    NEXT --> PRISMA
    NEXT --> WA
    PRISMA -->|Unix socket| PG
    NEXT --> FS
    WA -->|HTTPS| META[Meta Graph API<br/>v17.0]
```

## Application Layers

### 1. Routing Layer — `app/`

Next.js 16 App Router with route groups:

```
app/
├── page.tsx                    # Login page (public)
├── layout.tsx                  # Root layout (fonts, providers)
├── (dashboard)/                # Protected route group
│   ├── dashboard/              # Role-specific dashboards
│   ├── orders/                 # Order management
│   ├── inventory/              # Cloth + accessories
│   ├── customers/              # Customer profiles + measurements
│   ├── suppliers/              # Supplier management
│   ├── purchase-orders/        # PO management
│   ├── expenses/               # Expense tracking
│   ├── alerts/                 # Stock + order alerts
│   ├── reports/                # Financial + sales reports
│   ├── garment-types/          # Garment patterns
│   ├── bulk-upload/            # Excel import/export (ADMIN only)
│   └── admin/settings/         # User management (ADMIN only)
└── api/                        # API route handlers
```

All routes under `(dashboard)/` are protected by NextAuth middleware. The middleware checks for a valid JWT session and redirects unauthenticated users to the login page.

### 2. API Layer — `app/api/`

REST API endpoints built with Next.js Route Handlers. Each endpoint:
- Calls `requireAnyPermission()` or `requirePermission()` from `lib/api-permissions.ts`
- Validates request body with Zod schemas
- Operates on PostgreSQL via Prisma client
- Returns JSON responses

### 3. Data Access Layer — `lib/db.ts`

Prisma client singleton using the PostgreSQL adapter for Prisma 7:

```typescript
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
export const prisma = new PrismaClient({ adapter })
```

The adapter connects over a Unix socket in production for lower latency. The singleton pattern prevents connection pool exhaustion during hot reloads.

### 4. Business Logic — `lib/`

| File | Purpose |
|------|---------|
| `lib/permissions.ts` | Role × permission matrix, `hasPermission()` |
| `lib/api-permissions.ts` | API route guards, `requireAnyPermission()` |
| `lib/auth.ts` | NextAuth configuration, credential validation |
| `lib/utils.ts` | `formatCurrency()`, `generateOrderNumber()`, `calculateStockStatus()` |
| `lib/generate-alerts.ts` | Auto-generate stock and order alerts |
| `lib/dashboard-data.ts` | Dashboard metric calculations |
| `lib/whatsapp/whatsapp-service.ts` | WhatsApp message sending |
| `lib/barcode/qrcode-service.ts` | QR code generation and lookup |
| `lib/excel-processor.ts` | Bulk upload processing |
| `lib/excel-upload.ts` | Upload validation and duplicate detection |

### 5. Component Layer — `components/`

Organized by feature domain:

```
components/
├── dashboard/          # Role-specific dashboard panels + charts
├── orders/             # Order forms, dialogs, invoice printing
├── inventory/          # Inventory forms, edit dialogs, history viewer
├── customers/          # Customer cards, order dialogs
├── measurements/       # Visual measurement tool (bilingual EN/PA)
├── payment-installments.tsx
├── DashboardLayout.tsx # Sidebar nav (permission-filtered)
├── barcode-scanner-improved.tsx
└── ui/                 # shadcn/ui primitives (Button, Dialog, etc.)
```

## Data Flow: Creating an Order

```mermaid
sequenceDiagram
    participant Browser
    participant API as /api/orders POST
    participant DB as PostgreSQL

    Browser->>API: POST {customerId, items, stitchingTier, advancePaid, ...}
    API->>API: requireAnyPermission(['create_order'])
    API->>API: Zod schema validation
    API->>DB: Fetch GarmentPattern (baseMeters + adjustments)
    API->>DB: Fetch ClothInventory (pricePerMeter)
    API->>API: Calculate estimatedMeters per item<br/>(baseMeters + bodyTypeAdjustment)
    API->>API: Calculate pricing<br/>(fabric + accessories + stitching + premiums + GST 12%)
    API->>DB: BEGIN TRANSACTION
    DB-->>API: Transaction client
    API->>DB: Create Order record
    API->>DB: Create OrderItem records
    API->>DB: Update ClothInventory.reserved += estimatedMeters
    API->>DB: Create StockMovement (ORDER_RESERVED)
    API->>DB: Update AccessoryInventory.reserved (per GarmentAccessory)
    API->>DB: Create AccessoryStockMovement (ORDER_RESERVED)
    API->>DB: Create OrderHistory (ORDER_CREATED)
    API->>DB: COMMIT
    API-->>Browser: Created order JSON
    API->>API: after(): Send WhatsApp confirmation (non-blocking)
```

## WhatsApp Integration

```mermaid
flowchart LR
    ORDER[Order Created<br/>or Status → READY]
    WA[whatsappService<br/>lib/whatsapp/]
    ENV{WHATSAPP_API_KEY<br/>configured?}
    META[Meta Graph API<br/>graph.facebook.com/v17.0]
    LOG[Console Log<br/>DEV MODE]
    DB[(WhatsAppMessage<br/>record)]

    ORDER --> WA
    WA --> ENV
    ENV -->|Yes| META
    ENV -->|No| LOG
    META --> DB
```

Auto-sends are non-blocking (use Next.js `after()` hook): order creation triggers ORDER_CONFIRMATION; status change to READY triggers ORDER_READY pickup notification.

## Role-Based Dashboard Views

Each role sees a customized dashboard:

| Role | Dashboard Component | Key Metrics |
|------|--------------------|----|
| OWNER | `owner-dashboard.tsx` | Revenue, outstanding payments, fabric efficiency, charts |
| ADMIN | Same as Owner | Same as Owner |
| INVENTORY_MANAGER | `inventory-manager-dashboard.tsx` | Stock health, low/critical items, pending POs |
| SALES_MANAGER | `sales-manager-dashboard.tsx` | New orders, ready for pickup, monthly targets, forecast |
| TAILOR | `tailor-dashboard.tsx` | In-progress, due today, overdue, workload by garment |
| VIEWER | Basic stats card | Order count, inventory count |

## Environment Variables

```bash
DATABASE_URL="postgresql://hamees_user:PASSWORD@localhost:5432/tailor_inventory"
NEXTAUTH_URL="https://hamees.gagneet.com"
NEXTAUTH_SECRET="[32-byte base64 secret]"
NODE_ENV="production"

# Optional — WhatsApp Business API
WHATSAPP_API_KEY="your_api_key"
WHATSAPP_PHONE_NUMBER_ID="your_phone_number_id"
WHATSAPP_API_URL="https://graph.facebook.com/v17.0"
WHATSAPP_BUSINESS_ACCOUNT_ID="your_account_id"
```
