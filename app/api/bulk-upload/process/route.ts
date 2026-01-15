import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { processExcelUpload } from '@/lib/excel-processor'

/**
 * POST /api/bulk-upload/process
 * Process and upload data from Excel file
 * Body: { file, duplicateActions: { "table:row": "skip|overwrite" } }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const duplicateActionsJson = formData.get('duplicateActions') as string

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Parse duplicate actions
    let duplicateActions = new Map<string, 'skip' | 'overwrite'>()
    if (duplicateActionsJson) {
      try {
        const actions = JSON.parse(duplicateActionsJson)
        duplicateActions = new Map(Object.entries(actions))
      } catch (error) {
        console.error('Failed to parse duplicate actions:', error)
      }
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Process upload
    const result = await processExcelUpload(buffer, {
      userId: session.user.id,
      filename: file.name,
      duplicateActions,
      skipErrors: true // Continue processing even if some records fail
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Upload processing error:', error)
    return NextResponse.json(
      { error: 'Failed to process upload', details: String(error) },
      { status: 500 }
    )
  }
}
