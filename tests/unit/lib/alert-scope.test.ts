/**
 * lib/alert-scope.ts: payment reminders (PAYMENT_REMINDER) quote balances and are hidden from roles
 * without order financial access; reorder reminders (REORDER_REMINDER) carry no amounts and stay visible.
 */
import { describe, it, expect } from 'vitest'
import { alertItemKind, alertVisibilityScope } from '@/lib/alert-scope'
import { hasFinancialAccess } from '@/lib/field-acl'
import type { UserRole } from '@/lib/permissions'

const ROLES: UserRole[] = ['OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'SALES_MANAGER', 'MASTER_TAILOR', 'TAILOR', 'VIEWER']
const HIDE_PAYMENT_REMINDERS = { NOT: { type: 'PAYMENT_REMINDER' } }

describe('alertVisibilityScope', () => {
  it('shows every alert to the owner', () => {
    expect(alertVisibilityScope('OWNER')).toEqual({})
  })

  it('hides payment reminders from inventory and production roles', () => {
    expect(alertVisibilityScope('INVENTORY_MANAGER')).toEqual(HIDE_PAYMENT_REMINDERS)
    expect(alertVisibilityScope('TAILOR')).toEqual(HIDE_PAYMENT_REMINDERS)
  })

  it('follows order financial access for every role', () => {
    for (const role of ROLES) {
      expect(alertVisibilityScope(role)).toEqual(hasFinancialAccess(role, 'order') ? {} : HIDE_PAYMENT_REMINDERS)
    }
  })

  it('never hides reorder reminders', () => {
    for (const role of ROLES) {
      expect(JSON.stringify(alertVisibilityScope(role))).not.toContain('REORDER_REMINDER')
    }
  })
})

describe('alertItemKind', () => {
  it('maps both the current and the older relatedType spellings', () => {
    expect(alertItemKind('cloth')).toBe('cloth')
    expect(alertItemKind('INVENTORY')).toBe('cloth')
    expect(alertItemKind('ClothInventory')).toBe('cloth')
    expect(alertItemKind('accessory')).toBe('accessory')
    expect(alertItemKind('AccessoryInventory')).toBe('accessory')
  })

  it('is null for alerts that do not point at a stock item', () => {
    expect(alertItemKind('order')).toBeNull()
    expect(alertItemKind(null)).toBeNull()
    expect(alertItemKind(undefined)).toBeNull()
    expect(alertItemKind('')).toBeNull()
  })
})
