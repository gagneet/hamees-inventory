import { prisma } from '@/lib/db'
import { AlertType, AlertSeverity } from '@prisma/client'

/**
 * Generate stock alerts for low and critical inventory levels
 * This function scans cloth and accessory inventory and creates alerts
 * for items that fall below their minimum thresholds
 */
export async function generateStockAlerts() {
  try {
    // Get all cloth inventory items
    const clothItems = await prisma.clothInventory.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        brand: true,
        color: true,
        type: true,
        currentStock: true,
        reserved: true,
        minimum: true,
        sku: true,
      },
    })

    // Get all accessory inventory items
    const accessoryItems = await prisma.accessoryInventory.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        type: true,
        currentStock: true,
        minimum: true,
        sku: true,
      },
    })

    let alertsCreated = 0
    let alertsResolved = 0

    // Process cloth inventory
    for (const item of clothItems) {
      const available = item.currentStock - item.reserved

      // Check if we already have an active alert for this item
      const existingAlert = await prisma.alert.findFirst({
        where: {
          relatedId: item.id,
          relatedType: 'cloth',
          isDismissed: false,
          type: {
            in: [AlertType.LOW_STOCK, AlertType.CRITICAL_STOCK],
          },
        },
      })

      // Critical stock: Available <= minimum
      if (available <= item.minimum) {
        if (!existingAlert || existingAlert.type !== AlertType.CRITICAL_STOCK) {
          // Delete any existing low stock alert since this is now critical
          if (existingAlert) {
            await prisma.alert.delete({ where: { id: existingAlert.id } })
          }

          // Create critical stock alert
          await prisma.alert.create({
            data: {
              type: AlertType.CRITICAL_STOCK,
              severity: AlertSeverity.CRITICAL,
              title: 'Critical Stock Alert',
              message: `${item.name} (${item.brand} ${item.color}) is below minimum stock. Available: ${available.toFixed(2)}m, Minimum: ${item.minimum}m`,
              relatedId: item.id,
              relatedType: 'cloth',
            },
          })
          alertsCreated++
        }
      }
      // Low stock: Available < (minimum × 1.1) but > minimum [warning zone]
      else if (available < item.minimum * 1.1 && available > item.minimum) {
        if (!existingAlert) {
          // Create low stock alert
          await prisma.alert.create({
            data: {
              type: AlertType.LOW_STOCK,
              severity: AlertSeverity.MEDIUM,
              title: 'Low Stock Warning',
              message: `${item.name} (${item.brand} ${item.color}) is running low. Available: ${available.toFixed(2)}m, Minimum: ${item.minimum}m`,
              relatedId: item.id,
              relatedType: 'cloth',
            },
          })
          alertsCreated++
        }
      }
      // Stock is healthy, resolve any existing alerts
      else if (existingAlert) {
        await prisma.alert.delete({ where: { id: existingAlert.id } })
        alertsResolved++
      }
    }

    // Process accessory inventory
    for (const item of accessoryItems) {
      const available = item.currentStock

      // Check if we already have an active alert for this item
      const existingAlert = await prisma.alert.findFirst({
        where: {
          relatedId: item.id,
          relatedType: 'accessory',
          isDismissed: false,
          type: {
            in: [AlertType.LOW_STOCK, AlertType.CRITICAL_STOCK],
          },
        },
      })

      // Critical stock: Available <= minimum
      if (available <= item.minimum) {
        if (!existingAlert || existingAlert.type !== AlertType.CRITICAL_STOCK) {
          // Delete any existing low stock alert since this is now critical
          if (existingAlert) {
            await prisma.alert.delete({ where: { id: existingAlert.id } })
          }

          // Create critical stock alert
          await prisma.alert.create({
            data: {
              type: AlertType.CRITICAL_STOCK,
              severity: AlertSeverity.CRITICAL,
              title: 'Critical Stock Alert',
              message: `${item.name} (${item.type}) is below minimum stock. Available: ${available} units, Minimum: ${item.minimum} units`,
              relatedId: item.id,
              relatedType: 'accessory',
            },
          })
          alertsCreated++
        }
      }
      // Low stock: Available < (minimum × 1.1) but > minimum [warning zone]
      else if (available < item.minimum * 1.1 && available > item.minimum) {
        if (!existingAlert) {
          // Create low stock alert
          await prisma.alert.create({
            data: {
              type: AlertType.LOW_STOCK,
              severity: AlertSeverity.MEDIUM,
              title: 'Low Stock Warning',
              message: `${item.name} (${item.type}) is running low. Available: ${available} units, Minimum: ${item.minimum} units`,
              relatedId: item.id,
              relatedType: 'accessory',
            },
          })
          alertsCreated++
        }
      }
      // Stock is healthy, resolve any existing alerts
      else if (existingAlert) {
        await prisma.alert.delete({ where: { id: existingAlert.id } })
        alertsResolved++
      }
    }

    return {
      success: true,
      alertsCreated,
      alertsResolved,
    }
  } catch (error) {
    console.error('Error generating stock alerts:', error)
    return {
      success: false,
      alertsCreated: 0,
      alertsResolved: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Clean up old resolved/dismissed alerts
 * Removes alerts that have been dismissed or resolved for more than 30 days
 */
export async function cleanupOldAlerts() {
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const result = await prisma.alert.deleteMany({
      where: {
        OR: [
          {
            isDismissed: true,
            updatedAt: {
              lt: thirtyDaysAgo,
            },
          },
          {
            dismissedUntil: {
              not: null,
              lt: new Date(), // Dismissed until date has passed
            },
          },
        ],
      },
    })

    return {
      success: true,
      deletedCount: result.count,
    }
  } catch (error) {
    console.error('Error cleaning up old alerts:', error)
    return {
      success: false,
      deletedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
