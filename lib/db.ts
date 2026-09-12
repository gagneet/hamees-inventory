import { createPrismaClient, type AppPrismaClient } from '@/lib/prisma-client'

// Amounts are converted between decimal numbers and stored minor units inside the client
// (lib/prisma-client.ts) — never construct a bare PrismaClient.
const globalForPrisma = globalThis as unknown as {
  prisma: AppPrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
