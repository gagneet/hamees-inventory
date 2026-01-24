/**
 * Fix Installment Amounts Migration Script
 *
 * This script updates existing PaymentInstallment records to show the correct
 * balance due at the time of payment, rather than just the payment amount.
 *
 * Logic:
 * - Installment #1: installmentAmount = total order amount (customer's commitment)
 * - Installment #2+: installmentAmount = balance remaining after previous payments
 *
 * Run with: pnpm tsx scripts/fix-installment-amounts.ts
 */

import { prisma } from '../lib/db'

async function fixInstallmentAmounts() {
  console.log('🔧 Starting installment amounts fix...\n')

  try {
    // Get all orders with installments
    const orders = await prisma.order.findMany({
      include: {
        installments: {
          orderBy: {
            installmentNumber: 'asc',
          },
        },
      },
      where: {
        installments: {
          some: {},
        },
      },
    })

    console.log(`Found ${orders.length} orders with installments\n`)

    let totalUpdated = 0

    for (const order of orders) {
      console.log(`Processing Order ${order.orderNumber}:`)
      console.log(`  Total Amount: ₹${order.totalAmount.toFixed(2)}`)
      console.log(`  Advance Paid: ₹${order.advancePaid.toFixed(2)}`)
      console.log(`  Current Balance: ₹${order.balanceAmount.toFixed(2)}`)
      console.log(`  Installments: ${order.installments.length}`)

      let runningBalance = order.totalAmount

      for (const installment of order.installments) {
        const oldAmount = installment.installmentAmount

        // For first installment, show total order amount
        // For subsequent installments, show balance at that point
        let newAmount: number

        if (installment.installmentNumber === 1) {
          newAmount = order.totalAmount
        } else {
          // Balance before this payment = previous running balance
          newAmount = runningBalance
        }

        // Update running balance
        runningBalance = runningBalance - installment.paidAmount

        // Only update if amount changed
        if (Math.abs(oldAmount - newAmount) > 0.01) {
          await prisma.paymentInstallment.update({
            where: { id: installment.id },
            data: {
              installmentAmount: parseFloat(newAmount.toFixed(2)),
            },
          })

          console.log(`  ✓ Installment #${installment.installmentNumber}:`)
          console.log(`    Old: ₹${oldAmount.toFixed(2)} → New: ₹${newAmount.toFixed(2)}`)
          console.log(`    Paid: ₹${installment.paidAmount.toFixed(2)}`)
          totalUpdated++
        } else {
          console.log(`  ✓ Installment #${installment.installmentNumber}: No change needed`)
        }
      }

      console.log(`  Final balance: ₹${runningBalance.toFixed(2)}\n`)
    }

    console.log(`\n✅ Migration completed!`)
    console.log(`   Total orders processed: ${orders.length}`)
    console.log(`   Total installments updated: ${totalUpdated}`)
  } catch (error) {
    console.error('❌ Error during migration:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the migration
fixInstallmentAmounts()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })
