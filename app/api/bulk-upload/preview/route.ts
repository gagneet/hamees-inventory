import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { parseExcelFile, detectDuplicates, validateRelations } from '@/lib/excel-upload'

/**
 * POST /api/bulk-upload/preview
 * Preview upload without actually inserting data
 * Returns: validation errors, duplicates, and statistics
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Parse Excel file
    const parsedSheets = await parseExcelFile(buffer)

    // Collect statistics
    let totalRecords = 0
    let validRecords = 0
    let invalidRecords = 0
    const validationErrors: any[] = []

    for (const sheet of parsedSheets) {
      totalRecords += sheet.rows.length + sheet.errors.length
      validRecords += sheet.rows.length
      invalidRecords += sheet.errors.length

      validationErrors.push(...sheet.errors.map(e => ({
        table: sheet.tableName,
        row: e.row,
        error: e.error,
        data: e.data
      })))
    }

    // Detect duplicates
    const duplicates: any[] = []
    for (const sheet of parsedSheets) {
      if (sheet.rows.length === 0) continue

      const sheetDuplicates = await detectDuplicates(sheet.tableName, sheet.rows)
      duplicates.push(...sheetDuplicates)
    }

    // Validate relations
    const relationErrors: any[] = []
    for (const sheet of parsedSheets) {
      if (sheet.rows.length === 0) continue

      const errors = await validateRelations(sheet.tableName, sheet.rows)
      relationErrors.push(...errors.map(e => ({
        table: sheet.tableName,
        row: e.row,
        error: e.error
      })))
    }

    return NextResponse.json({
      filename: file.name,
      totalRecords,
      validRecords,
      invalidRecords,
      duplicateCount: duplicates.length,
      relationErrorCount: relationErrors.length,
      validationErrors,
      duplicates,
      relationErrors,
      sheets: parsedSheets.map(s => ({
        name: s.sheetName,
        table: s.tableName,
        rowCount: s.rows.length,
        errorCount: s.errors.length
      }))
    })
  } catch (error) {
    console.error('Preview error:', error)
    return NextResponse.json(
      { error: 'Failed to preview upload', details: String(error) },
      { status: 500 }
    )
  }
}
