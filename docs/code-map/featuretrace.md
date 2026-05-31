# FeatureTrace Code Map

This file is the concise, session-safe dependency map for recently touched features.  
Use it before edits to identify upstream callers, downstream dependencies, and coupled files.
If a PR touches these mapped flows, update this file in the same PR.

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
```
