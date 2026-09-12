import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'
import { z } from 'zod'
import { audit } from '@/lib/audit'
import { hashPassword } from '@/lib/password'
import { emailSchema, passwordSchema, roleSchema, USER_PUBLIC_SELECT } from '@/lib/user-admin'

const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: emailSchema,
  password: passwordSchema,
  role: roleSchema,
})

// GET /api/admin/users - List all users
export async function GET() {
  const { error } = await requirePermission('manage_users')
  if (error) return error

  try {
    const users = await prisma.user.findMany({
      select: USER_PUBLIC_SELECT,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

// POST /api/admin/users - Create new user
export async function POST(request: Request) {
  const { session, error } = await requirePermission('manage_users')
  if (error) return error

  try {
    const body = await request.json()
    const validatedData = createUserSchema.parse(body)

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: validatedData.email, mode: 'insensitive' } },
      select: { id: true },
    })

    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 })
    }

    const hashedPassword = await hashPassword(validatedData.password)

    const user = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        role: validatedData.role,
        active: true,
      },
      select: USER_PUBLIC_SELECT,
    })

    await audit({
      userId: session.user.id,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: user.id,
      details: { email: user.email, role: user.role },
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    // Unique email constraint hit by a concurrent create
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 })
    }

    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
