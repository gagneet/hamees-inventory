/**
 * Fix Specific Split Order Payment Issue
 *
 * Order ORD-1769338355430-738 (original) was split into ORD-1769340093159-602
 * The payment installment was not properly split, causing negative balance
 *
 * Fix:
 * 1. Update original order's installment to correct amount
 * 2. Create installment on split order for its advance payment
 * 3. Recalculate balances for both orders
 */

import { prisma } from '../lib/db'

const roundCurrency = (value: number) => parseFloat(value.toFixed(2))

async function fixSpecificSplitOrder() {
  console.log('🔧 Fixing specific split order payment issue...\n')

  try {
    // Get original order
    const originalOrder = await prisma.order.findUnique({
      where: { orderNumber: 'ORD-1769338355430-738' },
      include: { installments: true },
    })

    if (!originalOrder) {
      console.error('❌ Original order not found')
      return
    }

    // Get split order
    const splitOrder = await prisma.order.findUnique({
      where: { orderNumber: 'ORD-1769340093159-602' },
    })

    if (!splitOrder) {
      console.error('❌ Split order not found')
      return
    }

    console.log(`Original order: ${originalOrder.orderNumber}`)
    console.log(`  Total: ₹${originalOrder.totalAmount.toFixed(2)}`)
    console.log(`  Advance: ₹${originalOrder.advancePaid.toFixed(2)}`)
    console.log(`  Current Balance: ₹${originalOrder.balanceAmount.toFixed(2)}`)

    console.log(`\nSplit order: ${splitOrder.orderNumber}`)
    console.log(`  Total: ₹${splitOrder.totalAmount.toFixed(2)}`)
    console.log(`  Advance: ₹${splitOrder.advancePaid.toFixed(2)}`)
    console.log(`  Current Balance: ₹${splitOrder.balanceAmount.toFixed(2)}`)

    // Get the existing installment on original order
    const originalInstallment = originalOrder.installments[0]
    if (!originalInstallment) {
      console.error('❌ No installment found on original order')
      return
    }

    console.log(`\nExisting installment on original:`)
    console.log(`  Amount: ₹${originalInstallment.installmentAmount.toFixed(2)}`)
    console.log(`  Paid: ₹${originalInstallment.paidAmount.toFixed(2)}`)
    console.log(`  Status: ${originalInstallment.status}`)

    await prisma.$transaction(async (tx) => {
      // 1. Update original order's installment to show correct installmentAmount
      await tx.paymentInstallment.update({
        where: { id: originalInstallment.id },
        data: {
          installmentAmount: originalOrder.totalAmount,
          paidAmount: originalOrder.advancePaid, // Should match advancePaid
        },
      })

      console.log(`\n✓ Updated original order installment:`)
      console.log(`  New installmentAmount: ₹${originalOrder.totalAmount.toFixed(2)}`)
      console.log(`  New paidAmount: ₹${originalOrder.advancePaid.toFixed(2)}`)

      // 2. Create installment on split order for its advance payment
      await tx.paymentInstallment.create({
        data: {
          orderId: splitOrder.id,
          installmentNumber: 1,
          installmentAmount: splitOrder.totalAmount,
          dueDate: originalInstallment.dueDate,
          paidDate: originalInstallment.paidDate,
          paidAmount: splitOrder.advancePaid,
          paymentMode: originalInstallment.paymentMode,
          transactionRef: originalInstallment.transactionRef,
          status: 'PAID',
          notes: `Advance payment from split of ${originalOrder.orderNumber}`,
        },
      })

      console.log(`\n✓ Created installment on split order:`)
      console.log(`  installmentAmount: ₹${splitOrder.totalAmount.toFixed(2)}`)
      console.log(`  paidAmount: ₹${splitOrder.advancePaid.toFixed(2)}`)

      // 3. Recalculate balances
      const originalBalance = roundCurrency(
        originalOrder.totalAmount - originalOrder.discount - originalOrder.advancePaid
      )
      const splitBalance = roundCurrency(
        splitOrder.totalAmount - splitOrder.discount - splitOrder.advancePaid
      )

      await tx.order.update({
        where: { id: originalOrder.id },
        data: { balanceAmount: originalBalance },
      })

      await tx.order.update({
        where: { id: splitOrder.id },
        data: { balanceAmount: splitBalance },
      })

      console.log(`\n✓ Recalculated balances:`)
      console.log(`  Original order balance: ₹${originalBalance.toFixed(2)}`)
      console.log(`  Split order balance: ₹${splitBalance.toFixed(2)}`)
    })

    console.log('\n✅ Split order payment issue fixed successfully!')

    // Verify the fix
    const verifyOriginal = await prisma.order.findUnique({
      where: { id: originalOrder.id },
      include: { installments: true },
    })

    const verifySplit = await prisma.order.findUnique({
      where: { id: splitOrder.id },
      include: { installments: true },
    })

    console.log('\n📊 Verification:')
    console.log(`\nOriginal order ${verifyOriginal?.orderNumber}:`)
    console.log(`  Total: ₹${verifyOriginal?.totalAmount.toFixed(2)}`)
    console.log(`  Balance: ₹${verifyOriginal?.balanceAmount.toFixed(2)}`)
    console.log(`  Installments: ${verifyOriginal?.installments.length}`)

    console.log(`\nSplit order ${verifySplit?.orderNumber}:`)
    console.log(`  Total: ₹${verifySplit?.totalAmount.toFixed(2)}`)
    console.log(`  Balance: ₹${verifySplit?.balanceAmount.toFixed(2)}`)
    console.log(`  Installments: ${verifySplit?.installments.length}`)

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  }
}

fixSpecificSplitOrder()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error('❌ Script failed:', error)
    await prisma.$disconnect()
    process.exit(1)
  })
