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
  console.log('Creating garment patterns...')
  
  const shirt = await prisma.garmentPattern.create({
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

  const trouser = await prisma.garmentPattern.create({
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

  const suit = await prisma.garmentPattern.create({
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

  const sherwani = await prisma.garmentPattern.create({
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

  console.log('✅ Created 4 garment patterns')
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
