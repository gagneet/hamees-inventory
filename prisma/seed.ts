import { PrismaClient, UserRole, OrderStatus, OrderPriority, BodyType, StockMovementType } from '@prisma/client'
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

async function main() {
  console.log('🌱 Starting seed...')

  // Clear existing data (in development)
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
      email: 'owner@tailorshop.com',
      password: hashedPassword,
      name: 'Shop Owner',
      role: UserRole.OWNER,
      phone: '+91-98765-43210',
    },
  })

  const inventoryManager = await prisma.user.create({
    data: {
      email: 'inventory@tailorshop.com',
      password: hashedPassword,
      name: 'Inventory Manager',
      role: UserRole.INVENTORY_MANAGER,
      phone: '+91-98765-43211',
    },
  })

  console.log('✅ Users created')

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

  // 3. Create Cloth Inventory
  console.log('📦 Creating cloth inventory...')
  const cloth1 = await prisma.clothInventory.create({
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
      totalPurchased: 120,
      reserved: 8,
      minimum: 15,
      supplier: supplier1.name,
      supplierId: supplier1.id,
      location: 'Rack A-1',
      notes: 'Popular for formal shirts',
    },
  })

  const cloth2 = await prisma.clothInventory.create({
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
      totalPurchased: 120,
      reserved: 5,
      minimum: 20,
      supplier: supplier1.name,
      supplierId: supplier1.id,
      location: 'Rack B-1',
      notes: 'Wedding and special occasions',
    },
  })

  const cloth3 = await prisma.clothInventory.create({
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
      totalPurchased: 120,
      reserved: 12,
      minimum: 25,
      supplier: supplier2.name,
      supplierId: supplier2.id,
      location: 'Rack A-2',
      notes: 'Best seller for casual shirts',
    },
  })

  const cloth4 = await prisma.clothInventory.create({
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
      totalPurchased: 120,
      reserved: 6,
      minimum: 20,
      supplier: supplier2.name,
      supplierId: supplier2.id,
      location: 'Rack C-1',
      notes: 'Summer collection',
    },
  })

  console.log('✅ Cloth inventory created')

  // 4. Create Accessories
  console.log('🔘 Creating accessories...')
  const button1 = await prisma.accessoryInventory.create({
    data: {
      name: 'Formal Shirt Button',
      type: 'Button',
      color: 'White',
      currentStock: 500,
      minimum: 100,
      pricePerUnit: 2,
      supplier: supplier1.name,
      supplierId: supplier1.id,
    },
  })

  const thread1 = await prisma.accessoryInventory.create({
    data: {
      name: 'Polyester Thread',
      type: 'Thread',
      color: 'White',
      currentStock: 200,
      minimum: 50,
      pricePerUnit: 15,
      supplier: supplier1.name,
      supplierId: supplier1.id,
    },
  })

  const zipper1 = await prisma.accessoryInventory.create({
    data: {
      name: 'Metal Zipper',
      type: 'Zipper',
      color: 'Black',
      currentStock: 80,
      minimum: 20,
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
      { garmentPatternId: shirtPattern.id, accessoryId: button1.id, quantity: 10 },
      { garmentPatternId: shirtPattern.id, accessoryId: thread1.id, quantity: 1 },
      { garmentPatternId: trouserPattern.id, accessoryId: button1.id, quantity: 2 },
      { garmentPatternId: trouserPattern.id, accessoryId: thread1.id, quantity: 1 },
      { garmentPatternId: trouserPattern.id, accessoryId: zipper1.id, quantity: 1 },
      { garmentPatternId: suitPattern.id, accessoryId: button1.id, quantity: 15 },
      { garmentPatternId: suitPattern.id, accessoryId: thread1.id, quantity: 2 },
      { garmentPatternId: suitPattern.id, accessoryId: zipper1.id, quantity: 1 },
      { garmentPatternId: sherwaniPattern.id, accessoryId: button1.id, quantity: 12 },
      { garmentPatternId: sherwaniPattern.id, accessoryId: thread1.id, quantity: 2 },
    ],
  })

  console.log('✅ Garment patterns created')

  // 6. Create Customers
  console.log('👥 Creating customers...')
  const customer1 = await prisma.customer.create({
    data: {
      name: 'Rajesh Kumar',
      email: 'rajesh.kumar@example.com',
      phone: '+91-98765-99999',
      address: '123 Main Street',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
      notes: 'Regular customer, prefers formal wear',
    },
  })

  const customer2 = await prisma.customer.create({
    data: {
      name: 'Amit Sharma',
      email: 'amit.sharma@example.com',
      phone: '+91-98765-88888',
      address: '456 Park Avenue',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      notes: 'Wedding orders',
    },
  })

  // Create measurements for customers
  const measurement1 = await prisma.measurement.create({
    data: {
      customerId: customer1.id,
      garmentType: "Men's Shirt",
      neck: 40,
      chest: 100,
      waist: 90,
      shoulder: 45,
      sleeveLength: 62,
      shirtLength: 76,
      notes: 'Regular fit preferred',
    },
  })

  console.log('✅ Customers and measurements created')

  // 7. Create Sample Orders
  console.log('📝 Creating sample orders...')

  // Calculate order details
  const estimatedMetersShirt = shirtPattern.baseMeters + shirtPattern.regularAdjustment
  const orderTotal = estimatedMetersShirt * cloth1.pricePerMeter

  const order1 = await prisma.order.create({
    data: {
      orderNumber: `ORD-${Date.now()}-001`,
      customerId: customer1.id,
      userId: owner.id,
      measurementId: measurement1.id,
      status: OrderStatus.STITCHING,
      priority: OrderPriority.NORMAL,
      deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      totalAmount: orderTotal,
      advancePaid: orderTotal * 0.5,
      balanceAmount: orderTotal * 0.5,
      notes: 'Customer wants slim fit',
      items: {
        create: [
          {
            garmentPatternId: shirtPattern.id,
            clothInventoryId: cloth1.id,
            quantity: 1,
            bodyType: BodyType.REGULAR,
            estimatedMeters: estimatedMetersShirt,
            pricePerUnit: orderTotal,
            totalPrice: orderTotal,
          },
        ],
      },
    },
  })

  // Create stock movement for the order
  await prisma.stockMovement.create({
    data: {
      clothInventoryId: cloth1.id,
      orderId: order1.id,
      userId: owner.id,
      type: StockMovementType.ORDER_RESERVED,
      quantity: -estimatedMetersShirt,
      balanceAfter: cloth1.currentStock - estimatedMetersShirt,
      notes: `Reserved for order ${order1.orderNumber}`,
    },
  })

  console.log('✅ Sample orders created')

  // 8. Create Settings
  console.log('⚙️  Creating settings...')
  await prisma.settings.createMany({
    data: [
      {
        key: 'shop_name',
        value: 'Elite Tailors',
        description: 'Name of the tailor shop',
      },
      {
        key: 'shop_phone',
        value: '+91-98765-00000',
        description: 'Shop contact number',
      },
      {
        key: 'shop_email',
        value: 'contact@elitetailors.com',
        description: 'Shop email address',
      },
      {
        key: 'shop_address',
        value: '789 Fashion Street, Mumbai, Maharashtra 400001',
        description: 'Shop address',
      },
      {
        key: 'currency',
        value: 'INR',
        description: 'Default currency',
      },
      {
        key: 'low_stock_multiplier',
        value: '1.0',
        description: 'Multiplier for low stock alerts (minimum * this value)',
      },
      {
        key: 'critical_stock_multiplier',
        value: '0.5',
        description: 'Multiplier for critical stock alerts (minimum * this value)',
      },
    ],
  })

  console.log('✅ Settings created')

  // 9. Create Alerts for low stock items
  console.log('🔔 Creating alerts...')
  await prisma.alert.create({
    data: {
      type: 'LOW_STOCK',
      severity: 'MEDIUM',
      title: 'Low Stock Alert',
      message: `${cloth2.name} is running low. Current: ${cloth2.currentStock}m, Minimum: ${cloth2.minimum}m`,
      relatedId: cloth2.id,
      relatedType: 'ClothInventory',
    },
  })

  console.log('✅ Alerts created')

  console.log('🎉 Seed completed successfully!')
  console.log('\n📊 Summary:')
  console.log(`  Users: 2`)
  console.log(`  Suppliers: 2`)
  console.log(`  Cloth Items: 4`)
  console.log(`  Accessories: 3`)
  console.log(`  Garment Patterns: 4`)
  console.log(`  Customers: 2`)
  console.log(`  Orders: 1`)
  console.log(`  Settings: 7`)
  console.log('\n🔑 Login Credentials:')
  console.log(`  Email: owner@tailorshop.com`)
  console.log(`  Password: admin123`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
