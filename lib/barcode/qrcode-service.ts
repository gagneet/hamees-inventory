import QRCode from 'qrcode'
import { prisma } from '@/lib/db'

export interface QRCodeData {
  type: 'cloth' | 'accessory'
  id: string
  sku?: string
  name: string
}

export class QRCodeService {
  /**
   * Generate QR code data URL for an inventory item
   */
  async generateQRCode(data: QRCodeData): Promise<string> {
    try {
      // Create JSON string with item data
      const qrData = JSON.stringify({
        type: data.type,
        id: data.id,
        sku: data.sku,
        name: data.name,
        timestamp: new Date().toISOString(),
      })

      // Generate QR code as data URL
      const qrCodeDataURL = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })

      return qrCodeDataURL
    } catch (error) {
      console.error('QR code generation error:', error)
      throw new Error('Failed to generate QR code')
    }
  }

  /**
   * Generate QR code for cloth inventory item
   */
  async generateClothQRCode(clothId: string): Promise<string> {
    const cloth = await prisma.clothInventory.findUnique({
      where: { id: clothId },
    })

    if (!cloth) throw new Error('Cloth item not found')

    return this.generateQRCode({
      type: 'cloth',
      id: cloth.id,
      sku: cloth.sku,
      name: `${cloth.brand} ${cloth.color} ${cloth.type}`,
    })
  }

  /**
   * Generate QR code for accessory inventory item
   */
  async generateAccessoryQRCode(accessoryId: string): Promise<string> {
    const accessory = await prisma.accessoryInventory.findUnique({
      where: { id: accessoryId },
    })

    if (!accessory) throw new Error('Accessory item not found')

    return this.generateQRCode({
      type: 'accessory',
      id: accessory.id,
      name: `${accessory.type} ${accessory.color || ''}`.trim(),
    })
  }

  /**
   * Generate printable label HTML for an item
   */
  generateLabelHTML(data: {
    qrCode: string
    name: string
    sku?: string
    price?: number
    stock?: number
  }): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Inventory Label - ${data.name}</title>
        <style>
          @page {
            size: 80mm 40mm;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            width: 80mm;
            height: 40mm;
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
          }
          .label {
            width: 100%;
            height: 100%;
            padding: 4mm;
            box-sizing: border-box;
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 3mm;
            border: 1px solid #000;
          }
          .qr-code {
            flex-shrink: 0;
          }
          .qr-code img {
            width: 30mm;
            height: 30mm;
            display: block;
          }
          .info {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .name {
            font-size: 12pt;
            font-weight: bold;
            margin-bottom: 2mm;
            line-height: 1.2;
          }
          .details {
            font-size: 9pt;
            line-height: 1.4;
          }
          .sku {
            font-family: 'Courier New', monospace;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="qr-code">
            <img src="${data.qrCode}" alt="QR Code" />
          </div>
          <div class="info">
            <div class="name">${data.name}</div>
            <div class="details">
              ${data.sku ? `<div class="sku">SKU: ${data.sku}</div>` : ''}
              ${data.price !== undefined ? `<div>Price: ₹${data.price.toFixed(2)}</div>` : ''}
              ${data.stock !== undefined ? `<div>Stock: ${data.stock}</div>` : ''}
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }

  /**
   * Parse QR code data from scanned string
   */
  parseQRCode(qrString: string): QRCodeData | null {
    try {
      const data = JSON.parse(qrString)
      if (data.type && data.id && data.name) {
        return {
          type: data.type,
          id: data.id,
          sku: data.sku,
          name: data.name,
        }
      }
      return null
    } catch (error) {
      return null
    }
  }

  /**
   * Lookup inventory item by QR code data
   */
  async lookupByQRCode(qrString: string) {
    const qrData = this.parseQRCode(qrString)

    if (!qrData) {
      return { found: false, message: 'Invalid QR code' }
    }

    if (qrData.type === 'cloth') {
      const cloth = await prisma.clothInventory.findUnique({
        where: { id: qrData.id },
        include: { supplierRel: true },
      })

      if (cloth) {
        return {
          found: true,
          type: 'cloth',
          item: cloth,
        }
      }
    } else if (qrData.type === 'accessory') {
      const accessory = await prisma.accessoryInventory.findUnique({
        where: { id: qrData.id },
        include: { supplierRel: true },
      })

      if (accessory) {
        return {
          found: true,
          type: 'accessory',
          item: accessory,
        }
      }
    }

    return { found: false, message: 'Item not found in database' }
  }
}

// Export singleton instance
export const qrcodeService = new QRCodeService()
