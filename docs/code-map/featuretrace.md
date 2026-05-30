# FeatureTrace Code Map

This file is the concise, session-safe dependency map for recently touched features.  
Use it before edits to identify upstream callers, downstream dependencies, and coupled files.
If a PR touches these mapped flows, update this file in the same PR.

```yaml
features:
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
    last_updated_reason: "Fix non-functional Manage Measurements path and add create/link flow."

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
