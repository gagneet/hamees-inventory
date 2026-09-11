import { describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'
import { encodeMoneyArgs, moneyFieldsByModel } from '@/lib/money-codec'
import { moneyResultFields } from '@/lib/prisma-client'

const clientToModel = (name: string) => name.charAt(0).toUpperCase() + name.slice(1)

describe('money field list', () => {
  it('the typed read extension covers exactly the BigInt money columns in the schema', () => {
    const fromExtension: Record<string, string[]> = {}
    for (const [client, fields] of Object.entries(moneyResultFields)) {
      fromExtension[clientToModel(client)] = Object.keys(fields).sort()
    }
    expect(fromExtension).toEqual(moneyFieldsByModel())
  })

  it('stores no non-money data in BigInt columns', () => {
    // Quantities, rates and percentages stay Float/Int; only amounts are BigInt minor units
    for (const model of Prisma.dmmf.datamodel.models) {
      for (const field of model.fields) {
        if (field.type !== 'BigInt') continue
        expect(field.name).toMatch(/amount|price|cost|paid|discount|total|charge|fee|premium|gst|tax|advance|balance|sgst|cgst|igst|override/i)
      }
    }
  })
})

describe('encodeMoneyArgs', () => {
  it('converts money filters, including logical and relation filters', () => {
    const args = {
      where: {
        totalAmount: { gt: 100.5, in: [1, 2.5] },
        balanceAmount: { not: { lt: 0.01 } },
        OR: [{ discount: 0 }, { advancePaid: { gte: 10 } }],
        items: { some: { totalPrice: 10 } },
        customer: { orders: { none: { totalAmount: 1 } } },
        notes: { contains: '5' },
      },
    }
    expect(encodeMoneyArgs('Order', 'findMany', args)).toEqual({
      where: {
        totalAmount: { gt: 10050n, in: [100n, 250n] },
        balanceAmount: { not: { lt: 1n } },
        OR: [{ discount: 0n }, { advancePaid: { gte: 1000n } }],
        items: { some: { totalPrice: 1000n } },
        customer: { orders: { none: { totalAmount: 100n } } },
        notes: { contains: '5' },
      },
    })
  })

  it('converts to-one relation filters given directly or with is/isNot', () => {
    expect(encodeMoneyArgs('OrderItem', 'findMany', { where: { order: { totalAmount: 5 } } })).toEqual({
      where: { order: { totalAmount: 500n } },
    })
    expect(encodeMoneyArgs('OrderItem', 'findMany', { where: { order: { isNot: { balanceAmount: 0.5 } } } })).toEqual({
      where: { order: { isNot: { balanceAmount: 50n } } },
    })
  })

  it('converts create data and nested creates, leaving quantities alone', () => {
    const encoded = encodeMoneyArgs('PurchaseOrder', 'create', {
      data: {
        poNumber: 'PO-1',
        totalAmount: 39.98,
        balanceAmount: 0.1 + 0.2,
        items: {
          create: [{ itemName: 'Linen', itemType: 'CLOTH', orderedQuantity: 1.5, unit: 'm', pricePerUnit: 19.99, totalPrice: 29.99 }],
        },
      },
    })
    expect(encoded).toEqual({
      data: {
        poNumber: 'PO-1',
        totalAmount: 3998n,
        balanceAmount: 30n,
        items: {
          create: [{ itemName: 'Linen', itemType: 'CLOTH', orderedQuantity: 1.5, unit: 'm', pricePerUnit: 1999n, totalPrice: 2999n }],
        },
      },
    })
  })

  it('converts set/increment/decrement but not multiply/divide factors', () => {
    expect(
      encodeMoneyArgs('PurchaseOrder', 'update', {
        where: { id: 'po1' },
        data: { paidAmount: { increment: 0.3 }, balanceAmount: { decrement: 0.3 }, totalAmount: { multiply: 2 }, subTotal: { set: 1 } },
      })
    ).toEqual({
      where: { id: 'po1' },
      data: { paidAmount: { increment: 30n }, balanceAmount: { decrement: 30n }, totalAmount: { multiply: 2 }, subTotal: { set: 100n } },
    })
  })

  it('converts nested update, updateMany, upsert, connectOrCreate and deleteMany', () => {
    const encoded = encodeMoneyArgs('Order', 'update', {
      where: { id: 'o1' },
      data: {
        items: {
          update: [{ where: { id: 'i1' }, data: { totalPrice: 1 } }],
          updateMany: { where: { pricePerUnit: { lt: 2 } }, data: { pricePerUnit: 2 } },
          deleteMany: { totalPrice: 0 },
        },
        installments: {
          upsert: { where: { id: 'p1' }, create: { installmentAmount: 5, paidAmount: 5 }, update: { paidAmount: 6 } },
        },
        customer: { update: { name: 'A' } },
      },
    }) as { data: Record<string, any> }
    expect(encoded.data.items.update[0]).toEqual({ where: { id: 'i1' }, data: { totalPrice: 100n } })
    expect(encoded.data.items.updateMany).toEqual({ where: { pricePerUnit: { lt: 200n } }, data: { pricePerUnit: 200n } })
    expect(encoded.data.items.deleteMany).toEqual({ totalPrice: 0n })
    expect(encoded.data.installments.upsert).toEqual({
      where: { id: 'p1' },
      create: { installmentAmount: 500n, paidAmount: 500n },
      update: { paidAmount: 600n },
    })
    expect(encoded.data.customer).toEqual({ update: { name: 'A' } })

    expect(
      encodeMoneyArgs('Supplier', 'update', {
        where: { id: 's1' },
        data: { purchaseOrders: { connectOrCreate: { where: { id: 'x' }, create: { poNumber: 'P', totalAmount: 1, balanceAmount: 1 } } } },
      })
    ).toEqual({
      where: { id: 's1' },
      data: { purchaseOrders: { connectOrCreate: { where: { id: 'x' }, create: { poNumber: 'P', totalAmount: 100n, balanceAmount: 100n } } } },
    })
  })

  it('converts createMany data arrays and top-level upsert', () => {
    expect(encodeMoneyArgs('Expense', 'createMany', { data: [{ amount: 1, totalAmount: 1.18 }] })).toEqual({
      data: [{ amount: 100n, totalAmount: 118n }],
    })
    expect(
      encodeMoneyArgs('ClothInventory', 'upsert', { where: { sku: 'A' }, create: { pricePerMeter: 450 }, update: { pricePerMeter: 475.5 } })
    ).toEqual({ where: { sku: 'A' }, create: { pricePerMeter: 45000n }, update: { pricePerMeter: 47550n } })
  })

  it('converts where filters inside include/select and _count', () => {
    expect(
      encodeMoneyArgs('Order', 'findUnique', {
        where: { id: 'o1' },
        include: {
          installments: { where: { paidAmount: { gt: 0.5 } } },
          items: { include: { order: { select: { id: true } } } },
          _count: { select: { installments: { where: { paidAmount: 0 } } } },
        },
      })
    ).toEqual({
      where: { id: 'o1' },
      include: {
        installments: { where: { paidAmount: { gt: 50n } } },
        items: { include: { order: { select: { id: true } } } },
        _count: { select: { installments: { where: { paidAmount: 0n } } } },
      },
    })
  })

  it('converts groupBy having filters on money aggregates', () => {
    expect(
      encodeMoneyArgs('Order', 'groupBy', { by: ['status'], having: { totalAmount: { _sum: { gt: 1000 } } } })
    ).toEqual({ by: ['status'], having: { totalAmount: { _sum: { gt: 100000n } } } })
  })

  it('passes bigint (already minor units), null and non-money fields through, without mutating the input', () => {
    const args = { where: { totalAmount: 500n, fabricCostOverride: null, gstRate: 12 }, data: { discount: 250n } }
    const snapshot = JSON.parse(JSON.stringify(args, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v)))
    expect(encodeMoneyArgs('Order', 'updateMany', args)).toEqual(args)
    expect(JSON.parse(JSON.stringify(args, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v)))).toEqual(snapshot)

    const withNumbers = { where: { totalAmount: { gt: 1 } } }
    encodeMoneyArgs('Order', 'count', withNumbers)
    expect(withNumbers).toEqual({ where: { totalAmount: { gt: 1 } } })
  })

  it('ignores models without money and unknown models', () => {
    const args = { where: { email: 'a@b.c' } }
    expect(encodeMoneyArgs('User', 'findUnique', args)).toEqual(args)
    expect(encodeMoneyArgs(undefined, '$queryRaw', args)).toBe(args)
  })
})
