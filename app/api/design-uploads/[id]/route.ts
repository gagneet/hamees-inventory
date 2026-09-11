import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readFile, unlink } from 'fs/promises'
import { basename, join, resolve, sep } from 'path'
import { requirePermission } from '@/lib/api-permissions'
import { actorFromSession, notFound, orderItemScope } from '@/lib/authz'
import { safeHeaderFilename } from '@/lib/html-escape'

const UPLOAD_DIR = resolve(process.cwd(), 'uploads', 'designs')

// Only these types are ever served inline; anything else is forced to download.
const INLINE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'])

/** Resolve a stored filename inside UPLOAD_DIR, rejecting anything that escapes it. */
function storedFilePath(stored: string): string | null {
  const name = basename(stored)
  if (!name || name !== stored) return null
  const full = resolve(join(UPLOAD_DIR, name))
  return full.startsWith(UPLOAD_DIR + sep) ? full : null
}

/** Find a design the actor can reach (via the order item's order scope). */
async function findDesignInScope(id: string, actor: NonNullable<ReturnType<typeof actorFromSession>>) {
  return prisma.designUpload.findFirst({
    where: { id, orderItem: orderItemScope(actor) },
  })
}

// GET /api/design-uploads/[id] - Download/view a design file
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requirePermission('view_orders')
    if (error) return error
    const actor = actorFromSession(session)
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const design = await findDesignInScope(id, actor)

    if (!design) {
      return notFound('Design file')
    }

    const filePath = storedFilePath(design.filePath)
    if (!filePath) {
      return notFound('Design file')
    }

    try {
      const fileBuffer = await readFile(filePath)
      const inline = INLINE_TYPES.has(design.fileType)
      const filename = safeHeaderFilename(design.fileName, 'design')

      return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
          'Content-Type': inline ? design.fileType : 'application/octet-stream',
          'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
          'Content-Length': fileBuffer.length.toString(),
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
          'Cache-Control': 'private, no-store',
        },
      })
    } catch (fileError) {
      console.error('Error reading file:', fileError)
      return notFound('Design file')
    }
  } catch (error) {
    console.error('Error downloading design:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/design-uploads/[id] - Delete a design file
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Only users with delete_order permission can delete
    const { session, error } = await requirePermission('delete_order')
    if (error) return error
    const actor = actorFromSession(session)
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const design = await findDesignInScope(id, actor)

    if (!design) {
      return notFound('Design file')
    }

    // Delete from database first; then remove the file (only inside the uploads directory)
    await prisma.designUpload.delete({
      where: { id },
    })

    const filePath = storedFilePath(design.filePath)
    if (filePath) {
      await unlink(filePath).catch((fileError) => {
        console.error('Error deleting file from disk:', fileError)
      })
    }

    return NextResponse.json({ message: 'Design deleted successfully' })
  } catch (error) {
    console.error('Error deleting design:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
