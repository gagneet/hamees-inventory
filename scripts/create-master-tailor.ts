/**
 * Create a placeholder Master Tailor account on a real deployment, to be renamed later to the
 * actual person (Admin Settings → Users).
 *
 *   pnpm tsx scripts/create-master-tailor.ts [--email master@example.com] [--name "Master Tailor"]
 *
 * - Does nothing if an active MASTER_TAILOR already exists, or if the email is taken.
 * - Password: MASTER_TAILOR_PASSWORD from the environment, otherwise a random one printed once.
 *   Change it at first sign-in.
 * - Hashed with the app's bcrypt cost (lib/password) and recorded in the audit log.
 */

import 'dotenv/config' // DATABASE_URL from .env; must load before lib/db creates the client
import { randomBytes } from 'crypto'
import { prisma } from '../lib/db'
import { hashPassword } from '../lib/password'
import { audit } from '../lib/audit'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const email = (arg('email') ?? 'master@hameesattire.com').trim().toLowerCase()
  const name = (arg('name') ?? 'Master Tailor').trim()

  const existingMaster = await prisma.user.findFirst({
    where: { role: 'MASTER_TAILOR', active: true },
    select: { email: true },
  })
  if (existingMaster) {
    console.log(`An active Master Tailor already exists (${existingMaster.email}); nothing to do.`)
    return
  }
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    console.log(`${email} is already used by another account; pass --email to choose another address.`)
    process.exitCode = 1
    return
  }

  const fromEnv = process.env.MASTER_TAILOR_PASSWORD
  if (fromEnv !== undefined && fromEnv.length < 8) {
    console.error('MASTER_TAILOR_PASSWORD must be at least 8 characters.')
    process.exitCode = 1
    return
  }
  const password = fromEnv ?? randomBytes(12).toString('base64url')

  const user = await prisma.user.create({
    data: { email, name, role: 'MASTER_TAILOR', password: await hashPassword(password), active: true },
    select: { id: true },
  })
  await audit({
    userId: null,
    action: 'USER_CREATED',
    entityType: 'User',
    entityId: user.id,
    details: { email, role: 'MASTER_TAILOR', via: 'scripts/create-master-tailor.ts' },
  })

  console.log(`Created Master Tailor: ${name} <${email}>`)
  if (!fromEnv) console.log(`Temporary password (shown once, change it at first sign-in): ${password}`)
}

main()
  .catch((error) => {
    console.error('Failed to create the Master Tailor:', error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
