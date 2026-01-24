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
        minimumStockMeters: true,
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
        minimumStockUnits: true,
        sku: true,
      },
    })

    let alertsCreated = 0
    let alertsResolved = 0

    // Process cloth inventory - batch query all existing alerts first
    const clothItemIds = clothItems.map(item => item.id)
    const existingClothAlerts = await prisma.alert.findMany({
      where: {
        relatedId: { in: clothItemIds },
        relatedType: 'cloth',
        isDismissed: false,
        type: {
          in: [AlertType.LOW_STOCK, AlertType.CRITICAL_STOCK],
        },
      },
    })
    
    // Create lookup map for O(1) access
    const clothAlertsMap = new Map(existingClothAlerts.map(alert => [alert.relatedId, alert]))
    
    for (const item of clothItems) {
      const available = item.currentStock - item.reserved
      const existingAlert = clothAlertsMap.get(item.id)

      // IMPORTANT: Must match dashboard and low-stock API calculations
      // Critical stock: Available <= minimum (at or below threshold)
      if (available <= item.minimumStockMeters) {
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
              title: `Critical Stock Alert: ${item.name}`,
              message: `${item.name} (${item.brand} ${item.color}) is at or below minimum threshold. Available: ${available.toFixed(2)}m, Minimum: ${item.minimumStockMeters}m`,
              relatedId: item.id,
              relatedType: 'cloth',
            },
          })
          alertsCreated++
        }
      }
      // Low stock: Available > minimum AND Available <= (minimum × 1.25) [warning zone]
      else if (available > item.minimumStockMeters && available <= item.minimumStockMeters * 1.25) {
        if (!existingAlert) {
          // Create low stock alert
          await prisma.alert.create({
            data: {
              type: AlertType.LOW_STOCK,
              severity: AlertSeverity.MEDIUM,
              title: `Low Stock Warning: ${item.name}`,
              message: `${item.name} (${item.brand} ${item.color}) is in warning zone. Available: ${available.toFixed(2)}m, Minimum: ${item.minimumStockMeters}m`,
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

    // Process accessory inventory - batch query all existing alerts first
    const accessoryItemIds = accessoryItems.map(item => item.id)
    const existingAccessoryAlerts = await prisma.alert.findMany({
      where: {
        relatedId: { in: accessoryItemIds },
        relatedType: 'accessory',
        isDismissed: false,
        type: {
          in: [AlertType.LOW_STOCK, AlertType.CRITICAL_STOCK],
        },
      },
    })
    
    // Create lookup map for O(1) access
    const accessoryAlertsMap = new Map(existingAccessoryAlerts.map(alert => [alert.relatedId, alert]))
    
    for (const item of accessoryItems) {
      const available = item.currentStock
      const existingAlert = accessoryAlertsMap.get(item.id)

      // IMPORTANT: Must match dashboard and low-stock API calculations
      // Critical stock: Available <= minimum (at or below threshold)
      if (available <= item.minimumStockUnits) {
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
              title: `Critical Stock Alert: ${item.name}`,
              message: `${item.name} (${item.type}) is at or below minimum threshold. Available: ${available} units, Minimum: ${item.minimumStockUnits} units`,
              relatedId: item.id,
              relatedType: 'accessory',
            },
          })
          alertsCreated++
        }
      }
      // Low stock: Available > minimum AND Available <= (minimum × 1.25) [warning zone]
      else if (available > item.minimumStockUnits && available <= item.minimumStockUnits * 1.25) {
        if (!existingAlert) {
          // Create low stock alert
          await prisma.alert.create({
            data: {
              type: AlertType.LOW_STOCK,
              severity: AlertSeverity.MEDIUM,
              title: `Low Stock Warning: ${item.name}`,
              message: `${item.name} (${item.type}) is in warning zone. Available: ${available} units, Minimum: ${item.minimumStockUnits} units`,
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

    // ===================
    // GENERATE ORDER ALERTS
    // ===================

    // Get overdue orders (past delivery date, not delivered/cancelled)
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const overdueOrders = await prisma.order.findMany({
      where: {
        deliveryDate: {
          lt: startOfToday,
        },
        status: {
          notIn: ['DELIVERED', 'CANCELLED'],
        },
      },
      select: {
        id: true,
        orderNumber: true,
        deliveryDate: true,
        customer: {
          select: {
            name: true,
          },
        },
      },
    })

    // Get existing overdue order alerts
    const existingOverdueAlerts = await prisma.alert.findMany({
      where: {
        relatedId: { in: overdueOrders.map(o => o.id) },
        relatedType: 'order',
        isDismissed: false,
        type: AlertType.ORDER_DELAYED,
      },
    })

    const overdueAlertsMap = new Map(existingOverdueAlerts.map(alert => [alert.relatedId, alert]))

    // Process overdue orders
    for (const order of overdueOrders) {
      if (!overdueAlertsMap.has(order.id)) {
        const daysOverdue = Math.floor((now.getTime() - order.deliveryDate.getTime()) / (1000 * 60 * 60 * 24))
        await prisma.alert.create({
          data: {
            type: AlertType.ORDER_DELAYED,
            severity: daysOverdue > 7 ? AlertSeverity.CRITICAL : AlertSeverity.HIGH,
            title: `Overdue Order: ${order.orderNumber}`,
            message: `Order ${order.orderNumber} for ${order.customer.name} is ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue. Expected delivery: ${order.deliveryDate.toLocaleDateString()}`,
            relatedId: order.id,
            relatedType: 'order',
          },
        })
        alertsCreated++
      }
    }

    // Resolve alerts for orders that are no longer overdue
    const currentOverdueIds = new Set(overdueOrders.map(o => o.id))
    for (const alert of existingOverdueAlerts) {
      if (alert.relatedId && !currentOverdueIds.has(alert.relatedId)) {
        await prisma.alert.delete({ where: { id: alert.id } })
        alertsResolved++
      }
    }

    // Get orders with pending balance (delivered but not fully paid)
    const pendingPaymentOrders = await prisma.order.findMany({
      where: {
        balanceAmount: {
          gt: 0,
        },
        status: 'DELIVERED',
      },
      select: {
        id: true,
        orderNumber: true,
        balanceAmount: true,
        deliveryDate: true,
        customer: {
          select: {
            name: true,
          },
        },
      },
    })

    // Get existing payment reminder alerts
    const existingPaymentAlerts = await prisma.alert.findMany({
      where: {
        relatedId: { in: pendingPaymentOrders.map(o => o.id) },
        relatedType: 'order',
        isDismissed: false,
        type: AlertType.REORDER_REMINDER, // Reusing REORDER_REMINDER for payment reminders
      },
    })

    const paymentAlertsMap = new Map(existingPaymentAlerts.map(alert => [alert.relatedId, alert]))

    // Process pending payments
    for (const order of pendingPaymentOrders) {
      if (!paymentAlertsMap.has(order.id)) {
        const daysSinceDelivery = Math.floor((now.getTime() - order.deliveryDate.getTime()) / (1000 * 60 * 60 * 24))
        await prisma.alert.create({
          data: {
            type: AlertType.REORDER_REMINDER,
            severity: daysSinceDelivery > 30 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
            title: `Pending Payment: ${order.orderNumber}`,
            message: `Order ${order.orderNumber} for ${order.customer.name} has pending balance of ₹${order.balanceAmount.toFixed(2)}. Delivered ${daysSinceDelivery} day${daysSinceDelivery === 1 ? '' : 's'} ago.`,
            relatedId: order.id,
            relatedType: 'order',
          },
        })
        alertsCreated++
      }
    }

    // Resolve payment alerts for orders that are now fully paid
    const currentPendingPaymentIds = new Set(pendingPaymentOrders.map(o => o.id))
    for (const alert of existingPaymentAlerts) {
      if (alert.relatedId && !currentPendingPaymentIds.has(alert.relatedId)) {
        await prisma.alert.delete({ where: { id: alert.id } })
        alertsResolved++
      }
    }

    return {
      success: true,
      alertsCreated,
      alertsResolved,
    }
  } catch (error) {
    console.error('Error generating alerts:', error)
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
