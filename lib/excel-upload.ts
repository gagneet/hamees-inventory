import ExcelJS from 'exceljs'
import { prisma } from '@/lib/db'
import { z } from 'zod'

// ===== TYPES =====

export interface UploadResult {
  uploadId: string
  totalRecords: number
  successCount: number
  failureCount: number
  duplicateCount: number
  skippedCount: number
  successDetails: Array<{ table: string; id: string; row: number }>
  failureDetails: Array<{ table: string; row: number; error: string; data: any }>
  duplicateDetails: Array<{ table: string; row: number; existing: any; new: any; action?: 'skip' | 'overwrite' }>
  summary: string
}

export interface ParsedSheet {
  sheetName: string
  tableName: string
  rows: any[]
  errors: Array<{ row: number; error: string; data: any }>
}

export interface DuplicateCheck {
  table: string
  row: number
  existing: any
  new: any
  conflicts: string[]
}

// ===== VALIDATION SCHEMAS =====

const userSchema = z.object({
  id: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.enum(['OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'SALES_MANAGER', 'TAILOR', 'VIEWER']),
  phone: z.string().optional().nullable(),
  active: z.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
})

const supplierSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  contactPerson: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().min(1),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  pincode: z.string().optional().nullable(),
  gstin: z.string().optional().nullable(),
  rating: z.number().min(0).max(5).default(0),
  notes: z.string().optional().nullable(),
  active: z.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
})

const clothInventorySchema = z.object({
  id: z.string().optional(),
  sku: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().min(1),
  color: z.string().min(1),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  pattern: z.string().min(1),
  quality: z.string().min(1),
  type: z.string().min(1),
  pricePerMeter: z.number().positive(),
  currentStock: z.number().min(0),
  totalPurchased: z.number().min(0).default(0),
  reserved: z.number().min(0).default(0),
  minimum: z.number().min(0),
  supplier: z.string().min(1),
  supplierId: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  active: z.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  // Phase 1 Enhancement Fields
  fabricComposition: z.string().optional().nullable(),
  gsm: z.number().optional().nullable(),
  threadCount: z.number().optional().nullable(),
  weaveType: z.string().optional().nullable(),
  fabricWidth: z.string().optional().nullable(),
  shrinkagePercent: z.number().optional().nullable(),
  colorFastness: z.string().optional().nullable(),
  seasonSuitability: z.string().optional().nullable(), // Comma-separated string in Excel
  occasionType: z.string().optional().nullable(), // Comma-separated string in Excel
  careInstructions: z.string().optional().nullable(),
  swatchImage: z.string().optional().nullable(),
  textureImage: z.string().optional().nullable()
})

const accessoryInventorySchema = z.object({
  id: z.string().optional(),
  sku: z.string().optional().nullable(), // Auto-generated if not provided
  name: z.string().min(1),
  type: z.string().min(1),
  color: z.string().optional().nullable(),
  currentStock: z.number().int().min(0),
  minimum: z.number().int().min(0),
  pricePerUnit: z.number().positive(),
  supplier: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  active: z.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  // Phase 1 Enhancement Fields
  colorCode: z.string().optional().nullable(), // Pantone/DMC color codes
  threadWeight: z.string().optional().nullable(), // 40wt, 50wt, 60wt
  buttonSize: z.string().optional().nullable(), // Ligne sizing (14L, 18L, 20L, 24L)
  holePunchSize: z.number().optional().nullable(), // Number of holes (2, 4)
  material: z.string().optional().nullable(), // Shell, Brass, Resin, Horn, Plastic, Wood
  finish: z.string().optional().nullable(), // Matte, Polished, Antique, Brushed
  recommendedFor: z.string().optional().nullable(), // Comma-separated string in Excel
  styleCategory: z.string().optional().nullable(), // Formal, Casual, Designer, Traditional
  productImage: z.string().optional().nullable(),
  closeUpImage: z.string().optional().nullable()
})

const customerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().min(1),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  pincode: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  active: z.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
})

const garmentPatternSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  baseMeters: z.number().positive(),
  slimAdjustment: z.number().default(0),
  regularAdjustment: z.number().default(0),
  largeAdjustment: z.number().default(0.3),
  xlAdjustment: z.number().default(0.5),
  active: z.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
})

const measurementSchema = z.object({
  id: z.string().optional(),
  customerId: z.string().min(1),
  userId: z.string().optional().nullable(),
  garmentType: z.string().min(1),
  bodyType: z.enum(['SLIM', 'REGULAR', 'LARGE', 'XL']).optional().nullable(),
  neck: z.number().optional().nullable(),
  chest: z.number().optional().nullable(),
  waist: z.number().optional().nullable(),
  hip: z.number().optional().nullable(),
  shoulder: z.number().optional().nullable(),
  sleeveLength: z.number().optional().nullable(),
  shirtLength: z.number().optional().nullable(),
  inseam: z.number().optional().nullable(),
  outseam: z.number().optional().nullable(),
  thigh: z.number().optional().nullable(),
  knee: z.number().optional().nullable(),
  bottomOpening: z.number().optional().nullable(),
  jacketLength: z.number().optional().nullable(),
  lapelWidth: z.number().optional().nullable(),
  additionalMeasurements: z.string().optional().nullable(),
  replacesId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  notes: z.string().optional().nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
})

// ===== SCHEMA REGISTRY =====

const schemaRegistry: Record<string, z.ZodSchema> = {
  'User': userSchema,
  'Supplier': supplierSchema,
  'ClothInventory': clothInventorySchema,
  'AccessoryInventory': accessoryInventorySchema,
  'Customer': customerSchema,
  'GarmentPattern': garmentPatternSchema,
  'Measurement': measurementSchema
}

// ===== SHEET NAME TO TABLE MAPPING =====

const sheetToTableMap: Record<string, string> = {
  '1. Users': 'User',
  '2. Suppliers': 'Supplier',
  '3. Cloth Inventory': 'ClothInventory',
  '4. Accessories': 'AccessoryInventory',
  '5. Customers': 'Customer',
  '6. Garment Patterns': 'GarmentPattern',
  '8. Measurements': 'Measurement',
  '9. Orders': 'Order',
  '10. Order Items': 'OrderItem'
}

// ===== DUPLICATE DETECTION =====

export async function detectDuplicates(tableName: string, data: any[]): Promise<DuplicateCheck[]> {
  const duplicates: DuplicateCheck[] = []

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    let existing: any = null
    const conflicts: string[] = []

    try {
      switch (tableName) {
        case 'User':
          existing = await prisma.user.findUnique({ where: { email: row.email } })
          if (existing) {
            if (existing.name !== row.name) conflicts.push('name')
            if (existing.role !== row.role) conflicts.push('role')
            if (existing.phone !== row.phone) conflicts.push('phone')
          }
          break

        case 'Supplier':
          existing = await prisma.supplier.findFirst({
            where: {
              OR: [
                { name: row.name },
                { phone: row.phone },
                ...(row.email ? [{ email: row.email }] : [])
              ]
            }
          })
          if (existing) {
            if (existing.contactPerson !== row.contactPerson) conflicts.push('contactPerson')
            if (existing.address !== row.address) conflicts.push('address')
          }
          break

        case 'ClothInventory':
          existing = await prisma.clothInventory.findUnique({ where: { sku: row.sku } })
          if (existing) {
            if (existing.name !== row.name) conflicts.push('name')
            if (existing.color !== row.color) conflicts.push('color')
            if (existing.currentStock !== row.currentStock) conflicts.push('currentStock')
          }
          break

        case 'Customer':
          existing = await prisma.customer.findFirst({
            where: {
              OR: [
                { phone: row.phone },
                ...(row.email ? [{ email: row.email }] : [])
              ]
            }
          })
          if (existing) {
            if (existing.name !== row.name) conflicts.push('name')
            if (existing.address !== row.address) conflicts.push('address')
          }
          break

        case 'GarmentPattern':
          existing = await prisma.garmentPattern.findFirst({ where: { name: row.name } })
          if (existing) {
            if (existing.baseMeters !== row.baseMeters) conflicts.push('baseMeters')
          }
          break
      }

      if (existing && conflicts.length > 0) {
        duplicates.push({
          table: tableName,
          row: i + 1,
          existing,
          new: row,
          conflicts
        })
      }
    } catch (error) {
      console.error(`Error detecting duplicate in ${tableName} row ${i + 1}:`, error)
    }
  }

  return duplicates
}

// ===== PARSE EXCEL FILE =====

export async function parseExcelFile(buffer: ArrayBuffer | Buffer): Promise<ParsedSheet[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as any)

  const parsedSheets: ParsedSheet[] = []

  for (const worksheet of workbook.worksheets) {
    const sheetName = worksheet.name

    // Skip README and unknown sheets
    if (sheetName === 'README' || !sheetToTableMap[sheetName]) {
      continue
    }

    const tableName = sheetToTableMap[sheetName]
    const schema = schemaRegistry[tableName]

    if (!schema) {
      console.warn(`No schema found for table: ${tableName}`)
      continue
    }

    const rows: any[] = []
    const errors: Array<{ row: number; error: string; data: any }> = []

    // Find header row (skip notes row if exists)
    let headerRowIndex = 1
    const firstRow = worksheet.getRow(1)
    if (firstRow.getCell(1).value?.toString().startsWith('NOTE:')) {
      headerRowIndex = 3 // Notes, empty, then header
    }

    const headerRow = worksheet.getRow(headerRowIndex)
    const headers: string[] = []
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber] = cell.value?.toString() || ''
    })

    // Parse data rows
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowIndex) return // Skip header rows

      const rowData: any = {}
      let isEmpty = true

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = headers[colNumber]
        if (!header) return

        // Map header to field name (remove (FK), (cm), etc.)
        const fieldName = header
          .replace(/ \(FK\)$/, '')
          .replace(/ \(cm\)$/, '')
          .replace(/ \(JSON\)$/, '')
          .replace(/ \(Hashed\)$/, '')
          .replace(/\s+/g, '')
          .replace(/^ID$/, 'id')
          .replace(/^Email$/, 'email')

        const value = cell.value
        if (value !== null && value !== undefined && value !== '') {
          isEmpty = false
          rowData[toCamelCase(fieldName)] = parseValue(value, fieldName)
        }
      })

      if (isEmpty) return // Skip empty rows

      // Validate row data
      try {
        const validated = schema.parse(rowData)
        rows.push(validated)
      } catch (error) {
        if (error instanceof z.ZodError) {
          errors.push({
            row: rowNumber,
            error: error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
            data: rowData
          })
        } else {
          errors.push({
            row: rowNumber,
            error: String(error),
            data: rowData
          })
        }
      }
    })

    parsedSheets.push({
      sheetName,
      tableName,
      rows,
      errors
    })
  }

  return parsedSheets
}

// ===== UTILITY FUNCTIONS =====

function toCamelCase(str: string): string {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (letter, index) => {
      return index === 0 ? letter.toLowerCase() : letter.toUpperCase()
    })
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
}

function parseValue(value: any, fieldName: string): any {
  if (value === null || value === undefined || value === '') {
    return null
  }

  // Handle Excel date objects
  if (value instanceof Date) {
    return value.toISOString()
  }

  // Handle rich text
  if (typeof value === 'object' && 'richText' in value) {
    return value.richText.map((rt: any) => rt.text).join('')
  }

  // Boolean fields
  if (fieldName.toLowerCase().includes('active') || fieldName.toLowerCase().includes('isactive')) {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '1'
    }
    return Boolean(value)
  }

  // Numeric fields
  const numericFields = ['price', 'stock', 'minimum', 'meters', 'quantity', 'amount', 'rating', 'neck', 'chest', 'waist', 'hip', 'shoulder', 'sleeve', 'length', 'inseam', 'outseam', 'thigh', 'knee', 'bottom', 'jacket', 'lapel', 'adjustment']
  if (numericFields.some(nf => fieldName.toLowerCase().includes(nf))) {
    return Number(value)
  }

  return String(value).trim()
}

// ===== VALIDATE RELATIONAL INTEGRITY =====

export async function validateRelations(tableName: string, data: any[]): Promise<Array<{ row: number; error: string }>> {
  const errors: Array<{ row: number; error: string }> = []

  for (let i = 0; i < data.length; i++) {
    const row = data[i]

    try {
      switch (tableName) {
        case 'ClothInventory':
          if (row.supplierId) {
            const supplier = await prisma.supplier.findUnique({ where: { id: row.supplierId } })
            if (!supplier) {
              errors.push({ row: i + 1, error: `Supplier ID ${row.supplierId} not found` })
            }
          }
          break

        case 'AccessoryInventory':
          if (row.supplierId) {
            const supplier = await prisma.supplier.findUnique({ where: { id: row.supplierId } })
            if (!supplier) {
              errors.push({ row: i + 1, error: `Supplier ID ${row.supplierId} not found` })
            }
          }
          break

        case 'Measurement':
          const customer = await prisma.customer.findUnique({ where: { id: row.customerId } })
          if (!customer) {
            errors.push({ row: i + 1, error: `Customer ID ${row.customerId} not found` })
          }
          if (row.userId) {
            const user = await prisma.user.findUnique({ where: { id: row.userId } })
            if (!user) {
              errors.push({ row: i + 1, error: `User ID ${row.userId} not found` })
            }
          }
          break
      }
    } catch (error) {
      errors.push({ row: i + 1, error: `Validation error: ${String(error)}` })
    }
  }

  return errors
}
