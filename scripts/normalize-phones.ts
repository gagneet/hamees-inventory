/**
 * Normalise stored phone numbers to E.164 ("+919876543210").
 *
 *   pnpm tsx scripts/normalize-phones.ts           # dry run: counts per table, changes nothing
 *   pnpm tsx scripts/normalize-phones.ts --apply   # rewrite the numbers counted as "to update"
 *
 * Numbers without a country code are read in the shop's phone region (BusinessSettings.phoneRegion).
 * Prints counts only — never phone numbers. Numbers that cannot be parsed are left unchanged and
 * counted as "invalid"; fix those by hand in the app (the forms show which ones are invalid).
 * Safe to re-run: numbers already in E.164 are not touched.
 */
import 'dotenv/config' // DATABASE_URL from .env
import { Pool } from 'pg'
import { createPrismaClient } from '../lib/prisma-client'
import { normalizePhone, toRegion } from '../lib/phone'
import { DEFAULT_PHONE_REGION } from '../lib/app-settings'

const apply = process.argv.includes('--apply')

type Row = { id: string; phone: string | null }
type Table = { name: string; load: () => Promise<Row[]>; save: (id: string, phone: string) => Promise<unknown> }

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL not set')

  const pool = new Pool({ connectionString })
  const prisma = createPrismaClient({ pool })

  try {
    const settings = await prisma.businessSettings.findFirst({ orderBy: { createdAt: 'asc' }, select: { phoneRegion: true } })
    const region = toRegion(settings?.phoneRegion) ?? DEFAULT_PHONE_REGION
    console.log(`${apply ? 'APPLY' : 'DRY RUN'}: numbers without a country code are read as ${region} numbers\n`)

    const tables: Table[] = [
      {
        name: 'Customer',
        load: () => prisma.customer.findMany({ select: { id: true, phone: true } }),
        save: (id, phone) => prisma.customer.update({ where: { id }, data: { phone }, select: { id: true } }),
      },
      {
        name: 'Supplier',
        load: () => prisma.supplier.findMany({ select: { id: true, phone: true } }),
        save: (id, phone) => prisma.supplier.update({ where: { id }, data: { phone }, select: { id: true } }),
      },
      {
        name: 'User',
        load: () => prisma.user.findMany({ select: { id: true, phone: true } }),
        save: (id, phone) => prisma.user.update({ where: { id }, data: { phone }, select: { id: true } }),
      },
      {
        name: 'BusinessSettings',
        load: () => prisma.businessSettings.findMany({ select: { id: true, phone: true } }),
        save: (id, phone) => prisma.businessSettings.update({ where: { id }, data: { phone }, select: { id: true } }),
      },
    ]

    const totals = { toUpdate: 0, invalid: 0 }
    for (const table of tables) {
      const rows = await table.load()
      const counts = { total: rows.length, empty: 0, alreadyE164: 0, toUpdate: 0, invalid: 0, updated: 0 }
      for (const row of rows) {
        if (!row.phone || !row.phone.trim()) {
          counts.empty++
          continue
        }
        const result = normalizePhone(row.phone, region)
        if (!result.ok) {
          counts.invalid++
          continue
        }
        if (result.e164 === row.phone) {
          counts.alreadyE164++
          continue
        }
        counts.toUpdate++
        if (apply) {
          await table.save(row.id, result.e164)
          counts.updated++
        }
      }
      totals.toUpdate += counts.toUpdate
      totals.invalid += counts.invalid
      console.log(
        `${table.name.padEnd(17)} total ${counts.total}, already E.164 ${counts.alreadyE164}, ` +
          `to update ${counts.toUpdate}, invalid ${counts.invalid}, empty ${counts.empty}` +
          (apply ? `, updated ${counts.updated}` : '')
      )
    }

    console.log('')
    if (!apply) {
      console.log(
        totals.toUpdate > 0
          ? `Nothing was changed. Re-run with --apply to rewrite ${totals.toUpdate} number(s).`
          : 'Nothing to update.'
      )
    }
    if (totals.invalid > 0) {
      console.log(`${totals.invalid} number(s) could not be parsed and were left unchanged; correct them in the app (customers, shop settings) or through the Excel import (suppliers).`)
    }
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((error) => {
  // First line only: never echo row data
  console.error(error instanceof Error ? error.message.split('\n')[0] : 'normalize-phones failed')
  process.exit(1)
})
