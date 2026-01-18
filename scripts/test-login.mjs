import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'

dotenv.config()

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function testLogin() {
  try {
    const email = 'owner@hameesattire.com'
    const password = 'admin123'

    console.log(`🔐 Testing login for: ${email}`)
    console.log(`🔑 Password: ${password}\n`)

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      console.log('❌ User not found')
      return
    }

    console.log('✅ User found:')
    console.log(`   ID: ${user.id}`)
    console.log(`   Name: ${user.name}`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Role: ${user.role}`)
    console.log(`   Active: ${user.active}`)
    console.log(`   Password hash: ${user.password.substring(0, 20)}...`)

    // Test password
    const isPasswordValid = await bcrypt.compare(password, user.password)
    console.log(`\n🔍 Password validation: ${isPasswordValid ? '✅ VALID' : '❌ INVALID'}`)

    if (!isPasswordValid) {
      console.log('\n⚠️  Password does not match!')
      console.log('💡 Generating new hash for "admin123"...')
      const newHash = await bcrypt.hash('admin123', 10)
      console.log(`   New hash: ${newHash.substring(0, 20)}...`)
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

testLogin()
