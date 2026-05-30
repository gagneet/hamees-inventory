/**
 * Order Item Measurement API Unit Tests
 *
 * Covers:
 * - POST /api/orders/[id]/items/[itemId]/measurement
 *   - permission guard
 *   - status guards (DELIVERED/CANCELLED)
 *   - link existing measurement flow
 *   - create + link new measurement flow
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { POST } from '@/app/api/orders/[id]/items/[itemId]/measurement/route'
import { prisma } from '@/lib/db'
import * as apiPermissions from '@/lib/api-permissions'

type MockPrisma = {
  orderItem: {
    findFirst: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  measurement: {
    findFirst: ReturnType<typeof vi.fn>
  }
  $transaction: ReturnType<typeof vi.fn>
}

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/orders/order-1/items/item-1/measurement', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeContext() {
  return {
    params: Promise.resolve({ id: 'order-1', itemId: 'item-1' }),
  }
}

describe('POST /api/orders/[id]/items/[itemId]/measurement', () => {
  const mockPrisma = prisma as unknown as MockPrisma

  beforeEach(() => {
    vi.restoreAllMocks()

    mockPrisma.orderItem = {
      findFirst: vi.fn(),
      update: vi.fn(),
    }
    mockPrisma.measurement = {
      findFirst: vi.fn(),
    }
    mockPrisma.$transaction = vi.fn()

    vi.spyOn(apiPermissions, 'requireAnyPermission').mockResolvedValue({
      session: { user: { id: 'user-1', role: 'OWNER' } },
      error: null,
    } as never)
  })

  it('returns permission error when user lacks manage_measurements', async () => {
    vi.spyOn(apiPermissions, 'requireAnyPermission').mockResolvedValueOnce({
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    } as never)

    const response = await POST(makeRequest({ measurementId: 'm-1' }), makeContext())

    expect(response.status).toBe(403)
    expect(mockPrisma.orderItem.findFirst).not.toHaveBeenCalled()
  })

  it('rejects delivered orders for measurement updates', async () => {
    mockPrisma.orderItem.findFirst.mockResolvedValue({
      id: 'item-1',
      order: {
        id: 'order-1',
        customerId: 'customer-1',
        status: 'DELIVERED',
      },
    })

    const response = await POST(makeRequest({ measurementId: 'm-1' }), makeContext())
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('delivered or cancelled orders')
  })

  it('links an existing active measurement for the same customer', async () => {
    mockPrisma.orderItem.findFirst.mockResolvedValue({
      id: 'item-1',
      order: {
        id: 'order-1',
        customerId: 'customer-1',
        status: 'NEW',
      },
    })
    mockPrisma.measurement.findFirst.mockResolvedValue({
      id: 'm-1',
      garmentType: 'Sherwani',
      customerId: 'customer-1',
      isActive: true,
      createdBy: { id: 'u-1', name: 'Owner' },
    })
    mockPrisma.orderItem.update.mockResolvedValue({ id: 'item-1', measurementId: 'm-1' })

    const response = await POST(makeRequest({ measurementId: 'm-1' }), makeContext())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.measurement.id).toBe('m-1')
    expect(body.message).toContain('linked')
    expect(mockPrisma.measurement.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'm-1',
          customerId: 'customer-1',
          isActive: true,
        }),
      })
    )
    expect(mockPrisma.orderItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { measurementId: 'm-1' },
    })
  })

  it('creates and links a new measurement in a transaction', async () => {
    mockPrisma.orderItem.findFirst.mockResolvedValue({
      id: 'item-1',
      order: {
        id: 'order-1',
        customerId: 'customer-1',
        status: 'NEW',
      },
    })

    const tx = {
      measurement: {
        create: vi.fn().mockResolvedValue({
          id: 'new-measurement-1',
          garmentType: 'Sherwani',
          createdBy: { id: 'user-1', name: 'Owner' },
        }),
      },
      orderItem: {
        update: vi.fn().mockResolvedValue({ id: 'item-1', measurementId: 'new-measurement-1' }),
      },
    }

    mockPrisma.$transaction.mockImplementation(async (fn: (arg: typeof tx) => Promise<unknown>) => fn(tx))

    const response = await POST(
      makeRequest({
        garmentType: 'Sherwani',
        bodyType: 'REGULAR',
        chest: 40,
        waist: 36,
      }),
      makeContext()
    )
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.measurement.id).toBe('new-measurement-1')
    expect(tx.measurement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: 'customer-1',
          userId: 'user-1',
          garmentType: 'Sherwani',
        }),
      })
    )
    expect(tx.orderItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { measurementId: 'new-measurement-1' },
    })
  })
})
