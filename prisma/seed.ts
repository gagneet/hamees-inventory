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

  // ============================================================
  // CLEAR EXISTING DATA - CORRECT ORDER (children before parents)
  // ============================================================
  console.log('🗑️  Clearing existing data...')

  // Level 1: Leaf tables (no other tables depend on these)
  try { await prisma.designUpload.deleteMany() } catch (e) { /* table may not exist */ }
  try { await prisma.whatsAppMessage.deleteMany() } catch (e) { /* table may not exist */ }
  try { await prisma.whatsAppTemplate.deleteMany() } catch (e) { /* table may not exist */ }
  try { await prisma.orderHistory.deleteMany() } catch (e) { /* table may not exist */ }
  try { await prisma.paymentInstallment.deleteMany() } catch (e) { /* table may not exist */ }
  try { await prisma.alert.deleteMany() } catch (e) { /* table may not exist */ }
  try { await prisma.uploadHistory.deleteMany() } catch (e) { /* table may not exist */ }
  try { await prisma.settings.deleteMany() } catch (e) { /* table may not exist */ }
  try { await prisma.businessSettings.deleteMany() } catch (e) { /* table may not exist */ }

  // Level 2: Stock movements (depend on inventory, orders, users)
  try { await prisma.accessoryStockMovement.deleteMany() } catch (e) { /* table may not exist */ }
  try { await prisma.stockMovement.deleteMany() } catch (e) { /* table may not exist */ }

  // Level 3: Order items (depend on orders, patterns, cloth, measurements)
  try { await prisma.orderItem.deleteMany() } catch (e) { /* table may not exist */ }

  // Level 4: Orders (depend on customers, users, measurements)
  try { await prisma.order.deleteMany() } catch (e) { /* table may not exist */ }

  // Level 5: Measurements (depend on customers, users)
  try { await prisma.measurement.deleteMany() } catch (e) { /* table may not exist */ }

  // Level 6: Customers
  try { await prisma.customer.deleteMany() } catch (e) { /* table may not exist */ }

  // Level 7: Garment accessories (depend on patterns, accessories)
  try { await prisma.garmentAccessory.deleteMany() } catch (e) { /* table may not exist */ }

  // Level 8: Accessory inventory (now safe)
  try { await prisma.accessoryInventory.deleteMany() } catch (e) { /* table may not exist */ }

  // Level 9: Garment patterns
  try { await prisma.garmentPattern.deleteMany() } catch (e) { /* table may not exist */ }

  // Level 10: PO items
  try { await prisma.pOItem.deleteMany() } catch (e) { /* table may not exist */ }

  // Level 11: Purchase orders (depend on suppliers)
  try { await prisma.purchaseOrder.deleteMany() } catch (e) { /* table may not exist */ }

  // Level 12: Supplier prices (depend on suppliers, cloth)
  try { await prisma.supplierPrice.deleteMany() } catch (e) { /* table may not exist */ }

  // Level 13: Cloth inventory (depend on suppliers)
  try { await prisma.clothInventory.deleteMany() } catch (e) { /* table may not exist */ }

  // Level 14: Suppliers
  try { await prisma.supplier.deleteMany() } catch (e) { /* table may not exist */ }

  // Level 15: Expenses (depend on users)
  try { await prisma.expense.deleteMany() } catch (e) { /* table may not exist */ }

  // Level 16: Users (many things depend on this, delete last)
  try { await prisma.user.deleteMany() } catch (e) { /* table may not exist */ }

  console.log('✅ Cleared existing data\n')

  // ============================================================
  // 1. CREATE USERS (6 roles)
  // ============================================================
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

  console.log('✅ Created 6 users\n')

  // ============================================================
  // 2. CREATE SUPPLIERS
  // ============================================================
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

  // ============================================================
  // 3. CREATE CLOTH INVENTORY
  // ============================================================
  console.log('📦 Creating cloth inventory...')
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
  for (let i = 0; i < clothTypes.length; i++) {
    const cloth = clothTypes[i]
    const item = await prisma.clothInventory.create({
      data: {
        sku: `CLT-${cloth.type.substring(0, 3).toUpperCase()}-${cloth.brand.substring(0, 3).toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
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
        minimumStockMeters: cloth.minimum,  // NEW FIELD NAME
        supplier: suppliers[randomInt(0, 1)].name,
        supplierId: suppliers[randomInt(0, 1)].id,
        location: `Rack ${cloth.rack}`,
      },
    })
    clothInventory.push(item)
  }
  console.log(`✅ Created ${clothInventory.length} cloth items\n`)

  // ============================================================
  // 4. CREATE ACCESSORY INVENTORY
  // ============================================================
  console.log('🔘 Creating accessory inventory...')
  const accessories = await Promise.all([
    prisma.accessoryInventory.create({
      data: {
        sku: 'ACC-BUT-001',
        name: 'Pearl Buttons',
        type: 'Button',
        color: 'White',
        currentStock: 5000,
        reserved: 0,
        minimumStockUnits: 500,  // NEW FIELD NAME
        pricePerUnit: 2.5,
        supplier: suppliers[2].name,
        supplierId: suppliers[2].id
      },
    }),
    prisma.accessoryInventory.create({
      data: {
        sku: 'ACC-BUT-002',
        name: 'Metal Buttons',
        type: 'Button',
        color: 'Gold',
        currentStock: 3000,
        reserved: 0,
        minimumStockUnits: 300,  // NEW FIELD NAME
        pricePerUnit: 5.0,
        supplier: suppliers[2].name,
        supplierId: suppliers[2].id
      },
    }),
    prisma.accessoryInventory.create({
      data: {
        sku: 'ACC-BUT-003',
        name: 'Black Buttons',
        type: 'Button',
        color: 'Black',
        currentStock: 4000,
        reserved: 0,
        minimumStockUnits: 400,  // NEW FIELD NAME
        pricePerUnit: 3.0,
        supplier: suppliers[2].name,
        supplierId: suppliers[2].id
      },
    }),
    prisma.accessoryInventory.create({
      data: {
        sku: 'ACC-THR-001',
        name: 'Polyester Thread',
        type: 'Thread',
        color: 'White',
        currentStock: 2000,
        reserved: 0,
        minimumStockUnits: 200,  // NEW FIELD NAME
        pricePerUnit: 15.0,
        supplier: suppliers[2].name,
        supplierId: suppliers[2].id
      },
    }),
    prisma.accessoryInventory.create({
      data: {
        sku: 'ACC-THR-002',
        name: 'Cotton Thread',
        type: 'Thread',
        color: 'Black',
        currentStock: 1800,
        reserved: 0,
        minimumStockUnits: 180,  // NEW FIELD NAME
        pricePerUnit: 18.0,
        supplier: suppliers[2].name,
        supplierId: suppliers[2].id
      },
    }),
    prisma.accessoryInventory.create({
      data: {
        sku: 'ACC-ZIP-001',
        name: 'Metal Zipper',
        type: 'Zipper',
        color: 'Silver',
        currentStock: 1200,
        reserved: 0,
        minimumStockUnits: 120,  // NEW FIELD NAME
        pricePerUnit: 25.0,
        supplier: suppliers[2].name,
        supplierId: suppliers[2].id
      },
    }),
  ])
  console.log(`✅ Created ${accessories.length} accessory items\n`)

  // ============================================================
  // 5. CREATE GARMENT PATTERNS
  // ============================================================
  console.log('👔 Creating garment patterns...')
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
        basicStitchingCharge: 2000,
        premiumStitchingCharge: 3000,
        luxuryStitchingCharge: 4000,
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
        basicStitchingCharge: 2500,
        premiumStitchingCharge: 3500,
        luxuryStitchingCharge: 5000,
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
        basicStitchingCharge: 8000,
        premiumStitchingCharge: 12000,
        luxuryStitchingCharge: 16000,
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
        basicStitchingCharge: 12000,
        premiumStitchingCharge: 18000,
        luxuryStitchingCharge: 25000,
      },
    }),
  ])

  // Link accessories to garment patterns
  await prisma.garmentAccessory.createMany({
    data: [
      { garmentPatternId: garmentPatterns[0].id, accessoryId: accessories[0].id, quantityPerGarment: 8 },  // Shirt - Pearl Buttons
      { garmentPatternId: garmentPatterns[0].id, accessoryId: accessories[3].id, quantityPerGarment: 1 },  // Shirt - Thread
      { garmentPatternId: garmentPatterns[1].id, accessoryId: accessories[2].id, quantityPerGarment: 1 },  // Trouser - Black Buttons
      { garmentPatternId: garmentPatterns[1].id, accessoryId: accessories[4].id, quantityPerGarment: 1 },  // Trouser - Thread
      { garmentPatternId: garmentPatterns[1].id, accessoryId: accessories[5].id, quantityPerGarment: 1 },  // Trouser - Zipper
      { garmentPatternId: garmentPatterns[2].id, accessoryId: accessories[1].id, quantityPerGarment: 6 },  // Suit - Metal Buttons
      { garmentPatternId: garmentPatterns[2].id, accessoryId: accessories[3].id, quantityPerGarment: 2 },  // Suit - Thread
      { garmentPatternId: garmentPatterns[3].id, accessoryId: accessories[1].id, quantityPerGarment: 10 }, // Sherwani - Metal Buttons
      { garmentPatternId: garmentPatterns[3].id, accessoryId: accessories[3].id, quantityPerGarment: 2 },  // Sherwani - Thread
    ],
  })
  console.log(`✅ Created ${garmentPatterns.length} garment patterns with accessories\n`)

  // ============================================================
  // 6. CREATE CUSTOMERS WITH MEASUREMENTS
  // ============================================================
  console.log('👤 Creating customers with measurements...')
  const customerNames = [
    'Rahul Verma', 'Amit Patel', 'Vikram Singh', 'Arjun Mehta', 'Rohan Kapoor',
    'Sanjay Sharma', 'Rajesh Kumar', 'Anil Gupta', 'Suresh Reddy', 'Manoj Agarwal',
    'Karan Malhotra', 'Ajay Joshi', 'Deepak Nair', 'Nitin Desai', 'Praveen Rao',
  ]

  const customers = []
  for (let i = 0; i < customerNames.length; i++) {
    const isB2B = i % 5 === 0
    const states = ['Maharashtra', 'Delhi', 'Karnataka', 'Telangana', 'Tamil Nadu']
    const state = randomChoice(states)

    const customer = await prisma.customer.create({
      data: {
        name: customerNames[i],
        phone: `+91 ${90000 + i}00000`,
        email: `${customerNames[i].toLowerCase().replace(' ', '.')}@email.com`,
        address: `${randomInt(1, 999)} MG Road`,
        city: randomChoice(['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai']),
        state: state,
        pincode: `${randomInt(100000, 999999)}`,
        customerType: isB2B ? 'B2B' : 'B2C',
        gstin: isB2B ? `${randomInt(10, 37)}AABCU${randomInt(1000, 9999)}R${randomInt(1, 9)}Z${randomInt(1, 9)}` : null,
      },
    })

    // Create measurements for Shirt and Trouser
    const measurementTypes = ['Shirt', 'Trouser']
    for (const garmentType of measurementTypes) {
      await prisma.measurement.create({
        data: {
          customerId: customer.id,
          userId: tailor.id,
          garmentType: garmentType,
          bodyType: randomChoice([BodyType.SLIM, BodyType.REGULAR, BodyType.LARGE, BodyType.XL]),
          chest: garmentType === 'Shirt' ? randomFloat(36, 46) : null,
          waist: randomFloat(30, 40),
          shoulder: garmentType === 'Shirt' ? randomFloat(15, 19) : null,
          sleeveLength: garmentType === 'Shirt' ? randomFloat(23, 27) : null,
          shirtLength: garmentType === 'Shirt' ? randomFloat(28, 32) : null,
          inseam: garmentType === 'Trouser' ? randomFloat(30, 34) : null,
          outseam: garmentType === 'Trouser' ? randomFloat(40, 44) : null,
          hip: garmentType === 'Trouser' ? randomFloat(38, 44) : null,
          isActive: true,
        },
      })
    }

    customers.push(customer)
  }
  console.log(`✅ Created ${customers.length} customers with measurements\n`)

  // ============================================================
  // 7. CREATE ORDERS (simplified - 20 orders)
  // ============================================================
  console.log('📋 Creating orders...')

  let totalOrders = 0

  for (let i = 0; i < 20; i++) {
    const customer = randomChoice(customers)
    const orderDate = randomDate(new Date(2025, 6, 1), new Date())
    const deliveryDate = new Date(orderDate.getTime() + randomInt(7, 14) * 24 * 60 * 60 * 1000)

    // Determine status based on delivery date
    let status: OrderStatus
    const now = new Date()
    if (deliveryDate < now) {
      status = randomChoice([OrderStatus.DELIVERED, OrderStatus.DELIVERED, OrderStatus.READY])
    } else {
      status = randomChoice([OrderStatus.NEW, OrderStatus.MATERIAL_SELECTED, OrderStatus.CUTTING, OrderStatus.STITCHING])
    }

    const pattern = randomChoice(garmentPatterns)
    const cloth = randomChoice(clothInventory)
    const bodyType = randomChoice([BodyType.SLIM, BodyType.REGULAR, BodyType.LARGE])

    let adjustment = 0
    if (bodyType === BodyType.LARGE) adjustment = pattern.largeAdjustment

    const estimatedMeters = pattern.baseMeters + adjustment
    const fabricCost = estimatedMeters * cloth.pricePerMeter
    const stitchingCharges = pattern.basicStitchingCharge
    const itemTotal = fabricCost + stitchingCharges

    const gstRate = 12
    const gstAmount = (itemTotal * gstRate) / 100
    const totalAmount = itemTotal + gstAmount
    const advancePaid = totalAmount * randomFloat(0.3, 0.6)
    const balanceAmount = totalAmount - advancePaid

    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-2025-${String(i + 1).padStart(4, '0')}`,
        customerId: customer.id,
        userId: randomChoice([salesManager.id, admin.id, owner.id]),
        status: status,
        priority: randomChoice([OrderPriority.NORMAL, OrderPriority.NORMAL, OrderPriority.URGENT]),
        deliveryDate: deliveryDate,
        orderDate: orderDate,
        completedDate: status === OrderStatus.DELIVERED ? deliveryDate : null,
        subTotal: itemTotal,
        gstRate: gstRate,
        cgst: gstAmount / 2,
        sgst: gstAmount / 2,
        igst: 0,
        gstAmount: gstAmount,
        taxableAmount: itemTotal,
        totalAmount: totalAmount,
        advancePaid: advancePaid,
        balanceAmount: balanceAmount,
        items: {
          create: [{
            garmentPatternId: pattern.id,
            clothInventoryId: cloth.id,
            assignedTailorId: randomChoice([tailor.id, null]),
            quantityOrdered: 1,  // NEW FIELD NAME
            bodyType: bodyType,
            estimatedMeters: estimatedMeters,
            actualMetersUsed: status === OrderStatus.DELIVERED ? estimatedMeters + randomFloat(-0.1, 0.2) : null,
            wastageMeters: status === OrderStatus.DELIVERED ? randomFloat(0.05, 0.15) : null,  // NEW FIELD NAME
            pricePerUnit: itemTotal,
            totalPrice: itemTotal,
          }],
        },
        createdAt: orderDate,
        updatedAt: orderDate,
      },
    })

    // Create stock movement for non-NEW orders
    if (status !== OrderStatus.NEW) {
      await prisma.stockMovement.create({
        data: {
          clothInventoryId: cloth.id,
          orderId: order.id,
          userId: owner.id,
          type: status === OrderStatus.DELIVERED ? StockMovementType.ORDER_USED : StockMovementType.ORDER_RESERVED,
          quantityMeters: -estimatedMeters,  // NEW FIELD NAME
          balanceAfterMeters: cloth.currentStock - estimatedMeters,  // NEW FIELD NAME
          notes: `${status === OrderStatus.DELIVERED ? 'Used' : 'Reserved'} for order ${order.orderNumber}`,
          createdAt: orderDate,
        },
      })

      // Update cloth reserved
      if (status !== OrderStatus.DELIVERED) {
        await prisma.clothInventory.update({
          where: { id: cloth.id },
          data: { reserved: { increment: estimatedMeters } },
        })
      }
    }

    totalOrders++
  }

  console.log(`✅ Created ${totalOrders} orders\n`)

  // ============================================================
  // 8. CREATE PURCHASE ORDERS
  // ============================================================
  console.log('🛒 Creating purchase orders...')
  for (let i = 0; i < 10; i++) {
    const supplier = randomChoice(suppliers)
    const poDate = randomDate(new Date(2025, 6, 1), new Date())
    const subTotal = randomFloat(50000, 150000)
    const gstRate = 18
    const gstAmount = (subTotal * gstRate) / 100
    const totalAmount = subTotal + gstAmount
    const paidAmount = randomFloat(30000, Math.min(totalAmount, 100000))
    const balanceAmount = totalAmount - paidAmount
    const isReceived = i < 7

    await prisma.purchaseOrder.create({
      data: {
        poNumber: `PO-2025-${String(i + 1).padStart(4, '0')}`,
        supplierId: supplier.id,
        orderDate: poDate,
        expectedDate: new Date(poDate.getTime() + randomInt(7, 21) * 24 * 60 * 60 * 1000),
        receivedDate: isReceived ? new Date(poDate.getTime() + randomInt(7, 14) * 24 * 60 * 60 * 1000) : null,
        subTotal: subTotal,
        gstRate: gstRate,
        cgst: gstAmount / 2,
        sgst: gstAmount / 2,
        igst: 0,
        gstAmount: gstAmount,
        isInputTaxCredit: true,
        itcClaimed: isReceived && i % 3 === 0,
        supplierInvoiceNumber: isReceived ? `SINV-${supplier.name.substring(0, 3).toUpperCase()}-${randomInt(1000, 9999)}` : null,
        supplierInvoiceDate: isReceived ? poDate : null,
        totalAmount: totalAmount,
        paidAmount: paidAmount,
        balanceAmount: balanceAmount,
        status: isReceived ? 'RECEIVED' : 'PENDING',
        items: {
          create: [{
            itemName: randomChoice(clothInventory).name,
            itemType: 'CLOTH',
            orderedQuantity: randomFloat(20, 50),  // NEW FIELD NAME
            unit: 'meters',
            pricePerUnit: randomFloat(300, 800),
            totalPrice: subTotal,
            receivedQuantity: isReceived ? randomFloat(20, 50) : 0,
          }],
        },
      },
    })
  }
  console.log('✅ Created 10 purchase orders\n')

  // ============================================================
  // 9. CREATE EXPENSES
  // ============================================================
  console.log('💰 Creating expenses...')
  for (let i = 0; i < 10; i++) {
    const amount = randomFloat(5000, 30000)
    await prisma.expense.create({
      data: {
        category: randomChoice(Object.values(ExpenseCategory)),
        amount: amount,
        totalAmount: amount,
        description: `Monthly ${randomChoice(['electricity', 'rent', 'salary', 'maintenance'])} payment`,
        expenseDate: randomDate(new Date(2025, 6, 1), new Date()),
        paymentMode: randomChoice(Object.values(PaymentMode)),
        paidBy: owner.id,
      },
    })
  }
  console.log('✅ Created 10 expenses\n')

  // ============================================================
  // 10. CREATE SETTINGS
  // ============================================================
  console.log('⚙️  Creating settings...')
  await prisma.settings.createMany({
    data: [
      { key: 'shop_name', value: 'Hamees Attire', description: 'Name of the tailor shop' },
      { key: 'shop_phone', value: '+91-8400008096', description: 'Shop contact number' },
      { key: 'shop_email', value: 'contact@hameesattire.com', description: 'Shop email address' },
      { key: 'shop_address', value: 'Amritsar, Punjab, India', description: 'Shop address' },
      { key: 'currency', value: 'INR', description: 'Default currency' },
      { key: 'low_stock_multiplier', value: '1.0', description: 'Multiplier for low stock alerts' },
      { key: 'critical_stock_multiplier', value: '0.5', description: 'Multiplier for critical stock alerts' },
    ],
  })
  console.log('✅ Settings created\n')

  // ============================================================
  // 11. CREATE ALERTS
  // ============================================================
  console.log('🔔 Creating alerts...')
  await prisma.alert.create({
    data: {
      type: 'LOW_STOCK',
      severity: 'MEDIUM',
      title: 'Low Stock Alert - Cloth',
      message: 'Brocade Silk is running low. Current: 65m, Minimum: 15m',
      relatedId: clothInventory[9].id,
      relatedType: 'ClothInventory',
    },
  })
  console.log('✅ Alerts created\n')

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('='.repeat(60))
  console.log('🎉 Production seed completed successfully!\n')
  console.log('📊 Summary:')
  console.log(`   Users: 6`)
  console.log(`   Suppliers: ${suppliers.length}`)
  console.log(`   Cloth Items: ${clothInventory.length}`)
  console.log(`   Accessory Items: ${accessories.length}`)
  console.log(`   Garment Patterns: ${garmentPatterns.length}`)
  console.log(`   Customers: ${customers.length}`)
  console.log(`   Orders: ${totalOrders}`)
  console.log(`   Purchase Orders: 10`)
  console.log(`   Expenses: 10`)
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
