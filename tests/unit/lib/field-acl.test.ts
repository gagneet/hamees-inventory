import { describe, it, expect } from 'vitest'
import {
  canViewField,
  getViewableFields,
  filterObjectByRole,
  filterArrayByRole,
  canViewAnyField,
  canViewAllFields,
  type EntityType,
} from '@/lib/field-acl'
import type { UserRole } from '@prisma/client'

const ALL_ROLES: UserRole[] = ['OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'SALES_MANAGER', 'TAILOR', 'VIEWER']

// ─────────────────────────────────────────────────────────────
// OWNER role — Full access to all financial fields
// ─────────────────────────────────────────────────────────────
describe('ACL – OWNER role', () => {
  const role: UserRole = 'OWNER'

  describe('Order fields', () => {
    it('can view totalAmount', () => expect(canViewField(role, 'order', 'totalAmount')).toBe(true))
    it('can view advancePaid', () => expect(canViewField(role, 'order', 'advancePaid')).toBe(true))
    it('can view discount', () => expect(canViewField(role, 'order', 'discount')).toBe(true))
    it('can view gstAmount', () => expect(canViewField(role, 'order', 'gstAmount')).toBe(true))
    it('can view stitchingTier', () => expect(canViewField(role, 'order', 'stitchingTier')).toBe(true))
  })

  describe('Order Item fields', () => {
    it('can view totalPrice', () => expect(canViewField(role, 'order_item', 'totalPrice')).toBe(true))
  })

  describe('Purchase Order fields', () => {
    it('can view totalAmount', () => expect(canViewField(role, 'purchase_order', 'totalAmount')).toBe(true))
    it('can view balanceAmount', () => expect(canViewField(role, 'purchase_order', 'balanceAmount')).toBe(true))
  })

  describe('Inventory fields', () => {
    it('can view costPerUnit', () => expect(canViewField(role, 'inventory', 'costPerUnit')).toBe(true))
    it('can view totalCost', () => expect(canViewField(role, 'inventory', 'totalCost')).toBe(true))
  })

  describe('Expense fields', () => {
    it('can view totalAmount', () => expect(canViewField(role, 'expense', 'totalAmount')).toBe(true))
    it('can view category', () => expect(canViewField(role, 'expense', 'category')).toBe(true))
  })

  describe('Report Financial fields', () => {
    it('can view summary', () => expect(canViewField(role, 'report_financial', 'summary')).toBe(true))
    it('can view financialData', () => expect(canViewField(role, 'report_financial', 'financialData')).toBe(true))
  })
})

// ─────────────────────────────────────────────────────────────
// ADMIN role — Full access (same as OWNER)
// ─────────────────────────────────────────────────────────────
describe('ACL – ADMIN role', () => {
  const role: UserRole = 'ADMIN'

  it('can view all order financial fields', () => {
    expect(canViewField(role, 'order', 'totalAmount')).toBe(true)
    expect(canViewField(role, 'order', 'advancePaid')).toBe(true)
    expect(canViewField(role, 'order', 'gstAmount')).toBe(true)
  })

  it('can view all PO financial fields', () => {
    expect(canViewField(role, 'purchase_order', 'totalAmount')).toBe(true)
    expect(canViewField(role, 'purchase_order', 'balanceAmount')).toBe(true)
  })

  it('can view all inventory financial fields', () => {
    expect(canViewField(role, 'inventory', 'costPerUnit')).toBe(true)
    expect(canViewField(role, 'inventory', 'totalCost')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────
// INVENTORY_MANAGER — Can see PO/inventory amounts, NOT order amounts
// ─────────────────────────────────────────────────────────────
describe('ACL – INVENTORY_MANAGER role', () => {
  const role: UserRole = 'INVENTORY_MANAGER'

  describe('Order fields', () => {
    it('CANNOT view order totalAmount', () => expect(canViewField(role, 'order', 'totalAmount')).toBe(false))
    it('CANNOT view order advancePaid', () => expect(canViewField(role, 'order', 'advancePaid')).toBe(false))
    it('CANNOT view order gstAmount', () => expect(canViewField(role, 'order', 'gstAmount')).toBe(false))
  })

  describe('Purchase Order fields', () => {
    it('CAN view PO totalAmount', () => expect(canViewField(role, 'purchase_order', 'totalAmount')).toBe(true))
    it('CAN view PO balanceAmount', () => expect(canViewField(role, 'purchase_order', 'balanceAmount')).toBe(true))
    it('CAN view PO paidAmount', () => expect(canViewField(role, 'purchase_order', 'paidAmount')).toBe(true))
  })

  describe('Inventory fields', () => {
    it('CAN view inventory costPerUnit', () => expect(canViewField(role, 'inventory', 'costPerUnit')).toBe(true))
    it('CAN view inventory totalCost', () => expect(canViewField(role, 'inventory', 'totalCost')).toBe(true))
  })

  describe('Expense fields', () => {
    it('CANNOT view expenses', () => expect(canViewField(role, 'expense', 'totalAmount')).toBe(false))
  })

  describe('Report fields', () => {
    it('CANNOT view financial reports', () => expect(canViewField(role, 'report_financial', 'summary')).toBe(false))
  })
})

// ─────────────────────────────────────────────────────────────
// SALES_MANAGER — Can see customer details, but NO financial data
// ─────────────────────────────────────────────────────────────
describe('ACL – SALES_MANAGER role', () => {
  const role: UserRole = 'SALES_MANAGER'

  describe('Order fields', () => {
    it('CANNOT view order totalAmount', () => expect(canViewField(role, 'order', 'totalAmount')).toBe(false))
    it('CANNOT view order advancePaid', () => expect(canViewField(role, 'order', 'advancePaid')).toBe(false))
  })

  describe('Order Item fields', () => {
    it('CANNOT view order item totalPrice', () => expect(canViewField(role, 'order_item', 'totalPrice')).toBe(false))
  })

  describe('Customer fields', () => {
    it('CANNOT view customer totalRevenue', () => expect(canViewField(role, 'customer', 'totalRevenue')).toBe(false))
    it('CANNOT view customer outstandingAmount', () => expect(canViewField(role, 'customer', 'outstandingAmount')).toBe(false))
  })

  describe('Purchase Order fields', () => {
    it('CANNOT view PO amounts', () => expect(canViewField(role, 'purchase_order', 'totalAmount')).toBe(false))
  })

  describe('Inventory fields', () => {
    it('CANNOT view inventory costs', () => expect(canViewField(role, 'inventory', 'costPerUnit')).toBe(false))
  })

  describe('Expense fields', () => {
    it('CANNOT view expenses', () => expect(canViewField(role, 'expense', 'totalAmount')).toBe(false))
  })
})

// ─────────────────────────────────────────────────────────────
// TAILOR — Can create POs but CANNOT see amounts/prices (clerk role)
// ─────────────────────────────────────────────────────────────
describe('ACL – TAILOR role', () => {
  const role: UserRole = 'TAILOR'

  describe('Order fields', () => {
    it('CANNOT view order totalAmount', () => expect(canViewField(role, 'order', 'totalAmount')).toBe(false))
    it('CANNOT view order advancePaid', () => expect(canViewField(role, 'order', 'advancePaid')).toBe(false))
    it('CANNOT view order gstAmount', () => expect(canViewField(role, 'order', 'gstAmount')).toBe(false))
  })

  describe('Purchase Order fields', () => {
    it('CANNOT view PO totalAmount', () => expect(canViewField(role, 'purchase_order', 'totalAmount')).toBe(false))
    it('CANNOT view PO balanceAmount', () => expect(canViewField(role, 'purchase_order', 'balanceAmount')).toBe(false))
    it('CANNOT view PO paidAmount', () => expect(canViewField(role, 'purchase_order', 'paidAmount')).toBe(false))
  })

  describe('Inventory fields', () => {
    it('CANNOT view inventory costs', () => expect(canViewField(role, 'inventory', 'costPerUnit')).toBe(false))
  })

  describe('Expense fields', () => {
    it('CANNOT view expenses', () => expect(canViewField(role, 'expense', 'totalAmount')).toBe(false))
  })
})

// ─────────────────────────────────────────────────────────────
// VIEWER — Read-only, minimal financial access
// ─────────────────────────────────────────────────────────────
describe('ACL – VIEWER role', () => {
  const role: UserRole = 'VIEWER'

  it('CANNOT view order financial fields', () => {
    expect(canViewField(role, 'order', 'totalAmount')).toBe(false)
    expect(canViewField(role, 'order', 'advancePaid')).toBe(false)
  })

  it('CANNOT view PO financial fields', () => {
    expect(canViewField(role, 'purchase_order', 'totalAmount')).toBe(false)
  })

  it('CANNOT view inventory costs', () => {
    expect(canViewField(role, 'inventory', 'costPerUnit')).toBe(false)
  })

  it('CANNOT view expenses', () => {
    expect(canViewField(role, 'expense', 'totalAmount')).toBe(false)
  })

  it('CANNOT view financial reports', () => {
    expect(canViewField(role, 'report_financial', 'summary')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────
// getViewableFields — Get all fields for a role
// ─────────────────────────────────────────────────────────────
describe('getViewableFields', () => {
  it('returns all order fields for OWNER', () => {
    const fields = getViewableFields('OWNER', 'order')
    expect(fields).toContain('totalAmount')
    expect(fields).toContain('advancePaid')
    expect(fields).toContain('gstAmount')
  })

  it('returns empty array for TAILOR on orders', () => {
    const fields = getViewableFields('TAILOR', 'order')
    expect(fields).toEqual([])
  })

  it('returns PO fields for INVENTORY_MANAGER', () => {
    const fields = getViewableFields('INVENTORY_MANAGER', 'purchase_order')
    expect(fields).toContain('totalAmount')
    expect(fields).toContain('balanceAmount')
  })
})

// ─────────────────────────────────────────────────────────────
// filterObjectByRole — Filtering objects
// ─────────────────────────────────────────────────────────────
describe('filterObjectByRole', () => {
  const order = {
    id: '123',
    status: 'NEW',
    totalAmount: 5000,
    advancePaid: 2000,
    discount: 500,
    gstAmount: 500,
    customerId: 'cust-1',
  }

  it('OWNER sees all fields', () => {
    const filtered = filterObjectByRole(order, 'OWNER', 'order')
    expect(filtered.totalAmount).toBe(5000)
    expect(filtered.advancePaid).toBe(2000)
    expect(filtered.customerId).toBe('cust-1')
  })

  it('TAILOR does NOT see financial fields', () => {
    const filtered = filterObjectByRole(order, 'TAILOR', 'order')
    expect(filtered.totalAmount).toBeUndefined()
    expect(filtered.advancePaid).toBeUndefined()
    expect(filtered.discount).toBeUndefined()
    expect(filtered.gstAmount).toBeUndefined()
    expect(filtered.customerId).toBe('cust-1') // Non-financial field still present
    expect(filtered.status).toBe('NEW')
    expect(filtered.id).toBe('123')
  })

  it('INVENTORY_MANAGER does NOT see order financial fields', () => {
    const filtered = filterObjectByRole(order, 'INVENTORY_MANAGER', 'order')
    expect(filtered.totalAmount).toBeUndefined()
    expect(filtered.advancePaid).toBeUndefined()
  })

  it('SALES_MANAGER does NOT see order financial fields', () => {
    const filtered = filterObjectByRole(order, 'SALES_MANAGER', 'order')
    expect(filtered.totalAmount).toBeUndefined()
  })

  it('handles null/undefined gracefully', () => {
    expect(filterObjectByRole(null, 'OWNER', 'order')).toEqual({})
    expect(filterObjectByRole(undefined, 'OWNER', 'order')).toEqual({})
  })

  describe('Purchase Order filtering', () => {
    const po = {
      id: 'po-123',
      supplierId: 'sup-1',
      totalAmount: 10000,
      balanceAmount: 5000,
      paidAmount: 5000,
      status: 'PENDING',
    }

    it('INVENTORY_MANAGER can see PO amounts', () => {
      const filtered = filterObjectByRole(po, 'INVENTORY_MANAGER', 'purchase_order')
      expect(filtered.totalAmount).toBe(10000)
      expect(filtered.balanceAmount).toBe(5000)
    })

    it('TAILOR CANNOT see PO amounts', () => {
      const filtered = filterObjectByRole(po, 'TAILOR', 'purchase_order')
      expect(filtered.totalAmount).toBeUndefined()
      expect(filtered.balanceAmount).toBeUndefined()
      expect(filtered.id).toBe('po-123')
      expect(filtered.status).toBe('PENDING')
    })

    it('SALES_MANAGER CANNOT see PO amounts', () => {
      const filtered = filterObjectByRole(po, 'SALES_MANAGER', 'purchase_order')
      expect(filtered.totalAmount).toBeUndefined()
      expect(filtered.balanceAmount).toBeUndefined()
    })
  })
})

// ─────────────────────────────────────────────────────────────
// filterArrayByRole — Filtering arrays of objects
// ─────────────────────────────────────────────────────────────
describe('filterArrayByRole', () => {
  const orders = [
    { id: '1', totalAmount: 5000, customerId: 'c1' },
    { id: '2', totalAmount: 3000, customerId: 'c2' },
  ]

  it('filters all objects in array', () => {
    const filtered = filterArrayByRole(orders, 'TAILOR', 'order')
    expect(filtered).toHaveLength(2)
    expect(filtered[0].totalAmount).toBeUndefined()
    expect(filtered[1].totalAmount).toBeUndefined()
    expect(filtered[0].id).toBe('1')
  })

  it('handles null/undefined arrays', () => {
    expect(filterArrayByRole(null, 'OWNER', 'order')).toEqual([])
    expect(filterArrayByRole(undefined, 'OWNER', 'order')).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────
// canViewAnyField / canViewAllFields — Multi-field checks
// ─────────────────────────────────────────────────────────────
describe('canViewAnyField', () => {
  it('returns true if role can view ANY of the fields', () => {
    expect(canViewAnyField('OWNER', 'order', ['totalAmount', 'unknownField'])).toBe(true)
  })

  it('returns false if role cannot view ANY of the fields', () => {
    expect(canViewAnyField('TAILOR', 'order', ['totalAmount', 'advancePaid'])).toBe(false)
  })
})

describe('canViewAllFields', () => {
  it('returns true if role can view ALL fields', () => {
    expect(canViewAllFields('OWNER', 'order', ['totalAmount', 'advancePaid'])).toBe(true)
  })

  it('returns false if role cannot view even one field', () => {
    expect(canViewAllFields('OWNER', 'order', ['totalAmount', 'unknownField'])).toBe(false)
  })

  it('returns false for TAILOR (no order financial fields)', () => {
    expect(canViewAllFields('TAILOR', 'order', ['totalAmount'])).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────
// Comprehensive role comparison
// ─────────────────────────────────────────────────────────────
describe('Role comparison – Order financial fields', () => {
  const financialFields = ['totalAmount', 'advancePaid', 'gstAmount', 'discount']

  it('OWNER can see all order financial fields', () => {
    financialFields.forEach((field) => {
      expect(canViewField('OWNER', 'order', field)).toBe(true)
    })
  })

  it('ADMIN can see all order financial fields', () => {
    financialFields.forEach((field) => {
      expect(canViewField('ADMIN', 'order', field)).toBe(true)
    })
  })

  it('INVENTORY_MANAGER cannot see any order financial fields', () => {
    financialFields.forEach((field) => {
      expect(canViewField('INVENTORY_MANAGER', 'order', field)).toBe(false)
    })
  })

  it('SALES_MANAGER cannot see any order financial fields', () => {
    financialFields.forEach((field) => {
      expect(canViewField('SALES_MANAGER', 'order', field)).toBe(false)
    })
  })

  it('TAILOR cannot see any order financial fields', () => {
    financialFields.forEach((field) => {
      expect(canViewField('TAILOR', 'order', field)).toBe(false)
    })
  })

  it('VIEWER cannot see any order financial fields', () => {
    financialFields.forEach((field) => {
      expect(canViewField('VIEWER', 'order', field)).toBe(false)
    })
  })
})

describe('Role comparison – PO financial fields', () => {
  const poFields = ['totalAmount', 'balanceAmount', 'paidAmount']

  it('OWNER and ADMIN can see all PO financial fields', () => {
    ;(['OWNER', 'ADMIN'] as const).forEach((role) => {
      poFields.forEach((field) => {
        expect(canViewField(role, 'purchase_order', field)).toBe(true)
      })
    })
  })

  it('Only INVENTORY_MANAGER and OWNER/ADMIN can see PO financial fields', () => {
    const ownerRoles = ['OWNER', 'ADMIN', 'INVENTORY_MANAGER'] as const

    ownerRoles.forEach((role) => {
      poFields.forEach((field) => {
        expect(canViewField(role, 'purchase_order', field)).toBe(true)
      })
    })
  })

  it('SALES_MANAGER, TAILOR, and VIEWER cannot see PO financial fields', () => {
    const restrictedRoles = ['SALES_MANAGER', 'TAILOR', 'VIEWER'] as const

    restrictedRoles.forEach((role) => {
      poFields.forEach((field) => {
        expect(canViewField(role, 'purchase_order', field)).toBe(false)
      })
    })
  })
})
