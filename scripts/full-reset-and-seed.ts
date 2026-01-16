import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config()

const connectionString = process.env.DATABASE_URL!
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🗑️ Cleaning database (preserving users)...')
  
  // Delete everything except users
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
  await prisma.expense.deleteMany()
  
  console.log('✅ Database cleaned')
  console.log('')
  console.log('📋 Creating suppliers...')
  
  await prisma.supplier.create({
    data: {
      name: 'ABC Fabrics',
      contactPerson: 'Ramesh Kumar',
      email: 'contact@abcfabrics.com',
      phone: '+91-98765-11111',
      address: 'Fabric Market, Sector 10',
      city: 'Ludhiana',
      state: 'Punjab',
      pincode: '141001',
      rating: 5.0,
    }
  })

  await prisma.supplier.create({
    data: {
      name: 'Quality Accessories',
      contactPerson: 'Suresh Patel',
      email: 'info@qualityaccessories.com',
      phone: '+91-98765-22222',
      address: 'Accessories Hub, Ring Road',
      city: 'Surat',
      state: 'Gujarat',
      pincode: '395001',
      rating: 4.5,
    }
  })
  
  console.log('✅ Suppliers created')
  console.log('')
  console.log('👔 Creating garment patterns...')
  
  await prisma.garmentPattern.create({
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

  await prisma.garmentPattern.create({
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

  await prisma.garmentPattern.create({
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

  await prisma.garmentPattern.create({
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
  
  console.log('✅ Garment patterns created')
  console.log('')
  console.log('✅ Base data ready. Now run: pnpm tsx prisma/seed-production.ts')
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
