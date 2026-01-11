import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config()

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function checkDatabase() {
  try {
    console.log('Checking database...\n')

    // Check users
    const users = await prisma.user.findMany()
    console.log(`📊 Users: ${users.length}`)
    users.forEach(u => console.log(`   - ${u.email} (${u.role})`))

    // Check customers
    const customers = await prisma.customer.count()
    console.log(`\n📊 Customers: ${customers}`)

    // Check orders
    const orders = await prisma.order.count()
    console.log(`📊 Orders: ${orders}`)

    // Check cloth inventory
    const clothItems = await prisma.clothInventory.count()
    console.log(`📊 Cloth Items: ${clothItems}`)

    // Check accessories
    const accessories = await prisma.accessoryInventory.count()
    console.log(`📊 Accessories: ${accessories}`)

    // Check garment patterns
    const patterns = await prisma.garmentPattern.count()
    console.log(`📊 Garment Patterns: ${patterns}`)

  } catch (error) {
    console.error('❌ Database error:', error)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

checkDatabase()
