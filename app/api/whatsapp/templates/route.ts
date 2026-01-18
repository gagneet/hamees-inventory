import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { z } from 'zod'

const templateSchema = z.object({
  name: z.string().min(1),
  category: z.enum(['TRANSACTIONAL', 'MARKETING', 'UTILITY']),
  language: z.string().default('en'),
  content: z.string().min(1),
  variables: z.array(z.string()),
})

// GET - List all active templates
export async function GET() {
  const { error } = await requireAnyPermission(['view_inventory'])
  if (error) return error

  try {
    const templates = await prisma.whatsAppTemplate.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

// POST - Create new template
export async function POST(request: Request) {
  const { error } = await requireAnyPermission(['manage_settings'])
  if (error) return error

  try {
    const body = await request.json()
    const data = templateSchema.parse(body)

    const template = await prisma.whatsAppTemplate.create({
      data: {
        name: data.name,
        category: data.category,
        language: data.language,
        content: data.content,
        variables: data.variables,
      },
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating template:', error)
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    )
  }
}
