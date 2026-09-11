/**
 * Per-item production status: order-status derivation and item transition rules.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  checkItemStatusTransition,
  deriveOrderStatus,
  itemProgress,
  nextStage,
  syncOrderStatus,
} from '@/lib/item-status'
import type { Actor } from '@/lib/authz'
import type { TransactionClient } from '@/lib/prisma-client'

const tailor: Actor = { id: 'ravi', role: 'TAILOR' }
const master: Actor = { id: 'meena', role: 'MASTER_TAILOR' }
const owner: Actor = { id: 'owner', role: 'OWNER' }

const own = (status: string) => ({ assignedTailorId: 'ravi', status })

describe('deriveOrderStatus', () => {
  it('is the least advanced item stage', () => {
    expect(deriveOrderStatus([{ status: 'READY' }, { status: 'CUTTING' }, { status: 'STITCHING' }])).toBe('CUTTING')
    expect(deriveOrderStatus([{ status: 'READY' }, { status: 'READY' }])).toBe('READY')
    expect(deriveOrderStatus([{ status: 'MATERIAL_SELECTED' }, { status: 'NEW' }])).toBe('NEW')
  })

  it('leaves orders without production items alone', () => {
    expect(deriveOrderStatus([])).toBeNull()
    expect(deriveOrderStatus([{ status: 'DELIVERED' }])).toBeNull()
  })

  it('ignores items already closed', () => {
    expect(deriveOrderStatus([{ status: 'CANCELLED' }, { status: 'FINISHING' }])).toBe('FINISHING')
  })
})

describe('helpers', () => {
  it('nextStage walks forward and stops at READY', () => {
    expect(nextStage('NEW')).toBe('MATERIAL_SELECTED')
    expect(nextStage('FINISHING')).toBe('READY')
    expect(nextStage('READY')).toBeNull()
    expect(nextStage('DELIVERED')).toBeNull()
  })

  it('itemProgress counts ready garments of those in production', () => {
    expect(itemProgress([{ status: 'READY' }, { status: 'CUTTING' }, { status: 'READY' }])).toEqual({ ready: 2, total: 3 })
    expect(itemProgress([{ status: 'DELIVERED' }])).toEqual({ ready: 0, total: 0 })
  })
})

describe('checkItemStatusTransition', () => {
  it('only allows production stages on items', () => {
    const r = checkItemStatusTransition(owner, own('READY'), 'DELIVERED', 'READY')
    expect(r).toMatchObject({ ok: false, status: 400 })
  })

  it('blocks changes on a delivered or cancelled order', () => {
    expect(checkItemStatusTransition(owner, own('READY'), 'FINISHING', 'DELIVERED')).toMatchObject({ ok: false, status: 400 })
    expect(checkItemStatusTransition(owner, own('NEW'), 'CUTTING', 'CANCELLED')).toMatchObject({ ok: false, status: 400 })
  })

  it("hides a colleague's item from a tailor (404)", () => {
    const item = { assignedTailorId: 'someone-else', status: 'CUTTING' }
    expect(checkItemStatusTransition(tailor, item, 'STITCHING', 'CUTTING')).toMatchObject({ ok: false, status: 404 })
    expect(checkItemStatusTransition(tailor, { assignedTailorId: null, status: 'NEW' }, 'CUTTING', 'NEW')).toMatchObject({
      ok: false,
      status: 404,
    })
  })

  it('lets a tailor move their own item forward, including skipping stages', () => {
    expect(checkItemStatusTransition(tailor, own('CUTTING'), 'STITCHING', 'CUTTING')).toEqual({ ok: true })
    expect(checkItemStatusTransition(tailor, own('NEW'), 'READY', 'NEW')).toEqual({ ok: true })
  })

  it('lets a tailor step back exactly one stage to correct a mistake', () => {
    expect(checkItemStatusTransition(tailor, own('STITCHING'), 'CUTTING', 'CUTTING')).toEqual({ ok: true })
    expect(checkItemStatusTransition(tailor, own('READY'), 'FINISHING', 'FINISHING')).toEqual({ ok: true })
    expect(checkItemStatusTransition(tailor, own('STITCHING'), 'NEW', 'NEW')).toMatchObject({ ok: false, status: 403 })
  })

  it('lets roles that see all orders move any item anywhere in production', () => {
    const colleague = { assignedTailorId: 'ravi', status: 'READY' }
    expect(checkItemStatusTransition(master, colleague, 'CUTTING', 'CUTTING')).toEqual({ ok: true })
    expect(checkItemStatusTransition(owner, { assignedTailorId: null, status: 'NEW' }, 'STITCHING', 'NEW')).toEqual({ ok: true })
  })

  it('rejects a move to the current stage', () => {
    expect(checkItemStatusTransition(tailor, own('CUTTING'), 'CUTTING', 'CUTTING')).toMatchObject({ ok: false, status: 400 })
  })
})

describe('syncOrderStatus', () => {
  function fakeTx(order: { status: string; items: { status: string }[] } | null) {
    return {
      order: { findUnique: vi.fn().mockResolvedValue(order), update: vi.fn().mockResolvedValue({}) },
      orderHistory: { create: vi.fn().mockResolvedValue({}) },
    }
  }

  it('moves the order to the least advanced item stage and records it', async () => {
    const tx = fakeTx({ status: 'CUTTING', items: [{ status: 'STITCHING' }, { status: 'READY' }] })
    const r = await syncOrderStatus(tx as unknown as TransactionClient, 'o1', 'u1')
    expect(r).toEqual({ from: 'CUTTING', to: 'STITCHING', changed: true })
    expect(tx.order.update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { status: 'STITCHING' } })
    expect(tx.orderHistory.create.mock.calls[0][0].data).toMatchObject({
      orderId: 'o1',
      changeType: 'STATUS_UPDATE',
      oldValue: 'CUTTING',
      newValue: 'STITCHING',
    })
  })

  it('does nothing when the derived status is unchanged', async () => {
    const tx = fakeTx({ status: 'CUTTING', items: [{ status: 'CUTTING' }, { status: 'READY' }] })
    expect(await syncOrderStatus(tx as unknown as TransactionClient, 'o1', 'u1')).toEqual({
      from: 'CUTTING',
      to: 'CUTTING',
      changed: false,
    })
    expect(tx.order.update).not.toHaveBeenCalled()
    expect(tx.orderHistory.create).not.toHaveBeenCalled()
  })

  it('never reopens a closed order', async () => {
    const tx = fakeTx({ status: 'DELIVERED', items: [{ status: 'NEW' }] })
    expect(await syncOrderStatus(tx as unknown as TransactionClient, 'o1', 'u1')).toBeNull()
    expect(tx.order.update).not.toHaveBeenCalled()
  })
})
