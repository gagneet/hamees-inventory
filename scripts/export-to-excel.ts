import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import ExcelJS from 'exceljs'
import * as fs from 'fs'
import * as path from 'path'

// Database connection
const connectionString = process.env.DATABASE_URL || 'postgresql://hamees_user:hamees_secure_2026@localhost:5432/tailor_inventory?schema=public'
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

interface TableConfig {
  name: string
  sheetName: string
  fetchData: () => Promise<any[]>
  columns: Array<{ key: string; header: string; width?: number }>
  notes?: string
}

async function exportToExcel() {
  console.log('Starting Excel export...')

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Hamees Inventory System'
  workbook.created = new Date()

  // Define table configurations with export order (dependencies first)
  const tables: TableConfig[] = [
    // 1. Users (no dependencies)
    {
      name: 'User',
      sheetName: '1. Users',
      fetchData: async () => {
        const users = await prisma.user.findMany({
          orderBy: { createdAt: 'asc' }
        })
        return users.map(u => ({
          id: u.id,
          email: u.email,
          password: u.password,
          name: u.name,
          role: u.role,
          phone: u.phone || '',
          active: u.active,
          createdAt: u.createdAt.toISOString(),
          updatedAt: u.updatedAt.toISOString()
        }))
      },
      columns: [
        { key: 'id', header: 'ID', width: 30 },
        { key: 'email', header: 'Email', width: 30 },
        { key: 'password', header: 'Password (Hashed)', width: 60 },
        { key: 'name', header: 'Name', width: 25 },
        { key: 'role', header: 'Role', width: 20 },
        { key: 'phone', header: 'Phone', width: 15 },
        { key: 'active', header: 'Active', width: 10 },
        { key: 'createdAt', header: 'Created At', width: 20 },
        { key: 'updatedAt', header: 'Updated At', width: 20 }
      ],
      notes: 'Roles: OWNER, ADMIN, INVENTORY_MANAGER, SALES_MANAGER, TAILOR, VIEWER'
    },

    // 2. Suppliers (no dependencies)
    {
      name: 'Supplier',
      sheetName: '2. Suppliers',
      fetchData: async () => {
        const suppliers = await prisma.supplier.findMany({
          orderBy: { createdAt: 'asc' }
        })
        return suppliers.map(s => ({
          id: s.id,
          name: s.name,
          contactPerson: s.contactPerson || '',
          email: s.email || '',
          phone: s.phone,
          address: s.address || '',
          city: s.city || '',
          state: s.state || '',
          pincode: s.pincode || '',
          gstin: s.gstin || '',
          rating: s.rating,
          notes: s.notes || '',
          active: s.active,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString()
        }))
      },
      columns: [
        { key: 'id', header: 'ID', width: 30 },
        { key: 'name', header: 'Name', width: 25 },
        { key: 'contactPerson', header: 'Contact Person', width: 25 },
        { key: 'email', header: 'Email', width: 30 },
        { key: 'phone', header: 'Phone', width: 15 },
        { key: 'address', header: 'Address', width: 40 },
        { key: 'city', header: 'City', width: 20 },
        { key: 'state', header: 'State', width: 20 },
        { key: 'pincode', header: 'Pincode', width: 10 },
        { key: 'gstin', header: 'GSTIN', width: 20 },
        { key: 'rating', header: 'Rating', width: 10 },
        { key: 'notes', header: 'Notes', width: 40 },
        { key: 'active', header: 'Active', width: 10 },
        { key: 'createdAt', header: 'Created At', width: 20 },
        { key: 'updatedAt', header: 'Updated At', width: 20 }
      ]
    },

    // 3. Cloth Inventory (depends on Supplier)
    {
      name: 'ClothInventory',
      sheetName: '3. Cloth Inventory',
      fetchData: async () => {
        const items = await prisma.clothInventory.findMany({
          orderBy: { createdAt: 'asc' }
        })
        return items.map(i => ({
          id: i.id,
          sku: i.sku,
          name: i.name,
          brand: i.brand,
          color: i.color,
          colorHex: i.colorHex,
          pattern: i.pattern,
          quality: i.quality,
          type: i.type,
          pricePerMeter: i.pricePerMeter,
          currentStock: i.currentStock,
          totalPurchased: i.totalPurchased,
          reserved: i.reserved,
          minimum: i.minimum,
          supplier: i.supplier,
          supplierId: i.supplierId || '',
          location: i.location || '',
          notes: i.notes || '',
          active: i.active,
          createdAt: i.createdAt.toISOString(),
          updatedAt: i.updatedAt.toISOString()
        }))
      },
      columns: [
        { key: 'id', header: 'ID', width: 30 },
        { key: 'sku', header: 'SKU', width: 20 },
        { key: 'name', header: 'Name', width: 25 },
        { key: 'brand', header: 'Brand', width: 20 },
        { key: 'color', header: 'Color', width: 15 },
        { key: 'colorHex', header: 'Color Hex', width: 10 },
        { key: 'pattern', header: 'Pattern', width: 15 },
        { key: 'quality', header: 'Quality', width: 15 },
        { key: 'type', header: 'Type', width: 15 },
        { key: 'pricePerMeter', header: 'Price/Meter', width: 12 },
        { key: 'currentStock', header: 'Current Stock', width: 12 },
        { key: 'totalPurchased', header: 'Total Purchased', width: 15 },
        { key: 'reserved', header: 'Reserved', width: 12 },
        { key: 'minimum', header: 'Minimum', width: 12 },
        { key: 'supplier', header: 'Supplier Name', width: 25 },
        { key: 'supplierId', header: 'Supplier ID (FK)', width: 30 },
        { key: 'location', header: 'Location', width: 20 },
        { key: 'notes', header: 'Notes', width: 40 },
        { key: 'active', header: 'Active', width: 10 },
        { key: 'createdAt', header: 'Created At', width: 20 },
        { key: 'updatedAt', header: 'Updated At', width: 20 }
      ],
      notes: 'Types: Cotton, Silk, Linen, Wool, etc. | Patterns: Plain, Striped, Checkered | Quality: Premium, Standard, Economy'
    },

    // 4. Accessory Inventory (depends on Supplier)
    {
      name: 'AccessoryInventory',
      sheetName: '4. Accessories',
      fetchData: async () => {
        const items = await prisma.accessoryInventory.findMany({
          orderBy: { createdAt: 'asc' }
        })
        return items.map(i => ({
          id: i.id,
          name: i.name,
          type: i.type,
          color: i.color || '',
          currentStock: i.currentStock,
          minimum: i.minimum,
          pricePerUnit: i.pricePerUnit,
          supplier: i.supplier || '',
          supplierId: i.supplierId || '',
          active: i.active,
          createdAt: i.createdAt.toISOString(),
          updatedAt: i.updatedAt.toISOString()
        }))
      },
      columns: [
        { key: 'id', header: 'ID', width: 30 },
        { key: 'name', header: 'Name', width: 25 },
        { key: 'type', header: 'Type', width: 20 },
        { key: 'color', header: 'Color', width: 15 },
        { key: 'currentStock', header: 'Current Stock', width: 12 },
        { key: 'minimum', header: 'Minimum', width: 12 },
        { key: 'pricePerUnit', header: 'Price/Unit', width: 12 },
        { key: 'supplier', header: 'Supplier Name', width: 25 },
        { key: 'supplierId', header: 'Supplier ID (FK)', width: 30 },
        { key: 'active', header: 'Active', width: 10 },
        { key: 'createdAt', header: 'Created At', width: 20 },
        { key: 'updatedAt', header: 'Updated At', width: 20 }
      ],
      notes: 'Types: Button, Thread, Zipper, etc.'
    },

    // 5. Customers (no dependencies)
    {
      name: 'Customer',
      sheetName: '5. Customers',
      fetchData: async () => {
        const customers = await prisma.customer.findMany({
          orderBy: { createdAt: 'asc' }
        })
        return customers.map(c => ({
          id: c.id,
          name: c.name,
          email: c.email || '',
          phone: c.phone,
          address: c.address || '',
          city: c.city || '',
          state: c.state || '',
          pincode: c.pincode || '',
          notes: c.notes || '',
          active: c.active,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString()
        }))
      },
      columns: [
        { key: 'id', header: 'ID', width: 30 },
        { key: 'name', header: 'Name', width: 25 },
        { key: 'email', header: 'Email', width: 30 },
        { key: 'phone', header: 'Phone', width: 15 },
        { key: 'address', header: 'Address', width: 40 },
        { key: 'city', header: 'City', width: 20 },
        { key: 'state', header: 'State', width: 20 },
        { key: 'pincode', header: 'Pincode', width: 10 },
        { key: 'notes', header: 'Notes', width: 40 },
        { key: 'active', header: 'Active', width: 10 },
        { key: 'createdAt', header: 'Created At', width: 20 },
        { key: 'updatedAt', header: 'Updated At', width: 20 }
      ]
    },

    // 6. Garment Patterns (no dependencies)
    {
      name: 'GarmentPattern',
      sheetName: '6. Garment Patterns',
      fetchData: async () => {
        const patterns = await prisma.garmentPattern.findMany({
          orderBy: { createdAt: 'asc' }
        })
        return patterns.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description || '',
          baseMeters: p.baseMeters,
          slimAdjustment: p.slimAdjustment,
          regularAdjustment: p.regularAdjustment,
          largeAdjustment: p.largeAdjustment,
          xlAdjustment: p.xlAdjustment,
          active: p.active,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString()
        }))
      },
      columns: [
        { key: 'id', header: 'ID', width: 30 },
        { key: 'name', header: 'Name', width: 25 },
        { key: 'description', header: 'Description', width: 40 },
        { key: 'baseMeters', header: 'Base Meters', width: 12 },
        { key: 'slimAdjustment', header: 'Slim Adjustment', width: 15 },
        { key: 'regularAdjustment', header: 'Regular Adjustment', width: 18 },
        { key: 'largeAdjustment', header: 'Large Adjustment', width: 15 },
        { key: 'xlAdjustment', header: 'XL Adjustment', width: 15 },
        { key: 'active', header: 'Active', width: 10 },
        { key: 'createdAt', header: 'Created At', width: 20 },
        { key: 'updatedAt', header: 'Updated At', width: 20 }
      ],
      notes: 'Body Type adjustments are additional meters added to baseMeters'
    },

    // 7. Garment Accessories (junction table - depends on GarmentPattern and AccessoryInventory)
    {
      name: 'GarmentAccessory',
      sheetName: '7. Garment Accessories',
      fetchData: async () => {
        const items = await prisma.garmentAccessory.findMany({
          include: {
            garmentPattern: { select: { name: true } },
            accessory: { select: { name: true, type: true } }
          }
        })
        return items.map(i => ({
          id: i.id,
          garmentPatternId: i.garmentPatternId,
          garmentPatternName: i.garmentPattern.name,
          accessoryId: i.accessoryId,
          accessoryName: i.accessory.name,
          accessoryType: i.accessory.type,
          quantity: i.quantity
        }))
      },
      columns: [
        { key: 'id', header: 'ID', width: 30 },
        { key: 'garmentPatternId', header: 'Garment Pattern ID (FK)', width: 30 },
        { key: 'garmentPatternName', header: 'Garment Pattern', width: 25 },
        { key: 'accessoryId', header: 'Accessory ID (FK)', width: 30 },
        { key: 'accessoryName', header: 'Accessory Name', width: 25 },
        { key: 'accessoryType', header: 'Accessory Type', width: 15 },
        { key: 'quantity', header: 'Quantity', width: 10 }
      ],
      notes: 'Junction table linking garment patterns to required accessories'
    },

    // 8. Measurements (depends on Customer and User)
    {
      name: 'Measurement',
      sheetName: '8. Measurements',
      fetchData: async () => {
        const measurements = await prisma.measurement.findMany({
          orderBy: { createdAt: 'asc' }
        })
        return measurements.map(m => ({
          id: m.id,
          customerId: m.customerId,
          userId: m.userId || '',
          garmentType: m.garmentType,
          bodyType: m.bodyType || '',
          neck: m.neck || '',
          chest: m.chest || '',
          waist: m.waist || '',
          hip: m.hip || '',
          shoulder: m.shoulder || '',
          sleeveLength: m.sleeveLength || '',
          shirtLength: m.shirtLength || '',
          inseam: m.inseam || '',
          outseam: m.outseam || '',
          thigh: m.thigh || '',
          knee: m.knee || '',
          bottomOpening: m.bottomOpening || '',
          jacketLength: m.jacketLength || '',
          lapelWidth: m.lapelWidth || '',
          additionalMeasurements: m.additionalMeasurements ? JSON.stringify(m.additionalMeasurements) : '',
          replacesId: m.replacesId || '',
          isActive: m.isActive,
          notes: m.notes || '',
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt.toISOString()
        }))
      },
      columns: [
        { key: 'id', header: 'ID', width: 30 },
        { key: 'customerId', header: 'Customer ID (FK)', width: 30 },
        { key: 'userId', header: 'User ID (FK)', width: 30 },
        { key: 'garmentType', header: 'Garment Type', width: 15 },
        { key: 'bodyType', header: 'Body Type', width: 12 },
        { key: 'neck', header: 'Neck (cm)', width: 10 },
        { key: 'chest', header: 'Chest (cm)', width: 10 },
        { key: 'waist', header: 'Waist (cm)', width: 10 },
        { key: 'hip', header: 'Hip (cm)', width: 10 },
        { key: 'shoulder', header: 'Shoulder (cm)', width: 12 },
        { key: 'sleeveLength', header: 'Sleeve (cm)', width: 12 },
        { key: 'shirtLength', header: 'Shirt Length (cm)', width: 15 },
        { key: 'inseam', header: 'Inseam (cm)', width: 12 },
        { key: 'outseam', header: 'Outseam (cm)', width: 12 },
        { key: 'thigh', header: 'Thigh (cm)', width: 10 },
        { key: 'knee', header: 'Knee (cm)', width: 10 },
        { key: 'bottomOpening', header: 'Bottom (cm)', width: 12 },
        { key: 'jacketLength', header: 'Jacket (cm)', width: 12 },
        { key: 'lapelWidth', header: 'Lapel (cm)', width: 12 },
        { key: 'additionalMeasurements', header: 'Additional (JSON)', width: 40 },
        { key: 'replacesId', header: 'Replaces ID (FK)', width: 30 },
        { key: 'isActive', header: 'Is Active', width: 10 },
        { key: 'notes', header: 'Notes', width: 40 },
        { key: 'createdAt', header: 'Created At', width: 20 },
        { key: 'updatedAt', header: 'Updated At', width: 20 }
      ],
      notes: 'Garment Types: Shirt, Trouser, Suit, Sherwani | Body Types: SLIM, REGULAR, LARGE, XL'
    },

    // 9. Orders (depends on Customer, User, Measurement)
    {
      name: 'Order',
      sheetName: '9. Orders',
      fetchData: async () => {
        const orders = await prisma.order.findMany({
          orderBy: { createdAt: 'asc' }
        })
        return orders.map(o => ({
          id: o.id,
          orderNumber: o.orderNumber,
          customerId: o.customerId,
          userId: o.userId,
          measurementId: o.measurementId || '',
          status: o.status,
          priority: o.priority,
          deliveryDate: o.deliveryDate.toISOString().split('T')[0],
          orderDate: o.orderDate.toISOString().split('T')[0],
          completedDate: o.completedDate ? o.completedDate.toISOString().split('T')[0] : '',
          totalAmount: o.totalAmount,
          advancePaid: o.advancePaid,
          balanceAmount: o.balanceAmount,
          notes: o.notes || '',
          active: o.active,
          createdAt: o.createdAt.toISOString(),
          updatedAt: o.updatedAt.toISOString()
        }))
      },
      columns: [
        { key: 'id', header: 'ID', width: 30 },
        { key: 'orderNumber', header: 'Order Number', width: 20 },
        { key: 'customerId', header: 'Customer ID (FK)', width: 30 },
        { key: 'userId', header: 'User ID (FK)', width: 30 },
        { key: 'measurementId', header: 'Measurement ID (FK)', width: 30 },
        { key: 'status', header: 'Status', width: 20 },
        { key: 'priority', header: 'Priority', width: 12 },
        { key: 'deliveryDate', header: 'Delivery Date', width: 15 },
        { key: 'orderDate', header: 'Order Date', width: 15 },
        { key: 'completedDate', header: 'Completed Date', width: 15 },
        { key: 'totalAmount', header: 'Total Amount', width: 12 },
        { key: 'advancePaid', header: 'Advance Paid', width: 12 },
        { key: 'balanceAmount', header: 'Balance Amount', width: 15 },
        { key: 'notes', header: 'Notes', width: 40 },
        { key: 'active', header: 'Active', width: 10 },
        { key: 'createdAt', header: 'Created At', width: 20 },
        { key: 'updatedAt', header: 'Updated At', width: 20 }
      ],
      notes: 'Status: NEW, MATERIAL_SELECTED, CUTTING, STITCHING, FINISHING, READY, DELIVERED, CANCELLED | Priority: NORMAL, URGENT'
    },

    // 10. Order Items (depends on Order, GarmentPattern, ClothInventory, Measurement)
    {
      name: 'OrderItem',
      sheetName: '10. Order Items',
      fetchData: async () => {
        const items = await prisma.orderItem.findMany({
          orderBy: { createdAt: 'asc' }
        })
        return items.map(i => ({
          id: i.id,
          orderId: i.orderId,
          garmentPatternId: i.garmentPatternId,
          clothInventoryId: i.clothInventoryId,
          measurementId: i.measurementId || '',
          quantity: i.quantity,
          bodyType: i.bodyType,
          estimatedMeters: i.estimatedMeters,
          actualMetersUsed: i.actualMetersUsed || '',
          wastage: i.wastage || '',
          pricePerUnit: i.pricePerUnit,
          totalPrice: i.totalPrice,
          notes: i.notes || '',
          createdAt: i.createdAt.toISOString(),
          updatedAt: i.updatedAt.toISOString()
        }))
      },
      columns: [
        { key: 'id', header: 'ID', width: 30 },
        { key: 'orderId', header: 'Order ID (FK)', width: 30 },
        { key: 'garmentPatternId', header: 'Garment Pattern ID (FK)', width: 30 },
        { key: 'clothInventoryId', header: 'Cloth Inventory ID (FK)', width: 30 },
        { key: 'measurementId', header: 'Measurement ID (FK)', width: 30 },
        { key: 'quantity', header: 'Quantity', width: 10 },
        { key: 'bodyType', header: 'Body Type', width: 12 },
        { key: 'estimatedMeters', header: 'Estimated Meters', width: 15 },
        { key: 'actualMetersUsed', header: 'Actual Meters', width: 15 },
        { key: 'wastage', header: 'Wastage', width: 10 },
        { key: 'pricePerUnit', header: 'Price/Unit', width: 12 },
        { key: 'totalPrice', header: 'Total Price', width: 12 },
        { key: 'notes', header: 'Notes', width: 40 },
        { key: 'createdAt', header: 'Created At', width: 20 },
        { key: 'updatedAt', header: 'Updated At', width: 20 }
      ],
      notes: 'Body Type: SLIM, REGULAR, LARGE, XL'
    },

    // 11. Purchase Orders (depends on Supplier)
    {
      name: 'PurchaseOrder',
      sheetName: '11. Purchase Orders',
      fetchData: async () => {
        const pos = await prisma.purchaseOrder.findMany({
          orderBy: { createdAt: 'asc' }
        })
        return pos.map(p => ({
          id: p.id,
          poNumber: p.poNumber,
          supplierId: p.supplierId,
          orderDate: p.orderDate.toISOString().split('T')[0],
          expectedDate: p.expectedDate ? p.expectedDate.toISOString().split('T')[0] : '',
          receivedDate: p.receivedDate ? p.receivedDate.toISOString().split('T')[0] : '',
          totalAmount: p.totalAmount,
          paidAmount: p.paidAmount,
          balanceAmount: p.balanceAmount,
          status: p.status,
          notes: p.notes || '',
          active: p.active,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString()
        }))
      },
      columns: [
        { key: 'id', header: 'ID', width: 30 },
        { key: 'poNumber', header: 'PO Number', width: 20 },
        { key: 'supplierId', header: 'Supplier ID (FK)', width: 30 },
        { key: 'orderDate', header: 'Order Date', width: 15 },
        { key: 'expectedDate', header: 'Expected Date', width: 15 },
        { key: 'receivedDate', header: 'Received Date', width: 15 },
        { key: 'totalAmount', header: 'Total Amount', width: 12 },
        { key: 'paidAmount', header: 'Paid Amount', width: 12 },
        { key: 'balanceAmount', header: 'Balance Amount', width: 15 },
        { key: 'status', header: 'Status', width: 15 },
        { key: 'notes', header: 'Notes', width: 40 },
        { key: 'active', header: 'Active', width: 10 },
        { key: 'createdAt', header: 'Created At', width: 20 },
        { key: 'updatedAt', header: 'Updated At', width: 20 }
      ],
      notes: 'Status: PENDING, RECEIVED, PARTIAL, CANCELLED'
    },

    // 12. PO Items (depends on PurchaseOrder)
    {
      name: 'POItem',
      sheetName: '12. PO Items',
      fetchData: async () => {
        const items = await prisma.pOItem.findMany()
        return items.map(i => ({
          id: i.id,
          purchaseOrderId: i.purchaseOrderId,
          itemName: i.itemName,
          itemType: i.itemType,
          quantity: i.quantity,
          unit: i.unit,
          pricePerUnit: i.pricePerUnit,
          totalPrice: i.totalPrice,
          receivedQuantity: i.receivedQuantity,
          createdAt: i.createdAt.toISOString()
        }))
      },
      columns: [
        { key: 'id', header: 'ID', width: 30 },
        { key: 'purchaseOrderId', header: 'Purchase Order ID (FK)', width: 30 },
        { key: 'itemName', header: 'Item Name', width: 25 },
        { key: 'itemType', header: 'Item Type', width: 15 },
        { key: 'quantity', header: 'Quantity', width: 12 },
        { key: 'unit', header: 'Unit', width: 10 },
        { key: 'pricePerUnit', header: 'Price/Unit', width: 12 },
        { key: 'totalPrice', header: 'Total Price', width: 12 },
        { key: 'receivedQuantity', header: 'Received Qty', width: 12 },
        { key: 'createdAt', header: 'Created At', width: 20 }
      ],
      notes: 'Item Type: CLOTH, ACCESSORY | Unit: meters, pieces'
    }
  ]

  // Create sheets and populate data
  for (const table of tables) {
    console.log(`Exporting ${table.name}...`)

    const worksheet = workbook.addWorksheet(table.sheetName)

    // Add notes at the top if available
    if (table.notes) {
      worksheet.addRow([`NOTE: ${table.notes}`])
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFF6600' } }
      worksheet.addRow([]) // Empty row
    }

    // Define columns
    worksheet.columns = table.columns

    // Fetch and add data
    const data = await table.fetchData()
    data.forEach(row => {
      worksheet.addRow(row)
    })

    // Style the header row
    const headerRowIndex = table.notes ? 3 : 1
    const headerRow = worksheet.getRow(headerRowIndex)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }

    // Add filters
    worksheet.autoFilter = {
      from: { row: headerRowIndex, column: 1 },
      to: { row: headerRowIndex, column: table.columns.length }
    }

    // Freeze header row
    worksheet.views = [{ state: 'frozen', ySplit: headerRowIndex }]

    console.log(`  ✓ ${data.length} rows exported`)
  }

  // Add README sheet
  const readmeSheet = workbook.addWorksheet('README')
  readmeSheet.getColumn(1).width = 80

  const readme = [
    ['HAMEES INVENTORY SYSTEM - EXCEL TEMPLATE'],
    [''],
    ['This Excel file contains all data from your Hamees Inventory database.'],
    ['You can use this as a template to bulk upload data.'],
    [''],
    ['IMPORTANT NOTES:'],
    ['1. DO NOT modify the ID columns unless you know what you\'re doing'],
    ['2. Foreign Key (FK) columns must reference valid IDs from other sheets'],
    ['3. Date formats should be ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)'],
    ['4. Boolean values should be true/false'],
    ['5. Empty cells will be treated as NULL/empty strings'],
    [''],
    ['RELATIONSHIP DEPENDENCIES (Upload Order):'],
    ['1. Users - No dependencies'],
    ['2. Suppliers - No dependencies'],
    ['3. Cloth Inventory - Requires Suppliers (supplierId)'],
    ['4. Accessories - Requires Suppliers (supplierId)'],
    ['5. Customers - No dependencies'],
    ['6. Garment Patterns - No dependencies'],
    ['7. Garment Accessories - Requires Garment Patterns + Accessories'],
    ['8. Measurements - Requires Customers + Users (optional)'],
    ['9. Orders - Requires Customers + Users + Measurements (optional)'],
    ['10. Order Items - Requires Orders + Garment Patterns + Cloth Inventory + Measurements (optional)'],
    ['11. Purchase Orders - Requires Suppliers'],
    ['12. PO Items - Requires Purchase Orders'],
    [''],
    ['UPLOAD PROCESS:'],
    ['- The system will validate all data before uploading'],
    ['- Duplicates will be detected and you will be asked to confirm'],
    ['- Any corrupted data will be skipped with a detailed error report'],
    ['- A final report will show what was uploaded and what failed'],
    ['- All uploads are tracked in an audit trail'],
    [''],
    ['For more information, visit: https://hamees.gagneet.com'],
    [''],
    [`Generated: ${new Date().toISOString()}`]
  ]

  readme.forEach((row, index) => {
    const excelRow = readmeSheet.addRow(row)
    if (index === 0 || row[0]?.includes('IMPORTANT') || row[0]?.includes('RELATIONSHIP') || row[0]?.includes('UPLOAD')) {
      excelRow.font = { bold: true, size: 12 }
    }
  })

  readmeSheet.getRow(1).font = { bold: true, size: 16, color: { argb: 'FF4472C4' } }

  // Save file
  const outputDir = path.join(process.cwd(), 'exports')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
  const filename = `hamees-inventory-export-${timestamp}.xlsx`
  const filepath = path.join(outputDir, filename)

  await workbook.xlsx.writeFile(filepath)

  console.log('\n✅ Export complete!')
  console.log(`📁 File saved to: ${filepath}`)
  console.log(`📊 Total sheets: ${tables.length + 1} (including README)`)

  await prisma.$disconnect()
  await pool.end()
}

// Run export
exportToExcel().catch(error => {
  console.error('❌ Export failed:', error)
  process.exit(1)
})
