# User Roles and Permissions

## Overview

The Hamees Inventory Management System implements a comprehensive **Role-Based Access Control (RBAC)** system with 6 distinct user roles. Each role has specific permissions tailored to their responsibilities within the tailor shop.

## Demo User Accounts

All demo users share the same password: **`admin123`**

| Email | Role | Name | Phone | Description |
|-------|------|------|-------|-------------|
| `owner@hameesattire.com` | OWNER | Shop Owner | +91-9876543210 | Complete system access |
| `admin@hameesattire.com` | ADMIN | Administrator | +91-9876543211 | Administrative access (no user management) |
| `inventory@hameesattire.com` | INVENTORY_MANAGER | Inventory Manager | +91-9876543212 | Manages inventory and suppliers |
| `sales@hameesattire.com` | SALES_MANAGER | Sales Manager | +91-9876543213 | Manages orders and customers |
| `tailor@hameesattire.com` | TAILOR | Master Tailor | +91-9876543214 | Updates order status, views data |
| `viewer@hameesattire.com` | VIEWER | View Only User | +91-9876543215 | Read-only access |

## Role Details & Permissions

### 1. OWNER 👑

**Description:** Complete control over the entire system with all permissions enabled.

**Use Case:** Shop owner who needs full visibility and control.

**Permissions:**
- ✅ View Dashboard
- ✅ View Inventory
- ✅ Manage Inventory (Add, Edit, Delete)
- ✅ View Orders
- ✅ Create, Update, Delete Orders
- ✅ Update Order Status
- ✅ View Customers
- ✅ Manage Customers (Add, Edit, Delete)
- ✅ View Suppliers
- ✅ Manage Suppliers (Add, Edit, Delete)
- ✅ View Reports
- ✅ Manage Users (Create, Edit, Delete users)
- ✅ Manage Settings (System configuration)
- ✅ View & Manage Alerts

---

### 2. ADMIN 🔧

**Description:** Administrative access with all capabilities except user management.

**Use Case:** Senior staff member who assists in managing the business but cannot create/modify user accounts.

**Permissions:**
- ✅ View Dashboard
- ✅ View Inventory
- ✅ Manage Inventory (Add, Edit, Delete)
- ✅ View Orders
- ✅ Create, Update, Delete Orders
- ✅ Update Order Status
- ✅ View Customers
- ✅ Manage Customers (Add, Edit, Delete)
- ✅ View Suppliers
- ✅ Manage Suppliers (Add, Edit, Delete)
- ✅ View Reports
- ✅ View & Manage Alerts
- ❌ Manage Users
- ❌ Manage Settings

---

### 3. INVENTORY_MANAGER 📦

**Description:** Focused on inventory and supplier management.

**Use Case:** Staff responsible for tracking fabric stock, ordering supplies, and managing supplier relationships.

**Permissions:**
- ✅ View Dashboard
- ✅ View Inventory
- ✅ Manage Inventory (Add, Edit stock levels)
- ✅ View Suppliers
- ✅ Manage Suppliers (Add, Edit supplier info, pricing)
- ✅ View Orders (Read-only, to understand fabric requirements)
- ✅ View Customers (Read-only)
- ✅ View Alerts (Stock alerts)
- ❌ Create/Delete Orders
- ❌ Manage Customers
- ❌ Delete Inventory
- ❌ Manage Users
- ❌ Manage Settings

**Typical Workflow:**
1. Monitor low-stock alerts
2. Create purchase orders with suppliers
3. Update inventory when new stock arrives
4. Adjust fabric prices when supplier rates change
5. Check order requirements to forecast fabric needs

---

### 4. SALES_MANAGER 💼

**Description:** Customer-facing role focused on orders and customer relationships.

**Use Case:** Staff who takes orders, manages customer measurements, and tracks order fulfillment.

**Permissions:**
- ✅ View Dashboard
- ✅ View Inventory (Read-only, to check fabric availability)
- ✅ View Orders
- ✅ Create Orders
- ✅ Update Orders (Edit order details, delivery dates)
- ✅ Update Order Status
- ✅ View Customers
- ✅ Manage Customers (Add new customers, update measurements)
- ✅ View Reports (Order reports, revenue)
- ✅ View Alerts (Order delay alerts)
- ❌ Manage Inventory
- ❌ Manage Suppliers
- ❌ Delete Orders
- ❌ Manage Users
- ❌ Manage Settings

**Typical Workflow:**
1. Add new customers and record measurements
2. Create orders with fabric selection
3. Update order status as work progresses
4. Monitor order delays and customer notifications
5. View sales reports and revenue trends

---

### 5. TAILOR 👔

**Description:** Operational role for workshop staff who execute orders.

**Use Case:** Tailors who need to view order details and update work status but don't handle business operations.

**Permissions:**
- ✅ View Dashboard
- ✅ View Inventory (Read-only, to check fabric details)
- ✅ View Orders (See assigned work)
- ✅ Update Order Status (Mark cutting, stitching, finishing stages)
- ✅ View Customers (See customer details and measurements)
- ✅ View Alerts (Order-related alerts)
- ❌ Create/Delete Orders
- ❌ Manage Inventory
- ❌ Manage Customers
- ❌ Manage Suppliers
- ❌ View Reports
- ❌ Manage Users
- ❌ Manage Settings

**Typical Workflow:**
1. View assigned orders and customer measurements
2. Check fabric details for each order
3. Update status: CUTTING → STITCHING → FINISHING → READY
4. Record actual fabric used and wastage (after cutting)
5. Flag issues or delays via alerts

---

### 6. VIEWER 👁️

**Description:** Read-only access to all data without any modification capabilities.

**Use Case:** External accountants, auditors, or junior staff who need to view data for analysis or learning.

**Permissions:**
- ✅ View Dashboard
- ✅ View Inventory
- ✅ View Orders
- ✅ View Customers
- ✅ View Alerts
- ❌ Create, Update, or Delete anything
- ❌ Manage any module
- ❌ View Reports (no access to financial reports)
- ❌ Manage Users
- ❌ Manage Settings

**Use Cases:**
- External accountant reviewing order history
- Junior staff learning the system
- Quality auditor checking order fulfillment
- Business consultant analyzing operations

---

## Permission Matrix

| Permission | OWNER | ADMIN | INVENTORY_MANAGER | SALES_MANAGER | TAILOR | VIEWER |
|------------|:-----:|:-----:|:-----------------:|:-------------:|:------:|:------:|
| **Dashboard** |
| View Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Inventory** |
| View Inventory | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Add Inventory | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage Inventory | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete Inventory | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Orders** |
| View Orders | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create Order | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Update Order | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Delete Order | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Update Order Status | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| **Customers** |
| View Customers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage Customers | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Suppliers** |
| View Suppliers | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage Suppliers | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Reports** |
| View Reports | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Alerts** |
| View Alerts | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage Alerts | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **System** |
| Manage Users | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage Settings | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Implementation Details

### Permission Checking

The system uses centralized permission checking via `lib/permissions.ts`:

```typescript
import { hasPermission } from '@/lib/permissions'
import { UserRole } from '@prisma/client'

// Check single permission
if (hasPermission(user.role, 'manage_inventory')) {
  // User can manage inventory
}

// Check any permission
if (hasAnyPermission(user.role, ['create_order', 'update_order'])) {
  // User can create OR update orders
}

// Check all permissions
if (hasAllPermissions(user.role, ['view_customers', 'manage_customers'])) {
  // User can view AND manage customers
}
```

### UI Permission Guards

React components use the `PermissionGuard` component:

```typescript
import { PermissionGuard } from '@/components/auth/permission-guard'

<PermissionGuard permission="manage_inventory">
  <Button>Add New Fabric</Button>
</PermissionGuard>
```

### API Route Protection

API routes use middleware to check permissions:

```typescript
import { checkPermission } from '@/lib/api-permissions'

export async function POST(request: Request) {
  const session = await auth()
  checkPermission(session, 'create_order') // Throws error if no permission

  // Process request...
}
```

---

## Security Notes

1. **Password Hashing:** All passwords are hashed using bcrypt with 10 salt rounds
2. **Session Management:** JWT-based sessions via NextAuth.js v5
3. **Route Protection:** Middleware enforces authentication on all `/dashboard/*` routes
4. **API Security:** All API endpoints validate both authentication and permissions
5. **Default Role:** New users default to `VIEWER` role for safety
6. **Password Policy:** Consider implementing password complexity requirements in production

---

## Production Recommendations

### For Shop Owner (OWNER role)

1. **Change default password immediately** after first login
2. Create strong, unique passwords for all users
3. Regularly review user access and disable inactive accounts
4. Use ADMIN role for daily operations, reserve OWNER for critical changes
5. Enable audit logging to track who makes changes

### For System Administrators

1. Never share user credentials
2. Create separate accounts for each person (no shared logins)
3. Review permissions quarterly
4. Disable accounts when staff leave
5. Use VIEWER role for external auditors/consultants
6. Consider implementing two-factor authentication (2FA) for OWNER/ADMIN roles

### For Regular Staff

1. Log out when leaving workstation
2. Report suspicious activity immediately
3. Don't share credentials with colleagues
4. Only use permissions required for your job

---

## Testing Roles

To test different role behaviors:

1. Log in with different demo accounts
2. Navigate to various pages
3. Observe UI elements that are hidden/disabled based on permissions
4. Attempt API operations that should be blocked

Example test scenario:
- Login as `tailor@hameesattire.com`
- Navigate to Dashboard → should see order info
- Navigate to Orders → should see list but no "Create Order" button
- Click on order → should see status update dropdown
- Navigate to Inventory → should see items but no add/edit/delete buttons
- Navigate to Customers → should see list (read-only)
- Try accessing `/settings` → should redirect or show "Access Denied"

---

## Database Schema

User table structure:

```sql
CREATE TABLE "User" (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password      TEXT NOT NULL,     -- bcrypt hashed
  name          TEXT NOT NULL,
  role          UserRole DEFAULT 'VIEWER',
  phone         TEXT,
  active        BOOLEAN DEFAULT true,
  createdAt     TIMESTAMP DEFAULT NOW(),
  updatedAt     TIMESTAMP DEFAULT NOW()
);

CREATE TYPE UserRole AS ENUM (
  'OWNER',
  'ADMIN',
  'INVENTORY_MANAGER',
  'SALES_MANAGER',
  'TAILOR',
  'VIEWER'
);
```

---

## Related Files

- **Permission Logic:** `lib/permissions.ts`
- **API Helpers:** `lib/api-permissions.ts`
- **UI Guard Component:** `components/auth/permission-guard.tsx`
- **Auth Configuration:** `lib/auth.ts`
- **Middleware:** `middleware.ts`
- **Database Schema:** `prisma/schema.prisma` (lines 14-21, 95-113)

---

## Frequently Asked Questions

**Q: Can I create custom roles?**
A: Yes, but it requires code changes. Add the role to the `UserRole` enum in `schema.prisma`, update the permissions matrix in `lib/permissions.ts`, and run a database migration.

**Q: Can a user have multiple roles?**
A: No, each user has exactly one role. If someone needs varied permissions, assign them the ADMIN role or create a custom role.

**Q: What happens if I forget the OWNER password?**
A: You'll need database access to reset it. See `scripts/insert-demo-users.sql` for the password hash format.

**Q: Can VIEWER users see financial data?**
A: No, VIEWER role explicitly excludes `view_reports` permission which includes financial reports.

**Q: How do I audit who made changes?**
A: Most database tables include `userId` foreign keys that track which user performed actions. The `OrderHistory` table specifically logs all order changes with user information.

---

## Version History

- **v0.4.0** (January 2026): Initial RBAC implementation with 6 roles
- **v0.7.0** (January 2026): Enhanced with GST compliance features
- **v0.8.0** (January 2026): Added payment installment tracking

---

**Last Updated:** January 15, 2026
