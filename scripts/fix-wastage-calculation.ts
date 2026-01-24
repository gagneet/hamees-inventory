/**
 * Fix Wastage Calculation Script
 *
 * This script recalculates wastage for all order items that have actualMetersUsed
 * but wastage = 0 (indicating it wasn't auto-calculated previously).
 *
 * Wastage = actualMetersUsed - estimatedMeters
 *
 * Run: pnpm tsx scripts/fix-wastage-calculation.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function fixWastageCalculation() {
  try {
    console.log('🔍 Finding order items with actualMetersUsed but incorrect wastage...')

    // Find all order items where actualMetersUsed is set but wastage is 0
    const itemsToFix = await prisma.orderItem.findMany({
      where: {
        actualMetersUsed: {
          not: null,
        },
        // Find items where wastage is incorrect (0 when it shouldn't be)
        // This will catch items where actualMetersUsed !== estimatedMeters but wastage = 0
      },
      select: {
        id: true,
        estimatedMeters: true,
        actualMetersUsed: true,
        wastageMeters: true,
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
    })

    console.log(`📊 Found ${itemsToFix.length} order items with actualMetersUsed recorded`)

    // Filter items that need fixing (where wastage should be recalculated)
    const itemsNeedingFix = itemsToFix.filter((item) => {
      const expectedWastage = (item.actualMetersUsed || 0) - item.estimatedMeters
      const currentWastage = item.wastageMeters || 0
      // Fix if there's a difference (allowing for small floating point errors)
      return Math.abs(expectedWastage - currentWastage) > 0.001
    })

    console.log(`🔧 ${itemsNeedingFix.length} items need wastage recalculation`)

    if (itemsNeedingFix.length === 0) {
      console.log('✅ All wastage calculations are already correct!')
      return
    }

    // Show some examples before fixing
    console.log('\n📋 Examples of items to fix:')
    itemsNeedingFix.slice(0, 5).forEach((item) => {
      const expectedWastage = (item.actualMetersUsed || 0) - item.estimatedMeters
      console.log(
        `  Order ${item.order.orderNumber}: Est=${item.estimatedMeters}m, Actual=${item.actualMetersUsed}m, ` +
        `Current Wastage=${item.wastageMeters || 0}m → Should be ${expectedWastage.toFixed(2)}m`
      )
    })

    // Ask for confirmation (in production, you might want to add a --force flag)
    console.log(`\n⚠️  About to update ${itemsNeedingFix.length} order items`)

    // Update each item with correct wastage
    let fixed = 0
    for (const item of itemsNeedingFix) {
      const correctWastage = (item.actualMetersUsed || 0) - item.estimatedMeters

      await prisma.orderItem.update({
        where: { id: item.id },
        data: {
          wastageMeters: correctWastage,
        },
      })

      fixed++
      if (fixed % 10 === 0) {
        console.log(`  ✓ Fixed ${fixed}/${itemsNeedingFix.length} items...`)
      }
    }

    console.log(`\n✅ Successfully recalculated wastage for ${fixed} order items!`)

    // Show summary statistics
    const totalEstimated = itemsNeedingFix.reduce((sum, item) => sum + item.estimatedMeters, 0)
    const totalActual = itemsNeedingFix.reduce((sum, item) => sum + (item.actualMetersUsed || 0), 0)
    const totalWastage = totalActual - totalEstimated

    console.log('\n📈 Summary:')
    console.log(`  Total Estimated: ${totalEstimated.toFixed(2)}m`)
    console.log(`  Total Actual Used: ${totalActual.toFixed(2)}m`)
    console.log(`  Total Wastage: ${totalWastage >= 0 ? '+' : ''}${totalWastage.toFixed(2)}m`)
    console.log(`  Efficiency: ${((totalEstimated - Math.abs(totalWastage)) / totalEstimated * 100).toFixed(2)}%`)

  } catch (error) {
    console.error('❌ Error fixing wastage calculation:', error)
    throw error
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

// Run the script
fixWastageCalculation()
  .then(() => {
    console.log('\n🎉 Wastage calculation fix complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Script failed:', error)
    process.exit(1)
  })
