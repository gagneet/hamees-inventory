import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-permissions'
import { processExcelUpload } from '@/lib/excel-processor'
import { checkSpreadsheetUpload } from '@/lib/upload-limits'

/**
 * POST /api/bulk-upload/process
 * Process and upload data from Excel file
 * Body: { file, duplicateActions: { "table:row": "skip|overwrite" } }
 */
export async function POST(req: NextRequest) {
  try {
    const { session, error } = await requirePermission('bulk_upload')
    if (error) return error

    const formData = await req.formData()
    const file = formData.get('file') as File
    const duplicateActionsJson = formData.get('duplicateActions') as string

    const uploadError = await checkSpreadsheetUpload(file)
    if (uploadError) {
      return NextResponse.json({ error: uploadError }, { status: 400 })
    }

    // Parse duplicate actions (only "skip" / "overwrite" values are honoured)
    const duplicateActions = new Map<string, 'skip' | 'overwrite'>()
    if (typeof duplicateActionsJson === 'string' && duplicateActionsJson) {
      if (duplicateActionsJson.length > 1_000_000) {
        return NextResponse.json({ error: 'Too many duplicate actions' }, { status: 400 })
      }
      try {
        const actions = JSON.parse(duplicateActionsJson)
        if (actions && typeof actions === 'object' && !Array.isArray(actions)) {
          for (const [key, value] of Object.entries(actions)) {
            if (value === 'skip' || value === 'overwrite') duplicateActions.set(key, value)
          }
        }
      } catch (error) {
        return NextResponse.json({ error: 'Invalid duplicate actions' }, { status: 400 })
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
      { error: 'Failed to process upload' },
      { status: 500 }
    )
  }
}
