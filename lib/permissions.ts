import { UserRole } from '@prisma/client'

// Re-export UserRole for convenience
export type { UserRole }

/**
 * Role-based access control permissions
 * Defines what each role can do in the system.
 *
 * Object-level (ABAC) rules that depend on *which* record is accessed live in
 * lib/authz.ts — e.g. a TAILOR only sees orders that have an item assigned to them.
 */

export type Permission =
  | 'view_dashboard'
  | 'view_inventory'
  | 'manage_inventory'
  | 'add_inventory'
  | 'delete_inventory'
  | 'view_orders'
  | 'view_all_orders' // Without this, order/customer access is limited to assigned work (see lib/authz.ts)
  | 'create_order'
  | 'update_order'
  | 'delete_order'
  | 'update_order_status'
  | 'record_payment'
  | 'assign_tailors'
  | 'view_production' // Tailor workload board / production oversight
  | 'view_customers'
  | 'manage_customers'
  | 'delete_customer'
  | 'manage_measurements'
  | 'delete_measurement'
  | 'view_suppliers'
  | 'manage_suppliers'
  | 'view_purchase_orders'
  | 'manage_purchase_orders'
  | 'delete_purchase_order'
  | 'view_expenses'
  | 'manage_expenses'
  | 'delete_expenses'
  | 'view_garment_types'
  | 'manage_garment_types'
  | 'delete_garment_type'
  | 'view_reports'
  | 'view_inventory_reports'
  | 'view_sales_reports'
  | 'view_customer_reports'
  | 'view_expense_reports'
  | 'view_financial_reports'
  | 'view_production_reports'
  | 'manage_users'
  | 'manage_settings'
  | 'view_alerts'
  | 'manage_alerts'
  | 'bulk_upload'
  | 'bulk_delete'

export const ALL_ROLES: UserRole[] = [
  'OWNER',
  'ADMIN',
  'INVENTORY_MANAGER',
  'SALES_MANAGER',
  'MASTER_TAILOR',
  'TAILOR',
  'VIEWER',
]

/**
 * Permission matrix for each role
 */
const rolePermissions: Record<UserRole, Permission[]> = {
  OWNER: [
    // Full access except manage_settings, user management and delete permissions
    'view_dashboard',
    'view_inventory',
    'manage_inventory',
    'add_inventory',
    // NO delete_inventory
    'view_orders',
    'view_all_orders',
    'create_order',
    'update_order',
    // NO delete_order
    'update_order_status',
    'record_payment',
    'assign_tailors',
    'view_production',
    'view_customers',
    'manage_customers',
    'manage_measurements',
    // NO delete_customer
    'view_suppliers',
    'manage_suppliers',
    'view_purchase_orders',
    'manage_purchase_orders',
    // NO delete_purchase_order
    'view_expenses',
    'manage_expenses',
    // NO delete_expenses
    'view_garment_types',
    'manage_garment_types',
    // NO delete_garment_type
    'view_reports',
    'view_inventory_reports',
    'view_sales_reports',
    'view_customer_reports',
    'view_expense_reports',
    'view_financial_reports',
    'view_production_reports',
    // NO manage_users - only ADMIN can manage users
    // NO manage_settings - cannot modify application parameters
    'view_alerts',
    'manage_alerts',
    // NO bulk_upload, NO bulk_delete
  ],
  ADMIN: [
    // Full access including settings, users, delete, and bulk upload
    'view_dashboard',
    'view_inventory',
    'manage_inventory',
    'add_inventory',
    'delete_inventory',
    'view_orders',
    'view_all_orders',
    'create_order',
    'update_order',
    'delete_order',
    'update_order_status',
    'record_payment',
    'assign_tailors',
    'view_production',
    'view_customers',
    'manage_customers',
    'delete_customer',
    'manage_measurements',
    'delete_measurement',
    'view_suppliers',
    'manage_suppliers',
    'view_purchase_orders',
    'manage_purchase_orders',
    'delete_purchase_order',
    'view_expenses',
    'manage_expenses',
    'delete_expenses',
    'view_garment_types',
    'manage_garment_types',
    'delete_garment_type',
    'view_reports',
    'view_inventory_reports',
    'view_sales_reports',
    'view_customer_reports',
    'view_expense_reports',
    'view_financial_reports',
    'view_production_reports',
    'manage_users',
    'manage_settings',
    'view_alerts',
    'manage_alerts',
    'bulk_upload',
    'bulk_delete',
  ],
  INVENTORY_MANAGER: [
    // Only inventory, POs, garments, suppliers - NO orders, customers, expenses
    'view_dashboard',
    'view_inventory',
    'manage_inventory',
    'add_inventory',
    'view_purchase_orders',
    'manage_purchase_orders',
    'view_garment_types',
    'manage_garment_types',
    'view_suppliers',
    'manage_suppliers',
    'view_reports',
    'view_inventory_reports',
    'view_alerts',
    'manage_alerts', // Acknowledge / dismiss stock alerts
  ],
  SALES_MANAGER: [
    // Orders, customers, garments - NO inventory, POs, expenses or payment amounts
    'view_dashboard',
    'view_orders',
    'view_all_orders',
    'create_order',
    'update_order',
    'update_order_status',
    'assign_tailors',
    'view_customers',
    'manage_customers',
    'manage_measurements',
    'view_garment_types',
    'manage_garment_types',
    'view_reports',
    'view_sales_reports',
    'view_customer_reports',
    'view_alerts',
  ],
  MASTER_TAILOR: [
    // Production supervisor: sees every order, assigns tailors, oversees workload. No financials.
    'view_dashboard',
    'view_inventory',
    'view_orders',
    'view_all_orders',
    'update_order_status',
    'assign_tailors',
    'view_production',
    'view_customers',
    'manage_measurements',
    'view_purchase_orders',
    'manage_purchase_orders',
    'view_garment_types',
    'view_reports',
    'view_production_reports',
    'view_alerts',
  ],
  TAILOR: [
    // Works on assigned orders only (object-level scope in lib/authz.ts). No financials.
    'view_dashboard',
    'view_inventory',
    'view_orders',
    'update_order_status',
    'view_customers',
    'manage_measurements',
    'view_purchase_orders',
    'manage_purchase_orders',
    'view_garment_types',
    'view_alerts',
  ],
  VIEWER: [
    // Read-only: dashboard, inventory, customers, orders (no financials)
    'view_dashboard',
    'view_inventory',
    'view_orders',
    'view_all_orders',
    'view_customers',
    'view_alerts',
  ],
}

/**
 * Check if a user role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false
}

/**
 * Check if a user role has any of the specified permissions
 */
export function hasAnyPermission(
  role: UserRole,
  permissions: Permission[]
): boolean {
  return permissions.some((permission) => hasPermission(role, permission))
}

/**
 * Check if a user role has all of the specified permissions
 */
export function hasAllPermissions(
  role: UserRole,
  permissions: Permission[]
): boolean {
  return permissions.every((permission) => hasPermission(role, permission))
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return rolePermissions[role] ?? []
}

/**
 * Roles whose members can be assigned production work on order items
 */
export const ASSIGNABLE_TAILOR_ROLES: UserRole[] = ['TAILOR', 'MASTER_TAILOR']

/**
 * Role descriptions for UI display
 */
export const roleDescriptions: Record<UserRole, string> = {
  OWNER: 'Full access to all features except settings, user management and delete operations',
  ADMIN: 'Full administrative access including user management, settings, and delete operations',
  INVENTORY_MANAGER: 'Manage inventory, purchase orders, garments, and suppliers only',
  SALES_MANAGER: 'Manage orders, customers, garment types and tailor assignment (no payment amounts)',
  MASTER_TAILOR: 'Supervise production: view all orders, assign tailors, monitor tailor workload and production reports (no financials)',
  TAILOR: 'Work on assigned orders only: update production status, notes and measurements (no financials)',
  VIEWER: 'Read-only access to dashboard, inventory, customers, and orders (no financials)',
}

/**
 * Get user-friendly role name
 */
export function getRoleName(role: UserRole): string {
  const names: Record<UserRole, string> = {
    OWNER: 'Owner',
    ADMIN: 'Administrator',
    INVENTORY_MANAGER: 'Inventory Manager',
    SALES_MANAGER: 'Sales Manager',
    MASTER_TAILOR: 'Master Tailor',
    TAILOR: 'Tailor',
    VIEWER: 'Viewer',
  }
  return names[role] ?? role
}
