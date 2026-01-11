import { UserRole } from '@prisma/client'

/**
 * Role-based access control permissions
 * Defines what each role can do in the system
 */

export type Permission =
  | 'view_dashboard'
  | 'view_inventory'
  | 'manage_inventory'
  | 'add_inventory'
  | 'delete_inventory'
  | 'view_orders'
  | 'create_order'
  | 'update_order'
  | 'delete_order'
  | 'update_order_status'
  | 'view_customers'
  | 'manage_customers'
  | 'view_suppliers'
  | 'manage_suppliers'
  | 'view_reports'
  | 'manage_users'
  | 'manage_settings'
  | 'view_alerts'
  | 'manage_alerts'

/**
 * Permission matrix for each role
 */
const rolePermissions: Record<UserRole, Permission[]> = {
  OWNER: [
    'view_dashboard',
    'view_inventory',
    'manage_inventory',
    'add_inventory',
    'delete_inventory',
    'view_orders',
    'create_order',
    'update_order',
    'delete_order',
    'update_order_status',
    'view_customers',
    'manage_customers',
    'view_suppliers',
    'manage_suppliers',
    'view_reports',
    'manage_users',
    'manage_settings',
    'view_alerts',
    'manage_alerts',
  ],
  ADMIN: [
    'view_dashboard',
    'view_inventory',
    'manage_inventory',
    'add_inventory',
    'delete_inventory',
    'view_orders',
    'create_order',
    'update_order',
    'delete_order',
    'update_order_status',
    'view_customers',
    'manage_customers',
    'view_suppliers',
    'manage_suppliers',
    'view_reports',
    'view_alerts',
    'manage_alerts',
  ],
  INVENTORY_MANAGER: [
    'view_dashboard',
    'view_inventory',
    'manage_inventory',
    'add_inventory',
    'view_orders',
    'view_customers',
    'view_suppliers',
    'manage_suppliers',
    'view_alerts',
  ],
  SALES_MANAGER: [
    'view_dashboard',
    'view_inventory',
    'view_orders',
    'create_order',
    'update_order',
    'update_order_status',
    'view_customers',
    'manage_customers',
    'view_reports',
    'view_alerts',
  ],
  TAILOR: [
    'view_dashboard',
    'view_inventory',
    'view_orders',
    'update_order_status',
    'view_customers',
    'view_alerts',
  ],
  VIEWER: [
    'view_dashboard',
    'view_inventory',
    'view_orders',
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
 * Role descriptions for UI display
 */
export const roleDescriptions: Record<UserRole, string> = {
  OWNER: 'Full system access with all permissions',
  ADMIN: 'Administrative access excluding user management',
  INVENTORY_MANAGER: 'Manage inventory and suppliers',
  SALES_MANAGER: 'Manage orders and customers',
  TAILOR: 'Update order status and view information',
  VIEWER: 'Read-only access to all data',
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
    TAILOR: 'Tailor',
    VIEWER: 'Viewer',
  }
  return names[role]
}
