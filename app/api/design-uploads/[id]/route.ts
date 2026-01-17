import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readFile, unlink } from 'fs/promises'
import { join } from 'path'
import { requireAuth, requirePermission } from '@/lib/api-permissions'

const UPLOAD_DIR = join(process.cwd(), 'uploads')

// GET /api/design-uploads/[id] - Download/view a design file
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth()
    if (error) return error

    const { id } = await params
    const design = await prisma.designUpload.findUnique({
      where: { id },
    })

    if (!design) {
      return NextResponse.json(
        { error: 'Design file not found' },
        { status: 404 }
      )
    }

    const filePath = join(UPLOAD_DIR, design.filePath)

    try {
      const fileBuffer = await readFile(filePath)

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': design.fileType,
          'Content-Disposition': `inline; filename="${design.fileName}"`,
          'Content-Length': design.fileSize.toString(),
        },
      })
    } catch (fileError) {
      console.error('Error reading file:', fileError)
      return NextResponse.json(
        { error: 'File not found on disk' },
        { status: 404 }
      )
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

    const { id } = await params
    const design = await prisma.designUpload.findUnique({
      where: { id },
    })

    if (!design) {
      return NextResponse.json(
        { error: 'Design file not found' },
        { status: 404 }
      )
    }

    // Delete from disk
    const filePath = join(UPLOAD_DIR, design.filePath)
    try {
      await unlink(filePath)
    } catch (fileError) {
      console.error('Error deleting file from disk:', fileError)
      // Continue with database deletion even if file is already gone
    }

    // Delete from database
    await prisma.designUpload.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Design deleted successfully' })
  } catch (error) {
    console.error('Error deleting design:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
