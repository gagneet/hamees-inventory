/**
 * Clean up duplicate alerts and fix relatedType inconsistency
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL not set')
}

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function cleanupDuplicateAlerts() {
  console.log('🔍 Finding duplicate alerts...\n')

  // Get all alerts
  const alerts = await prisma.alert.findMany({
    where: {
      isDismissed: false,
      type: {
        in: ['LOW_STOCK', 'CRITICAL_STOCK'],
      },
    },
    orderBy: {
      createdAt: 'asc', // Keep oldest alert
    },
  })

  console.log(`Found ${alerts.length} total active stock alerts`)

  // Group by unique key: relatedId + type
  const alertsByKey = new Map<string, typeof alerts>()

  alerts.forEach((alert) => {
    const key = `${alert.relatedId}-${alert.type}`
    if (!alertsByKey.has(key)) {
      alertsByKey.set(key, [])
    }
    alertsByKey.get(key)!.push(alert)
  })

  let duplicatesDeleted = 0
  let alertsUpdated = 0

  // Process each group
  for (const [key, groupAlerts] of alertsByKey) {
    if (groupAlerts.length > 1) {
      console.log(`\n📦 Processing ${groupAlerts.length} duplicates for key: ${key}`)

      // Keep the first (oldest) alert, delete the rest
      const [keepAlert, ...deleteAlerts] = groupAlerts

      console.log(`  ✓ Keeping alert ${keepAlert.id} (created ${keepAlert.createdAt.toISOString()})`)

      // Fix relatedType if needed
      if (keepAlert.relatedType === 'INVENTORY') {
        console.log(`  🔧 Fixing relatedType from 'INVENTORY' to 'cloth'`)
        await prisma.alert.update({
          where: { id: keepAlert.id },
          data: { relatedType: 'cloth' },
        })
        alertsUpdated++
      }

      // Delete duplicates
      for (const alert of deleteAlerts) {
        console.log(`  ❌ Deleting duplicate ${alert.id} (created ${alert.createdAt.toISOString()})`)
        await prisma.alert.delete({
          where: { id: alert.id },
        })
        duplicatesDeleted++
      }
    } else {
      // Single alert - just fix relatedType if needed
      const alert = groupAlerts[0]
      if (alert.relatedType === 'INVENTORY') {
        console.log(`\n🔧 Fixing relatedType for alert ${alert.id}`)
        await prisma.alert.update({
          where: { id: alert.id },
          data: { relatedType: 'cloth' },
        })
        alertsUpdated++
      }
    }
  }

  console.log(`\n✅ Cleanup complete!`)
  console.log(`   Duplicates deleted: ${duplicatesDeleted}`)
  console.log(`   Alerts updated: ${alertsUpdated}`)
  console.log(`   Final alert count: ${alerts.length - duplicatesDeleted}`)

  await prisma.$disconnect()
  await pool.end()
}

cleanupDuplicateAlerts().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
