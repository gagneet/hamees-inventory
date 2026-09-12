import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'
import { actorFromSession } from '@/lib/authz'
import { z } from 'zod'

/**
 * @featuretrace Update an enquiry (staff)
 * @route PATCH /api/enquiries/[id]
 * @permission manage_enquiries
 * @writes CustomerEnquiry
 *
 * Only the shop's own fields move: the status and the staff note. Everything the visitor
 * submitted is left exactly as received, so the record stays an honest account of what was asked
 * for. CONVERTED is set by the conversion flow, not by hand.
 */

const patchSchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'CLOSED']).optional(),
  staffNotes: z.string().max(2000).nullish(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requirePermission('manage_enquiries')
  if (error) return error
  const actor = actorFromSession(session)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const data = patchSchema.parse(await request.json())

    const existing = await prisma.customerEnquiry.findUnique({ where: { id }, select: { status: true } })
    if (!existing) return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 })
    if (existing.status === 'CONVERTED' && data.status) {
      return NextResponse.json(
        { error: 'This enquiry already has an order. Its status cannot be changed.' },
        { status: 400 }
      )
    }

    const enquiry = await prisma.customerEnquiry.update({
      where: { id },
      data: {
        ...(data.status ? { status: data.status } : {}),
        ...(data.staffNotes !== undefined ? { staffNotes: data.staffNotes } : {}),
        handledById: actor.id,
      },
      select: { id: true, status: true, staffNotes: true },
    })

    return NextResponse.json({ enquiry })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    console.error('Error updating enquiry:', error)
    return NextResponse.json({ error: 'Failed to update enquiry' }, { status: 500 })
  }
}
