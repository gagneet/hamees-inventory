import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'

const execAsync = promisify(exec)

/**
 * GET /api/bulk-upload/download-template
 * Generate and download Excel template with current data
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Run export script
    console.log('Generating Excel export...')
    await execAsync('pnpm tsx scripts/export-to-excel.ts', {
      cwd: process.cwd()
    })

    // Find the generated file
    const exportsDir = path.join(process.cwd(), 'exports')
    const files = await fs.readdir(exportsDir)
    const latestFile = files
      .filter(f => f.startsWith('hamees-inventory-export-') && f.endsWith('.xlsx'))
      .sort()
      .reverse()[0]

    if (!latestFile) {
      return NextResponse.json({ error: 'Export file not found' }, { status: 404 })
    }

    const filePath = path.join(exportsDir, latestFile)
    const fileBuffer = await fs.readFile(filePath)

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${latestFile}"`
      }
    })
  } catch (error) {
    console.error('Template download error:', error)
    return NextResponse.json(
      { error: 'Failed to generate template', details: String(error) },
      { status: 500 }
    )
  }
}
