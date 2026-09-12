/**
 * Re-price orders that were discounted under the old model, where the discount was applied
 * AFTER tax (it reduced only the balance) instead of reducing the taxable value.
 *
 *   pnpm tsx scripts/reprice-discounted-orders.ts             # dry run: lists what would change
 *   pnpm tsx scripts/reprice-discounted-orders.ts --apply     # rewrite open orders
 *   pnpm tsx scripts/reprice-discounted-orders.ts --apply --include-closed
 *
 * What changes, per order:
 *   taxableAmount = subTotal − discount   (was subTotal)
 *   tax           = the order's own rate on the discounted value, split the way it was split
 *   totalAmount   = taxableAmount + tax
 *   balanceAmount = totalAmount − advancePaid − payments received (the discount is no longer
 *                   subtracted a second time, because it is now inside totalAmount)
 *
 * The customer's balance does not move: it falls by exactly the tax that is no longer charged
 * on the discounted amount, which is the point of the correction.
 *
 * DELIVERED and CANCELLED orders are SKIPPED by default. Restating a supply that has already
 * been invoiced and reported is not a data fix — the correct treatment is a credit note. Pass
 * --include-closed only if the shop has not yet filed on those periods and an accountant has
 * agreed to restate them.
 *
 * Safe to re-run: an order already priced under the new model is reported as "already correct".
 */
import 'dotenv/config' // DATABASE_URL from .env
import { Pool } from 'pg'
import { createPrismaClient } from '../lib/prisma-client'
import { repriceOrder, sumInstallmentPayments, orderBalance } from '../lib/order-pricing'
import { settingsFromRow, taxConfigFrom } from '../lib/settings-row'
import { moneyEquals } from '../lib/money'

const apply = process.argv.includes('--apply')
const includeClosed = process.argv.includes('--include-closed')

const CLOSED = ['DELIVERED', 'CANCELLED']

function money(amount: number): string {
  return amount.toFixed(2).padStart(12)
}

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL not set')

  const pool = new Pool({ connectionString })
  const prisma = createPrismaClient({ pool })

  try {
    const settings = await prisma.businessSettings.findFirst({ orderBy: { createdAt: 'asc' } })
    if (!settings) throw new Error('No BusinessSettings row: run the app once before this script')
    const taxConfig = taxConfigFrom(settingsFromRow(settings))

    const orders = await prisma.order.findMany({
      where: { discount: { gt: 0 } },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        subTotal: true,
        discount: true,
        taxableAmount: true,
        gstRate: true,
        cgst: true,
        sgst: true,
        igst: true,
        gstAmount: true,
        totalAmount: true,
        advancePaid: true,
        balanceAmount: true,
        customer: { select: { state: true } },
        installments: { select: { installmentNumber: true, paidAmount: true, notes: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    console.log(
      `${apply ? 'APPLY' : 'DRY RUN'}: ${orders.length} discounted order(s) found` +
        `${includeClosed ? ' (delivered and cancelled orders INCLUDED)' : ' (delivered and cancelled orders skipped)'}\n`
    )

    const counts = { correct: 0, skipped: 0, toUpdate: 0, updated: 0 }
    let taxRelieved = 0

    for (const order of orders) {
      const priced = repriceOrder(order.subTotal, order.discount, order, taxConfig, {
        customerRegion: order.customer.state,
      })
      const paid = sumInstallmentPayments(order.installments, order.advancePaid)
      const balanceAmount = orderBalance(priced.totalAmount, order.advancePaid, paid)

      const alreadyCorrect =
        moneyEquals(priced.taxableAmount, order.taxableAmount) &&
        moneyEquals(priced.totalAmount, order.totalAmount) &&
        moneyEquals(priced.gstAmount, order.gstAmount) &&
        moneyEquals(balanceAmount, order.balanceAmount)

      if (alreadyCorrect) {
        counts.correct++
        continue
      }

      if (CLOSED.includes(order.status) && !includeClosed) {
        counts.skipped++
        console.log(
          `SKIP  ${order.orderNumber.padEnd(26)} ${order.status.padEnd(10)} ` +
            `discount ${money(order.discount)} — already supplied; issue a credit note instead`
        )
        continue
      }

      counts.toUpdate++
      taxRelieved += order.gstAmount - priced.gstAmount
      console.log(
        `${apply ? 'FIX  ' : 'PLAN '} ${order.orderNumber.padEnd(26)} ${order.status.padEnd(10)} ` +
          `taxable ${money(order.taxableAmount)} → ${money(priced.taxableAmount)} · ` +
          `tax ${money(order.gstAmount)} → ${money(priced.gstAmount)} · ` +
          `total ${money(order.totalAmount)} → ${money(priced.totalAmount)} · ` +
          `balance ${money(order.balanceAmount)} → ${money(balanceAmount)}`
      )

      if (apply) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            taxableAmount: priced.taxableAmount,
            discount: priced.discount,
            cgst: priced.cgst,
            sgst: priced.sgst,
            igst: priced.igst,
            gstAmount: priced.gstAmount,
            totalAmount: priced.totalAmount,
            balanceAmount,
          },
          select: { id: true },
        })
        counts.updated++
      }
    }

    console.log('')
    console.log(
      `already correct ${counts.correct}, to update ${counts.toUpdate}, skipped (closed) ${counts.skipped}` +
        (apply ? `, updated ${counts.updated}` : '')
    )
    if (counts.toUpdate > 0) {
      console.log(`Tax no longer charged on discounted value: ${taxRelieved.toFixed(2)}`)
    }
    if (!apply && counts.toUpdate > 0) {
      console.log('Nothing was changed. Re-run with --apply to write these values.')
    }
    if (counts.skipped > 0) {
      console.log(
        `${counts.skipped} delivered/cancelled order(s) were left as invoiced. Restate them only ` +
          'with an accountant\'s agreement: pnpm tsx scripts/reprice-discounted-orders.ts --apply --include-closed'
      )
    }
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message.split('\n')[0] : 'reprice-discounted-orders failed')
  process.exit(1)
})
