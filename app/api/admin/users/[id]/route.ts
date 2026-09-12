import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { audit } from '@/lib/audit'
import { hashPassword } from '@/lib/password'
import { checkUserChange, emailSchema, passwordSchema, roleSchema, USER_PUBLIC_SELECT } from '@/lib/user-admin'

const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: emailSchema.optional(),
  password: passwordSchema.optional(),
  role: roleSchema.optional(),
  active: z.boolean().optional(),
})

const prismaCode = (err: unknown) =>
  err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined

// GET /api/admin/users/[id] - Get single user
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission('manage_users')
  if (error) return error

  try {
    const { id } = await params

    const user = await prisma.user.findUnique({
      where: { id },
      select: USER_PUBLIC_SELECT,
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

// PATCH /api/admin/users/[id] - Update user (a password change ends the user's other sessions)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requirePermission('manage_users')
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json()
    const validatedData = updateUserSchema.parse(body)

    // Hash outside the transaction so it isn't held open for the bcrypt work
    const newPasswordHash = validatedData.password ? await hashPassword(validatedData.password) : null

    // Serializable: the last-active-Admin/Owner check and the update must see the same state
    const result = await prisma.$transaction(
      async (tx) => {
        const existingUser = await tx.user.findUnique({
          where: { id },
          select: { id: true, email: true, role: true, active: true },
        })
        if (!existingUser) return { status: 404 as const, error: 'User not found' }

        const guardError = await checkUserChange(
          session.user.id,
          existingUser,
          { role: validatedData.role, active: validatedData.active },
          tx
        )
        if (guardError) return { status: 403 as const, error: guardError }

        if (validatedData.email && validatedData.email !== existingUser.email.toLowerCase()) {
          const emailInUse = await tx.user.findFirst({
            where: { email: { equals: validatedData.email, mode: 'insensitive' }, id: { not: id } },
            select: { id: true },
          })
          if (emailInUse) return { status: 409 as const, error: 'Email already in use' }
        }

        const updateData: Prisma.UserUpdateInput = {}
        if (validatedData.name) updateData.name = validatedData.name
        if (validatedData.email) updateData.email = validatedData.email
        if (validatedData.role) updateData.role = validatedData.role
        if (validatedData.active !== undefined) updateData.active = validatedData.active
        if (newPasswordHash) updateData.password = newPasswordHash

        const user = await tx.user.update({ where: { id }, data: updateData, select: USER_PUBLIC_SELECT })
        return { status: 200 as const, user, existingUser }
      },
      { isolationLevel: 'Serializable' }
    )

    if (result.status !== 200) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    const { user, existingUser } = result

    await audit({
      userId: session.user.id,
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: id,
      details: {
        fields: Object.keys(validatedData),
        ...(validatedData.role && validatedData.role !== existingUser.role
          ? { roleFrom: existingUser.role, roleTo: validatedData.role }
          : {}),
        ...(validatedData.active !== undefined && validatedData.active !== existingUser.active
          ? { active: validatedData.active }
          : {}),
      },
    })

    return NextResponse.json({ user })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    if (prismaCode(error) === 'P2002') {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }
    if (prismaCode(error) === 'P2034') {
      return NextResponse.json(
        { error: 'Another change to user accounts happened at the same time. Please try again.' },
        { status: 409 }
      )
    }

    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}
