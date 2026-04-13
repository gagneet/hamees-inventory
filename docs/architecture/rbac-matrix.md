# Role-Based Access Control Matrix

## Roles

| Role | Description |
|------|-------------|
| **OWNER** | Full manage access to all business features. Cannot delete any data. Cannot manage users or system settings. |
| **ADMIN** | Complete system access including all delete operations and user management. |
| **INVENTORY_MANAGER** | Inventory, purchase orders, garment types, and suppliers only. No access to orders, customers, or expenses. |
| **SALES_MANAGER** | Orders, customers, garment types, and reports only. No inventory or purchase orders. |
| **TAILOR** | View most data. Create orders/POs. Manage measurements. Update order status. No expense access. |
| **VIEWER** | Read-only dashboard, inventory, orders, customers, and alerts. |

## Complete Permission Matrix

The table below lists all 38 permissions defined in `lib/permissions.ts`.

| Permission | OWNER | ADMIN | INV_MGR | SALES_MGR | TAILOR | VIEWER |
|-----------|-------|-------|---------|-----------|--------|--------|
| **Dashboard** | | | | | | |
| `view_dashboard` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Inventory** | | | | | | |
| `view_inventory` | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| `add_inventory` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `manage_inventory` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `delete_inventory` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Orders** | | | | | | |
| `view_orders` | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| `create_order` | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| `update_order` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `update_order_status` | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| `delete_order` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Customers** | | | | | | |
| `view_customers` | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| `manage_customers` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `delete_customer` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Measurements** | | | | | | |
| `manage_measurements` | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| `delete_measurement` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Suppliers** | | | | | | |
| `view_suppliers` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `manage_suppliers` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Purchase Orders** | | | | | | |
| `view_purchase_orders` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| `manage_purchase_orders` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| `delete_purchase_order` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Expenses** | | | | | | |
| `view_expenses` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `manage_expenses` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `delete_expenses` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Garment Types** | | | | | | |
| `view_garment_types` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `manage_garment_types` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `delete_garment_type` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Reports** | | | | | | |
| `view_reports` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `view_inventory_reports` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `view_sales_reports` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `view_customer_reports` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `view_expense_reports` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `view_financial_reports` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Administration** | | | | | | |
| `manage_users` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `manage_settings` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `bulk_upload` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `bulk_delete` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Alerts** | | | | | | |
| `view_alerts` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `manage_alerts` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

**Legend:** ✅ = Permitted, ❌ = Denied

## Permission Count Per Role

| Role | Permitted | Denied | Total |
|------|-----------|--------|-------|
| OWNER | 30 | 9 | 39 |
| ADMIN | 39 | 0 | 39 |
| INVENTORY_MANAGER | 11 | 28 | 39 |
| SALES_MANAGER | 14 | 25 | 39 |
| TAILOR | 11 | 28 | 39 |
| VIEWER | 5 | 34 | 39 |

## UI Navigation Filter

The sidebar navigation in `components/DashboardLayout.tsx` filters menu items based on the user's permissions. Each nav item has a `requiredPermission` field; items are only rendered if `hasPermission(userRole, requiredPermission)` returns `true`.

```typescript
const navItems = [
  { href: '/dashboard',        label: 'Dashboard',        requiredPermission: 'view_dashboard' },
  { href: '/orders',           label: 'Orders',           requiredPermission: 'view_orders' },
  { href: '/inventory',        label: 'Inventory',        requiredPermission: 'view_inventory' },
  { href: '/customers',        label: 'Customers',        requiredPermission: 'view_customers' },
  { href: '/suppliers',        label: 'Suppliers',        requiredPermission: 'view_suppliers' },
  { href: '/purchase-orders',  label: 'Purchase Orders',  requiredPermission: 'view_purchase_orders' },
  { href: '/expenses',         label: 'Expenses',         requiredPermission: 'view_expenses' },
  { href: '/alerts',           label: 'Alerts',           requiredPermission: 'view_alerts' },
  { href: '/garment-types',    label: 'Garment Types',    requiredPermission: 'view_garment_types' },
  { href: '/reports',          label: 'Reports',          requiredPermission: 'view_reports' },
  { href: '/bulk-upload',      label: 'Bulk Upload',      requiredPermission: 'bulk_upload' },
  { href: '/admin/settings',   label: 'Admin Settings',   requiredPermission: 'manage_settings' },
]
```

## What Each Role Sees

### OWNER Navigation
Dashboard, Orders, Inventory, Customers, Suppliers, Purchase Orders, **Expenses**, Alerts, Garment Types, Reports

OWNER is the business proprietor. They have full operational control but:
- **Cannot delete** any data (prevents accidental data loss)
- **Cannot manage users** (only ADMIN can create/deactivate user accounts)
- **Cannot access Bulk Upload** (data import is an ADMIN-only operation)
- **Cannot modify settings** (application configuration is ADMIN territory)

### ADMIN Navigation
Dashboard, Orders, Inventory, Customers, Suppliers, Purchase Orders, Expenses, Alerts, Garment Types, Reports, **Bulk Upload**, **Admin Settings**

ADMIN is a technical administrator with full system access.

### INVENTORY_MANAGER Navigation
Dashboard, **Inventory**, **Suppliers**, **Purchase Orders**, Alerts, **Garment Types**, Reports (inventory only)

Cannot see: Orders, Customers, Expenses. Focused on stock and supply chain.

### SALES_MANAGER Navigation
Dashboard, **Orders**, **Customers**, Alerts, **Garment Types**, Reports (sales + customer only)

Cannot see: Inventory, Suppliers, Purchase Orders, Expenses.

### TAILOR Navigation
Dashboard, **Inventory** (view only), **Orders** (view + status update), **Customers** (view only), **Purchase Orders** (view + manage), Alerts, **Garment Types** (view only)

Cannot see: Expenses. Cannot edit orders (only update status and manage measurements).

Note: TAILOR has `manage_purchase_orders` — tailors can create POs for materials they need.

### VIEWER Navigation
Dashboard, Inventory (view), Orders (view), Customers (view), Alerts

Purely read-only. No create, update, or delete capabilities.

## Permission Enforcement: Two Layers

### Layer 1: Middleware (Authentication Gate)
```
All (dashboard)/ routes → middleware.ts → check JWT → redirect if missing
```

### Layer 2: API Routes (Authorization Gate)
```
Every API endpoint → requireAnyPermission([...]) → 401/403 if insufficient role
```

UI-level hiding of buttons/links is a UX feature, not a security boundary. Security is always enforced at the API layer.

## Special Cases

### Assigning Tailors to Order Items
Requires `update_order` **OR** `update_order_status` (TAILOR has the second but not the first):

```typescript
// app/api/orders/[id]/items/[itemId]/route.ts
const { session, error } = await requireAnyPermission([
  'update_order',
  'update_order_status'   // Allows TAILOR role to assign themselves
])
```

### Discount Application
Only OWNER role applies discounts by convention (not enforced by a dedicated permission — uses `update_order`). The business rule is that only the owner can override pricing.

### Delete Permission Philosophy
- OWNER has manage access everywhere but no delete permissions
- This prevents accidental destruction of business records
- Only ADMIN (trusted technical administrator) can permanently remove data
- All "deletes" in the system are soft-deletes (`active: false`) except where noted
