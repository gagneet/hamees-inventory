import { PrismaClient, UserRole, OrderStatus, OrderPriority, BodyType, StockMovementType } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'
import { subMonths, subDays, addDays } from 'date-fns'

dotenv.config()

const connectionString = process.env.DATABASE_URL!
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({
  adapter,
  log: ['error'],
})

// Utility function to create dates in the past
function pastDate(monthsAgo: number, daysAgo: number = 0) {
  return subDays(subMonths(new Date(), monthsAgo), daysAgo)
}

async function main() {
  console.log('🌱 Starting enhanced seed...')

  // Clear existing data
  console.log('🗑️  Clearing existing data...')
  await prisma.stockMovement.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.alert.deleteMany()
  await prisma.measurement.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.garmentAccessory.deleteMany()
  await prisma.accessoryInventory.deleteMany()
  await prisma.garmentPattern.deleteMany()
  await prisma.supplierPrice.deleteMany()
  await prisma.pOItem.deleteMany()
  await prisma.purchaseOrder.deleteMany()
  await prisma.clothInventory.deleteMany()
  await prisma.supplier.deleteMany()
  await prisma.user.deleteMany()
  await prisma.settings.deleteMany()

  // 1. Create Users
  console.log('👤 Creating users...')
  const hashedPassword = await bcrypt.hash('admin123', 10)

  const owner = await prisma.user.create({
    data: {
      email: 'owner@hameesattire.com',
      password: hashedPassword,
      name: 'Shop Owner',
      role: UserRole.OWNER,
      phone: '+91-8400008096',
    },
  })

  const admin = await prisma.user.create({
    data: {
      email: 'admin@hameesattire.com',
      password: hashedPassword,
      name: 'Admin User',
      role: UserRole.ADMIN,
      phone: '+91-8400008097',
    },
  })

  const inventoryManager = await prisma.user.create({
    data: {
      email: 'inventory@hameesattire.com',
      password: hashedPassword,
      name: 'Inventory Manager',
      role: UserRole.INVENTORY_MANAGER,
      phone: '+91-8400008098',
    },
  })

  const salesManager = await prisma.user.create({
    data: {
      email: 'sales@hameesattire.com',
      password: hashedPassword,
      name: 'Sales Manager',
      role: UserRole.SALES_MANAGER,
      phone: '+91-8400008099',
    },
  })

  const tailor = await prisma.user.create({
    data: {
      email: 'tailor@hameesattire.com',
      password: hashedPassword,
      name: 'Master Tailor',
      role: UserRole.TAILOR,
      phone: '+91-8400008100',
    },
  })

  const viewer = await prisma.user.create({
    data: {
      email: 'viewer@hameesattire.com',
      password: hashedPassword,
      name: 'Viewer User',
      role: UserRole.VIEWER,
      phone: '+91-8400008101',
    },
  })

  console.log('✅ Users created (6 roles)')

  // 2. Create Suppliers
  console.log('🏢 Creating suppliers...')
  const supplier1 = await prisma.supplier.create({
    data: {
      name: 'ABC Fabrics',
      contactPerson: 'Ramesh Kumar',
      email: 'contact@abcfabrics.com',
      phone: '+91-98765-11111',
      address: 'Fabric Market, Sector 10',
      city: 'Ludhiana',
      state: 'Punjab',
      pincode: '141001',
      gstin: 'GST1234567890',
      rating: 5.0,
      notes: 'Excellent quality and timely delivery',
    },
  })

  const supplier2 = await prisma.supplier.create({
    data: {
      name: 'XYZ Textiles',
      contactPerson: 'Suresh Patel',
      email: 'info@xyztextiles.com',
      phone: '+91-98765-22222',
      address: 'Textile Hub, Ring Road',
      city: 'Surat',
      state: 'Gujarat',
      pincode: '395001',
      gstin: 'GST0987654321',
      rating: 4.2,
      notes: 'Good variety of fabrics',
    },
  })

  console.log('✅ Suppliers created')

  // 3. Create Cloth Inventory (More variety)
  console.log('📦 Creating cloth inventory...')
  const clothItems = await Promise.all([
    prisma.clothInventory.create({
      data: {
        sku: 'COT-BLU-001',
        name: 'Cotton Blue Premium',
        brand: 'ABC Premium',
        color: 'Blue',
        colorHex: '#1E40AF',
        pattern: 'Plain',
        quality: 'Premium',
        type: 'Cotton',
        pricePerMeter: 250,
        currentStock: 45,
        totalPurchased: 180,
        reserved: 8,
        minimumStockMeters: 15,
        supplier: supplier1.name,
        supplierId: supplier1.id,
        location: 'Rack A-1',
        notes: 'Popular for formal shirts',
      },
    }),
    prisma.clothInventory.create({
      data: {
        sku: 'SIL-RED-001',
        name: 'Silk Red Wedding',
        brand: 'Royal Silk',
        color: 'Red',
        colorHex: '#DC2626',
        pattern: 'Jacquard',
        quality: 'Premium',
        type: 'Silk',
        pricePerMeter: 850,
        currentStock: 18,
        totalPurchased: 150,
        reserved: 5,
        minimumStockMeters: 20,
        supplier: supplier1.name,
        supplierId: supplier1.id,
        location: 'Rack B-1',
        notes: 'Wedding and special occasions',
      },
    }),
    prisma.clothInventory.create({
      data: {
        sku: 'COT-WHI-001',
        name: 'Cotton White Standard',
        brand: 'Daily Wear',
        color: 'White',
        colorHex: '#FFFFFF',
        pattern: 'Plain',
        quality: 'Standard',
        type: 'Cotton',
        pricePerMeter: 180,
        currentStock: 65,
        totalPurchased: 200,
        reserved: 12,
        minimumStockMeters: 25,
        supplier: supplier2.name,
        supplierId: supplier2.id,
        location: 'Rack A-2',
        notes: 'Best seller for casual shirts',
      },
    }),
    prisma.clothInventory.create({
      data: {
        sku: 'LIN-BEI-001',
        name: 'Linen Beige Natural',
        brand: 'Natural Linen',
        color: 'Beige',
        colorHex: '#F5F5DC',
        pattern: 'Textured',
        quality: 'Premium',
        type: 'Linen',
        pricePerMeter: 420,
        currentStock: 38,
        totalPurchased: 150,
        reserved: 6,
        minimumStockMeters: 20,
        supplier: supplier2.name,
        supplierId: supplier2.id,
        location: 'Rack C-1',
        notes: 'Summer collection',
      },
    }),
    prisma.clothInventory.create({
      data: {
        sku: 'WOL-GRY-001',
        name: 'Wool Grey Premium',
        brand: 'Premium Wool',
        color: 'Grey',
        colorHex: '#6B7280',
        pattern: 'Herringbone',
        quality: 'Premium',
        type: 'Wool',
        pricePerMeter: 950,
        currentStock: 52,
        totalPurchased: 120,
        reserved: 10,
        minimumStockMeters: 15,
        supplier: supplier1.name,
        supplierId: supplier1.id,
        location: 'Rack D-1',
        notes: 'Perfect for suits',
      },
    }),
    prisma.clothInventory.create({
      data: {
        sku: 'COT-BLK-001',
        name: 'Cotton Black Formal',
        brand: 'Black Label',
        color: 'Black',
        colorHex: '#000000',
        pattern: 'Plain',
        quality: 'Premium',
        type: 'Cotton',
        pricePerMeter: 320,
        currentStock: 40,
        totalPurchased: 140,
        reserved: 7,
        minimumStockMeters: 18,
        supplier: supplier1.name,
        supplierId: supplier1.id,
        location: 'Rack A-3',
        notes: 'Formal occasions',
      },
    }),
  ])

  console.log('✅ Cloth inventory created')

  // 4. Create Accessories
  console.log('🔘 Creating accessories...')
  const button1 = await prisma.accessoryInventory.create({
    data: {
      sku: 'ACC-BUT-ENH-001',
      name: 'Formal Shirt Button',
      type: 'Button',
      color: 'White',
      currentStock: 500,
      minimumStockUnits: 100,
      pricePerUnit: 2,
      supplier: supplier1.name,
      supplierId: supplier1.id,
    },
  })

  const thread1 = await prisma.accessoryInventory.create({
    data: {
      sku: 'ACC-THR-ENH-001',
      name: 'Polyester Thread',
      type: 'Thread',
      color: 'White',
      currentStock: 200,
      minimumStockUnits: 50,
      pricePerUnit: 15,
      supplier: supplier1.name,
      supplierId: supplier1.id,
    },
  })

  const zipper1 = await prisma.accessoryInventory.create({
    data: {
      sku: 'ACC-ZIP-ENH-001',
      name: 'Metal Zipper',
      type: 'Zipper',
      color: 'Black',
      currentStock: 80,
      minimumStockUnits: 20,
      pricePerUnit: 25,
      supplier: supplier2.name,
      supplierId: supplier2.id,
    },
  })

  console.log('✅ Accessories created')

  // 5. Create Garment Patterns
  console.log('👔 Creating garment patterns...')
  const shirtPattern = await prisma.garmentPattern.create({
    data: {
      name: "Men's Shirt",
      description: 'Standard formal/casual shirt pattern',
      baseMeters: 2.5,
      slimAdjustment: 0,
      regularAdjustment: 0,
      largeAdjustment: 0.3,
      xlAdjustment: 0.5,
    },
  })

  const trouserPattern = await prisma.garmentPattern.create({
    data: {
      name: "Men's Trouser",
      description: 'Standard trouser pattern',
      baseMeters: 1.8,
      slimAdjustment: 0,
      regularAdjustment: 0,
      largeAdjustment: 0.2,
      xlAdjustment: 0.4,
    },
  })

  const suitPattern = await prisma.garmentPattern.create({
    data: {
      name: "Men's Suit",
      description: 'Complete suit (jacket + trouser)',
      baseMeters: 3.5,
      slimAdjustment: 0,
      regularAdjustment: 0,
      largeAdjustment: 0.5,
      xlAdjustment: 0.8,
    },
  })

  const sherwaniPattern = await prisma.garmentPattern.create({
    data: {
      name: "Men's Sherwani",
      description: 'Traditional sherwani pattern',
      baseMeters: 4.5,
      slimAdjustment: 0,
      regularAdjustment: 0,
      largeAdjustment: 0.6,
      xlAdjustment: 1.0,
    },
  })

  // Link accessories to patterns
  await prisma.garmentAccessory.createMany({
    data: [
      { garmentPatternId: shirtPattern.id, accessoryId: button1.id, quantityPerGarment: 10 },
      { garmentPatternId: shirtPattern.id, accessoryId: thread1.id, quantityPerGarment: 1 },
      { garmentPatternId: trouserPattern.id, accessoryId: button1.id, quantityPerGarment: 2 },
      { garmentPatternId: trouserPattern.id, accessoryId: thread1.id, quantityPerGarment: 1 },
      { garmentPatternId: trouserPattern.id, accessoryId: zipper1.id, quantityPerGarment: 1 },
      { garmentPatternId: suitPattern.id, accessoryId: button1.id, quantityPerGarment: 15 },
      { garmentPatternId: suitPattern.id, accessoryId: thread1.id, quantityPerGarment: 2 },
      { garmentPatternId: suitPattern.id, accessoryId: zipper1.id, quantityPerGarment: 1 },
      { garmentPatternId: sherwaniPattern.id, accessoryId: button1.id, quantityPerGarment: 12 },
      { garmentPatternId: sherwaniPattern.id, accessoryId: thread1.id, quantityPerGarment: 2 },
    ],
  })

  console.log('✅ Garment patterns created')

  // 6. Create Customers with Measurements
  console.log('👥 Creating customers with measurements...')

  const customersData = [
    {
      name: 'Rajesh Kumar',
      email: 'rajesh.kumar@example.com',
      phone: '+91-98765-99999',
      city: 'Delhi',
      measurements: { neck: 40, chest: 100, waist: 90, shoulder: 45, sleeveLength: 62, shirtLength: 76 },
    },
    {
      name: 'Amit Sharma',
      email: 'amit.sharma@example.com',
      phone: '+91-98765-88888',
      city: 'Mumbai',
      measurements: { neck: 41, chest: 105, waist: 95, shoulder: 46, sleeveLength: 63, shirtLength: 78 },
    },
    {
      name: 'Vikram Singh',
      email: 'vikram@example.com',
      phone: '+91-98765-77777',
      city: 'Bangalore',
      measurements: { neck: 39, chest: 98, waist: 88, shoulder: 44, sleeveLength: 61, shirtLength: 75 },
    },
    {
      name: 'Arjun Patel',
      email: 'arjun@example.com',
      phone: '+91-98765-66666',
      city: 'Ahmedabad',
      measurements: { neck: 42, chest: 108, waist: 98, shoulder: 47, sleeveLength: 64, shirtLength: 79 },
    },
    {
      name: 'Rahul Mehta',
      email: 'rahul@example.com',
      phone: '+91-98765-55555',
      city: 'Pune',
      measurements: { neck: 40, chest: 102, waist: 92, shoulder: 45, sleeveLength: 62, shirtLength: 77 },
    },
  ]

  const customers = []
  for (const data of customersData) {
    const customer = await prisma.customer.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: '123 Main Street',
        city: data.city,
        state: 'State',
        pincode: '110001',
        notes: 'Regular customer',
      },
    })

    await prisma.measurement.create({
      data: {
        customerId: customer.id,
        garmentType: "Men's Shirt",
        ...data.measurements,
        notes: 'Regular fit preferred',
      },
    })

    customers.push(customer)
  }

  console.log('✅ Customers and measurements created')

  // 7. Create Comprehensive Orders (Last 6 months)
  console.log('📝 Creating comprehensive orders...')

  const orderStatuses: OrderStatus[] = [
    OrderStatus.DELIVERED,
    OrderStatus.DELIVERED,
    OrderStatus.DELIVERED,
    OrderStatus.READY,
    OrderStatus.FINISHING,
    OrderStatus.STITCHING,
    OrderStatus.CUTTING,
    OrderStatus.MATERIAL_SELECTED,
    OrderStatus.NEW,
  ]

  let orderCount = 0

  // Create orders for the last 6 months
  for (let month = 5; month >= 0; month--) {
    const ordersThisMonth = month === 0 ? 8 : Math.floor(Math.random() * 6) + 3 // More orders in current month

    for (let i = 0; i < ordersThisMonth; i++) {
      const customer = customers[Math.floor(Math.random() * customers.length)]
      const cloth = clothItems[Math.floor(Math.random() * clothItems.length)]
      const pattern = Math.random() > 0.5 ? shirtPattern : (Math.random() > 0.5 ? suitPattern : trouserPattern)
      const bodyType = [BodyType.SLIM, BodyType.REGULAR, BodyType.LARGE][Math.floor(Math.random() * 3)]

      let adjustment = 0
      if (bodyType === BodyType.LARGE) adjustment = pattern.largeAdjustment

      const estimatedMeters = pattern.baseMeters + adjustment
      const itemTotal = estimatedMeters * cloth.pricePerMeter + 1500 // Add stitching charges

      const status = month > 0 ? OrderStatus.DELIVERED : orderStatuses[i % orderStatuses.length]
      const orderDate = pastDate(month, Math.floor(Math.random() * 28))
      const deliveryDate = addDays(orderDate, 7 + Math.floor(Math.random() * 7))

      const order = await prisma.order.create({
        data: {
          orderNumber: `ORD-${Date.now()}-${String(orderCount++).padStart(3, '0')}`,
          customerId: customer.id,
          userId: owner.id,
          status,
          priority: Math.random() > 0.8 ? OrderPriority.URGENT : OrderPriority.NORMAL,
          orderDate,
          deliveryDate,
          completedDate: status === OrderStatus.DELIVERED ? deliveryDate : null,
          totalAmount: itemTotal,
          advancePaid: itemTotal * 0.5,
          balanceAmount: itemTotal * 0.5,
          notes: 'Customer order',
          createdAt: orderDate,
          items: {
            create: [
              {
                garmentPatternId: pattern.id,
                clothInventoryId: cloth.id,
                quantityOrdered: 1,
                bodyType,
                estimatedMeters,
                actualMetersUsed: status === OrderStatus.DELIVERED ? estimatedMeters + 0.1 : null,
                wastageMeters: status === OrderStatus.DELIVERED ? 0.1 : null,
                pricePerUnit: itemTotal,
                totalPrice: itemTotal,
              },
            ],
          },
        },
      })

      // Create stock movement if order is past material selection stage
      if (status !== OrderStatus.NEW) {
        await prisma.stockMovement.create({
          data: {
            clothInventoryId: cloth.id,
            orderId: order.id,
            userId: owner.id,
            type: status === OrderStatus.DELIVERED ? StockMovementType.ORDER_USED : StockMovementType.ORDER_RESERVED,
            quantityMeters: -estimatedMeters,
            balanceAfterMeters: cloth.currentStock - estimatedMeters,
            notes: `${status === OrderStatus.DELIVERED ? 'Used' : 'Reserved'} for order ${order.orderNumber}`,
            createdAt: orderDate,
          },
        })
      }
    }
  }

  console.log('✅ Comprehensive orders created')

  // 8. Create Settings
  console.log('⚙️  Creating settings...')
  await prisma.settings.createMany({
    data: [
      { key: 'shop_name', value: 'Hamees Tailors', description: 'Name of the tailor shop' },
      { key: 'shop_phone', value: '+91-98765-00000', description: 'Shop contact number' },
      { key: 'shop_email', value: 'contact@hamees.com', description: 'Shop email address' },
      { key: 'shop_address', value: '789 Fashion Street, Mumbai, Maharashtra 400001', description: 'Shop address' },
      { key: 'currency', value: 'INR', description: 'Default currency' },
      { key: 'low_stock_multiplier', value: '1.0', description: 'Multiplier for low stock alerts' },
      { key: 'critical_stock_multiplier', value: '0.5', description: 'Multiplier for critical stock alerts' },
    ],
  })

  console.log('✅ Settings created')

  // 9. Create Alerts
  console.log('🔔 Creating alerts...')

  // Check for low stock cloth items and create alerts
  const lowStockCloth = clothItems.filter(item => (item.currentStock - item.reserved) < item.minimumStockMeters)

  for (const item of lowStockCloth) {
    const available = item.currentStock - item.reserved
    const severity = available < (item.minimumStockMeters * 0.5) ? 'HIGH' : 'MEDIUM'

    await prisma.alert.create({
      data: {
        type: severity === 'HIGH' ? 'CRITICAL_STOCK' : 'LOW_STOCK',
        severity,
        title: `${severity === 'HIGH' ? 'Critical' : 'Low'} Stock Alert - Cloth`,
        message: `${item.name} is running ${severity === 'HIGH' ? 'critically' : ''} low. Available: ${available}m, Minimum: ${item.minimumStockMeters}m`,
        relatedId: item.id,
        relatedType: 'ClothInventory',
      },
    })
  }

  // Check for low stock accessory items and create alerts
  const allAccessories = await prisma.accessoryInventory.findMany()
  const lowStockAccessories = allAccessories.filter(item => item.currentStock < item.minimumStockUnits)

  for (const item of lowStockAccessories) {
    const severity = item.currentStock < (item.minimumStockUnits * 0.5) ? 'HIGH' : 'MEDIUM'

    await prisma.alert.create({
      data: {
        type: severity === 'HIGH' ? 'CRITICAL_STOCK' : 'LOW_STOCK',
        severity,
        title: `${severity === 'HIGH' ? 'Critical' : 'Low'} Stock Alert - Accessory`,
        message: `${item.name} is running ${severity === 'HIGH' ? 'critically' : ''} low. Available: ${item.currentStock} pcs, Minimum: ${item.minimumStockUnits} pcs`,
        relatedId: item.id,
        relatedType: 'AccessoryInventory',
      },
    })
  }

  console.log('✅ Alerts created')

  const totalOrders = await prisma.order.count()
  const totalCustomers = await prisma.customer.count()

  console.log('\n🎉 Enhanced seed completed successfully!')
  console.log('\n📊 Summary:')
  console.log(`  Users: 6 (all roles)`)
  console.log(`  Suppliers: 2`)
  console.log(`  Cloth Items: ${clothItems.length}`)
  console.log(`  Accessories: 3`)
  console.log(`  Garment Patterns: 4`)
  console.log(`  Customers: ${totalCustomers}`)
  console.log(`  Orders: ${totalOrders}`)
  console.log(`  Settings: 7`)
  console.log('\n🔑 Login Credentials (all use password: admin123):')
  console.log(`  owner@hameesattire.com - OWNER (Full access)`)
  console.log(`  admin@hameesattire.com - ADMIN (Administrative access)`)
  console.log(`  inventory@hameesattire.com - INVENTORY_MANAGER`)
  console.log(`  sales@hameesattire.com - SALES_MANAGER`)
  console.log(`  tailor@hameesattire.com - TAILOR`)
  console.log(`  viewer@hameesattire.com - VIEWER (Read-only)`)
  console.log(`\n🌐 Dashboard URL: https://hamees.gagneet.com/dashboard`)
}

main()
  .catch((e) => {
    console.error('❌ Enhanced seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
