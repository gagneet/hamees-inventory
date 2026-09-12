import { Pool } from 'pg'
import * as dotenv from 'dotenv'
import { createPrismaClient } from '../lib/prisma-client'

dotenv.config()

const connectionString = process.env.DATABASE_URL!
const pool = new Pool({ connectionString })
const prisma = createPrismaClient({ pool })

async function main() {
  console.log('Creating suppliers...')
  
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
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
