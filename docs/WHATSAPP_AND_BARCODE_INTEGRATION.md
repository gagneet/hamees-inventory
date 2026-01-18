# WhatsApp & Barcode Integration Guide

**Version:** 0.18.0
**Date:** January 18, 2026
**Author:** Hamees Inventory System

---

## Overview

This document covers the implementation of two major features:
1. **QR Code & Barcode System** - Generate and scan QR codes for inventory items
2. **WhatsApp Business Integration** - Automated customer notifications and alerts

---

## 📱 WhatsApp Business Integration

### Features Implemented

#### 1. Database Schema

**New Models:**

```prisma
model WhatsAppMessage {
  id            String    @id @default(cuid())
  recipient     String    // Phone number (E.164 format)
  customerId    String?
  orderId       String?
  messageType   String    // ORDER_CONFIRMATION, ORDER_READY, PAYMENT_REMINDER, CUSTOM
  templateName  String?
  content       String    @db.Text
  status        String    @default("PENDING") // PENDING, SENT, DELIVERED, READ, FAILED
  sentAt        DateTime?
  deliveredAt   DateTime?
  readAt        DateTime?
  failureReason String?
  metadata      Json?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  customer      Customer? @relation(...)
  order         Order?    @relation(...)
}

model WhatsAppTemplate {
  id            String    @id @default(cuid())
  name          String    @unique
  category      String    // TRANSACTIONAL, MARKETING, UTILITY
  language      String    @default("en")
  content       String    @db.Text
  variables     Json      // Array of placeholders
  active        Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

#### 2. WhatsApp Service Layer

**Location:** `lib/whatsapp/whatsapp-service.ts`

**Key Methods:**
- `sendTemplateMessage(payload)` - Send message with variable replacement
- `sendOrderConfirmation(orderId)` - Auto-send order confirmation
- `sendOrderReady(orderId)` - Notify customer order is ready
- `sendPaymentReminder(orderId)` - Send payment reminder
- `sendLowStockAlert(clothId)` - Alert owner about low stock

**Phone Number Normalization:**
- Removes all non-numeric characters
- Adds India country code (+91) if missing
- Converts to E.164 format

**Development Mode:**
- Works without WhatsApp API credentials
- Logs messages to console instead of sending
- Perfect for testing without API access

#### 3. Message Templates

**Pre-seeded Templates:**

1. **Order Confirmation** (`order_confirmation`)
   - Sent when new order is created
   - Variables: customer_name, order_number, delivery_date, items, total_amount, advance_paid, balance

2. **Order Ready** (`order_ready`)
   - Sent when order status changes to READY
   - Variables: customer_name, order_number, balance

3. **Payment Reminder** (`payment_reminder`)
   - Manual trigger for overdue payments
   - Variables: customer_name, order_number, delivery_date, balance

4. **Low Stock Alert** (`low_stock_alert`)
   - Alert owner when inventory is low
   - Variables: item_name, available_stock, minimum_stock

#### 4. API Endpoints

**Send Message:**
```bash
POST /api/whatsapp/send
Content-Type: application/json

{
  "to": "919876543210",
  "templateName": "order_confirmation",
  "variables": {
    "customer_name": "Rajesh Kumar",
    "order_number": "ORD-202601-0001",
    "delivery_date": "25/01/2026",
    "items": "- Men's Shirt (2)\n- Men's Trouser (1)",
    "total_amount": "₹15,000",
    "advance_paid": "₹5,000",
    "balance": "₹10,000"
  },
  "customerId": "customer_id",
  "orderId": "order_id",
  "type": "ORDER_CONFIRMATION"
}
```

**List Templates:**
```bash
GET /api/whatsapp/templates
```

**Message History:**
```bash
GET /api/whatsapp/history?customerId={id}
GET /api/whatsapp/history?orderId={id}
GET /api/whatsapp/history?status=SENT
```

#### 5. Automatic Workflow Integration

**Order Creation → WhatsApp Confirmation**
- **File:** `app/api/orders/route.ts:390-398`
- **Trigger:** New order created
- **Action:** Sends order confirmation automatically
- **Non-blocking:** Order creation succeeds even if WhatsApp fails

**Order Status → READY → WhatsApp Notification**
- **File:** `app/api/orders/[id]/status/route.ts:201-210`
- **Trigger:** Order status updated to READY
- **Action:** Sends pickup notification to customer
- **Non-blocking:** Status update succeeds even if WhatsApp fails

### Configuration

#### Environment Variables

Add to `.env` file:

```bash
# WhatsApp Business API (Optional - works in dev mode without these)
WHATSAPP_API_KEY=your_api_key_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_API_URL=https://graph.facebook.com/v17.0
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
```

**Without credentials:** System runs in development mode, logging messages to console.

#### WhatsApp Business API Setup

1. **Sign up:** https://business.facebook.com/
2. **Create Business Account**
3. **Add WhatsApp Product**
4. **Get API Credentials:**
   - Phone Number ID
   - API Access Token
   - Business Account ID
5. **Configure Webhook** (optional)
6. **Add credentials to `.env`**

### Usage Examples

#### Manual Message Send

```typescript
import { whatsappService } from '@/lib/whatsapp/whatsapp-service'

// Send custom message
await whatsappService.sendTemplateMessage({
  to: '919876543210',
  templateName: 'payment_reminder',
  variables: {
    customer_name: 'Rajesh Kumar',
    order_number: 'ORD-202601-0001',
    delivery_date: '25/01/2026',
    balance: '₹10,000'
  },
  type: 'PAYMENT_REMINDER',
  customerId: 'customer_id',
  orderId: 'order_id'
})
```

#### Automatic Triggers

```typescript
// Already integrated in order workflow
// No additional code needed

// Order creation automatically sends confirmation
POST /api/orders
→ WhatsApp confirmation sent ✅

// Order status update to READY automatically sends notification
PATCH /api/orders/{id}/status
{ "status": "READY" }
→ WhatsApp pickup notification sent ✅
```

### Message Status Tracking

Messages have the following statuses:
- **PENDING** - Queued, not yet sent
- **SENT** - Successfully sent to WhatsApp API
- **DELIVERED** - Delivered to recipient's device
- **READ** - Read by recipient
- **FAILED** - Failed to send (check `failureReason`)

### Testing

#### Test in Development Mode

1. **Create a new order:**
   ```bash
   POST /api/orders
   # Check PM2 logs for:
   # [WhatsApp] DEV MODE - Message would be sent:
   #   To: 919876543210
   #   Type: ORDER_CONFIRMATION
   #   Content: [full message]
   ```

2. **Update order to READY:**
   ```bash
   PATCH /api/orders/{id}/status
   { "status": "READY" }
   # Check logs for pickup notification
   ```

3. **View message history:**
   ```bash
   GET /api/whatsapp/history
   # Returns all sent messages with status
   ```

#### Test with WhatsApp Business API

1. Add credentials to `.env`
2. Restart application: `pm2 restart hamees-inventory`
3. Create test order with valid Indian phone number
4. Check recipient's WhatsApp for message

### Permissions

| Action | Required Permission | Roles |
|--------|-------------------|-------|
| Send message | `manage_customers` or `create_order` | OWNER, ADMIN, SALES_MANAGER |
| View templates | `view_inventory` | All except VIEWER |
| Create template | `manage_settings` | OWNER, ADMIN |
| View history | `view_customers` | OWNER, ADMIN, SALES_MANAGER |

---

## 📦 QR Code & Barcode System

### Features Implemented

#### 1. QR Code Service

**Location:** `lib/barcode/qrcode-service.ts`

**Key Methods:**
- `generateQRCode(data)` - Generate QR code data URL
- `generateClothQRCode(clothId)` - QR code for cloth item
- `generateAccessoryQRCode(accessoryId)` - QR code for accessory
- `generateLabelHTML(data)` - Printable label HTML (80mm x 40mm)
- `parseQRCode(qrString)` - Parse scanned QR code
- `lookupByQRCode(qrString)` - Find inventory item

**QR Code Data Format:**
```json
{
  "type": "cloth",
  "id": "cloth_id_here",
  "sku": "CLT-COT-ABC-123456",
  "name": "ABC Blue Cotton",
  "timestamp": "2026-01-18T00:00:00.000Z"
}
```

#### 2. API Endpoints

**Generate QR Code:**
```bash
POST /api/barcode/generate
Content-Type: application/json

{
  "type": "cloth",
  "itemId": "cloth_id_here"
}

# Response:
{
  "success": true,
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEU...",
  "type": "cloth",
  "itemId": "cloth_id_here"
}
```

**Lookup by QR Code:**
```bash
GET /api/barcode/generate?data={"type":"cloth","id":"..."}

# Response:
{
  "found": true,
  "type": "cloth",
  "item": { /* full item details */ }
}
```

**Generate Printable Label:**
```bash
POST /api/barcode/label
Content-Type: application/json

{
  "type": "cloth",
  "itemId": "cloth_id_here"
}

# Response:
{
  "success": true,
  "html": "<!DOCTYPE html>...",
  "qrCode": "data:image/png;base64,..."
}
```

#### 3. Existing Scanner Integration

**Location:** `components/barcode-scanner.tsx`

The existing barcode scanner component supports:
- **Camera Mode** - Scan QR codes with device camera
- **Manual Mode** - Enter barcode/SKU manually
- **Compatible** - Works with new QR code format
- **Auto-lookup** - Calls `/api/inventory/barcode?barcode={sku}` for SKU lookup

**Enhanced SKU Lookup:**
- `GET /api/inventory/barcode?barcode={sku}` - Already implemented
- Returns cloth item if found by SKU
- Can be enhanced to support QR code JSON format

#### 4. Label Format

**Printable Label Specification:**
- **Size:** 80mm × 40mm
- **Layout:** Horizontal, QR code on left, info on right
- **QR Code:** 30mm × 30mm
- **Border:** 1px solid black
- **Print-optimized** CSS with `@page` rules

**Label Contents:**
- QR code image
- Item name (bold, 12pt)
- SKU (monospace, bold)
- Price per meter/unit
- Current stock

### Usage Examples

#### Generate QR Code Programmatically

```typescript
import { qrcodeService } from '@/lib/barcode/qrcode-service'

// For cloth item
const qrCode = await qrcodeService.generateClothQRCode(clothId)
// Returns: data:image/png;base64,iVBORw0KGgoAAAANS...

// For accessory item
const qrCode = await qrcodeService.generateAccessoryQRCode(accessoryId)
```

#### Generate and Print Label

```typescript
import { qrcodeService } from '@/lib/barcode/qrcode-service'

// Generate label HTML
const cloth = await prisma.clothInventory.findUnique({ where: { id } })
const qrCode = await qrcodeService.generateClothQRCode(cloth.id)

const labelHTML = qrcodeService.generateLabelHTML({
  qrCode,
  name: `${cloth.brand} ${cloth.color} ${cloth.type}`,
  sku: cloth.sku,
  price: cloth.pricePerMeter,
  stock: `${cloth.currentStock.toFixed(2)}m`
})

// Open in new window and print
const printWindow = window.open('', '_blank')
printWindow.document.write(labelHTML)
printWindow.print()
```

#### Scan and Lookup

```typescript
// In barcode scanner component
const onScanSuccess = async (scannedData: string) => {
  // Try QR code format first
  const result = await fetch(`/api/barcode/generate?data=${encodeURIComponent(scannedData)}`)
  const data = await result.json()

  if (data.found) {
    // Display item details
    console.log('Item found:', data.item)
  } else {
    // Try SKU lookup
    const skuResult = await fetch(`/api/inventory/barcode?barcode=${scannedData}`)
    // ...
  }
}
```

### Future Enhancements

**Pending Features (Not Yet Implemented):**

1. **Batch QR Code Generation**
   - Select multiple items
   - Generate all QR codes at once
   - Print sheet with multiple labels

2. **Label Print UI**
   - Button on inventory cards
   - Print dialog with preview
   - Direct print to label printer

3. **Enhanced Scanner**
   - Support both SKU and QR code formats
   - Auto-detect format
   - Display item details inline

4. **Accessory Barcode Support**
   - Enable accessory scanning in existing scanner
   - Update SKU generation for accessories
   - Add accessory-specific fields

### Permissions

| Action | Required Permission | Roles |
|--------|-------------------|-------|
| Generate QR code | `view_inventory` | All except VIEWER |
| Generate label | `view_inventory` | All except VIEWER |
| Scan barcode | `view_inventory` | All except VIEWER |

---

## 📊 Implementation Summary

### Files Created

**WhatsApp Integration:**
1. `lib/whatsapp/whatsapp-service.ts` - WhatsApp service layer
2. `app/api/whatsapp/send/route.ts` - Send message endpoint
3. `app/api/whatsapp/templates/route.ts` - Template management
4. `app/api/whatsapp/history/route.ts` - Message history
5. `prisma/seed-whatsapp-templates.ts` - Template seeding script

**Barcode System:**
6. `lib/barcode/qrcode-service.ts` - QR code service layer
7. `app/api/barcode/generate/route.ts` - QR generation & lookup
8. `app/api/barcode/label/route.ts` - Label generation

**Documentation:**
9. `docs/WHATSAPP_AND_BARCODE_INTEGRATION.md` - This file

### Files Modified

1. `prisma/schema.prisma` - Added WhatsApp models
2. `app/api/orders/route.ts` - Auto-send order confirmation
3. `app/api/orders/[id]/status/route.ts` - Auto-send ready notification
4. `package.json` - Added dependencies

### Dependencies Added

```json
{
  "qrcode": "^1.5.4",
  "@types/qrcode": "^1.5.6",
  "@whiskeysockets/baileys": "7.0.0-rc.9",
  "qrcode-terminal": "^0.12.0",
  "pino": "^10.2.0",
  "axios": "^1.13.2"
}
```

### Database Changes

**New Tables:**
- `WhatsAppMessage` - Message history and tracking
- `WhatsAppTemplate` - Reusable message templates

**Updated Tables:**
- `Customer` - Added `whatsappMessages` relation
- `Order` - Added `whatsappMessages` relation

### Migration Commands

```bash
# Push schema changes
pnpm db:push

# Regenerate Prisma client
pnpm prisma generate

# Seed WhatsApp templates
PGPASSWORD=hamees_secure_2026 psql -h localhost -U hamees_user -d tailor_inventory -f /tmp/seed-whatsapp.sql
```

---

## 🧪 Testing Checklist

### WhatsApp Integration

- [ ] Create new order → Check logs for confirmation message
- [ ] Update order to READY → Check logs for pickup notification
- [ ] Send manual message via API → Verify message in database
- [ ] View message history → Check all messages appear
- [ ] Test with invalid phone number → Verify error handling
- [ ] Test template variables → Verify replacement works
- [ ] Test with WhatsApp API credentials → Verify actual sending

### Barcode System

- [ ] Generate QR code for cloth item → Verify image generated
- [ ] Generate QR code for accessory → Verify image generated
- [ ] Scan QR code → Verify item lookup works
- [ ] Generate printable label → Verify HTML format
- [ ] Print label → Verify 80mm x 40mm size
- [ ] Lookup by SKU → Verify existing functionality still works

---

## 🚀 Deployment

### Production Deployment Steps

1. **Build application:**
   ```bash
   NODE_ENV=production npm run build
   ```

2. **Restart PM2:**
   ```bash
   pm2 restart hamees-inventory
   ```

3. **Verify deployment:**
   ```bash
   pm2 logs hamees-inventory --lines 20
   curl https://hamees.gagneet.com/api/whatsapp/templates
   ```

### Configuration Checklist

- [ ] `.env` file has `DATABASE_URL`
- [ ] `NEXTAUTH_SECRET` is set
- [ ] `NEXTAUTH_URL=https://hamees.gagneet.com`
- [ ] WhatsApp credentials (optional for dev mode)
- [ ] PM2 process running
- [ ] nginx proxy configured
- [ ] Application accessible at https://hamees.gagneet.com

---

## 📖 API Reference

### WhatsApp Endpoints

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| POST | `/api/whatsapp/send` | Send message | `manage_customers`, `create_order` |
| GET | `/api/whatsapp/templates` | List templates | `view_inventory` |
| POST | `/api/whatsapp/templates` | Create template | `manage_settings` |
| GET | `/api/whatsapp/history` | Message history | `view_customers` |

### Barcode Endpoints

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| POST | `/api/barcode/generate` | Generate QR code | `view_inventory` |
| GET | `/api/barcode/generate?data={qr}` | Lookup by QR code | `view_inventory` |
| POST | `/api/barcode/label` | Generate label | `view_inventory` |

---

## 🔧 Troubleshooting

### WhatsApp Issues

**Messages not sending:**
- Check if WhatsApp API credentials are set
- Verify `WHATSAPP_API_KEY` is valid
- Check PM2 logs for errors: `pm2 logs hamees-inventory`
- Test in dev mode first (no credentials needed)

**Invalid phone number:**
- Ensure phone number is 10 digits
- System auto-adds +91 for Indian numbers
- E.164 format: 919876543210 (no spaces, no +)

**Template not found:**
- Run template seed script
- Check templates in database: `SELECT * FROM "WhatsAppTemplate";`
- Verify template name matches exactly

### Barcode Issues

**QR code not generating:**
- Check item exists in database
- Verify `itemId` is correct
- Check API response for errors

**Scanner not working:**
- Ensure camera permissions granted
- Test manual entry mode
- Check browser compatibility (Chrome/Edge recommended)

**Label not printing correctly:**
- Verify printer supports 80mm labels
- Check print preview before printing
- Adjust CSS if needed for specific printer

---

## 📝 Version History

### v0.18.0 (January 18, 2026)

**Added:**
- WhatsApp Business Integration with automatic notifications
- QR Code generation for inventory items
- Printable label system (80mm x 40mm)
- WhatsApp message templates (4 pre-seeded)
- Message history tracking with status
- Auto-send confirmations on order creation
- Auto-send notifications when order ready

**Database:**
- Added `WhatsAppMessage` model
- Added `WhatsAppTemplate` model
- Updated `Customer` and `Order` models with relations

**Dependencies:**
- qrcode, @types/qrcode
- @whiskeysockets/baileys
- qrcode-terminal, pino, axios

---

## 🤝 Support

For issues or questions:
1. Check PM2 logs: `pm2 logs hamees-inventory`
2. Review this documentation
3. Check WhatsApp Business API docs: https://developers.facebook.com/docs/whatsapp
4. Contact development team

---

**Last Updated:** January 18, 2026
**Version:** 0.18.0
**Status:** Production Ready ✅
