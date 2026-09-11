/**
 * Fix Split Order Installments
 *
 * Migration strategy:
 * - Identify split orders via notes: "Split from order <orderNumber>"
 * - For each split pair (original + child), keep installments on the original order
 * - If total PAID on original exceeds original total amount, move the excess to the split order
 * - Recompute installmentAmount on both orders to show balance due at time of payment
 * - Recompute balanceAmount using: totalAmount - discount - totalPaidInstallments
 *
 * Run: pnpm tsx scripts/fix-split-order-installments.ts
 */

import { prisma } from '../lib/db'

const roundCurrency = (value: number) => parseFloat(value.toFixed(2))

const getInstallmentStatus = (
  paidAmount: number,
  installmentAmount: number,
  dueDate: Date,
  currentStatus: string
) => {
  if (currentStatus === 'CANCELLED') return 'CANCELLED'
  if (paidAmount <= 0) return dueDate < new Date() ? 'OVERDUE' : 'PENDING'
  if (paidAmount >= installmentAmount) return 'PAID'
  return 'PARTIAL'
}

const recalcInstallmentAmounts = async (orderId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      installments: {
        orderBy: {
          installmentNumber: 'asc',
        },
      },
    },
  })

  if (!order) return

  let runningBalance = order.totalAmount

  for (const installment of order.installments) {
    const paidAmount = roundCurrency(installment.paidAmount || 0)
    const installmentAmount = roundCurrency(Math.max(0, runningBalance))
    runningBalance = roundCurrency(runningBalance - paidAmount)

    await prisma.paymentInstallment.update({
      where: { id: installment.id },
      data: {
        installmentAmount,
        status: getInstallmentStatus(
          paidAmount,
          installmentAmount,
          installment.dueDate,
          installment.status
        ),
      },
    })
  }

  const paidInstallments = await prisma.paymentInstallment.aggregate({
    where: {
      orderId,
      status: 'PAID',
    },
    _sum: {
      paidAmount: true,
    },
  })
  const totalPaidInstallments = paidInstallments._sum.paidAmount || 0
  const balanceAmount = roundCurrency(order.totalAmount - (order.discount || 0) - totalPaidInstallments)

  await prisma.order.update({
    where: { id: orderId },
    data: {
      balanceAmount,
    },
  })
}

async function fixSplitOrderInstallments() {
  console.log('🔧 Starting split order installment normalization...\n')

  const splitOrders = await prisma.order.findMany({
    where: {
      notes: {
        contains: 'Split from order',
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      orderNumber: true,
      notes: true,
      totalAmount: true,
      discount: true,
    },
  })

  if (splitOrders.length === 0) {
    console.log('No split orders found. Exiting.')
    return
  }

  console.log(`Found ${splitOrders.length} split orders.\n`)

  for (const splitOrder of splitOrders) {
    const match = splitOrder.notes?.match(/Split from order\s+([^\s]+)/i)
    if (!match) continue

    const originalOrderNumber = match[1]
    const originalOrder = await prisma.order.findUnique({
      where: { orderNumber: originalOrderNumber },
      include: {
        installments: {
          orderBy: {
            installmentNumber: 'asc',
          },
        },
      },
    })

    if (!originalOrder) {
      console.warn(`⚠️  Original order not found for split order ${splitOrder.orderNumber}`)
      continue
    }

    console.log(`Processing split pair: ${originalOrder.orderNumber} → ${splitOrder.orderNumber}`)

    const paidInstallments = originalOrder.installments
      .filter((installment) => installment.status === 'PAID')
    const totalPaidOriginal = paidInstallments.reduce((sum, inst) => sum + inst.paidAmount, 0)

    const overpayment = roundCurrency(Math.max(0, totalPaidOriginal - originalOrder.totalAmount))

    if (overpayment > 0) {
      const lastPaid = paidInstallments[paidInstallments.length - 1]
      const adjustedPaidAmount = roundCurrency(lastPaid.paidAmount - overpayment)

      await prisma.$transaction(async (tx) => {
        await tx.paymentInstallment.update({
          where: { id: lastPaid.id },
          data: {
            paidAmount: adjustedPaidAmount,
            status: getInstallmentStatus(
              adjustedPaidAmount,
              lastPaid.installmentAmount,
              lastPaid.dueDate,
              lastPaid.status
            ),
          },
        })

        const nextInstallmentNumber = await tx.paymentInstallment.count({
          where: { orderId: splitOrder.id },
        }).then((count) => count + 1)

        await tx.paymentInstallment.create({
          data: {
            orderId: splitOrder.id,
            installmentNumber: nextInstallmentNumber,
            installmentAmount: splitOrder.totalAmount,
            dueDate: lastPaid.dueDate,
            paidDate: lastPaid.paidDate,
            paidAmount: overpayment,
            paymentMode: lastPaid.paymentMode,
            transactionRef: lastPaid.transactionRef,
            status: 'PAID',
            notes: `Allocated overpayment from ${originalOrder.orderNumber}`,
          },
        })
      })

      console.log(`  ✓ Moved overpayment ₹${overpayment.toFixed(2)} to ${splitOrder.orderNumber}`)
    } else {
      console.log('  ✓ No overpayment to allocate')
    }

    await recalcInstallmentAmounts(originalOrder.id)
    await recalcInstallmentAmounts(splitOrder.id)
  }

  console.log('\n✅ Split order installment normalization completed.')
}

fixSplitOrderInstallments()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error('❌ Script failed:', error)
    await prisma.$disconnect()
    process.exit(1)
  })
