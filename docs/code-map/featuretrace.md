# FeatureTrace Code Map

This file is the concise, session-safe dependency map for recently touched features.  
Use it before edits to identify upstream callers, downstream dependencies, and coupled files.
If a PR touches these mapped flows, update this file in the same PR.

## Required Change Workflow

Before changing code, build a CodeSee-style impact map for the target file/function/module:

1. Inspect the target file.
2. Search all references/imports/usages with `rg`.
3. Identify upstream callers and runtime entry points: UI screens, API routes, jobs, CLI commands, services.
4. Identify downstream dependencies: helper functions, Prisma models/tables, schemas, config/env, external services.
5. Identify related tests and docs.
6. Summarise the impact map before editing.
7. Make the smallest safe change.
8. Update tests/docs when behaviour changes.
9. Add or update nearby `@featuretrace`/`FEATURETRACE` metadata for touched cross-file workflows.
10. Update this file when the dependency map changes.

Preferred local metadata format for primary files:

```text
FEATURETRACE:
  feature: <feature name>
  owner_area: <domain/module>
  entry_points:
    - <route/screen/job/CLI>
  upstream_callers:
    - <file:function>
  downstream_dependencies:
    - <file:function>
    - <database table/collection>
    - <external service/config>
  related_tests:
    - <test file/test name>
  change_risk:
    - <low/medium/high and why>
  maintainer_notes:
    - <anything a new developer should know>
```

For concise registry entries, use the YAML shape below. Keep entries accurate rather than exhaustive.

```yaml
features:
  field_level_acl:
    purpose: "Restrict visibility of financial fields (amounts, costs, payments) based on user roles. Only OWNER/ADMIN see all financial data; other roles have restricted access."
    main_files:
      - "lib/field-acl.ts (core ACL schema and utilities)"
      - "lib/api-filter-response.ts (API middleware for filtering)"
      - "hooks/use-field-visibility.tsx (React hook for frontend)"
      - "tests/unit/lib/field-acl.test.ts (73 unit tests)"
      - "tests/integration/acl-filtering.test.ts (28 integration tests)"
    entry_points:
      - "API: All GET endpoints returning financial data"
      - "UI: Dashboard, Orders, POs, Reports, Customers pages"
    upstream_callers:
      - "app/api/orders/* routes (5 routes: GET, POST, PATCH, payment, installments, items) ✅ UPDATED"
      - "app/api/purchase-orders/* routes (3 routes: GET, POST, detail, payment) ✅ UPDATED"
      - "app/api/reports/* routes (3 routes: financial, customers, expenses) ✅ UPDATED May 30"
      - "components/* and app/(dashboard)/orders/* (17 targeted surfaces) ✅ UPDATED"
    downstream_dependencies:
      - "lib/permissions.ts (role definitions)"
      - "lib/api-permissions.ts::requireAnyPermission (auth)"
      - "lib/auth.ts (session with user.role)"
      - "@prisma/client (UserRole enum)"
    database_tables: []
    external_services: []
    config_env:
      - "ENABLE_FIELD_ACL (future, currently always enabled)"
    related_tests:
      - "tests/unit/lib/field-acl.test.ts (73 tests, all role combinations) ✅ PASSING"
      - "tests/integration/acl-filtering.test.ts (28 tests, API response filtering) ✅ PASSING"
    implementation_status:
      - "Phase 1 - Core ACL system: ✅ COMPLETE (lib/field-acl.ts, api middleware, React hooks)"
      - "Phase 2 - API route updates: ✅ COMPLETE (11/11 routes updated, all endpoints filtering)"
      - "Phase 3 - Frontend components: ✅ COMPLETE (17/17 targeted surfaces now guarded via useFieldVisibility or canViewField)"
      - "Phase 4 - PO approval workflow: ⏳ PENDING (status field + approval UI, optional)"
    known_risks:
      - "Field-level guards depend on correctly classifying new financial fields. Update field-acl rules when adding new amount/cost/payment fields."
      - "Query-level financial filters (minAmount, maxAmount, balanceAmount) are restricted to roles that can view order financial fields (OWNER/ADMIN)."
      - "Floating-point precision in field detection (isFinancialField) - relies on pattern matching."
    last_updated_reason: "May 30: Completed reports route filtering and frontend ACL guards across all 17 targeted screens/components."
  
  order_item_measurement_linking:
    purpose: "Add or link measurements directly from Order Detail when an item has no measurement."
    main_files:
      - "app/(dashboard)/orders/[id]/page.tsx"
      - "components/orders/add-order-item-measurement-dialog.tsx"
      - "components/orders/order-item-measurements.tsx"
      - "app/api/orders/[id]/items/[itemId]/measurement/route.ts"
    entry_points:
      - "UI: /orders/:id (Manage measurements action per order item)"
      - "API: POST /api/orders/:id/items/:itemId/measurement"
    upstream_callers:
      - "Order detail page renders add/edit measurement actions"
    downstream_dependencies:
      - "app/api/customers/[id]/measurements/route.ts (existing measurements list)"
      - "lib/api-permissions.ts::requireAnyPermission"
      - "Prisma models: OrderItem, Order, Measurement, User"
    database_tables:
      - "OrderItem (measurementId)"
      - "Measurement"
      - "Order"
    external_services: []
    config_env: []
    related_tests:
      - "tests/unit/api/customers.test.ts (measurement schema conventions)"
      - "tests/unit/api/order-item-measurement.test.ts"
    known_risks:
      - "Incorrect scoping could link another customer's measurement."
      - "Allowing updates on delivered/cancelled orders would corrupt historical production data."
      - "Defaulting to a non-matching measurement would confuse repeat-order workflows."
    last_updated_reason: "Fix non-functional Manage Measurements path, add create/link flow, and prefer garment-matching defaults."

  reports_shell_layout:
    purpose: "Ensure all report pages render inside the dashboard shell (sidebar + header)."
    main_files:
      - "app/(dashboard)/reports/layout.tsx"
      - "app/(dashboard)/reports/page.tsx"
      - "app/(dashboard)/reports/expenses/page.tsx"
      - "app/(dashboard)/reports/financial/page.tsx"
      - "app/(dashboard)/reports/customers/page.tsx"
    entry_points:
      - "UI: /reports"
      - "UI: /reports/expenses"
      - "UI: /reports/financial"
      - "UI: /reports/customers"
    upstream_callers:
      - "Next.js App Router under app/(dashboard)/reports/*"
    downstream_dependencies:
      - "components/DashboardLayout.tsx"
      - "API: /api/reports/expenses"
      - "API: /api/reports/financial"
      - "API: /api/reports/customers"
    database_tables:
      - "Order"
      - "PaymentInstallment"
      - "Expense"
      - "Customer"
      - "Measurement"
    external_services: []
    config_env: []
    related_tests:
      - "tests/unit/api/reports.test.ts"
    known_risks:
      - "If pages re-wrap or bypass route layout, shell regressions can recur."
      - "Report API shape drift can break chart rendering."
    last_updated_reason: "Fix missing sidebar/header and restore report rendering consistency."

  purchase_order_non_owner_price_privacy:
    purpose: "Allow non-Owner users to create purchase orders without seeing or submitting supplier pricing; Owner-created POs are priced immediately, and OWNER or INVENTORY_MANAGER users approve non-Owner-created POs by entering item prices."
    main_files:
      - "app/(dashboard)/purchase-orders/new/page.tsx (full-page PO creation UI)"
      - "components/dashboard/create-po-dialog.tsx (dashboard PO creation dialog)"
      - "app/(dashboard)/purchase-orders/page.tsx (PO list financial visibility)"
      - "app/(dashboard)/purchase-orders/[id]/page.tsx (PO detail financial visibility)"
      - "app/api/purchase-orders/route.ts (PO create/list API, initial approval status)"
      - "app/api/purchase-orders/[id]/route.ts (PO approval/cancel/detail API)"
      - "app/api/purchase-orders/[id]/receive/route.ts (blocks receipt until approval)"
      - "app/api/purchase-orders/[id]/payment/route.ts (blocks payment until approval)"
      - "lib/api-filter-response.ts (nested PO item price redaction)"
      - "lib/field-acl.ts (role-to-financial-field rules)"
    entry_points:
      - "UI: /purchase-orders/new"
      - "UI: /purchase-orders"
      - "UI: /purchase-orders/:id"
      - "UI: CreatePODialog from dashboard surfaces"
      - "API: GET /api/purchase-orders"
      - "API: POST /api/purchase-orders"
      - "API: GET /api/purchase-orders/:id"
      - "API: PATCH /api/purchase-orders/:id (approve with prices)"
      - "API: POST /api/purchase-orders/:id/receive"
      - "API: POST /api/purchase-orders/:id/payment"
    upstream_callers:
      - "components/dashboard/inventory-manager-dashboard.tsx (opens CreatePODialog)"
      - "components/dashboard/pending-pos-dialog.tsx (links to PO list/detail)"
      - "components/DashboardLayout.tsx (Purchase Orders navigation)"
      - "components/command-palette.tsx (New Purchase Order command)"
      - "app/(dashboard)/inventory/cloth/[id]/page.tsx (Create Purchase Order link)"
      - "app/(dashboard)/inventory/accessories/[id]/page.tsx (Create Purchase Order link)"
      - "app/(dashboard)/alerts/[id]/page.tsx (Create Purchase Order link)"
    downstream_dependencies:
      - "hooks/use-field-visibility.tsx::useFieldVisibility"
      - "lib/field-acl.ts::canViewField"
      - "lib/api-filter-response.ts::filterApiResponse"
      - "lib/api-permissions.ts::requireAnyPermission"
      - "lib/auth.ts / NextAuth session user.role"
      - "prisma.purchaseOrder and prisma.pOItem"
      - "Zod purchaseOrderSchema in app/api/purchase-orders/route.ts"
      - "Zod approvePurchaseOrderSchema in app/api/purchase-orders/[id]/route.ts"
    database_tables:
      - "PurchaseOrder"
      - "POItem"
      - "Supplier"
    external_services: []
    config_env: []
    related_tests:
      - "tests/unit/lib/field-acl.test.ts"
      - "tests/unit/api/purchase-orders.test.ts"
      - "tests/integration/acl-filtering.test.ts"
    known_risks:
      - "POItem.pricePerUnit and totalPrice are non-null DB fields, so non-Owner-created rows store zero placeholders until approval writes item prices."
      - "Nested PO item financial fields must stay redacted; top-level PO filtering alone is not sufficient."
      - "Approval is status-string based; adding a formal Prisma enum or approver audit fields would require a migration and map update."
    last_updated_reason: "Added non-owner PO approval flow: non-owner-created POs require OWNER or INVENTORY_MANAGER approval with item prices before receipt/payment."

  codebase_mindmap:
    purpose: "Provide a CodeSee-style navigation map for repository ownership, feature domains, request flows, data model, and change-tracing rules."
    main_files:
      - "docs/CODEBASE_MINDMAP.md"
      - "docs/MINDMAPS.md"
      - "docs/APPLICATION_MAP.md"
      - "docs/code-map/featuretrace.md"
    entry_points:
      - "Docs: onboarding, PR planning, refactor planning"
    upstream_callers:
      - "Senior engineer workflow before code edits"
      - "FeatureTrace workflow when touching cross-file features"
    downstream_dependencies:
      - "app/(dashboard) route structure"
      - "app/api route structure"
      - "components feature folders"
      - "lib business/infrastructure utilities"
      - "prisma/schema.prisma"
      - "tests/unit and tests/integration"
    database_tables:
      - "Documents high-level relationships across User, Customer, Order, OrderItem, Inventory, PurchaseOrder, POItem, Alert, Expense, Measurement"
    external_services:
      - "WhatsApp Business API (documented integration)"
      - "Cloudflare Tunnel / PM2 deployment context"
    config_env:
      - "DATABASE_URL"
      - "NEXTAUTH_URL"
      - "NEXTAUTH_SECRET"
      - "WhatsApp environment variables when enabled"
    related_tests: []
    known_risks:
      - "Mindmaps can drift as routes/models evolve; update when adding domains, API routes, stock-changing flows, or financial fields."
      - "Docs are intentionally concise and do not replace source inspection for high-risk changes."
    last_updated_reason: "Created a code-oriented mindmap and added the required pre-edit impact-map workflow."

```
