import { PrismaClient, OrderStatus } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'
import {
  addDays,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  format,
} from 'date-fns'

dotenv.config()

const connectionString = process.env.DATABASE_URL!
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Starting production data seeding...')

  // Get existing users
  const owner = await prisma.user.findUnique({ where: { email: 'owner@hameesattire.com' } })
  const inventoryManager = await prisma.user.findUnique({ where: { email: 'inventory@hameesattire.com' } })

  if (!owner || !inventoryManager) {
    console.error('❌ Users not found. Please run the basic seed first.')
    return
  }

  // ===========================
  // 1. CREATE 10 CLOTH ITEMS
  // ===========================
  console.log('📦 Creating cloth inventory items...')

  const clothItems = [
    { name: 'Premium Linen', type: 'LINEN', color: 'Beige', colorHex: '#F5F5DC', pattern: 'Plain', quality: 'Premium', price: 850, stock: 45 },
    { name: 'Egyptian Cotton', type: 'COTTON', color: 'White', colorHex: '#FFFFFF', pattern: 'Plain', quality: 'Premium', price: 950, stock: 60 },
    { name: 'Silk Blend', type: 'SILK', color: 'Champagne', colorHex: '#F7E7CE', pattern: 'Plain', quality: 'Premium', price: 2500, stock: 25 },
    { name: 'Merino Wool', type: 'WOOL', color: 'Charcoal', colorHex: '#36454F', pattern: 'Plain', quality: 'Premium', price: 1800, stock: 30 },
    { name: 'Denim Cotton', type: 'COTTON', color: 'Navy Blue', colorHex: '#000080', pattern: 'Twill', quality: 'Standard', price: 650, stock: 70 },
    { name: 'Cashmere Blend', type: 'WOOL', color: 'Camel', colorHex: '#C19A6B', pattern: 'Plain', quality: 'Premium', price: 3200, stock: 15 },
    { name: 'Polyester Suiting', type: 'SYNTHETIC', color: 'Black', colorHex: '#000000', pattern: 'Plain', quality: 'Economy', price: 480, stock: 100 },
    { name: 'Khadi Cotton', type: 'COTTON', color: 'Cream', colorHex: '#FFFDD0', pattern: 'Plain', quality: 'Premium', price: 720, stock: 55 },
    { name: 'Tussar Silk', type: 'SILK', color: 'Gold', colorHex: '#FFD700', pattern: 'Textured', quality: 'Premium', price: 2800, stock: 20 },
    { name: 'Tweed Wool', type: 'WOOL', color: 'Brown', colorHex: '#964B00', pattern: 'Checkered', quality: 'Premium', price: 1600, stock: 35 },
  ]

  for (const cloth of clothItems) {
    await prisma.clothInventory.create({
      data: {
        name: cloth.name,
        type: cloth.type,
        color: cloth.color,
        colorHex: cloth.colorHex,
        pattern: cloth.pattern,
        quality: cloth.quality,
        brand: 'Premium Fabrics',
        supplier: 'ABC Fabrics',
        currentStock: cloth.stock,
        reserved: 0,
        minimum: 20,
        pricePerMeter: cloth.price,
        totalPurchased: cloth.stock,
        sku: `CLT-${cloth.type}-PF-${Date.now() + Math.random()}`,
      },
    })
  }
  console.log('✅ Created 10 cloth items')

  // ===========================
  // 2. CREATE 10 ACCESSORY ITEMS
  // ===========================
  console.log('📦 Creating accessory inventory items...')

  const accessoryItems = [
    { name: 'Metal Zipper', type: 'ZIPPER', price: 25, stock: 200 },
    { name: 'Plastic Zipper', type: 'ZIPPER', price: 15, stock: 300 },
    { name: 'Pearl Buttons', type: 'BUTTON', price: 8, stock: 500 },
    { name: 'Wooden Buttons', type: 'BUTTON', price: 12, stock: 350 },
    { name: 'Polyester Thread', type: 'THREAD', price: 50, stock: 100 },
    { name: 'Cotton Thread', type: 'THREAD', price: 45, stock: 120 },
    { name: 'Silk Lining', type: 'OTHER', price: 150, stock: 80 },
    { name: 'Shoulder Pads', type: 'OTHER', price: 35, stock: 150 },
    { name: 'Hook and Eye', type: 'BUTTON', price: 5, stock: 600 },
    { name: 'Velcro Strips', type: 'OTHER', price: 20, stock: 200 },
  ]

  for (let i = 0; i < accessoryItems.length; i++) {
    const accessory = accessoryItems[i]
    const typePrefix = accessory.type.substring(0, 3).toUpperCase()
    const sku = `ACC-${typePrefix}-PROD-${String(i + 1).padStart(3, '0')}`

    await prisma.accessoryInventory.create({
      data: {
        sku,
        name: accessory.name,
        type: accessory.type,
        color: null,
        supplier: 'Quality Accessories',
        currentStock: accessory.stock,
        minimum: 50,
        pricePerUnit: accessory.price,
      },
    })
  }
  console.log('✅ Created 10 accessory items')

  // ===========================
  // 3. CREATE 20 CUSTOMERS
  // ===========================
  console.log('👥 Creating customers...')

  const customerNames = [
    'Rajesh Kumar', 'Priya Sharma', 'Amit Patel', 'Sneha Reddy', 'Vikram Singh',
    'Ananya Iyer', 'Rohan Mehta', 'Kavya Nair', 'Arjun Verma', 'Divya Joshi',
    'Karan Malhotra', 'Pooja Gupta', 'Siddharth Rao', 'Nisha Agarwal', 'Varun Chopra',
    'Ritu Kapoor', 'Akash Desai', 'Meera Pillai', 'Rahul Bhatt', 'Simran Kaur',
  ]

  const customers = []
  for (const name of customerNames) {
    const customer = await prisma.customer.create({
      data: {
        name,
        email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
        phone: `+91${Math.floor(7000000000 + Math.random() * 2999999999)}`,
        address: `${Math.floor(Math.random() * 999) + 1}, MG Road, Bangalore`,
      },
    })
    customers.push(customer)
  }
  console.log(`✅ Created ${customers.length} customers`)

  // ===========================
  // 4. CREATE 20 PURCHASE ORDERS
  // ===========================
  console.log('📋 Creating purchase orders...')

  const supplier = await prisma.supplier.findFirst()
  if (!supplier) {
    console.error('❌ No supplier found')
    return
  }

  const allCloth = await prisma.clothInventory.findMany()

  const timestamp = Date.now()
  for (let i = 0; i < 20; i++) {
    const cloth = allCloth[Math.floor(Math.random() * allCloth.length)]
    const quantity = Math.floor(Math.random() * 50) + 20
    const pricePerMeter = cloth.pricePerMeter * 0.8 // 20% discount for bulk
    const totalPrice = quantity * pricePerMeter
    const paidAmount = totalPrice * (Math.random() > 0.3 ? 1 : Math.random()) // 70% fully paid

    const monthsAgo = Math.floor(Math.random() * 6)
    const createdDate = subMonths(new Date(), monthsAgo)

    await prisma.purchaseOrder.create({
      data: {
        poNumber: `PO-${format(createdDate, 'yyyyMM')}-${String(timestamp + i).slice(-6)}`,
        supplierId: supplier.id,
        status: paidAmount >= totalPrice ? 'RECEIVED' : paidAmount > 0 ? 'PARTIAL' : 'PENDING',
        totalAmount: totalPrice,
        paidAmount,
        balanceAmount: totalPrice - paidAmount,
        createdAt: createdDate,
        receivedDate: paidAmount >= totalPrice ? addDays(createdDate, Math.floor(Math.random() * 10) + 3) : null,
        items: {
          create: [{
            itemName: cloth.name,
            itemType: 'CLOTH',
            quantity,
            unit: 'meters',
            pricePerUnit: pricePerMeter,
            totalPrice,
            receivedQuantity: paidAmount >= totalPrice ? quantity : paidAmount > 0 ? Math.floor(quantity * 0.5) : 0,
          }],
        },
      },
    })
  }
  console.log('✅ Created 20 purchase orders')

  // ===========================
  // 5. CREATE ORDERS (JULY - DEC 2025)
  // ===========================
  console.log('📝 Creating orders from July to December 2025...')

  const garmentPatterns = await prisma.garmentPattern.findMany()
  const accessories = await prisma.accessoryInventory.findMany()

  // July 2025 - Large number (40 orders)
  console.log('  → July 2025: Creating 40 orders...')
  await createMonthOrders(7, 2025, 40, customers, garmentPatterns, allCloth, accessories, owner.id)

  // August 2025 - Slow month (12 orders)
  console.log('  → August 2025: Creating 12 orders...')
  await createMonthOrders(8, 2025, 12, customers, garmentPatterns, allCloth, accessories, owner.id)

  // September 2025 - Slow month (10 orders)
  console.log('  → September 2025: Creating 10 orders...')
  await createMonthOrders(9, 2025, 10, customers, garmentPatterns, allCloth, accessories, owner.id)

  // October 2025 - Huge spurt (50 orders)
  console.log('  → October 2025: Creating 50 orders...')
  await createMonthOrders(10, 2025, 50, customers, garmentPatterns, allCloth, accessories, owner.id)

  // November 2025 - Lots of finalizations (35 orders, most DELIVERED)
  console.log('  → November 2025: Creating 35 orders...')
  await createMonthOrders(11, 2025, 35, customers, garmentPatterns, allCloth, accessories, owner.id, true)

  // December 2025 - Lots of revenue (45 orders, most DELIVERED)
  console.log('  → December 2025: Creating 45 orders...')
  await createMonthOrders(12, 2025, 45, customers, garmentPatterns, allCloth, accessories, owner.id, true)

  console.log('✅ All orders created successfully!')
  console.log('\n✨ Production seed data completed!')
}

async function createMonthOrders(
  month: number,
  year: number,
  count: number,
  customers: any[],
  garmentPatterns: any[],
  clothItems: any[],
  accessories: any[],
  userId: string,
  mostDelivered: boolean = false
) {
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = endOfMonth(monthStart)

  for (let i = 0; i < count; i++) {
    // Random customer, prefer repeat customers for realistic data
    const customer = Math.random() > 0.4 ? customers[Math.floor(Math.random() * Math.min(10, customers.length))] : customers[Math.floor(Math.random() * customers.length)]

    // Random date within the month
    const dayOfMonth = Math.floor(Math.random() * (monthEnd.getDate() - 1)) + 1
    const orderDate = new Date(year, month - 1, dayOfMonth)

    // Delivery date: 7-14 days from order date
    const daysToDeliver = Math.floor(Math.random() * 8) + 7 // 7-14 days
    const deliveryDate = addDays(orderDate, daysToDeliver)

    // Completion date: 1-3 days before delivery date (fulfillment time: 4-13 days)
    const fulfillmentDays = Math.floor(Math.random() * 10) + 4 // 4-13 days
    const completedDate = addDays(orderDate, fulfillmentDays)

    // Status based on month and completion
    let status: OrderStatus = OrderStatus.NEW
    let actualCompletedDate = null

    if (mostDelivered) {
      // For Nov and Dec, most orders are DELIVERED
      status = Math.random() > 0.2 ? OrderStatus.DELIVERED : [OrderStatus.READY, OrderStatus.FINISHING, OrderStatus.STITCHING][Math.floor(Math.random() * 3)]
      if (status === OrderStatus.DELIVERED) {
        actualCompletedDate = completedDate
      }
    } else {
      // For other months, progressive status based on order date
      const now = new Date()
      const daysSinceOrder = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24))

      if (daysSinceOrder > fulfillmentDays + 3) {
        status = OrderStatus.DELIVERED
        actualCompletedDate = completedDate
      } else if (daysSinceOrder > fulfillmentDays) {
        status = OrderStatus.READY
      } else if (daysSinceOrder > fulfillmentDays - 3) {
        status = OrderStatus.FINISHING
      } else if (daysSinceOrder > fulfillmentDays - 6) {
        status = OrderStatus.STITCHING
      } else if (daysSinceOrder > 2) {
        status = OrderStatus.CUTTING
      } else if (daysSinceOrder > 1) {
        status = OrderStatus.MATERIAL_SELECTED
      }
    }

    // Random number of items (1-3)
    const itemCount = Math.floor(Math.random() * 3) + 1
    let totalAmount = 0
    const items = []

    for (let j = 0; j < itemCount; j++) {
      const garment = garmentPatterns[Math.floor(Math.random() * garmentPatterns.length)]
      const cloth = clothItems[Math.floor(Math.random() * clothItems.length)]
      const meters = garment.baseMeters + (Math.random() * 0.5) // Add some variation
      const pricePerUnit = cloth.pricePerMeter
      const itemTotal = meters * pricePerUnit

      totalAmount += itemTotal

      items.push({
        garmentPatternId: garment.id,
        clothInventoryId: cloth.id,
        estimatedMeters: meters,
        actualMetersUsed: status === OrderStatus.DELIVERED ? meters : 0,
        pricePerUnit,
        totalPrice: itemTotal,
      })
    }

    // GST calculation (12%)
    const gstRate = 12
    const gstAmount = totalAmount * (gstRate / 100)
    const finalTotal = totalAmount + gstAmount

    // Advance payment (50-90%)
    const advancePercent = Math.random() * 0.4 + 0.5 // 50-90%
    const advancePaid = finalTotal * advancePercent
    const balanceAmount = finalTotal - advancePaid

    await prisma.order.create({
      data: {
        orderNumber: `ORD-${year}${String(month).padStart(2, '0')}-${String(i + 1).padStart(4, '0')}`,
        customerId: customer.id,
        userId,
        orderDate,
        deliveryDate,
        status,
        totalAmount: finalTotal,
        advancePaid,
        balanceAmount,
        gstRate,
        gstAmount,
        cgst: gstAmount / 2,
        sgst: gstAmount / 2,
        igst: 0,
        completedDate: actualCompletedDate,
        items: {
          create: items,
        },
      },
    })
  }
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await pool.end()
    await prisma.$disconnect()
  })
