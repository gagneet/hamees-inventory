import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-permissions'
import { qrcodeService } from '@/lib/barcode/qrcode-service'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const generateLabelSchema = z.object({
  type: z.enum(['cloth', 'accessory']),
  itemId: z.string(),
})

// POST - Generate printable label for an inventory item
export async function POST(request: Request) {
  const { error } = await requireAnyPermission(['view_inventory'])
  if (error) return error

  try {
    const body = await request.json()
    const data = generateLabelSchema.parse(body)

    let qrCode: string
    let labelData: any

    if (data.type === 'cloth') {
      const cloth = await prisma.clothInventory.findUnique({
        where: { id: data.itemId },
      })

      if (!cloth) {
        return NextResponse.json(
          { error: 'Cloth item not found' },
          { status: 404 }
        )
      }

      qrCode = await qrcodeService.generateClothQRCode(cloth.id)

      labelData = {
        qrCode,
        name: `${cloth.brand} ${cloth.color} ${cloth.type}`,
        sku: cloth.sku,
        price: cloth.pricePerMeter,
        stock: `${cloth.currentStock.toFixed(2)}m`,
      }
    } else {
      const accessory = await prisma.accessoryInventory.findUnique({
        where: { id: data.itemId },
      })

      if (!accessory) {
        return NextResponse.json(
          { error: 'Accessory item not found' },
          { status: 404 }
        )
      }

      qrCode = await qrcodeService.generateAccessoryQRCode(accessory.id)

      labelData = {
        qrCode,
        name: `${accessory.type} ${accessory.color || ''}`.trim(),
        price: accessory.pricePerUnit,
        stock: `${accessory.currentStock} pcs`,
      }
    }

    const labelHTML = qrcodeService.generateLabelHTML(labelData)

    return NextResponse.json({
      success: true,
      html: labelHTML,
      qrCode: labelData.qrCode,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error generating label:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate label' },
      { status: 500 }
    )
  }
}
