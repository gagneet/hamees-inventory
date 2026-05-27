import { describe, it, expect } from 'vitest'
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getRolePermissions,
  getRoleName,
  roleDescriptions,
  type Permission,
} from '@/lib/permissions'
import type { UserRole } from '@prisma/client'

const ALL_ROLES: UserRole[] = ['OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'SALES_MANAGER', 'TAILOR', 'VIEWER']

// ─────────────────────────────────────────────────────────────
// hasPermission — OWNER expectations
// ─────────────────────────────────────────────────────────────
describe('hasPermission – OWNER', () => {
  const role: UserRole = 'OWNER'

  it('has view_dashboard', () => expect(hasPermission(role, 'view_dashboard')).toBe(true))
  it('has manage_inventory', () => expect(hasPermission(role, 'manage_inventory')).toBe(true))
  it('has create_order', () => expect(hasPermission(role, 'create_order')).toBe(true))
  it('has update_order', () => expect(hasPermission(role, 'update_order')).toBe(true))
  it('has view_expenses', () => expect(hasPermission(role, 'view_expenses')).toBe(true))
  it('has manage_expenses', () => expect(hasPermission(role, 'manage_expenses')).toBe(true))
  it('has view_reports', () => expect(hasPermission(role, 'view_reports')).toBe(true))
  it('has view_financial_reports', () => expect(hasPermission(role, 'view_financial_reports')).toBe(true))
  it('has manage_alerts', () => expect(hasPermission(role, 'manage_alerts')).toBe(true))

  // OWNER explicitly CANNOT do these
  it('does NOT have delete_inventory', () => expect(hasPermission(role, 'delete_inventory')).toBe(false))
  it('does NOT have delete_order', () => expect(hasPermission(role, 'delete_order')).toBe(false))
  it('does NOT have delete_customer', () => expect(hasPermission(role, 'delete_customer')).toBe(false))
  it('does NOT have delete_measurement', () => expect(hasPermission(role, 'delete_measurement')).toBe(false))
  it('does NOT have delete_purchase_order', () => expect(hasPermission(role, 'delete_purchase_order')).toBe(false))
  it('does NOT have delete_garment_type', () => expect(hasPermission(role, 'delete_garment_type')).toBe(false))
  it('does NOT have delete_expenses', () => expect(hasPermission(role, 'delete_expenses')).toBe(false))
  it('does NOT have manage_users', () => expect(hasPermission(role, 'manage_users')).toBe(false))
  it('does NOT have manage_settings', () => expect(hasPermission(role, 'manage_settings')).toBe(false))
  it('does NOT have bulk_upload', () => expect(hasPermission(role, 'bulk_upload')).toBe(false))
  it('does NOT have bulk_delete', () => expect(hasPermission(role, 'bulk_delete')).toBe(false))
})

// ─────────────────────────────────────────────────────────────
// hasPermission – ADMIN expectations (full access)
// ─────────────────────────────────────────────────────────────
describe('hasPermission – ADMIN', () => {
  const role: UserRole = 'ADMIN'

  it('has all delete permissions', () => {
    const deletePerms: Permission[] = [
      'delete_inventory', 'delete_order', 'delete_customer', 'delete_measurement',
      'delete_purchase_order', 'delete_garment_type', 'delete_expenses',
    ]
    for (const perm of deletePerms) {
      expect(hasPermission(role, perm), `ADMIN should have ${perm}`).toBe(true)
    }
  })

  it('has manage_users', () => expect(hasPermission(role, 'manage_users')).toBe(true))
  it('has manage_settings', () => expect(hasPermission(role, 'manage_settings')).toBe(true))
  it('has bulk_upload', () => expect(hasPermission(role, 'bulk_upload')).toBe(true))
  it('has bulk_delete', () => expect(hasPermission(role, 'bulk_delete')).toBe(true))
  it('has view_financial_reports', () => expect(hasPermission(role, 'view_financial_reports')).toBe(true))
})

// ─────────────────────────────────────────────────────────────
// hasPermission – INVENTORY_MANAGER expectations
// ─────────────────────────────────────────────────────────────
describe('hasPermission – INVENTORY_MANAGER', () => {
  const role: UserRole = 'INVENTORY_MANAGER'

  it('has view_inventory', () => expect(hasPermission(role, 'view_inventory')).toBe(true))
  it('has manage_inventory', () => expect(hasPermission(role, 'manage_inventory')).toBe(true))
  it('has view_purchase_orders', () => expect(hasPermission(role, 'view_purchase_orders')).toBe(true))
  it('has manage_purchase_orders', () => expect(hasPermission(role, 'manage_purchase_orders')).toBe(true))
  it('has view_suppliers', () => expect(hasPermission(role, 'view_suppliers')).toBe(true))
  it('has view_inventory_reports', () => expect(hasPermission(role, 'view_inventory_reports')).toBe(true))

  it('does NOT have view_orders', () => expect(hasPermission(role, 'view_orders')).toBe(false))
  it('does NOT have view_customers', () => expect(hasPermission(role, 'view_customers')).toBe(false))
  it('does NOT have view_expenses', () => expect(hasPermission(role, 'view_expenses')).toBe(false))
  it('does NOT have manage_users', () => expect(hasPermission(role, 'manage_users')).toBe(false))
  it('does NOT have delete_inventory', () => expect(hasPermission(role, 'delete_inventory')).toBe(false))
  it('does NOT have view_financial_reports', () => expect(hasPermission(role, 'view_financial_reports')).toBe(false))
})

// ─────────────────────────────────────────────────────────────
// hasPermission – SALES_MANAGER expectations
// ─────────────────────────────────────────────────────────────
describe('hasPermission – SALES_MANAGER', () => {
  const role: UserRole = 'SALES_MANAGER'

  it('has view_orders', () => expect(hasPermission(role, 'view_orders')).toBe(true))
  it('has create_order', () => expect(hasPermission(role, 'create_order')).toBe(true))
  it('has update_order', () => expect(hasPermission(role, 'update_order')).toBe(true))
  it('has view_customers', () => expect(hasPermission(role, 'view_customers')).toBe(true))
  it('has manage_customers', () => expect(hasPermission(role, 'manage_customers')).toBe(true))
  it('has manage_measurements', () => expect(hasPermission(role, 'manage_measurements')).toBe(true))
  it('has view_sales_reports', () => expect(hasPermission(role, 'view_sales_reports')).toBe(true))
  it('has view_customer_reports', () => expect(hasPermission(role, 'view_customer_reports')).toBe(true))

  it('does NOT have view_inventory (manage)', () => expect(hasPermission(role, 'manage_inventory')).toBe(false))
  it('does NOT have view_expenses', () => expect(hasPermission(role, 'view_expenses')).toBe(false))
  it('does NOT have view_purchase_orders', () => expect(hasPermission(role, 'view_purchase_orders')).toBe(false))
  it('does NOT have delete_customer', () => expect(hasPermission(role, 'delete_customer')).toBe(false))
  it('does NOT have manage_users', () => expect(hasPermission(role, 'manage_users')).toBe(false))
  it('does NOT have view_financial_reports', () => expect(hasPermission(role, 'view_financial_reports')).toBe(false))
})

// ─────────────────────────────────────────────────────────────
// hasPermission – TAILOR expectations
// ─────────────────────────────────────────────────────────────
describe('hasPermission – TAILOR', () => {
  const role: UserRole = 'TAILOR'

  it('has view_inventory', () => expect(hasPermission(role, 'view_inventory')).toBe(true))
  it('has view_orders', () => expect(hasPermission(role, 'view_orders')).toBe(true))
  it('has create_order', () => expect(hasPermission(role, 'create_order')).toBe(true))
  it('has update_order_status', () => expect(hasPermission(role, 'update_order_status')).toBe(true))
  it('has manage_measurements', () => expect(hasPermission(role, 'manage_measurements')).toBe(true))
  it('has view_purchase_orders', () => expect(hasPermission(role, 'view_purchase_orders')).toBe(true))

  it('does NOT have update_order (only status)', () => expect(hasPermission(role, 'update_order')).toBe(false))
  it('does NOT have view_expenses', () => expect(hasPermission(role, 'view_expenses')).toBe(false))
  it('does NOT have manage_customers', () => expect(hasPermission(role, 'manage_customers')).toBe(false))
  it('does NOT have manage_users', () => expect(hasPermission(role, 'manage_users')).toBe(false))
  it('does NOT have delete_order', () => expect(hasPermission(role, 'delete_order')).toBe(false))
})

// ─────────────────────────────────────────────────────────────
// hasPermission – VIEWER expectations (read-only)
// ─────────────────────────────────────────────────────────────
describe('hasPermission – VIEWER', () => {
  const role: UserRole = 'VIEWER'

  it('has view_dashboard', () => expect(hasPermission(role, 'view_dashboard')).toBe(true))
  it('has view_inventory', () => expect(hasPermission(role, 'view_inventory')).toBe(true))
  it('has view_orders', () => expect(hasPermission(role, 'view_orders')).toBe(true))
  it('has view_customers', () => expect(hasPermission(role, 'view_customers')).toBe(true))
  it('has view_alerts', () => expect(hasPermission(role, 'view_alerts')).toBe(true))

  it('does NOT have create_order', () => expect(hasPermission(role, 'create_order')).toBe(false))
  it('does NOT have manage_inventory', () => expect(hasPermission(role, 'manage_inventory')).toBe(false))
  it('does NOT have view_expenses', () => expect(hasPermission(role, 'view_expenses')).toBe(false))
  it('does NOT have manage_users', () => expect(hasPermission(role, 'manage_users')).toBe(false))
  it('does NOT have delete_inventory', () => expect(hasPermission(role, 'delete_inventory')).toBe(false))
  it('does NOT have update_order', () => expect(hasPermission(role, 'update_order')).toBe(false))
})

// ─────────────────────────────────────────────────────────────
// hasAnyPermission
// ─────────────────────────────────────────────────────────────
describe('hasAnyPermission', () => {
  it('returns true when the role has at least one of the listed permissions', () => {
    // VIEWER has view_inventory but not manage_inventory
    expect(hasAnyPermission('VIEWER', ['manage_inventory', 'view_inventory'])).toBe(true)
  })

  it('returns false when the role has none of the listed permissions', () => {
    // VIEWER has no write permissions
    expect(hasAnyPermission('VIEWER', ['manage_inventory', 'create_order', 'manage_users'])).toBe(false)
  })

  it('returns false for an empty permissions array', () => {
    expect(hasAnyPermission('ADMIN', [])).toBe(false)
  })

  it('TAILOR can assign measurements or update status', () => {
    expect(hasAnyPermission('TAILOR', ['update_order', 'update_order_status'])).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────
// hasAllPermissions
// ─────────────────────────────────────────────────────────────
describe('hasAllPermissions', () => {
  it('returns true when the role has ALL listed permissions', () => {
    expect(hasAllPermissions('ADMIN', ['delete_inventory', 'delete_order', 'manage_users'])).toBe(true)
  })

  it('returns false when the role is missing even one permission', () => {
    // OWNER has manage_inventory but NOT delete_inventory
    expect(hasAllPermissions('OWNER', ['manage_inventory', 'delete_inventory'])).toBe(false)
  })

  it('returns true for an empty permissions array (vacuously true)', () => {
    expect(hasAllPermissions('VIEWER', [])).toBe(true)
  })

  it('SALES_MANAGER has both create and update order', () => {
    expect(hasAllPermissions('SALES_MANAGER', ['create_order', 'update_order'])).toBe(true)
  })

  it('TAILOR does NOT have both create_order AND update_order', () => {
    // TAILOR has create_order but NOT update_order
    expect(hasAllPermissions('TAILOR', ['create_order', 'update_order'])).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────
// getRolePermissions
// ─────────────────────────────────────────────────────────────
describe('getRolePermissions', () => {
  it('returns a non-empty array for every role', () => {
    for (const role of ALL_ROLES) {
      const perms = getRolePermissions(role)
      expect(Array.isArray(perms), `${role} should return an array`).toBe(true)
      expect(perms.length, `${role} should have at least 1 permission`).toBeGreaterThan(0)
    }
  })

  it('ADMIN has more permissions than VIEWER', () => {
    expect(getRolePermissions('ADMIN').length).toBeGreaterThan(getRolePermissions('VIEWER').length)
  })

  it('OWNER permissions do not include any delete permissions', () => {
    const ownerPerms = getRolePermissions('OWNER')
    const deletePerms = ownerPerms.filter((p) => p.startsWith('delete_'))
    expect(deletePerms).toHaveLength(0)
  })

  it('ADMIN permissions include all delete permissions', () => {
    const adminPerms = getRolePermissions('ADMIN')
    const expected: Permission[] = [
      'delete_inventory', 'delete_order', 'delete_customer',
      'delete_measurement', 'delete_purchase_order', 'delete_garment_type', 'delete_expenses',
    ]
    for (const perm of expected) {
      expect(adminPerms, `ADMIN missing ${perm}`).toContain(perm)
    }
  })
})

// ─────────────────────────────────────────────────────────────
// getRoleName
// ─────────────────────────────────────────────────────────────
describe('getRoleName', () => {
  it('returns human-readable names for all roles', () => {
    expect(getRoleName('OWNER')).toBe('Owner')
    expect(getRoleName('ADMIN')).toBe('Administrator')
    expect(getRoleName('INVENTORY_MANAGER')).toBe('Inventory Manager')
    expect(getRoleName('SALES_MANAGER')).toBe('Sales Manager')
    expect(getRoleName('TAILOR')).toBe('Tailor')
    expect(getRoleName('VIEWER')).toBe('Viewer')
  })
})

// ─────────────────────────────────────────────────────────────
// roleDescriptions
// ─────────────────────────────────────────────────────────────
describe('roleDescriptions', () => {
  it('has a description for every role', () => {
    for (const role of ALL_ROLES) {
      expect(typeof roleDescriptions[role]).toBe('string')
      expect(roleDescriptions[role].length).toBeGreaterThan(0)
    }
  })
})

// ─────────────────────────────────────────────────────────────
// Cross-role permission exclusivity checks
// ─────────────────────────────────────────────────────────────
describe('permission exclusivity (cross-role)', () => {
  it('only ADMIN has manage_users', () => {
    for (const role of ALL_ROLES) {
      const expected = role === 'ADMIN'
      expect(hasPermission(role, 'manage_users'), `${role} manage_users should be ${expected}`).toBe(expected)
    }
  })

  it('only ADMIN has bulk_upload', () => {
    for (const role of ALL_ROLES) {
      const expected = role === 'ADMIN'
      expect(hasPermission(role, 'bulk_upload'), `${role} bulk_upload should be ${expected}`).toBe(expected)
    }
  })

  it('OWNER and ADMIN have view_financial_reports; others do not', () => {
    expect(hasPermission('OWNER', 'view_financial_reports')).toBe(true)
    expect(hasPermission('ADMIN', 'view_financial_reports')).toBe(true)
    expect(hasPermission('INVENTORY_MANAGER', 'view_financial_reports')).toBe(false)
    expect(hasPermission('SALES_MANAGER', 'view_financial_reports')).toBe(false)
    expect(hasPermission('TAILOR', 'view_financial_reports')).toBe(false)
    expect(hasPermission('VIEWER', 'view_financial_reports')).toBe(false)
  })

  it('OWNER, ADMIN, SALES_MANAGER can create orders; INVENTORY_MANAGER, TAILOR, VIEWER cannot directly update orders', () => {
    // update_order (edit order details, apply discount)
    expect(hasPermission('OWNER', 'update_order')).toBe(true)
    expect(hasPermission('ADMIN', 'update_order')).toBe(true)
    expect(hasPermission('SALES_MANAGER', 'update_order')).toBe(true)
    expect(hasPermission('TAILOR', 'update_order')).toBe(false)
    expect(hasPermission('INVENTORY_MANAGER', 'update_order')).toBe(false)
    expect(hasPermission('VIEWER', 'update_order')).toBe(false)
  })

  it('TAILOR has update_order_status but not update_order', () => {
    expect(hasPermission('TAILOR', 'update_order_status')).toBe(true)
    expect(hasPermission('TAILOR', 'update_order')).toBe(false)
  })

  it('only OWNER and ADMIN can manage expenses', () => {
    expect(hasPermission('OWNER', 'manage_expenses')).toBe(true)
    expect(hasPermission('ADMIN', 'manage_expenses')).toBe(true)
    expect(hasPermission('SALES_MANAGER', 'manage_expenses')).toBe(false)
    expect(hasPermission('INVENTORY_MANAGER', 'manage_expenses')).toBe(false)
    expect(hasPermission('TAILOR', 'manage_expenses')).toBe(false)
    expect(hasPermission('VIEWER', 'manage_expenses')).toBe(false)
  })

  it('only ADMIN can delete expenses', () => {
    for (const role of ALL_ROLES) {
      const expected = role === 'ADMIN'
      expect(hasPermission(role, 'delete_expenses'), `${role} delete_expenses should be ${expected}`).toBe(expected)
    }
  })
})
