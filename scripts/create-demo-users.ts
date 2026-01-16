/**
 * Creates demo users for all user roles
 * Run with: pnpm tsx scripts/create-demo-users.ts
 */

import { UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/db'

interface DemoUser {
  email: string
  password: string
  name: string
  role: UserRole
  phone?: string
}

const demoUsers: DemoUser[] = [
  {
    email: 'owner@hameesattire.com',
    password: 'admin123',
    name: 'Shop Owner',
    role: 'OWNER',
    phone: '+91-9876543210',
  },
  {
    email: 'admin@hameesattire.com',
    password: 'admin123',
    name: 'Administrator',
    role: 'ADMIN',
    phone: '+91-9876543211',
  },
  {
    email: 'inventory@hameesattire.com',
    password: 'admin123',
    name: 'Inventory Manager',
    role: 'INVENTORY_MANAGER',
    phone: '+91-9876543212',
  },
  {
    email: 'sales@hameesattire.com',
    password: 'admin123',
    name: 'Sales Manager',
    role: 'SALES_MANAGER',
    phone: '+91-9876543213',
  },
  {
    email: 'tailor@hameesattire.com',
    password: 'admin123',
    name: 'Master Tailor',
    role: 'TAILOR',
    phone: '+91-9876543214',
  },
  {
    email: 'viewer@hameesattire.com',
    password: 'admin123',
    name: 'View Only User',
    role: 'VIEWER',
    phone: '+91-9876543215',
  },
]

async function createDemoUsers() {
  console.log('🚀 Creating demo users for all roles...\n')

  for (const user of demoUsers) {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email },
      })

      if (existingUser) {
        console.log(`✓ User already exists: ${user.email} (${user.role})`)
        continue
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(user.password, 10)

      // Create user
      await prisma.user.create({
        data: {
          email: user.email,
          password: hashedPassword,
          name: user.name,
          role: user.role,
          phone: user.phone,
          active: true,
        },
      })

      console.log(`✓ Created: ${user.email} (${user.role})`)
    } catch (error) {
      console.error(`✗ Failed to create ${user.email}:`, error)
    }
  }

  console.log('\n✅ Demo users creation completed!\n')

  // Display all users
  console.log('📋 All Users in Database:\n')
  const allUsers = await prisma.user.findMany({
    select: {
      email: true,
      name: true,
      role: true,
      active: true,
    },
    orderBy: {
      role: 'asc',
    },
  })

  console.table(allUsers)

  console.log('\n🔑 Default Password for all users: admin123\n')
}

createDemoUsers()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
