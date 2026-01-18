#!/usr/bin/env tsx

/**
 * Complete Production Seed Script for Hamees Attire
 *
 * Generates realistic data from July 2025 to January 2026 with:
 * - Seasonal order patterns (peak in July/August, slow Sep/Oct, pickup Nov, high Dec-Jan)
 * - Proper customer-measurement-order linking
 * - Complete inventory with storage locations
 * - Purchase orders and stock movements
 * - All relationships properly connected
 *
 * Run with: pnpm tsx prisma/seed-complete.ts
 */

import { PrismaClient, UserRole, OrderStatus, OrderPriority, BodyType, StockMovementType, ExpenseCategory, PaymentMode } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'

dotenv.config()

const connectionString = process.env.DATABASE_URL!
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({
  adapter,
  log: ['error'],
})

// Helper functions
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomFloat(min: number, max: number, decimals: number = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals))
}

function randomChoice<T>(array: T[]): T {
  return array[randomInt(0, array.length - 1)]
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

async function main() {
  console.log('🌱 Starting complete production seed...\n')

  // Clear existing data
  console.log('🗑️  Clearing existing data...')
  await prisma.orderHistory.deleteMany()
  await prisma.paymentInstallment.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.measurement.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.stockMovement.deleteMany()
  await prisma.garmentAccessory.deleteMany()
  await prisma.purchaseOrder.deleteMany()
  await prisma.supplierPrice.deleteMany()
  await prisma.clothInventory.deleteMany()
  await prisma.accessoryInventory.deleteMany()
  await prisma.garmentPattern.deleteMany()
  await prisma.supplier.deleteMany()
  await prisma.expense.deleteMany()
  await prisma.uploadHistory.deleteMany()
  await prisma.user.deleteMany()
  console.log('✅ Cleared existing data\n')

  // 1. Create Users
  console.log('👥 Creating users...')
  const hashedPassword = await bcrypt.hash('admin123', 10)

  const owner = await prisma.user.create({
    data: {
      email: 'owner@hameesattire.com',
      password: hashedPassword,
      name: 'Hamees Khan (Owner)',
      role: UserRole.OWNER,
      phone: '+91 98765 43210',
    },
  })

  const admin = await prisma.user.create({
    data: {
      email: 'admin@hameesattire.com',
      password: hashedPassword,
      name: 'Zara Ahmed (Admin)',
      role: UserRole.ADMIN,
      phone: '+91 98765 43211',
    },
  })

  const inventoryManager = await prisma.user.create({
    data: {
      email: 'inventory@hameesattire.com',
      password: hashedPassword,
      name: 'Rajesh Kumar (Inventory)',
      role: UserRole.INVENTORY_MANAGER,
      phone: '+91 98765 43212',
    },
  })

  const salesManager = await prisma.user.create({
    data: {
      email: 'sales@hameesattire.com',
      password: hashedPassword,
      name: 'Priya Sharma (Sales)',
      role: UserRole.SALES_MANAGER,
      phone: '+91 98765 43213',
    },
  })

  const tailor = await prisma.user.create({
    data: {
      email: 'tailor@hameesattire.com',
      password: hashedPassword,
      name: 'Mohammed Akram (Tailor)',
      role: UserRole.TAILOR,
      phone: '+91 98765 43214',
    },
  })

  const viewer = await prisma.user.create({
    data: {
      email: 'viewer@hameesattire.com',
      password: hashedPassword,
      name: 'Guest Viewer',
      role: UserRole.VIEWER,
      phone: '+91 98765 43215',
    },
  })

  console.log(`✅ Created 6 users\n`)

  // 2. Create Suppliers
  console.log('🏭 Creating suppliers...')
  const suppliers = await Promise.all([
    prisma.supplier.create({
      data: {
        name: 'ABC Fabrics Ltd.',
        contactPerson: 'Suresh Patel',
        email: 'sales@abcfabrics.com',
        phone: '+91 22 1234 5678',
        address: '123 Textile Market',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        gstin: '27AABCU9603R1ZM',
        rating: 4.5,
      },
    }),
    prisma.supplier.create({
      data: {
        name: 'XYZ Textiles Pvt. Ltd.',
        contactPerson: 'Ramesh Singh',
        email: 'info@xyztextiles.com',
        phone: '+91 11 9876 5432',
        address: '456 Fabric Street',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110001',
        gstin: '07AACFX9876P1Z5',
        rating: 4.2,
      },
    }),
    prisma.supplier.create({
      data: {
        name: 'Premium Buttons & Accessories',
        contactPerson: 'Lakshmi Menon',
        email: 'contact@premiumbuttons.com',
        phone: '+91 80 5555 6666',
        address: '789 Accessory Lane',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560001',
        gstin: '29AABCP1234Q1Z3',
        rating: 4.7,
      },
    }),
  ])
  console.log(`✅ Created ${suppliers.length} suppliers\n`)

  // 3. Create Cloth Inventory with Storage Locations
  console.log('📦 Creating cloth inventory with storage locations...')
  const clothTypes = [
    { name: 'Premium Cotton', type: 'Cotton', color: 'White', colorHex: '#FFFFFF', brand: 'Raymond', quality: 'Premium', pricePerMeter: 450, stock: 250, minimum: 50, rack: 'A1' },
    { name: 'Cotton Blend', type: 'Cotton', color: 'Blue', colorHex: '#1E3A8A', brand: 'Grasim', quality: 'Standard', pricePerMeter: 320, stock: 180, minimum: 40, rack: 'A2' },
    { name: 'Pure Silk', type: 'Silk', color: 'Cream', colorHex: '#FFF8DC', brand: 'Vimal', quality: 'Premium', pricePerMeter: 850, stock: 120, minimum: 30, rack: 'B1' },
    { name: 'Silk Blend', type: 'Silk', color: 'Gold', colorHex: '#FFD700', brand: 'Siyaram', quality: 'Premium', pricePerMeter: 680, stock: 95, minimum: 25, rack: 'B2' },
    { name: 'Linen Pure', type: 'Linen', color: 'Beige', colorHex: '#F5F5DC', brand: 'Bombay Dyeing', quality: 'Premium', pricePerMeter: 520, stock: 140, minimum: 35, rack: 'C1' },
    { name: 'Linen Blend', type: 'Linen', color: 'Gray', colorHex: '#808080', brand: 'Raymond', quality: 'Standard', pricePerMeter: 380, stock: 110, minimum: 30, rack: 'C2' },
    { name: 'Wool Premium', type: 'Wool', color: 'Black', colorHex: '#000000', brand: 'Reid & Taylor', quality: 'Premium', pricePerMeter: 1200, stock: 85, minimum: 20, rack: 'D1' },
    { name: 'Wool Blend', type: 'Wool', color: 'Navy', colorHex: '#000080', brand: 'Vimal', quality: 'Standard', pricePerMeter: 850, stock: 75, minimum: 20, rack: 'D2' },
    { name: 'Polyester Blend', type: 'Polyester', color: 'Brown', colorHex: '#8B4513', brand: 'Grasim', quality: 'Standard', pricePerMeter: 280, stock: 200, minimum: 50, rack: 'E1' },
    { name: 'Brocade Silk', type: 'Silk', color: 'Red', colorHex: '#DC143C', brand: 'Siyaram', quality: 'Premium', pricePerMeter: 980, stock: 65, minimum: 15, rack: 'B3' },
  ]

  const clothInventory = []
  for (const cloth of clothTypes) {
    const item = await prisma.clothInventory.create({
      data: {
        sku: `CLT-${cloth.type.substring(0, 3).toUpperCase()}-${cloth.brand.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`,
        name: cloth.name,
        type: cloth.type,
        brand: cloth.brand,
        color: cloth.color,
        colorHex: cloth.colorHex,
        pattern: 'Plain',
        quality: cloth.quality,
        pricePerMeter: cloth.pricePerMeter,
        currentStock: cloth.stock,
        totalPurchased: cloth.stock,
        reserved: 0,
        minimum: cloth.minimum,
        supplier: suppliers[randomInt(0, 1)].name,
        supplierId: suppliers[randomInt(0, 1)].id,
        location: `Rack ${cloth.rack}`,
      },
    })
    clothInventory.push(item)
  }
  console.log(`✅ Created ${clothInventory.length} cloth items with rack locations\n`)

  // 4. Create Accessory Inventory
  console.log('🔘 Creating accessory inventory...')
  const accessories = await Promise.all([
    prisma.accessoryInventory.create({
      data: { sku: 'ACC-BUT-001', name: 'Pearl Buttons', type: 'Button', color: 'White', currentStock: 5000, minimum: 500, pricePerUnit: 2.5, supplier: suppliers[2].name, supplierId: suppliers[2].id },
    }),
    prisma.accessoryInventory.create({
      data: { sku: 'ACC-BUT-002', name: 'Metal Buttons', type: 'Button', color: 'Gold', currentStock: 3000, minimum: 300, pricePerUnit: 5.0, supplier: suppliers[2].name, supplierId: suppliers[2].id },
    }),
    prisma.accessoryInventory.create({
      data: { sku: 'ACC-BUT-003', name: 'Black Buttons', type: 'Button', color: 'Black', currentStock: 4000, minimum: 400, pricePerUnit: 3.0, supplier: suppliers[2].name, supplierId: suppliers[2].id },
    }),
    prisma.accessoryInventory.create({
      data: { sku: 'ACC-THR-001', name: 'Polyester Thread', type: 'Thread', color: 'White', currentStock: 2000, minimum: 200, pricePerUnit: 15.0, supplier: suppliers[2].name, supplierId: suppliers[2].id },
    }),
    prisma.accessoryInventory.create({
      data: { sku: 'ACC-THR-002', name: 'Cotton Thread', type: 'Thread', color: 'Black', currentStock: 1800, minimum: 180, pricePerUnit: 18.0, supplier: suppliers[2].name, supplierId: suppliers[2].id },
    }),
    prisma.accessoryInventory.create({
      data: { sku: 'ACC-ZIP-001', name: 'Metal Zipper', type: 'Zipper', color: 'Silver', currentStock: 1200, minimum: 120, pricePerUnit: 25.0, supplier: suppliers[2].name, supplierId: suppliers[2].id },
    }),
  ])
  console.log(`✅ Created ${accessories.length} accessory items\n`)

  // 5. Create Garment Patterns with Accessories
  console.log('👔 Creating garment patterns with accessories...')
  const garmentPatterns = await Promise.all([
    prisma.garmentPattern.create({
      data: {
        name: "Men's Shirt",
        description: 'Formal and casual shirts for men',
        baseMeters: 2.25,
        slimAdjustment: 0,
        regularAdjustment: 0,
        largeAdjustment: 0.3,
        xlAdjustment: 0.5,
      },
    }),
    prisma.garmentPattern.create({
      data: {
        name: "Men's Trouser",
        description: 'Formal and casual trousers for men',
        baseMeters: 2.5,
        slimAdjustment: 0,
        regularAdjustment: 0,
        largeAdjustment: 0.3,
        xlAdjustment: 0.5,
      },
    }),
    prisma.garmentPattern.create({
      data: {
        name: "Men's Suit",
        description: '2-piece suit (jacket + trouser)',
        baseMeters: 4.5,
        slimAdjustment: 0,
        regularAdjustment: 0,
        largeAdjustment: 0.5,
        xlAdjustment: 0.8,
      },
    }),
    prisma.garmentPattern.create({
      data: {
        name: "Men's Sherwani",
        description: 'Traditional ethnic wear for special occasions',
        baseMeters: 3.8,
        slimAdjustment: 0,
        regularAdjustment: 0,
        largeAdjustment: 0.4,
        xlAdjustment: 0.6,
      },
    }),
  ])

  // Link accessories to garment patterns
  await prisma.garmentAccessory.createMany({
    data: [
      { garmentPatternId: garmentPatterns[0].id, accessoryId: accessories[0].id, quantity: 8 }, // Shirt - Pearl Buttons
      { garmentPatternId: garmentPatterns[0].id, accessoryId: accessories[3].id, quantity: 1 }, // Shirt - Thread
      { garmentPatternId: garmentPatterns[1].id, accessoryId: accessories[2].id, quantity: 1 }, // Trouser - Black Buttons
      { garmentPatternId: garmentPatterns[1].id, accessoryId: accessories[4].id, quantity: 1 }, // Trouser - Thread
      { garmentPatternId: garmentPatterns[1].id, accessoryId: accessories[5].id, quantity: 1 }, // Trouser - Zipper
      { garmentPatternId: garmentPatterns[2].id, accessoryId: accessories[1].id, quantity: 6 }, // Suit - Metal Buttons
      { garmentPatternId: garmentPatterns[2].id, accessoryId: accessories[3].id, quantity: 2 }, // Suit - Thread
      { garmentPatternId: garmentPatterns[3].id, accessoryId: accessories[1].id, quantity: 10 }, // Sherwani - Metal Buttons
      { garmentPatternId: garmentPatterns[3].id, accessoryId: accessories[3].id, quantity: 2 }, // Sherwani - Thread
    ],
  })
  console.log(`✅ Created ${garmentPatterns.length} garment patterns with accessories\n`)

  // 6. Create Customers with Measurements
  console.log('👤 Creating customers with measurements...')
  const customerNames = [
    'Rahul Verma', 'Amit Patel', 'Vikram Singh', 'Arjun Mehta', 'Rohan Kapoor',
    'Sanjay Sharma', 'Rajesh Kumar', 'Anil Gupta', 'Suresh Reddy', 'Manoj Agarwal',
    'Karan Malhotra', 'Ajay Joshi', 'Deepak Nair', 'Nitin Desai', 'Praveen Rao',
    'Ashok Yadav', 'Harish Bhat', 'Ravi Iyer', 'Vijay Saxena', 'Sachin Pillai',
    'Varun Choudhary', 'Naveen Khanna', 'Abhishek Pandey', 'Gaurav Tiwari', 'Sandeep Jain',
  ]

  const customers = []
  for (let i = 0; i < customerNames.length; i++) {
    const customer = await prisma.customer.create({
      data: {
        name: customerNames[i],
        phone: `+91 ${90000 + i}00000`,
        email: `${customerNames[i].toLowerCase().replace(' ', '.')}@email.com`,
        address: `${randomInt(1, 999)} MG Road`,
        city: randomChoice(['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai']),
        state: randomChoice(['Maharashtra', 'Delhi', 'Karnataka', 'Telangana', 'Tamil Nadu']),
        pincode: `${randomInt(100000, 999999)}`,
      },
    })

    // Create measurements for each garment type
    const measurementTypes = ['Shirt', 'Trouser', 'Suit', 'Sherwani']
    for (const garmentType of measurementTypes) {
      await prisma.measurement.create({
        data: {
          customerId: customer.id,
          userId: tailor.id,
          garmentType: garmentType,
          bodyType: randomChoice([BodyType.SLIM, BodyType.REGULAR, BodyType.LARGE, BodyType.XL]),
          // Common measurements
          chest: garmentType === 'Shirt' || garmentType === 'Suit' || garmentType === 'Sherwani' ? randomFloat(36, 46) : null,
          waist: randomFloat(30, 40),
          shoulder: garmentType === 'Shirt' || garmentType === 'Suit' || garmentType === 'Sherwani' ? randomFloat(15, 19) : null,
          sleeveLength: garmentType === 'Shirt' || garmentType === 'Suit' || garmentType === 'Sherwani' ? randomFloat(23, 27) : null,
          shirtLength: garmentType === 'Shirt' ? randomFloat(28, 32) : null,
          inseam: garmentType === 'Trouser' || garmentType === 'Suit' ? randomFloat(30, 34) : null,
          outseam: garmentType === 'Trouser' || garmentType === 'Suit' ? randomFloat(40, 44) : null,
          hip: garmentType === 'Trouser' || garmentType === 'Suit' || garmentType === 'Sherwani' ? randomFloat(38, 44) : null,
          jacketLength: garmentType === 'Suit' || garmentType === 'Sherwani' ? randomFloat(28, 32) : null,
          isActive: true,
        },
      })
    }

    customers.push(customer)
  }
  console.log(`✅ Created ${customers.length} customers with ${customers.length * 4} measurements\n`)

  // 7. Create Orders with Seasonal Patterns
  console.log('📋 Creating orders with seasonal patterns...')

  const monthlyOrderCounts = [
    { month: 7, year: 2025, count: 45, name: 'July 2025 (Peak)' },      // July - Peak
    { month: 8, year: 2025, count: 42, name: 'August 2025 (Peak)' },    // August - Peak
    { month: 9, year: 2025, count: 15, name: 'September 2025 (Slow)' }, // September - Slow
    { month: 10, year: 2025, count: 12, name: 'October 2025 (Slow)' },  // October - Slow
    { month: 11, year: 2025, count: 38, name: 'November 2025 (Pickup)' },// November - Picking up
    { month: 12, year: 2025, count: 55, name: 'December 2025 (High)' }, // December - Very high
    { month: 1, year: 2026, count: 25, name: 'January 2026 (Current)' }, // January - Current month
  ]

  let totalOrders = 0
  let orderNumber = 1

  for (const monthData of monthlyOrderCounts) {
    console.log(`  Creating ${monthData.count} orders for ${monthData.name}...`)

    const monthStart = new Date(monthData.year, monthData.month - 1, 1)
    const monthEnd = new Date(monthData.year, monthData.month, 0, 23, 59, 59)

    for (let i = 0; i < monthData.count; i++) {
      const customer = randomChoice(customers)
      const orderDate = randomDate(monthStart, monthEnd)
      const deliveryDate = new Date(orderDate.getTime() + randomInt(7, 14) * 24 * 60 * 60 * 1000)

      // Determine status based on delivery date
      let status: OrderStatus
      const now = new Date()
      if (deliveryDate < now) {
        status = randomChoice([OrderStatus.DELIVERED, OrderStatus.DELIVERED, OrderStatus.DELIVERED, OrderStatus.READY]) // 75% delivered
      } else if (orderDate < new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)) {
        status = randomChoice([OrderStatus.CUTTING, OrderStatus.STITCHING, OrderStatus.FINISHING, OrderStatus.READY])
      } else {
        status = randomChoice([OrderStatus.NEW, OrderStatus.MATERIAL_SELECTED])
      }

      // Create order items (1-3 items per order)
      const numItems = randomInt(1, 3)
      const orderItems = []
      const itemsData = []

      for (let j = 0; j < numItems; j++) {
        const pattern = randomChoice(garmentPatterns)
        const cloth = randomChoice(clothInventory)
        const bodyType = randomChoice([BodyType.SLIM, BodyType.REGULAR, BodyType.LARGE, BodyType.XL])

        let adjustment = 0
        if (bodyType === BodyType.LARGE) adjustment = pattern.largeAdjustment
        if (bodyType === BodyType.XL) adjustment = pattern.xlAdjustment

        const estimatedMeters = pattern.baseMeters + adjustment
        const fabricCost = estimatedMeters * cloth.pricePerMeter
        const stitchingCharges = 1500
        const itemTotal = fabricCost + stitchingCharges

        // Get matching measurement
        const garmentTypeName = pattern.name.replace(/^(Men's|Women's|Kids)\s+/i, '').trim()
        const measurement = await prisma.measurement.findFirst({
          where: {
            customerId: customer.id,
            garmentType: garmentTypeName,
            isActive: true,
          },
        })

        itemsData.push({
          garmentPatternId: pattern.id,
          clothInventoryId: cloth.id,
          measurementId: measurement?.id, // Link measurement!
          quantity: 1,
          bodyType: bodyType,
          estimatedMeters: parseFloat(estimatedMeters.toFixed(2)),
          pricePerUnit: parseFloat(itemTotal.toFixed(2)),
          totalPrice: parseFloat(itemTotal.toFixed(2)),
          actualMetersUsed: status === OrderStatus.DELIVERED ? parseFloat((estimatedMeters + randomFloat(-0.2, 0.3)).toFixed(2)) : null,
        })

        orderItems.push({
          pattern,
          cloth,
          estimatedMeters,
          itemTotal,
        })
      }

      // Calculate totals
      const subTotal = parseFloat(orderItems.reduce((sum, item) => sum + item.itemTotal, 0).toFixed(2))
      const gstRate = 12
      const gstAmount = parseFloat(((subTotal * gstRate) / 100).toFixed(2))
      const totalAmount = parseFloat((subTotal + gstAmount).toFixed(2))
      const advancePaid = parseFloat((totalAmount * randomFloat(0.3, 0.6)).toFixed(2))
      const balanceAmount = parseFloat((totalAmount - advancePaid).toFixed(2))

      // Create order
      const order = await prisma.order.create({
        data: {
          orderNumber: `ORD-${monthData.year}${String(monthData.month).padStart(2, '0')}-${String(orderNumber++).padStart(4, '0')}`,
          customerId: customer.id,
          userId: randomChoice([salesManager.id, admin.id, owner.id]),
          status: status,
          priority: randomChoice([OrderPriority.NORMAL, OrderPriority.NORMAL, OrderPriority.NORMAL, OrderPriority.URGENT]),
          deliveryDate: deliveryDate,
          orderDate: orderDate,
          completedDate: status === OrderStatus.DELIVERED ? new Date(deliveryDate.getTime() - randomInt(0, 2) * 24 * 60 * 60 * 1000) : null,
          subTotal: subTotal,
          gstRate: gstRate,
          cgst: parseFloat((gstAmount / 2).toFixed(2)),
          sgst: parseFloat((gstAmount / 2).toFixed(2)),
          igst: 0,
          gstAmount: gstAmount,
          taxableAmount: subTotal,
          totalAmount: totalAmount,
          advancePaid: advancePaid,
          balanceAmount: balanceAmount,
          items: {
            create: itemsData,
          },
          createdAt: orderDate,
          updatedAt: orderDate,
        },
      })

      // Reserve stock for active orders (not delivered or cancelled)
      const isActiveOrder = status !== OrderStatus.DELIVERED && status !== OrderStatus.CANCELLED as OrderStatus
      if (isActiveOrder) {
        for (const itemData of itemsData) {
          await prisma.clothInventory.update({
            where: { id: itemData.clothInventoryId },
            data: { reserved: { increment: itemData.estimatedMeters } },
          })
        }
      }

      totalOrders++
    }
  }

  console.log(`✅ Created ${totalOrders} orders with proper measurement linking\n`)

  // 8. Create Purchase Orders
  console.log('🛒 Creating purchase orders...')
  for (let i = 0; i < 15; i++) {
    const supplier = randomChoice(suppliers)
    const poDate = randomDate(new Date(2025, 6, 1), new Date())
    const totalAmount = randomFloat(50000, 200000)
    const paidAmount = randomFloat(30000, Math.min(totalAmount, 150000))
    const balanceAmount = parseFloat((totalAmount - paidAmount).toFixed(2))

    await prisma.purchaseOrder.create({
      data: {
        poNumber: `PO-2025-${String(i + 1).padStart(4, '0')}`,
        supplierId: supplier.id,
        orderDate: poDate,
        expectedDate: new Date(poDate.getTime() + randomInt(7, 21) * 24 * 60 * 60 * 1000),
        receivedDate: i < 12 ? new Date(poDate.getTime() + randomInt(7, 14) * 24 * 60 * 60 * 1000) : null,
        totalAmount: totalAmount,
        paidAmount: paidAmount,
        balanceAmount: balanceAmount,
        status: i < 12 ? 'RECEIVED' : 'PENDING',
        notes: `Bulk order for ${randomChoice(['summer', 'winter', 'wedding'])} season`,
      },
    })
  }
  console.log(`✅ Created 15 purchase orders\n`)

  // 9. Create Expenses
  console.log('💰 Creating expenses...')
  for (let i = 0; i < 20; i++) {
    const amount = randomFloat(5000, 50000)
    await prisma.expense.create({
      data: {
        category: randomChoice(Object.values(ExpenseCategory)),
        amount: amount,
        totalAmount: amount, // Same as amount for simple expenses
        description: `Monthly ${randomChoice(['electricity', 'rent', 'salary', 'maintenance'])} payment`,
        expenseDate: randomDate(new Date(2025, 6, 1), new Date()),
        paymentMode: randomChoice(Object.values(PaymentMode)),
        paidByUser: {
          connect: { id: owner.id }
        },
      },
    })
  }
  console.log(`✅ Created 20 expenses\n`)

  console.log('\n' + '='.repeat(60))
  console.log('🎉 Production seed completed successfully!\n')
  console.log('📊 Summary:')
  console.log(`   Users: 6`)
  console.log(`   Suppliers: ${suppliers.length}`)
  console.log(`   Cloth Items: ${clothInventory.length} (with rack locations)`)
  console.log(`   Accessory Items: ${accessories.length}`)
  console.log(`   Garment Patterns: ${garmentPatterns.length}`)
  console.log(`   Customers: ${customers.length}`)
  console.log(`   Measurements: ${customers.length * 4}`)
  console.log(`   Orders: ${totalOrders} (July 2025 - Jan 2026)`)
  console.log(`   Purchase Orders: 15`)
  console.log(`   Expenses: 20`)
  console.log('='.repeat(60) + '\n')

  console.log('🔑 Login Credentials (password: admin123):')
  console.log('   owner@hameesattire.com - Full access')
  console.log('   admin@hameesattire.com - Administrative access')
  console.log('   inventory@hameesattire.com - Inventory management')
  console.log('   sales@hameesattire.com - Sales and orders')
  console.log('   tailor@hameesattire.com - Order status updates')
  console.log('   viewer@hameesattire.com - Read-only access')
}

main()
  .then(async () => {
    await prisma.$disconnect()
    await pool.end()
    process.exit(0)
  })
  .catch(async (e) => {
    console.error('❌ Error seeding database:', e)
    await prisma.$disconnect()
    await pool.end()
    process.exit(1)
  })
