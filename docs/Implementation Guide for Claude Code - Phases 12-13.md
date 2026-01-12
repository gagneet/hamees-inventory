# PHASE 12: WhatsApp Business Integration

## Objective
Implement automated WhatsApp messaging for order notifications, payment reminders, and customer communication.

## Duration
7-10 days

## Prerequisites
- WhatsApp Business API access OR Baileys library (unofficial)
- WhatsApp Business phone number

---

### Step 1: Database Schema Updates

#### Update: `prisma/schema.prisma`

Add new models for WhatsApp tracking:

```prisma
model WhatsAppMessage {
  id            String    @id @default(cuid())
  recipient     String    // Phone number
  customerId    String?
  orderId       String?
  messageType   String    // ORDER_CONFIRMATION, ORDER_READY, PAYMENT_REMINDER, etc.
  templateName  String?
  content       String
  status        String    @default("PENDING") // PENDING, SENT, DELIVERED, READ, FAILED
  sentAt        DateTime?
  deliveredAt   DateTime?
  readAt        DateTime?
  failureReason String?
  metadata      Json?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  customer      Customer? @relation(fields: [customerId], references: [id])
  order         Order?    @relation(fields: [orderId], references: [id])

  @@index([customerId])
  @@index([orderId])
  @@index([status])
  @@index([createdAt])
}

model WhatsAppTemplate {
  id            String    @id @default(cuid())
  name          String    @unique
  category      String    // TRANSACTIONAL, MARKETING, UTILITY
  language      String    @default("en")
  content       String
  variables     Json      // Array of variable placeholders
  active        Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([name])
  @@index([active])
}

// Update Order model to include WhatsApp messages
model Order {
  // ... existing fields ...
  whatsappMessages WhatsAppMessage[]
}

// Update Customer model to include WhatsApp messages
model Customer {
  // ... existing fields ...
  whatsappMessages WhatsAppMessage[]
}

// Add WhatsApp settings
model Settings {
  // ... existing fields ...
}
```

Run migration:
```bash
pnpm db:push
# OR for production
pnpm db:migrate
```

---

### Step 2: Install Dependencies

```bash
# Option A: Official WhatsApp Business API (Recommended for production)
pnpm add axios

# Option B: Baileys (Unofficial - for testing/quick start)
pnpm add @whiskeysockets/baileys qrcode-terminal pino
```

---

### Step 3: Create WhatsApp Service

#### File: `lib/whatsapp/whatsapp-service.ts`

```typescript
import { prisma } from '@/lib/db'

export interface WhatsAppMessagePayload {
  to: string
  templateName?: string
  variables?: Record<string, string>
  body?: string
  type?: 'ORDER_CONFIRMATION' | 'ORDER_READY' | 'PAYMENT_REMINDER' | 'CUSTOM'
  customerId?: string
  orderId?: string
}

export class WhatsAppService {
  private apiKey: string
  private phoneNumberId: string
  private baseUrl: string

  constructor() {
    this.apiKey = process.env.WHATSAPP_API_KEY || ''
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || ''
    this.baseUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v17.0'
  }

  /**
   * Send a templated WhatsApp message
   */
  async sendTemplateMessage(payload: WhatsAppMessagePayload): Promise<string> {
    try {
      // Normalize phone number (remove +, spaces, etc.)
      const to = this.normalizePhoneNumber(payload.to)

      // Get template
      const template = payload.templateName
        ? await prisma.whatsAppTemplate.findUnique({
            where: { name: payload.templateName },
          })
        : null

      if (payload.templateName && !template) {
        throw new Error(`Template ${payload.templateName} not found`)
      }

      // Replace variables in template
      let messageContent = payload.body || template?.content || ''
      if (template && payload.variables) {
        Object.entries(payload.variables).forEach(([key, value]) => {
          messageContent = messageContent.replace(`{{${key}}}`, value)
        })
      }

      // Save to database
      const message = await prisma.whatsAppMessage.create({
        data: {
          recipient: to,
          customerId: payload.customerId,
          orderId: payload.orderId,
          messageType: payload.type || 'CUSTOM',
          templateName: payload.templateName,
          content: messageContent,
          status: 'PENDING',
        },
      })

      // Send via WhatsApp API
      const sent = await this.sendViaAPI(to, messageContent, template?.name)

      // Update status
      await prisma.whatsAppMessage.update({
        where: { id: message.id },
        data: {
          status: sent ? 'SENT' : 'FAILED',
          sentAt: sent ? new Date() : null,
          failureReason: sent ? null : 'API call failed',
        },
      })

      return message.id
    } catch (error) {
      console.error('WhatsApp send error:', error)
      throw error
    }
  }

  /**
   * Send message via WhatsApp Business API
   */
  private async sendViaAPI(
    to: string,
    message: string,
    templateName?: string
  ): Promise<boolean> {
    try {
      // For Official WhatsApp Business API
      const response = await fetch(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: to,
            type: 'text',
            text: {
              body: message,
            },
          }),
        }
      )

      return response.ok
    } catch (error) {
      console.error('WhatsApp API error:', error)
      return false
    }
  }

  /**
   * Normalize phone number to E.164 format
   */
  private normalizePhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '')

    // Add country code if missing (assuming India +91)
    if (!cleaned.startsWith('91') && cleaned.length === 10) {
      cleaned = '91' + cleaned
    }

    return cleaned
  }

  /**
   * Send order confirmation
   */
  async sendOrderConfirmation(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: {
          include: {
            garmentPattern: true,
          },
        },
      },
    })

    if (!order) throw new Error('Order not found')

    const itemsList = order.items
      .map((item) => `- ${item.garmentPattern.name} (${item.quantity})`)
      .join('\n')

    await this.sendTemplateMessage({
      to: order.customer.phone,
      templateName: 'order_confirmation',
      variables: {
        customer_name: order.customer.name,
        order_number: order.orderNumber,
        delivery_date: order.deliveryDate.toLocaleDateString('en-IN'),
        total_amount: `₹${order.totalAmount.toLocaleString('en-IN')}`,
        advance_paid: `₹${order.advancePaid.toLocaleString('en-IN')}`,
        balance: `₹${order.balanceAmount.toLocaleString('en-IN')}`,
        items: itemsList,
      },
      type: 'ORDER_CONFIRMATION',
      customerId: order.customerId,
      orderId: order.id,
    })
  }

  /**
   * Send order ready notification
   */
  async sendOrderReady(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
      },
    })

    if (!order) throw new Error('Order not found')

    await this.sendTemplateMessage({
      to: order.customer.phone,
      templateName: 'order_ready',
      variables: {
        customer_name: order.customer.name,
        order_number: order.orderNumber,
        balance: `₹${order.balanceAmount.toLocaleString('en-IN')}`,
      },
      type: 'ORDER_READY',
      customerId: order.customerId,
      orderId: order.id,
    })
  }

  /**
   * Send payment reminder
   */
  async sendPaymentReminder(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
      },
    })

    if (!order) throw new Error('Order not found')

    await this.sendTemplateMessage({
      to: order.customer.phone,
      templateName: 'payment_reminder',
      variables: {
        customer_name: order.customer.name,
        order_number: order.orderNumber,
        balance: `₹${order.balanceAmount.toLocaleString('en-IN')}`,
        delivery_date: order.deliveryDate.toLocaleDateString('en-IN'),
      },
      type: 'PAYMENT_REMINDER',
      customerId: order.customerId,
      orderId: order.id,
    })
  }

  /**
   * Send low stock alert to owner
   */
  async sendLowStockAlert(clothId: string): Promise<void> {
    const cloth = await prisma.clothInventory.findUnique({
      where: { id: clothId },
    })

    if (!cloth) throw new Error('Cloth not found')

    const owner = await prisma.user.findFirst({
      where: { role: 'OWNER' },
    })

    if (!owner?.phone) return

    const available = cloth.currentStock - cloth.reserved

    await this.sendTemplateMessage({
      to: owner.phone,
      templateName: 'low_stock_alert',
      variables: {
        item_name: cloth.name,
        available_stock: `${available}m`,
        minimum_stock: `${cloth.minimum}m`,
      },
      type: 'CUSTOM',
    })
  }
}

// Export singleton instance
export const whatsappService = new WhatsAppService()
```

---

### Step 4: Create API Endpoints

#### File: `app/api/whatsapp/send/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-permissions'
import { whatsappService } from '@/lib/whatsapp/whatsapp-service'
import { z } from 'zod'

const sendMessageSchema = z.object({
  to: z.string().min(10),
  templateName: z.string().optional(),
  variables: z.record(z.string()).optional(),
  body: z.string().optional(),
  customerId: z.string().optional(),
  orderId: z.string().optional(),
})

export async function POST(request: Request) {
  const { error } = await requireAnyPermission(['manage_customers', 'create_order'])
  if (error) return error

  try {
    const body = await request.json()
    const data = sendMessageSchema.parse(body)

    const messageId = await whatsappService.sendTemplateMessage(data)

    return NextResponse.json({ success: true, messageId })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error sending WhatsApp message:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
```

#### File: `app/api/whatsapp/templates/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { z } from 'zod'

const templateSchema = z.object({
  name: z.string().min(1),
  category: z.enum(['TRANSACTIONAL', 'MARKETING', 'UTILITY']),
  language: z.string().default('en'),
  content: z.string().min(1),
  variables: z.array(z.string()),
})

export async function GET() {
  const { error } = await requireAnyPermission(['view_inventory'])
  if (error) return error

  try {
    const templates = await prisma.whatsAppTemplate.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const { error } = await requireAnyPermission(['manage_settings'])
  if (error) return error

  try {
    const body = await request.json()
    const data = templateSchema.parse(body)

    const template = await prisma.whatsAppTemplate.create({
      data: {
        name: data.name,
        category: data.category,
        language: data.language,
        content: data.content,
        variables: data.variables,
      },
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating template:', error)
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    )
  }
}
```

#### File: `app/api/whatsapp/history/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'

export async function GET(request: Request) {
  const { error } = await requireAnyPermission(['view_orders', 'view_customers'])
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')
    const orderId = searchParams.get('orderId')
    const limit = parseInt(searchParams.get('limit') || '50')

    const messages = await prisma.whatsAppMessage.findMany({
      where: {
        ...(customerId && { customerId }),
        ...(orderId && { orderId }),
      },
      include: {
        customer: {
          select: {
            name: true,
            phone: true,
          },
        },
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Error fetching message history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch history' },
      { status: 500 }
    )
  }
}
```

---

### Step 5: Auto-trigger WhatsApp Messages

#### File: `lib/whatsapp/triggers.ts`

```typescript
import { whatsappService } from './whatsapp-service'
import { OrderStatus } from '@prisma/client'

/**
 * Trigger WhatsApp messages based on order events
 */
export async function triggerOrderNotifications(
  orderId: string,
  event: 'created' | 'status_changed',
  newStatus?: OrderStatus
) {
  try {
    if (event === 'created') {
      // Send order confirmation
      await whatsappService.sendOrderConfirmation(orderId)
    }

    if (event === 'status_changed' && newStatus === OrderStatus.READY) {
      // Send order ready notification
      await whatsappService.sendOrderReady(orderId)
    }
  } catch (error) {
    console.error('WhatsApp trigger error:', error)
    // Don't throw - notifications shouldn't block order operations
  }
}

/**
 * Send payment reminders for orders with pending balance
 */
export async function sendPaymentReminders() {
  const { prisma } = await import('@/lib/db')
  const { addDays } = await import('date-fns')

  try {
    // Find orders with balance due in next 2 days
    const orders = await prisma.order.findMany({
      where: {
        balanceAmount: { gt: 0 },
        status: { in: ['READY', 'FINISHING'] },
        deliveryDate: {
          gte: new Date(),
          lte: addDays(new Date(), 2),
        },
      },
    })

    for (const order of orders) {
      await whatsappService.sendPaymentReminder(order.id)
    }

    console.log(`Sent ${orders.length} payment reminders`)
  } catch (error) {
    console.error('Payment reminder cron error:', error)
  }
}

/**
 * Send low stock alerts
 */
export async function sendLowStockAlerts() {
  const { prisma } = await import('@/lib/db')

  try {
    const lowStockItems = await prisma.clothInventory.findMany({
      where: {
        currentStock: {
          lte: prisma.clothInventory.fields.minimum,
        },
      },
    })

    for (const item of lowStockItems) {
      await whatsappService.sendLowStockAlert(item.id)
    }

    console.log(`Sent ${lowStockItems.length} low stock alerts`)
  } catch (error) {
    console.error('Low stock alert error:', error)
  }
}
```

---

### Step 6: Update Order Creation to Trigger WhatsApp

#### Update: `app/api/orders/route.ts`

Add this after order creation:

```typescript
// ... existing code ...

// Create order in transaction
const order = await prisma.$transaction(async (tx) => {
  // ... existing order creation code ...
  
  return newOrder
})

// Trigger WhatsApp notification (async, non-blocking)
triggerOrderNotifications(order.id, 'created').catch(console.error)

return NextResponse.json({ order }, { status: 201 })
```

#### Update: `app/api/orders/[id]/status/route.ts`

Add this after status update:

```typescript
// ... existing status update code ...

// Trigger WhatsApp notification if status changed to READY
if (status === OrderStatus.READY) {
  triggerOrderNotifications(id, 'status_changed', status).catch(console.error)
}

return NextResponse.json({ order: updatedOrder })
```

---

### Step 7: Seed WhatsApp Templates

#### File: `prisma/seed-whatsapp-templates.ts`

```typescript
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config()

const connectionString = process.env.DATABASE_URL!
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding WhatsApp templates...')

  await prisma.whatsAppTemplate.createMany({
    data: [
      {
        name: 'order_confirmation',
        category: 'TRANSACTIONAL',
        language: 'en',
        content: `Hello {{customer_name}}! 🎉

Your order #{{order_number}} has been confirmed.

📋 Order Details:
{{items}}

💰 Total: {{total_amount}}
💵 Advance Paid: {{advance_paid}}
💳 Balance: {{balance}}

📅 Delivery Date: {{delivery_date}}

Thank you for choosing Hamees Attire!`,
        variables: ['customer_name', 'order_number', 'items', 'total_amount', 'advance_paid', 'balance', 'delivery_date'],
      },
      {
        name: 'order_ready',
        category: 'TRANSACTIONAL',
        language: 'en',
        content: `Hi {{customer_name}}! ✅

Great news! Your order #{{order_number}} is ready for pickup.

💳 Remaining Balance: {{balance}}

Please visit our shop at your earliest convenience.

Hamees Attire - Bespoke Tailoring
📍 Amritsar, Punjab
📞 +91-8400008096`,
        variables: ['customer_name', 'order_number', 'balance'],
      },
      {
        name: 'payment_reminder',
        category: 'TRANSACTIONAL',
        language: 'en',
        content: `Dear {{customer_name}},

This is a friendly reminder about the pending balance for order #{{order_number}}.

💳 Balance Due: {{balance}}
📅 Delivery Date: {{delivery_date}}

Please arrange payment at your earliest convenience.

Thank you!
Hamees Attire`,
        variables: ['customer_name', 'order_number', 'balance', 'delivery_date'],
      },
      {
        name: 'low_stock_alert',
        category: 'UTILITY',
        language: 'en',
        content: `⚠️ LOW STOCK ALERT

{{item_name}} is running low!

📊 Available: {{available_stock}}
📉 Minimum: {{minimum_stock}}

Please reorder soon.`,
        variables: ['item_name', 'available_stock', 'minimum_stock'],
      },
    ],
    skipDuplicates: true,
  })

  console.log('✅ WhatsApp templates seeded')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
```

Run:
```bash
pnpm tsx prisma/seed-whatsapp-templates.ts
```

---

### Step 8: Environment Variables

#### Update: `.env`

```bash
# WhatsApp Configuration
WHATSAPP_API_KEY=your_api_key_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_API_URL=https://graph.facebook.com/v17.0
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
```

---

### Step 9: Create WhatsApp Management UI (Optional)

#### File: `app/(dashboard)/settings/whatsapp/page.tsx`

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare } from 'lucide-react'

async function getWhatsAppStats() {
  const [totalSent, templates, recentMessages] = await Promise.all([
    prisma.whatsAppMessage.count({
      where: { status: 'SENT' },
    }),
    prisma.whatsAppTemplate.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    }),
    prisma.whatsAppMessage.findMany({
      include: {
        customer: {
          select: { name: true },
        },
        order: {
          select: { orderNumber: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])

  return { totalSent, templates, recentMessages }
}

export default async function WhatsAppSettingsPage() {
  const session = await auth()
  if (!session?.user) redirect('/')

  const { totalSent, templates, recentMessages } = await getWhatsAppStats()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">WhatsApp Integration</h1>
              <p className="text-sm text-slate-600">Manage automated notifications</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid gap-6 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Total Sent</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalSent}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{templates.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold text-green-600">Connected ✓</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Templates */}
          <Card>
            <CardHeader>
              <CardTitle>Message Templates</CardTitle>
              <CardDescription>Active templates for notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="p-3 border border-slate-200 rounded-lg"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{template.name}</p>
                        <p className="text-sm text-slate-600">{template.category}</p>
                      </div>
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                        Active
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-2 line-clamp-2">
                      {template.content}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Messages */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Messages</CardTitle>
              <CardDescription>Last 10 sent messages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentMessages.map((message) => (
                  <div
                    key={message.id}
                    className="p-3 border border-slate-200 rounded-lg"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-sm">
                          {message.customer?.name || message.recipient}
                        </p>
                        <p className="text-xs text-slate-600">
                          {message.order?.orderNumber || message.messageType}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          message.status === 'SENT'
                            ? 'bg-green-100 text-green-700'
                            : message.status === 'FAILED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {message.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {new Date(message.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
```

---

### Step 10: Setup Cron Jobs (Optional)

#### File: `app/api/cron/payment-reminders/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { sendPaymentReminders } from '@/lib/whatsapp/triggers'

export async function GET(request: Request) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await sendPaymentReminders()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cron error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
```

Setup with Vercel Cron (add to `vercel.json`):

```json
{
  "crons": [
    {
      "path": "/api/cron/payment-reminders",
      "schedule": "0 9 * * *"
    }
  ]
}
```

---

### Testing Phase 12

```bash
# 1. Seed templates
pnpm tsx prisma/seed-whatsapp-templates.ts

# 2. Test sending message
curl -X POST http://localhost:3009/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+919876543210",
    "templateName": "order_confirmation",
    "variables": {
      "customer_name": "Test User",
      "order_number": "ORD-123"
    }
  }'

# 3. Manual testing:
- [ ] Create an order and verify WhatsApp sent
- [ ] Change order status to READY and verify notification
- [ ] Check WhatsApp message history in database
- [ ] View WhatsApp settings page
- [ ] Test templates page
```

---

# PHASE 13: REPORTS & ANALYTICS

## Objective
Build comprehensive reporting and analytics dashboard with charts, exports, and business insights.

## Duration
5-7 days

---

### Step 1: Install Dependencies

```bash
pnpm add recharts date-fns jspdf xlsx react-to-print
```

---

### Step 2: Create Reports API

#### File: `app/api/reports/inventory/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { startOfMonth, endOfMonth, subMonths } from 'date-fns'

export async function GET(request: Request) {
  const { error } = await requireAnyPermission(['view_reports', 'view_inventory'])
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const months = parseInt(searchParams.get('months') || '3')

    // Current inventory stats
    const clothInventory = await prisma.clothInventory.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        currentStock: true,
        reserved: true,
        minimum: true,
        pricePerMeter: true,
        totalPurchased: true,
      },
    })

    // Calculate totals
    const totalValue = clothInventory.reduce(
      (sum, item) => sum + item.currentStock * item.pricePerMeter,
      0
    )

    const totalMeters = clothInventory.reduce(
      (sum, item) => sum + item.currentStock,
      0
    )

    const lowStockItems = clothInventory.filter(
      (item) => item.currentStock - item.reserved < item.minimum
    )

    const criticalStockItems = clothInventory.filter(
      (item) => item.currentStock - item.reserved < item.minimum * 0.5
    )

    // Stock movements by month
    const stockMovementsByMonth = []
    for (let i = months - 1; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(new Date(), i))
      const monthEnd = endOfMonth(subMonths(new Date(), i))

      const movements = await prisma.stockMovement.findMany({
        where: {
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      })

      const purchases = movements.filter((m) => m.type === 'PURCHASE')
      const used = movements.filter((m) => m.type === 'ORDER_USED')

      stockMovementsByMonth.push({
        month: monthStart.toLocaleDateString('en-IN', {
          month: 'short',
          year: 'numeric',
        }),
        purchased: purchases.reduce((sum, m) => sum + m.quantity, 0),
        used: Math.abs(used.reduce((sum, m) => sum + m.quantity, 0)),
      })
    }

    // Inventory turnover
    const totalUsed = await prisma.stockMovement.aggregate({
      where: {
        type: 'ORDER_USED',
        createdAt: {
          gte: subMonths(new Date(), months),
        },
      },
      _sum: {
        quantity: true,
      },
    })

    const turnoverRate =
      totalMeters > 0 ? Math.abs(totalUsed._sum.quantity || 0) / totalMeters : 0

    return NextResponse.json({
      summary: {
        totalItems: clothInventory.length,
        totalValue,
        totalMeters,
        lowStockCount: lowStockItems.length,
        criticalStockCount: criticalStockItems.length,
        turnoverRate: turnoverRate.toFixed(2),
      },
      inventory: clothInventory.map((item) => ({
        ...item,
        available: item.currentStock - item.reserved,
        value: item.currentStock * item.pricePerMeter,
        status:
          item.currentStock - item.reserved < item.minimum * 0.5
            ? 'critical'
            : item.currentStock - item.reserved < item.minimum
            ? 'low'
            : 'healthy',
      })),
      lowStockItems: lowStockItems.map((item) => ({
        id: item.id,
        name: item.name,
        available: item.currentStock - item.reserved,
        minimum: item.minimum,
      })),
      stockMovementsByMonth,
    })
  } catch (error) {
    console.error('Error generating inventory report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
```

#### File: `app/api/reports/sales/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'

export async function GET(request: Request) {
  const { error } = await requireAnyPermission(['view_reports'])
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const months = parseInt(searchParams.get('months') || '6')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const dateFilter = startDate && endDate
      ? {
          createdAt: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }
      : {
          createdAt: {
            gte: subMonths(new Date(), months),
          },
        }

    // Revenue by month
    const revenueByMonth = []
    for (let i = months - 1; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(new Date(), i))
      const monthEnd = endOfMonth(subMonths(new Date(), i))

      const [revenue, orderCount] = await Promise.all([
        prisma.order.aggregate({
          where: {
            createdAt: { gte: monthStart, lte: monthEnd },
            status: 'DELIVERED',
          },
          _sum: { totalAmount: true },
        }),
        prisma.order.count({
          where: {
            createdAt: { gte: monthStart, lte: monthEnd },
          },
        }),
      ])

      revenueByMonth.push({
        month: format(monthStart, 'MMM yyyy'),
        revenue: revenue._sum.totalAmount || 0,
        orders: orderCount,
      })
    }

    // Top customers
    const topCustomers = await prisma.customer.findMany({
      include: {
        orders: {
          where: {
            status: 'DELIVERED',
            ...dateFilter,
          },
        },
      },
    })

    const customersWithRevenue = topCustomers
      .map((customer) => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        orderCount: customer.orders.length,
        totalRevenue: customer.orders.reduce((sum, o) => sum + o.totalAmount, 0),
      }))
      .filter((c) => c.orderCount > 0)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10)

    // Average order value
    const avgOrder = await prisma.order.aggregate({
      where: {
        status: 'DELIVERED',
        ...dateFilter,
      },
      _avg: { totalAmount: true },
      _count: true,
    })

    // Payment collection rate
    const payments = await prisma.order.aggregate({
      where: dateFilter,
      _sum: {
        totalAmount: true,
        advancePaid: true,
      },
    })

    const collectionRate =
      (payments._sum.totalAmount || 0) > 0
        ? ((payments._sum.advancePaid || 0) / (payments._sum.totalAmount || 1)) * 100
        : 0

    // Orders by status
    const ordersByStatus = await prisma.order.groupBy({
      by: ['status'],
      where: dateFilter,
      _count: { status: true },
    })

    return NextResponse.json({
      summary: {
        totalRevenue:
          revenueByMonth.reduce((sum, m) => sum + m.revenue, 0),
        totalOrders:
          revenueByMonth.reduce((sum, m) => sum + m.orders, 0),
        averageOrderValue: avgOrder._avg.totalAmount || 0,
        collectionRate: collectionRate.toFixed(1),
      },
      revenueByMonth,
      topCustomers: customersWithRevenue,
      ordersByStatus: ordersByStatus.map((s) => ({
        status: s.status,
        count: s._count.status,
      })),
    })
  } catch (error) {
    console.error('Error generating sales report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
```

#### File: `app/api/reports/materials/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { subMonths } from 'date-fns'

export async function GET(request: Request) {
  const { error } = await requireAnyPermission(['view_reports'])
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const months = parseInt(searchParams.get('months') || '3')

    // Material usage by fabric
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          createdAt: {
            gte: subMonths(new Date(), months),
          },
          status: 'DELIVERED',
        },
      },
      include: {
        clothInventory: {
          select: {
            id: true,
            name: true,
            type: true,
            pricePerMeter: true,
          },
        },
      },
    })

    // Group by fabric
    const fabricUsage = orderItems.reduce((acc, item) => {
      const fabricId = item.clothInventory.id
      if (!acc[fabricId]) {
        acc[fabricId] = {
          id: fabricId,
          name: item.clothInventory.name,
          type: item.clothInventory.type,
          totalMeters: 0,
          totalWastage: 0,
          totalCost: 0,
          orderCount: 0,
        }
      }

      acc[fabricId].totalMeters += item.actualMetersUsed || item.estimatedMeters
      acc[fabricId].totalWastage += item.wastage || 0
      acc[fabricId].totalCost +=
        (item.actualMetersUsed || item.estimatedMeters) *
        item.clothInventory.pricePerMeter
      acc[fabricId].orderCount += 1

      return acc
    }, {} as Record<string, any>)

    const fabricUsageArray = Object.values(fabricUsage).sort(
      (a: any, b: any) => b.totalMeters - a.totalMeters
    )

    // Calculate wastage percentage
    const totalUsed = fabricUsageArray.reduce(
      (sum: number, f: any) => sum + f.totalMeters,
      0
    )
    const totalWastage = fabricUsageArray.reduce(
      (sum: number, f: any) => sum + f.totalWastage,
      0
    )

    const wastagePercentage =
      totalUsed > 0 ? (totalWastage / totalUsed) * 100 : 0

    // Material efficiency (meters per order)
    const avgMetersPerOrder =
      orderItems.length > 0 ? totalUsed / orderItems.length : 0

    return NextResponse.json({
      summary: {
        totalMetersUsed: totalUsed.toFixed(2),
        totalWastage: totalWastage.toFixed(2),
        wastagePercentage: wastagePercentage.toFixed(2),
        avgMetersPerOrder: avgMetersPerOrder.toFixed(2),
        totalCost: fabricUsageArray.reduce(
          (sum: number, f: any) => sum + f.totalCost,
          0
        ),
      },
      fabricUsage: fabricUsageArray,
    })
  } catch (error) {
    console.error('Error generating materials report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
```

---

### Step 3: Create Reports Pages

#### File: `app/(dashboard)/reports/page.tsx`

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  BarChart3,
  Package,
  TrendingUp,
  Users,
  Scissors,
  FileText,
} from 'lucide-react'

export default async function ReportsPage() {
  const session = await auth()
  if (!session?.user) redirect('/')

  const reports = [
    {
      title: 'Inventory Report',
      description: 'Stock levels, value, and turnover analysis',
      icon: Package,
      href: '/reports/inventory',
      color: 'text-blue-600',
    },
    {
      title: 'Sales Report',
      description: 'Revenue trends, top customers, and order analysis',
      icon: TrendingUp,
      href: '/reports/sales',
      color: 'text-green-600',
    },
    {
      title: 'Material Usage',
      description: 'Fabric consumption, wastage, and efficiency',
      icon: Scissors,
      href: '/reports/materials',
      color: 'text-purple-600',
    },
    {
      title: 'Customer Report',
      description: 'Customer insights and lifetime value',
      icon: Users,
      href: '/reports/customers',
      color: 'text-orange-600',
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Reports & Analytics</h1>
              <p className="text-sm text-slate-600">
                Business insights and performance metrics
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {reports.map((report) => (
            <Link key={report.href} href={report.href}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{report.title}</CardTitle>
                      <CardDescription className="mt-2">
                        {report.description}
                      </CardDescription>
                    </div>
                    <report.icon className={`h-8 w-8 ${report.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full">
                    <FileText className="h-4 w-4 mr-2" />
                    View Report
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
```

#### File: `app/(dashboard)/reports/inventory/page.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, Printer } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from 'recharts'

export default function InventoryReportPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState(3)

  useEffect(() => {
    fetchReport()
  }, [timeRange])

  const fetchReport = async () => {
    setLoading(true)
    const response = await fetch(`/api/reports/inventory?months=${timeRange}`)
    const data = await response.json()
    setData(data)
    setLoading(false)
  }

  const handleExport = () => {
    // TODO: Implement Excel export
    console.log('Exporting...')
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading || !data) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 print:hidden">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Inventory Report</h1>
              <p className="text-sm text-slate-600">
                Last {timeRange} months • Generated on{' '}
                {new Date().toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(parseInt(e.target.value))}
                className="px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value={1}>1 Month</option>
                <option value={3}>3 Months</option>
                <option value={6}>6 Months</option>
                <option value={12}>12 Months</option>
              </select>
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 print:p-8">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data.summary.totalItems}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                ₹{data.summary.totalValue.toLocaleString('en-IN')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Stock</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {data.summary.totalMeters.toFixed(1)}m
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Turnover Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data.summary.turnoverRate}×</p>
            </CardContent>
          </Card>
        </div>

        {/* Stock Movements Chart */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Stock Movements</CardTitle>
            <CardDescription>
              Purchased vs Used fabric over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.stockMovementsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="purchased"
                    stroke="#10B981"
                    strokeWidth={2}
                    name="Purchased (m)"
                  />
                  <Line
                    type="monotone"
                    dataKey="used"
                    stroke="#EF4444"
                    strokeWidth={2}
                    name="Used (m)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Items */}
        {data.lowStockItems.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-error">Low Stock Alert</CardTitle>
              <CardDescription>
                {data.summary.lowStockCount} items need reordering
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.lowStockItems.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center p-3 border border-red-200 bg-red-50 rounded-lg"
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="text-sm text-error">
                      {item.available}m / {item.minimum}m minimum
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Full Inventory Table */}
        <Card>
          <CardHeader>
            <CardTitle>Complete Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Item</th>
                    <th className="text-left p-2">Type</th>
                    <th className="text-right p-2">Current</th>
                    <th className="text-right p-2">Reserved</th>
                    <th className="text-right p-2">Available</th>
                    <th className="text-right p-2">Minimum</th>
                    <th className="text-right p-2">Value</th>
                    <th className="text-center p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.inventory.map((item: any) => (
                    <tr key={item.id} className="border-b">
                      <td className="p-2">{item.name}</td>
                      <td className="p-2">{item.type}</td>
                      <td className="text-right p-2">{item.currentStock}m</td>
                      <td className="text-right p-2">{item.reserved}m</td>
                      <td className="text-right p-2">{item.available}m</td>
                      <td className="text-right p-2">{item.minimum}m</td>
                      <td className="text-right p-2">
                        ₹{item.value.toLocaleString('en-IN')}
                      </td>
                      <td className="text-center p-2">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            item.status === 'healthy'
                              ? 'bg-green-100 text-green-700'
                              : item.status === 'low'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
```

---

I'll continue with **Phase 14: Payment Integration** and **Phase 15: Barcode/QR System** in the next response to keep this manageable. Would you like me to continue now?