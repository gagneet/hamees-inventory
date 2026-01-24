/**
 * Diagnostic script to check stock levels and alert issues
 */
import { prisma } from '../lib/db'

async function diagnoseStockIssues() {
  console.log('=== STOCK DIAGNOSIS ===\n')

  // Check cloth inventory
  const clothItems = await prisma.clothInventory.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      brand: true,
      color: true,
      currentStock: true,
      reserved: true,
      minimumStockMeters: true,
    },
  })

  console.log(`Total active cloth items: ${clothItems.length}\n`)

  let lowStockCount = 0
  let criticalStockCount = 0

  clothItems.forEach((item) => {
    const available = item.currentStock - item.reserved
    const threshold = item.minimumStockMeters * 1.1

    const status =
      available <= item.minimumStockMeters ? 'CRITICAL' :
      available < threshold && available > item.minimumStockMeters ? 'LOW' :
      'HEALTHY'

    if (status !== 'HEALTHY') {
      console.log(`${item.name} (${item.brand} ${item.color})`)
      console.log(`  Current: ${item.currentStock.toFixed(2)}m | Reserved: ${item.reserved.toFixed(2)}m | Available: ${available.toFixed(2)}m`)
      console.log(`  Minimum: ${item.minimumStockMeters.toFixed(2)}m | Threshold (1.1×): ${threshold.toFixed(2)}m`)
      console.log(`  Status: ${status}`)
      console.log('')

      if (status === 'LOW') lowStockCount++
      if (status === 'CRITICAL') criticalStockCount++
    }
  })

  console.log(`\nLow Stock Count: ${lowStockCount}`)
  console.log(`Critical Stock Count: ${criticalStockCount}`)

  // Check for duplicate alerts
  console.log('\n\n=== ALERT DIAGNOSIS ===\n')

  const alerts = await prisma.alert.findMany({
    where: {
      isDismissed: false,
      type: {
        in: ['LOW_STOCK', 'CRITICAL_STOCK'],
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  console.log(`Total active stock alerts: ${alerts.length}\n`)

  // Group by relatedId to find duplicates
  const alertsByItem = new Map<string, typeof alerts>()

  alerts.forEach((alert) => {
    if (!alert.relatedId) return

    if (!alertsByItem.has(alert.relatedId)) {
      alertsByItem.set(alert.relatedId, [])
    }
    alertsByItem.get(alert.relatedId)!.push(alert)
  })

  // Find duplicates
  const duplicates: string[] = []
  alertsByItem.forEach((itemAlerts, relatedId) => {
    if (itemAlerts.length > 1) {
      duplicates.push(relatedId)
      console.log(`DUPLICATE ALERTS for ${relatedId}:`)
      itemAlerts.forEach((alert) => {
        console.log(`  - ${alert.type} (${alert.severity}) created ${alert.createdAt.toISOString()}`)
        console.log(`    ${alert.message}`)
      })
      console.log('')
    }
  })

  if (duplicates.length === 0) {
    console.log('✓ No duplicate alerts found')
  } else {
    console.log(`\n⚠️ Found ${duplicates.length} items with duplicate alerts`)
  }

  await prisma.$disconnect()
}

diagnoseStockIssues().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
