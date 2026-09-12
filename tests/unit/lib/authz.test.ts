import { describe, it, expect } from 'vitest'
import {
  actorFromSession,
  orderScope,
  orderItemScope,
  customerScope,
  measurementScope,
  scopedWhere,
  checkStatusTransition,
  isAssignableTailor,
  type Actor,
} from '@/lib/authz'

const tailor: Actor = { id: 'tailor-1', role: 'TAILOR' }
const master: Actor = { id: 'master-1', role: 'MASTER_TAILOR' }
const sales: Actor = { id: 'sales-1', role: 'SALES_MANAGER' }
const owner: Actor = { id: 'owner-1', role: 'OWNER' }

describe('actorFromSession', () => {
  it('extracts id and role', () => {
    expect(actorFromSession({ user: { id: 'u1', role: 'TAILOR' } })).toEqual({ id: 'u1', role: 'TAILOR' })
  })
  it('returns null for missing session data', () => {
    expect(actorFromSession(null)).toBeNull()
    expect(actorFromSession({ user: { id: 'u1' } })).toBeNull()
  })
})

describe('order scope (BOLA protection)', () => {
  it('limits TAILOR to orders with an item assigned to them', () => {
    expect(orderScope(tailor)).toEqual({ items: { some: { assignedTailorId: 'tailor-1' } } })
  })

  it('does not restrict roles with view_all_orders', () => {
    expect(orderScope(master)).toEqual({})
    expect(orderScope(sales)).toEqual({})
    expect(orderScope(owner)).toEqual({})
  })

  it('derives item, customer and measurement scopes from the order scope', () => {
    expect(orderItemScope(tailor)).toEqual({ order: { items: { some: { assignedTailorId: 'tailor-1' } } } })
    expect(customerScope(tailor)).toEqual({ orders: { some: { items: { some: { assignedTailorId: 'tailor-1' } } } } })
    expect(measurementScope(tailor)).toEqual({
      customer: { orders: { some: { items: { some: { assignedTailorId: 'tailor-1' } } } } },
    })
    expect(customerScope(owner)).toEqual({})
  })
})

describe('scopedWhere', () => {
  it('AND-combines caller filters with the scope so filters cannot widen access', () => {
    const where = { OR: [{ orderNumber: { contains: 'X' } }] }
    const scope = orderScope(tailor)
    expect(scopedWhere(where, scope)).toEqual({ AND: [where, scope] })
  })

  it('returns the other side when one side is empty', () => {
    expect(scopedWhere({}, orderScope(tailor))).toEqual(orderScope(tailor))
    expect(scopedWhere({ status: 'NEW' }, {})).toEqual({ status: 'NEW' })
    expect(scopedWhere(undefined, {})).toEqual({})
  })
})

describe('checkStatusTransition', () => {
  it('lets production roles move orders through production stages', () => {
    expect(checkStatusTransition(tailor, 'CUTTING', 'STITCHING')).toEqual({ ok: true })
    expect(checkStatusTransition(master, 'FINISHING', 'READY')).toEqual({ ok: true })
  })

  it('stops production roles from delivering or cancelling orders', () => {
    const deliver = checkStatusTransition(tailor, 'READY', 'DELIVERED')
    const cancel = checkStatusTransition(master, 'NEW', 'CANCELLED')
    expect(deliver.ok).toBe(false)
    expect(cancel.ok).toBe(false)
    if (!deliver.ok) expect(deliver.status).toBe(403)
  })

  it('allows roles with update_order to deliver and cancel', () => {
    expect(checkStatusTransition(sales, 'READY', 'DELIVERED')).toEqual({ ok: true })
    expect(checkStatusTransition(owner, 'NEW', 'CANCELLED')).toEqual({ ok: true })
  })

  it('treats DELIVERED and CANCELLED as terminal for everyone', () => {
    const reopen = checkStatusTransition(owner, 'CANCELLED', 'NEW')
    const redeliver = checkStatusTransition(owner, 'DELIVERED', 'CANCELLED')
    expect(reopen.ok).toBe(false)
    expect(redeliver.ok).toBe(false)
  })

  it('rejects no-op transitions', () => {
    expect(checkStatusTransition(owner, 'NEW', 'NEW').ok).toBe(false)
  })
})

describe('isAssignableTailor', () => {
  it('accepts active tailors and master tailors', () => {
    expect(isAssignableTailor({ role: 'TAILOR', active: true })).toBe(true)
    expect(isAssignableTailor({ role: 'MASTER_TAILOR', active: true })).toBe(true)
  })
  it('rejects inactive users and other roles', () => {
    expect(isAssignableTailor({ role: 'TAILOR', active: false })).toBe(false)
    expect(isAssignableTailor({ role: 'SALES_MANAGER', active: true })).toBe(false)
    expect(isAssignableTailor(null)).toBe(false)
  })
})
