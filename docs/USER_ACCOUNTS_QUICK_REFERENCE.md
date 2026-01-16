# User Accounts - Quick Reference

## 🔑 Demo Login Credentials

All users share the same password: **`admin123`**

| Role | Email | Access Level |
|------|-------|--------------|
| 👑 **OWNER** | `owner@hameesattire.com` | Full system access |
| 🔧 **ADMIN** | `admin@hameesattire.com` | Admin (no user management) |
| 📦 **INVENTORY_MANAGER** | `inventory@hameesattire.com` | Inventory & suppliers |
| 💼 **SALES_MANAGER** | `sales@hameesattire.com` | Orders & customers |
| 👔 **TAILOR** | `tailor@hameesattire.com` | Order status updates |
| 👁️ **VIEWER** | `viewer@hameesattire.com` | Read-only access |

## 🚀 Quick Start

1. Navigate to: https://hamees.gagneet.com
2. Select a user account based on role you want to test
3. Login with email and password: `admin123`
4. Explore features according to role permissions

## 📋 What Each Role Can Do

### OWNER 👑
- ✅ Everything - Complete control
- Manage users, settings, all data

### ADMIN 🔧
- ✅ Manage inventory, orders, customers, suppliers
- ❌ Cannot manage users or system settings

### INVENTORY_MANAGER 📦
- ✅ Add/edit inventory, manage suppliers
- ✅ View orders (read-only)
- ❌ Cannot create/edit orders or customers

### SALES_MANAGER 💼
- ✅ Create/edit orders, manage customers
- ✅ View inventory (read-only)
- ❌ Cannot manage inventory or suppliers

### TAILOR 👔
- ✅ Update order status (cutting → stitching → ready)
- ✅ View orders, customers, inventory
- ❌ Cannot create/edit anything

### VIEWER 👁️
- ✅ View all data (dashboard, orders, inventory, customers)
- ❌ Cannot create, edit, or delete anything

## 📚 Full Documentation

For complete permission matrix and implementation details:
- **docs/USER_ROLES_AND_PERMISSIONS.md**

---

**Last Updated:** January 15, 2026
