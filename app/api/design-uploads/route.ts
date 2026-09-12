import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/db'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { join } from 'path'
import { requireAnyPermission, requirePermission } from '@/lib/api-permissions'
import { actorFromSession, notFound, orderItemScope } from '@/lib/authz'
import type { DesignFileCategory } from '@prisma/client'

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'designs')
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_FILE_SIZE_MB = MAX_FILE_SIZE / (1024 * 1024) // Derived for display in error messages

// Allowed MIME types → stored extension. The extension is derived from the verified type,
// never from the user-supplied filename.
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

const CATEGORIES: DesignFileCategory[] = ['SKETCH', 'REFERENCE', 'WORK_IN_PROGRESS', 'FINAL']

/** Check the file's leading bytes match its declared type (blocks HTML/SVG/scripts renamed as images). */
function matchesSignature(type: string, bytes: Buffer): boolean {
  const startsWith = (...sig: number[]) => sig.every((b, i) => bytes[i] === b)
  switch (type) {
    case 'image/jpeg':
    case 'image/jpg':
      return startsWith(0xff, 0xd8, 0xff)
    case 'image/png':
      return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
    case 'image/gif':
      return bytes.subarray(0, 6).toString('ascii') === 'GIF87a' || bytes.subarray(0, 6).toString('ascii') === 'GIF89a'
    case 'image/webp':
      return bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
    case 'application/pdf':
      return bytes.subarray(0, 5).toString('ascii') === '%PDF-'
    default:
      return false
  }
}

/** Keep a display-only copy of the original filename without path components or control characters. */
function displayName(name: string): string {
  const base = name.split(/[\\/]/).pop() || 'design'
  return base.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 200) || 'design'
}

// GET /api/design-uploads?orderItemId=xxx - List all designs for an order item
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requirePermission('view_orders')
    if (error) return error
    const actor = actorFromSession(session)
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const orderItemId = searchParams.get('orderItemId')

    if (!orderItemId) {
      return NextResponse.json(
        { error: 'orderItemId is required' },
        { status: 400 }
      )
    }

    const inScope = await prisma.orderItem.count({ where: { id: orderItemId, ...orderItemScope(actor) } })
    if (inScope === 0) return notFound('Order item')

    const designs = await prisma.designUpload.findMany({
      where: { orderItemId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
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
    // Order editors and production staff (on orders in their scope) can upload designs / WIP photos
    const { session, error } = await requireAnyPermission(['update_order', 'update_order_status'])
    if (error) return error
    const actor = actorFromSession(session)
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file')
    const orderItemId = formData.get('orderItemId')
    const categoryInput = formData.get('category')
    const descriptionInput = formData.get('description')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (typeof orderItemId !== 'string' || !orderItemId) {
      return NextResponse.json(
        { error: 'orderItemId is required' },
        { status: 400 }
      )
    }

    const category = (typeof categoryInput === 'string' && categoryInput ? categoryInput : 'SKETCH') as DesignFileCategory
    if (!CATEGORIES.includes(category)) {
      return NextResponse.json({ error: `Invalid category. Allowed: ${CATEGORIES.join(', ')}` }, { status: 400 })
    }

    const description = typeof descriptionInput === 'string' ? descriptionInput.slice(0, 1000) : null

    // Validate file type
    const extension = ALLOWED_TYPES[file.type]
    if (!extension) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed types: JPEG, PNG, GIF, WebP, PDF' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File must be between 1 byte and ${MAX_FILE_SIZE_MB}MB` },
        { status: 400 }
      )
    }

    // Order item must exist and be in the actor's scope
    const orderItem = await prisma.orderItem.findFirst({
      where: { id: orderItemId, ...orderItemScope(actor) },
      select: { id: true },
    })

    if (!orderItem) {
      return notFound('Order item')
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (!matchesSignature(file.type, buffer)) {
      return NextResponse.json({ error: 'File content does not match its type' }, { status: 400 })
    }

    await mkdir(UPLOAD_DIR, { recursive: true })

    // Server-generated name: no user input reaches the filesystem path
    const storedName = `${randomUUID()}.${extension}`
    const filePath = join(UPLOAD_DIR, storedName)

    await writeFile(filePath, buffer, { flag: 'wx' })

    try {
      const design = await prisma.designUpload.create({
        data: {
          orderItemId: orderItem.id,
          fileName: displayName(file.name),
          fileType: file.type === 'image/jpg' ? 'image/jpeg' : file.type,
          filePath: storedName,
          fileSize: file.size,
          category,
          description: description || undefined,
          uploadedBy: actor.id,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      return NextResponse.json(design, { status: 201 })
    } catch (dbError) {
      // Don't leave orphaned files behind
      await unlink(filePath).catch(() => {})
      throw dbError
    }
  } catch (error) {
    console.error('Error uploading design:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
