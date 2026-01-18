import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-permissions'
import { qrcodeService } from '@/lib/barcode/qrcode-service'
import { z } from 'zod'

const generateQRSchema = z.object({
  type: z.enum(['cloth', 'accessory']),
  itemId: z.string(),
})

// POST - Generate QR code for an inventory item
export async function POST(request: Request) {
  const { error } = await requireAnyPermission(['view_inventory'])
  if (error) return error

  try {
    const body = await request.json()
    const data = generateQRSchema.parse(body)

    let qrCode: string

    if (data.type === 'cloth') {
      qrCode = await qrcodeService.generateClothQRCode(data.itemId)
    } else {
      qrCode = await qrcodeService.generateAccessoryQRCode(data.itemId)
    }

    return NextResponse.json({
      success: true,
      qrCode,
      type: data.type,
      itemId: data.itemId,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error generating QR code:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate QR code' },
      { status: 500 }
    )
  }
}

// GET - Lookup item by QR code data
export async function GET(request: Request) {
  const { error } = await requireAnyPermission(['view_inventory'])
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const qrData = searchParams.get('data')

    if (!qrData) {
      return NextResponse.json(
        { error: 'QR data parameter is required' },
        { status: 400 }
      )
    }

    const result = await qrcodeService.lookupByQRCode(qrData)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error looking up QR code:', error)
    return NextResponse.json(
      { error: 'Failed to lookup QR code' },
      { status: 500 }
    )
  }
}
