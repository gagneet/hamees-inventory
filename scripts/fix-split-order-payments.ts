/**
 * Fix Split Order Payment Installments
 *
 * This script fixes orders where split operations left incorrect installment amounts,
 * causing balance calculations to be wrong.
 *
 * Issue: After split, installments retain OLD paid amounts from before split
 * Solution: Sync Order.advancePaid with PaymentInstallment #1, recalculate balances
 *
 * Usage: pnpm tsx scripts/fix-split-order-payments.ts
 */

import { prisma } from '../lib/db'
import { readFileSync } from 'fs'
import { join } from 'path'

async function main() {
  console.log('🔧 Starting payment installment fix...\n')

  try {
    // Step 1: Find orders with mismatched advance payments
    console.log('Step 1: Checking for mismatched advance payments...')
    const mismatched = await prisma.$queryRaw<Array<{
      orderNumber: string
      order_advance: number
      installment_paid: number
      difference: number
    }>>`
      SELECT
        o."orderNumber",
        o."advancePaid" as order_advance,
        pi."paidAmount" as installment_paid,
        ABS(o."advancePaid" - pi."paidAmount") as difference
      FROM "Order" o
      INNER JOIN "PaymentInstallment" pi
        ON pi."orderId" = o.id
        AND pi."installmentNumber" = 1
      WHERE ABS(o."advancePaid" - pi."paidAmount") > 0.01
        AND o.status NOT IN ('CANCELLED')
      ORDER BY difference DESC
    `

    if (mismatched.length === 0) {
      console.log('✓ No mismatched advance payments found!\n')
    } else {
      console.log(`⚠️  Found ${mismatched.length} orders with mismatched advance payments:\n`)
      for (const order of mismatched.slice(0, 10)) {
        console.log(
          `  ${order.orderNumber}: ` +
          `Order.advancePaid = ₹${Number(order.order_advance).toFixed(2)}, ` +
          `Installment #1 = ₹${Number(order.installment_paid).toFixed(2)}, ` +
          `Diff = ₹${Number(order.difference).toFixed(2)}`
        )
      }
      if (mismatched.length > 10) {
        console.log(`  ... and ${mismatched.length - 10} more\n`)
      } else {
        console.log('')
      }
    }

    // Step 2: Find orders with incorrect balance calculations
    console.log('Step 2: Checking for incorrect balance calculations...')
    const wrongBalance = await prisma.$queryRaw<Array<{
      orderNumber: string
      current_balance: number
      expected_balance: number
      difference: number
    }>>`
      WITH order_payments AS (
        SELECT
          o.id,
          o."orderNumber",
          o."totalAmount",
          o."discount",
          o."balanceAmount" as current_balance,
          COALESCE(SUM(pi."paidAmount"), 0) as total_paid
        FROM "Order" o
        LEFT JOIN "PaymentInstallment" pi
          ON pi."orderId" = o.id
          AND pi.status = 'PAID'
        WHERE o.status NOT IN ('CANCELLED')
        GROUP BY o.id
      )
      SELECT
        "orderNumber",
        current_balance,
        ROUND(CAST("totalAmount" - "discount" - total_paid AS numeric), 2) as expected_balance,
        ABS(ROUND(CAST("totalAmount" - "discount" - total_paid AS numeric), 2) - current_balance) as difference
      FROM order_payments
      WHERE ABS(ROUND(CAST("totalAmount" - "discount" - total_paid AS numeric), 2) - current_balance) > 0.01
      ORDER BY difference DESC
    `

    if (wrongBalance.length === 0) {
      console.log('✓ All balance calculations are correct!\n')
    } else {
      console.log(`⚠️  Found ${wrongBalance.length} orders with incorrect balance:\n`)
      for (const order of wrongBalance.slice(0, 10)) {
        console.log(
          `  ${order.orderNumber}: ` +
          `Current = ₹${Number(order.current_balance).toFixed(2)}, ` +
          `Expected = ₹${Number(order.expected_balance).toFixed(2)}, ` +
          `Diff = ₹${Number(order.difference).toFixed(2)}`
        )
      }
      if (wrongBalance.length > 10) {
        console.log(`  ... and ${wrongBalance.length - 10} more\n`)
      } else {
        console.log('')
      }
    }

    // Ask for confirmation before proceeding
    if (mismatched.length === 0 && wrongBalance.length === 0) {
      console.log('✅ No fixes needed! All orders are correct.')
      return
    }

    console.log('\n⚠️  WARNING: This will update the database!')
    console.log('   - Fix mismatched advance payments')
    console.log('   - Recalculate balance amounts')
    console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...')

    await new Promise(resolve => setTimeout(resolve, 5000))

    console.log('\n🔧 Applying fixes...\n')

    // Execute the SQL migration
    const sqlPath = join(process.cwd(), 'prisma/migrations/fix_payment_installments_after_split.sql')
    const sql = readFileSync(sqlPath, 'utf8')

    // Split SQL into individual statements and execute
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (let i = 0; i < statements.length; i++) {
      console.log(`Executing statement ${i + 1}/${statements.length}...`)
      await prisma.$executeRawUnsafe(statements[i])
    }

    console.log('\n✅ Migration completed successfully!')

    // Step 3: Verify fixes
    console.log('\nStep 3: Verifying fixes...')
    const stillMismatched = await prisma.$queryRaw<Array<any>>`
      SELECT COUNT(*) as count
      FROM "Order" o
      INNER JOIN "PaymentInstallment" pi
        ON pi."orderId" = o.id
        AND pi."installmentNumber" = 1
      WHERE ABS(o."advancePaid" - pi."paidAmount") > 0.01
        AND o.status NOT IN ('CANCELLED')
    `

    const stillWrongBalance = await prisma.$queryRaw<Array<any>>`
      WITH order_payments AS (
        SELECT
          o.id,
          o."balanceAmount",
          ROUND(CAST(o."totalAmount" - o."discount" - COALESCE(SUM(pi."paidAmount"), 0) AS numeric), 2) as expected
        FROM "Order" o
        LEFT JOIN "PaymentInstallment" pi
          ON pi."orderId" = o.id
          AND pi.status = 'PAID'
        WHERE o.status NOT IN ('CANCELLED')
        GROUP BY o.id
      )
      SELECT COUNT(*) as count
      FROM order_payments
      WHERE ABS(expected - "balanceAmount") > 0.01
    `

    const remaining = Number(stillMismatched[0].count) + Number(stillWrongBalance[0].count)

    if (remaining === 0) {
      console.log('✅ All issues fixed successfully!')
    } else {
      console.log(`⚠️  ${remaining} issues still remain. Manual intervention may be needed.`)
    }

  } catch (error) {
    console.error('❌ Error during migration:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })
