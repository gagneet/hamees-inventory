import { prisma } from '@/lib/db'
import {
  parseExcelFile,
  detectDuplicates,
  validateRelations,
  UploadResult,
  DuplicateCheck
} from './excel-upload'
import bcrypt from 'bcryptjs'

interface ProcessOptions {
  userId: string
  filename: string
  duplicateActions?: Map<string, 'skip' | 'overwrite'> // Map of "table:row" to action
  skipErrors?: boolean // Continue processing even if some records fail
}

/**
 * Process Excel upload with safe-fail mechanism
 * - Validates all data before insertion
 * - Detects duplicates and applies user-confirmed actions
 * - Skips corrupted records and continues with valid ones
 * - Maintains relational integrity
 * - Creates comprehensive audit trail
 */
export async function processExcelUpload(
  buffer: Buffer,
  options: ProcessOptions
): Promise<UploadResult> {
  const { userId, filename, duplicateActions = new Map(), skipErrors = true } = options

  // Create upload history record
  const uploadHistory = await prisma.uploadHistory.create({
    data: {
      userId,
      filename,
      totalRecords: 0,
      successCount: 0,
      failureCount: 0,
      duplicateCount: 0,
      skippedCount: 0,
      status: 'IN_PROGRESS'
    }
  })

  const result: UploadResult = {
    uploadId: uploadHistory.id,
    totalRecords: 0,
    successCount: 0,
    failureCount: 0,
    duplicateCount: 0,
    skippedCount: 0,
    successDetails: [],
    failureDetails: [],
    duplicateDetails: [],
    summary: ''
  }

  try {
    // Step 1: Parse Excel file
    console.log('Step 1: Parsing Excel file...')
    const parsedSheets = await parseExcelFile(buffer)

    // Count total records and initial errors
    for (const sheet of parsedSheets) {
      result.totalRecords += sheet.rows.length + sheet.errors.length
      result.failureCount += sheet.errors.length
      result.failureDetails.push(...sheet.errors.map(e => ({
        table: sheet.tableName,
        row: e.row,
        error: `Validation error: ${e.error}`,
        data: e.data
      })))
    }

    // Step 2: Detect duplicates for each sheet
    console.log('Step 2: Detecting duplicates...')
    const allDuplicates: Map<string, DuplicateCheck[]> = new Map()

    for (const sheet of parsedSheets) {
      if (sheet.rows.length === 0) continue

      const duplicates = await detectDuplicates(sheet.tableName, sheet.rows)
      if (duplicates.length > 0) {
        allDuplicates.set(sheet.tableName, duplicates)
        result.duplicateCount += duplicates.length
        result.duplicateDetails.push(...duplicates.map(d => ({
          table: d.table,
          row: d.row,
          existing: d.existing,
          new: d.new,
          action: duplicateActions.get(`${d.table}:${d.row}`)
        })))
      }
    }

    // Step 3: Validate relational integrity
    console.log('Step 3: Validating relational integrity...')
    for (const sheet of parsedSheets) {
      if (sheet.rows.length === 0) continue

      const relationErrors = await validateRelations(sheet.tableName, sheet.rows)
      if (relationErrors.length > 0) {
        result.failureCount += relationErrors.length
        result.failureDetails.push(...relationErrors.map(e => ({
          table: sheet.tableName,
          row: e.row,
          error: `Relational integrity error: ${e.error}`,
          data: sheet.rows[e.row - 1]
        })))

        // Remove invalid rows
        if (skipErrors) {
          const errorRows = new Set(relationErrors.map(e => e.row - 1))
          sheet.rows = sheet.rows.filter((_, index) => !errorRows.has(index))
          result.skippedCount += relationErrors.length
        }
      }
    }

    // Step 4: Process inserts/updates with safe-fail
    console.log('Step 4: Processing data inserts/updates...')

    // Process in dependency order
    const processingOrder = [
      'User',
      'Supplier',
      'ClothInventory',
      'AccessoryInventory',
      'Customer',
      'GarmentPattern',
      'Measurement'
    ]

    for (const tableName of processingOrder) {
      const sheet = parsedSheets.find(s => s.tableName === tableName)
      if (!sheet || sheet.rows.length === 0) continue

      console.log(`  Processing ${tableName}...`)

      for (let i = 0; i < sheet.rows.length; i++) {
        const row = sheet.rows[i]
        const actionKey = `${tableName}:${i + 1}`
        const duplicateAction = duplicateActions.get(actionKey)

        try {
          // Check if this row is a duplicate
          const isDuplicate = allDuplicates.get(tableName)?.some(d => d.row === i + 1)

          if (isDuplicate && duplicateAction === 'skip') {
            result.skippedCount++
            continue
          }

          // Process the record
          const recordId = await insertOrUpdateRecord(tableName, row, duplicateAction === 'overwrite')

          result.successCount++
          result.successDetails.push({
            table: tableName,
            id: recordId,
            row: i + 1
          })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)

          result.failureDetails.push({
            table: tableName,
            row: i + 1,
            error: errorMessage,
            data: row
          })

          if (skipErrors) {
            result.failureCount++
            result.skippedCount++
            console.warn(`  ⚠ Skipped row ${i + 1} in ${tableName}: ${errorMessage}`)
          } else {
            throw error
          }
        }
      }
    }

    // Step 5: Generate summary
    result.summary = generateSummary(result)

    // Step 6: Update upload history
    await prisma.uploadHistory.update({
      where: { id: uploadHistory.id },
      data: {
        totalRecords: result.totalRecords,
        successCount: result.successCount,
        failureCount: result.failureCount,
        duplicateCount: result.duplicateCount,
        skippedCount: result.skippedCount,
        successDetails: result.successDetails,
        failureDetails: result.failureDetails,
        duplicateDetails: result.duplicateDetails,
        summary: result.summary,
        status: 'COMPLETED',
        completedAt: new Date()
      }
    })

    console.log('\n✅ Upload processing complete!')
    console.log(result.summary)

    return result

  } catch (error) {
    // Fatal error - mark upload as failed
    const errorMessage = error instanceof Error ? error.message : String(error)

    await prisma.uploadHistory.update({
      where: { id: uploadHistory.id },
      data: {
        status: 'FAILED',
        summary: `Upload failed: ${errorMessage}`,
        completedAt: new Date()
      }
    })

    throw error
  }
}

/**
 * Insert or update a single record
 */
async function insertOrUpdateRecord(
  tableName: string,
  data: any,
  overwrite: boolean
): Promise<string> {
  const { id, createdAt, updatedAt, ...insertData } = data

  switch (tableName) {
    case 'User': {
      // Hash password if it's not already hashed
      if (insertData.password && !insertData.password.startsWith('$2a$')) {
        insertData.password = await bcrypt.hash(insertData.password, 10)
      }

      if (overwrite) {
        const existing = await prisma.user.findUnique({ where: { email: insertData.email } })
        if (existing) {
          await prisma.user.update({
            where: { id: existing.id },
            data: insertData
          })
          return existing.id
        }
      }

      const user = await prisma.user.create({ data: insertData })
      return user.id
    }

    case 'Supplier': {
      if (overwrite) {
        const existing = await prisma.supplier.findFirst({
          where: { OR: [{ name: insertData.name }, { phone: insertData.phone }] }
        })
        if (existing) {
          await prisma.supplier.update({
            where: { id: existing.id },
            data: insertData
          })
          return existing.id
        }
      }

      const supplier = await prisma.supplier.create({ data: insertData })
      return supplier.id
    }

    case 'ClothInventory': {
      // Convert comma-separated strings to arrays for Phase 1 fields
      if (insertData.seasonSuitability && typeof insertData.seasonSuitability === 'string') {
        insertData.seasonSuitability = insertData.seasonSuitability
          .split(',')
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0)
      }
      if (insertData.occasionType && typeof insertData.occasionType === 'string') {
        insertData.occasionType = insertData.occasionType
          .split(',')
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0)
      }

      if (overwrite) {
        const existing = await prisma.clothInventory.findUnique({ where: { sku: insertData.sku } })
        if (existing) {
          await prisma.clothInventory.update({
            where: { id: existing.id },
            data: insertData
          })
          return existing.id
        }
      }

      const cloth = await prisma.clothInventory.create({ data: insertData })
      return cloth.id
    }

    case 'AccessoryInventory': {
      // Generate SKU if not provided
      if (!insertData.sku) {
        const typePrefix = (insertData.type || 'OTH').substring(0, 3).toUpperCase()
        insertData.sku = `ACC-${typePrefix}-${Date.now().toString().slice(-6)}`
      }

      // Convert comma-separated string to array for Phase 1 field
      if (insertData.recommendedFor && typeof insertData.recommendedFor === 'string') {
        insertData.recommendedFor = insertData.recommendedFor
          .split(',')
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0)
      }

      if (overwrite) {
        const existing = await prisma.accessoryInventory.findFirst({
          where: { sku: insertData.sku }
        })
        if (existing) {
          await prisma.accessoryInventory.update({
            where: { id: existing.id },
            data: insertData
          })
          return existing.id
        }
      }

      const accessory = await prisma.accessoryInventory.create({ data: insertData })
      return accessory.id
    }

    case 'Customer': {
      if (overwrite) {
        const existing = await prisma.customer.findFirst({
          where: { OR: [{ phone: insertData.phone }, ...(insertData.email ? [{ email: insertData.email }] : [])] }
        })
        if (existing) {
          await prisma.customer.update({
            where: { id: existing.id },
            data: insertData
          })
          return existing.id
        }
      }

      const customer = await prisma.customer.create({ data: insertData })
      return customer.id
    }

    case 'GarmentPattern': {
      if (overwrite) {
        const existing = await prisma.garmentPattern.findFirst({ where: { name: insertData.name } })
        if (existing) {
          await prisma.garmentPattern.update({
            where: { id: existing.id },
            data: insertData
          })
          return existing.id
        }
      }

      const pattern = await prisma.garmentPattern.create({ data: insertData })
      return pattern.id
    }

    case 'Measurement': {
      // Parse additional measurements if it's a JSON string
      if (typeof insertData.additionalMeasurements === 'string') {
        try {
          insertData.additionalMeasurements = JSON.parse(insertData.additionalMeasurements)
        } catch {
          insertData.additionalMeasurements = null
        }
      }

      if (overwrite) {
        const existing = await prisma.measurement.findFirst({
          where: {
            customerId: insertData.customerId,
            garmentType: insertData.garmentType,
            isActive: true
          }
        })
        if (existing) {
          await prisma.measurement.update({
            where: { id: existing.id },
            data: insertData
          })
          return existing.id
        }
      }

      const measurement = await prisma.measurement.create({ data: insertData })
      return measurement.id
    }

    default:
      throw new Error(`Unsupported table: ${tableName}`)
  }
}

/**
 * Generate human-readable summary
 */
function generateSummary(result: UploadResult): string {
  const lines = [
    '=== UPLOAD SUMMARY ===',
    `Total Records: ${result.totalRecords}`,
    `✅ Successfully Uploaded: ${result.successCount}`,
    `❌ Failed: ${result.failureCount}`,
    `🔄 Duplicates Found: ${result.duplicateCount}`,
    `⏭️ Skipped: ${result.skippedCount}`,
    '',
    `Success Rate: ${((result.successCount / result.totalRecords) * 100).toFixed(1)}%`
  ]

  if (result.failureDetails.length > 0) {
    lines.push('', '=== ERRORS ===')
    const errorsByTable = groupBy(result.failureDetails, 'table')
    for (const [table, errors] of Object.entries(errorsByTable)) {
      lines.push(`${table}: ${errors.length} errors`)
    }
  }

  if (result.duplicateDetails.length > 0) {
    lines.push('', '=== DUPLICATES ===')
    const dupsByTable = groupBy(result.duplicateDetails, 'table')
    for (const [table, dups] of Object.entries(dupsByTable)) {
      const skipped = dups.filter(d => d.action === 'skip').length
      const overwritten = dups.filter(d => d.action === 'overwrite').length
      lines.push(`${table}: ${dups.length} duplicates (${overwritten} overwritten, ${skipped} skipped)`)
    }
  }

  return lines.join('\n')
}

function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const group = String(item[key])
    if (!result[group]) {
      result[group] = []
    }
    result[group].push(item)
    return result
  }, {} as Record<string, T[]>)
}
