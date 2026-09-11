/**
 * lib/alert-scope.ts: payment reminders (PAYMENT_REMINDER) quote balances and are hidden from roles
 * without order financial access; reorder reminders (REORDER_REMINDER) carry no amounts and stay visible.
 */
import { describe, it, expect } from 'vitest'
import { alertVisibilityScope } from '@/lib/alert-scope'
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
