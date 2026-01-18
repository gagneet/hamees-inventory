import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'

export async function GET(request: Request) {
  const { error } = await requireAnyPermission(['view_orders', 'update_order', 'manage_users'])
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')

    const where: any = {
      active: true, // Only return active users
    }

    if (role) {
      where.role = role
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}
