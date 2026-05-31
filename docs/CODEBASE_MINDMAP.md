# Hamees Codebase Mindmap

This map explains the repository by code ownership, not only by product feature. Use it when onboarding, planning refactors, reviewing pull requests, or deciding which files must be inspected together for a change.

## 1. System Shape

```mermaid
mindmap
  root((Hamees Inventory))
    Runtime
      Next.js 16 App Router
      React 19 Client Components
      API Route Handlers
      Prisma 7 adapter-pg
      PostgreSQL 16
      NextAuth v5 JWT
    Entry Points
      app/page.tsx Login
      app/(dashboard) Protected UI
      app/api REST endpoints
      prisma/schema.prisma Data model
      components Shared UI and feature widgets
      lib Shared business and infra logic
    Infrastructure
      Port 3009
      PM2 fork mode
      Cloudflare Tunnel
      PostgreSQL local database
```

## 2. Folder Ownership

```mermaid
mindmap
  root((Repository))
    app
      layout.tsx Root providers shell
      page.tsx Public login
      (dashboard)
        dashboard Role dashboards
        orders Order lifecycle
        inventory Cloth and accessory stock
        customers Customer profiles and measurements
        purchase-orders Supplier restocking
        expenses Expense tracking
        reports Analytics
        alerts Operational alerts
        garment-types Pattern setup
        bulk-upload Excel import
        admin User and settings management
      api
        orders
        customers
        inventory
        purchase-orders
        expenses
        reports
        alerts
        auth
        whatsapp
        barcode
        excel
        bulk-upload
    components
      ui Shadcn and Radix primitives
      dashboard Role dashboard cards charts dialogs
      orders Order dialogs production board invoice actions
      inventory Edit forms stock history
      measurements Visual and form measurement tools
      customers Customer related dialogs
      alerts Alert cards and actions
    lib
      db Prisma singleton
      auth NextAuth config
      permissions Role permission matrix
      api-permissions Route guards
      field-acl Financial field visibility
      api-filter-response Response redaction
      utils Currency SKU order helpers
      dashboard-data Metrics aggregation
      generate-alerts Alert creation
      excel-processor Import parser
      whatsapp Service integration
      barcode QR code service
    prisma
      schema.prisma Models enums relations
      seed scripts Demo and production seed data
    tests
      unit Business utilities API schemas ACL
      integration Auth stock reservation response filtering
    docs
      architecture System docs
      MINDMAPS Product mindmaps
      CODEBASE_MINDMAP This file
```

## 3. Feature Domains

```mermaid
mindmap
  root((Business Domains))
    Auth and RBAC
      lib/auth.ts
      lib/permissions.ts
      lib/api-permissions.ts
      components/auth/permission-guard.tsx
      DashboardLayout permission-filtered nav
      UserRole enum
    Field Privacy
      lib/field-acl.ts
      hooks/use-field-visibility.tsx
      lib/api-filter-response.ts
      Financial values hidden by role
    Orders
      app/(dashboard)/orders
      app/api/orders
      components/orders
      Order OrderItem PaymentInstallment OrderHistory
      Stock reservation on create
      Status updates and tailor notes
      Split order
      Print invoice
      WhatsApp notification
    Customers and Measurements
      app/(dashboard)/customers
      app/api/customers
      app/api/measurements
      components/measurements
      Customer Measurement
      Measurement history and visual tool
    Inventory
      app/(dashboard)/inventory
      app/api/inventory
      components/inventory
      ClothInventory AccessoryInventory
      StockMovement AccessoryStockMovement
      Reserved stock and available stock
      Barcode lookup
    Purchase Orders
      app/(dashboard)/purchase-orders
      app/api/purchase-orders
      components/dashboard/create-po-dialog.tsx
      PurchaseOrder POItem Supplier
      Receive stock into inventory
      Payment tracking
    Alerts
      app/(dashboard)/alerts
      app/api/alerts
      lib/generate-alerts.ts
      Alert model
      Low stock critical stock overdue orders
    Reports and Dashboards
      app/(dashboard)/dashboard
      app/(dashboard)/reports
      app/api/dashboard
      app/api/reports
      lib/dashboard-data.ts
      Recharts components
    Imports Integrations
      app/api/bulk-upload
      app/api/excel/submit-order
      lib/excel-processor.ts
      lib/excel-upload.ts
      app/api/whatsapp
      lib/whatsapp/whatsapp-service.ts
      app/api/barcode
      lib/barcode/qrcode-service.ts
```

## 4. Core Data Model

```mermaid
erDiagram
    User ||--o{ Order : creates
    User ||--o{ OrderHistory : records
    User ||--o{ Measurement : records
    User ||--o{ Expense : records
    Customer ||--o{ Order : places
    Customer ||--o{ Measurement : has
    Order ||--o{ OrderItem : contains
    Order ||--o{ PaymentInstallment : has
    Order ||--o{ OrderHistory : tracks
    OrderItem }o--|| GarmentPattern : uses
    OrderItem }o--|| ClothInventory : reserves
    OrderItem }o--|| Measurement : references
    OrderItem }o--|| User : assignedTailor
    GarmentPattern ||--o{ GarmentAccessory : requires
    GarmentAccessory }o--|| AccessoryInventory : consumes
    ClothInventory ||--o{ StockMovement : logs
    AccessoryInventory ||--o{ AccessoryStockMovement : logs
    Supplier ||--o{ ClothInventory : supplies
    Supplier ||--o{ AccessoryInventory : supplies
    Supplier ||--o{ PurchaseOrder : receives
    PurchaseOrder ||--o{ POItem : contains
    Alert }o--o| ClothInventory : related
    Alert }o--o| Order : related
```

## 5. Request Flow Pattern

```mermaid
flowchart TD
    UI[Client page or component] --> Hook[useSession / useFieldVisibility]
    UI --> Fetch[fetch /api/...]
    Fetch --> Route[app/api/.../route.ts]
    Route --> Auth[auth or requirePermission]
    Auth --> Zod[Zod validation]
    Zod --> Prisma[lib/db Prisma client]
    Prisma --> DB[(PostgreSQL)]
    Route --> Redact[filterApiResponse when financial data exists]
    Redact --> UI
```

## 6. Order Creation Flow

```mermaid
flowchart TD
    Page[app/(dashboard)/orders/new/page.tsx] --> API[POST /api/orders]
    API --> Permission[create_order permission]
    Permission --> Validate[Zod payload validation]
    Validate --> Pattern[Read GarmentPattern]
    Validate --> Fabric[Read ClothInventory]
    Pattern --> Price[Calculate fabric stitching premiums GST]
    Fabric --> Reserve[Check available = currentStock - reserved]
    Price --> Tx[Prisma transaction]
    Reserve --> Tx
    Tx --> CreateOrder[Order]
    Tx --> CreateItems[OrderItem]
    Tx --> ReserveFabric[ClothInventory.reserved += estimatedMeters]
    Tx --> StockMove[StockMovement ORDER_RESERVED]
    Tx --> ReserveAccessories[AccessoryInventory.reserved]
    Tx --> History[OrderHistory ORDER_CREATED]
    API --> Response[Created order JSON]
    API --> WhatsApp[after() non-blocking confirmation]
```

## 7. Purchase Order Flow

```mermaid
flowchart TD
    CreatePage[Purchase order create page or dialog] --> POST[POST /api/purchase-orders]
    POST --> Role[manage_inventory or manage_purchase_orders]
    Role --> Creator{Creator role}
    Creator -->|OWNER| Approved[PurchaseOrder.status = APPROVED]
    Creator -->|Non-owner| PendingApproval[PurchaseOrder.status = PENDING_APPROVAL]
    PendingApproval --> Detail[Purchase order detail]
    Detail --> Approver{OWNER or INVENTORY_MANAGER}
    Approver --> PATCH[PATCH /api/purchase-orders/:id with item prices]
    PATCH --> Approved
    Approved --> Receive[POST /api/purchase-orders/:id/receive]
    Approved --> Payment[POST /api/purchase-orders/:id/payment]
    Receive --> Stock[Update ClothInventory or AccessoryInventory]
    Receive --> Movement[Create stock movement]
    Receive --> PartialOrReceived[status = PARTIAL or RECEIVED]
    Payment --> PartialOrReceived
```

## 8. Security and Privacy Map

```mermaid
mindmap
  root((Access Control))
    Route Access
      middleware protects dashboard routes
      NextAuth JWT session
      API routes call requirePermission helpers
    Role Permissions
      OWNER business full access no deletes no users
      ADMIN deletes users settings
      INVENTORY_MANAGER inventory suppliers POs
      SALES_MANAGER orders customers sales reports
      TAILOR production measurements selected POs no financials
      VIEWER read only non-financial
    Field-Level ACL
      Order totals hidden for restricted roles
      Order item prices hidden
      PO totals and item prices hidden
      Inventory costs hidden
      Expenses hidden
      Reports filtered by role
    UI Enforcement
      DashboardLayout nav filtering
      useFieldVisibility conditional rendering
      PermissionGuard reusable component
    API Enforcement
      filterApiResponse strips financial fields
      api-permissions blocks unauthorized mutation
```

## 9. Mindmap and FeatureTrace Maintenance Rules

Before modifying code, build an impact map: inspect the target file, search references with `rg`, identify upstream callers, downstream dependencies, runtime entry points, related tests, database tables, config/env, and external services. Summarise that map before editing.

1. When adding a new route under `app/(dashboard)`, add it to the Folder Ownership and Feature Domains sections.
2. When adding a new API domain under `app/api`, add it to Request Flow Pattern or a domain flow if it has business side effects.
3. When changing Prisma models, update Core Data Model.
4. When a workflow crosses 3 or more files, add or update `@featuretrace` / `FEATURETRACE` markers near the top of primary files.
5. Update `docs/code-map/featuretrace.md` whenever a code change alters callers, callees, entry points, tests, database tables, config, or known risks.
6. Financial fields must be checked in both `lib/field-acl.ts` and `lib/api-filter-response.ts` when adding new amount, cost, price, paid, balance, GST, tax, or expense fields.
7. Any stock-changing workflow should show its transaction path and stock movement table in this document.
8. Do not add runtime logging/tracing of sensitive data. Hot-path tracing should be gated behind config/debug flags.

## 10. Best Entry Points for Future Readers

| Question | Start Here |
|---|---|
| How does auth work? | `lib/auth.ts`, `lib/permissions.ts`, `lib/api-permissions.ts` |
| Why can a role not see a field? | `lib/field-acl.ts`, `hooks/use-field-visibility.tsx`, `lib/api-filter-response.ts` |
| How are orders created? | `app/(dashboard)/orders/new/page.tsx`, `app/api/orders/route.ts` |
| How is stock reserved? | `app/api/orders/route.ts`, `app/api/orders/[id]/status/route.ts`, `prisma/schema.prisma` |
| How are POs created and received? | `app/(dashboard)/purchase-orders`, `app/api/purchase-orders` |
| How are dashboards calculated? | `app/api/dashboard/enhanced-stats/route.ts`, `lib/dashboard-data.ts`, `components/dashboard` |
| How do reports work? | `app/(dashboard)/reports`, `app/api/reports` |
| How do imports work? | `app/api/bulk-upload`, `lib/excel-processor.ts`, `lib/excel-upload.ts` |
| How does Excel submit orders? | `app/api/excel/submit-order/route.ts`, `docs/excel-vba-module.bas` |
