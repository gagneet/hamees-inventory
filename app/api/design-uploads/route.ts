import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { requireAuth, requirePermission } from '@/lib/api-permissions'

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'designs')
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_FILE_SIZE_MB = MAX_FILE_SIZE / (1024 * 1024) // Derived for display in error messages
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]

// GET /api/design-uploads?orderItemId=xxx - List all designs for an order item
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireAuth()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const orderItemId = searchParams.get('orderItemId')

    if (!orderItemId) {
      return NextResponse.json(
        { error: 'orderItemId is required' },
        { status: 400 }
      )
    }

    const designs = await prisma.designUpload.findMany({
      where: { orderItemId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    })

    return NextResponse.json(designs)
  } catch (error) {
    console.error('Error fetching design uploads:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/design-uploads - Upload a new design file
export async function POST(request: NextRequest) {
  try {
    // Only users with update_order permission can upload
    const { session, error } = await requirePermission('update_order')
    if (error) return error

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const orderItemId = formData.get('orderItemId') as string
    const category = (formData.get('category') as string) || 'SKETCH'
    const description = formData.get('description') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!orderItemId) {
      return NextResponse.json(
        { error: 'orderItemId is required' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Invalid file type. Allowed types: ${ALLOWED_TYPES.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds maximum of ${MAX_FILE_SIZE_MB}MB` },
        { status: 400 }
      )
    }

    // Verify order item exists
    const orderItem = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        order: true,
      },
    })

    if (!orderItem) {
      return NextResponse.json(
        { error: 'Order item not found' },
        { status: 404 }
      )
    }

    // Create directory if it doesn't exist
    await mkdir(UPLOAD_DIR, { recursive: true })

    // Generate unique filename
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    
    // Safely extract file extension with robust handling
    // Handle edge cases: no extension, multiple dots, invalid characters
    const fileExtension = (() => {
      const parts = file.name.split('.')
      // File must have at least one dot and content after it
      if (parts.length < 2) {
        return null
      }
      const ext = parts[parts.length - 1].toLowerCase().trim()
      // Extension must be non-empty and contain only alphanumeric characters
      if (!ext || !/^[a-z0-9]+$/.test(ext)) {
        return null
      }
      return ext
    })()
    
    if (!fileExtension) {
      return NextResponse.json(
        { error: 'Invalid or missing file extension' },
        { status: 400 }
      )
    }
    
    const uniqueFileName = `${orderItemId}_${timestamp}_${randomSuffix}.${fileExtension}`
    const filePath = join(UPLOAD_DIR, uniqueFileName)

// Use transaction to ensure atomicity
const design = await prisma.$transaction(async (tx: any) => {
  // Save to database first
  const design = await tx.designUpload.create({
    data: {
      orderItemId,
      fileName: file.name,
      fileType: file.type,
      filePath: uniqueFileName, // Store only filename, not relative path
      fileSize: file.size,
      category: category as any,
      description: description || undefined,
      uploadedBy: session.user.id,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  // Save file to disk after database success
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  await writeFile(filePath, buffer)

  return design
})

    return NextResponse.json(design, { status: 201 })
  } catch (error) {
    console.error('Error uploading design:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
