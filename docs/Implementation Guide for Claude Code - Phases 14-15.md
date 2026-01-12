# PHASE 14: PAYMENT INTEGRATION & TRACKING

## Objective
Implement comprehensive payment recording, Razorpay integration, receipt generation, and payment tracking dashboard.

## Duration
5-7 days

---

### Step 1: Database Schema Updates

#### Update: `prisma/schema.prisma`

Add Payment model:

```prisma
model Payment {
  id                  String    @id @default(cuid())
  orderId             String
  customerId          String
  amount              Float
  paymentMethod       String    // CASH, UPI, CARD, BANK_TRANSFER, RAZORPAY
  paymentStatus       String    @default("PENDING") // PENDING, COMPLETED, FAILED, REFUNDED
  
  // Razorpay fields
  razorpayOrderId     String?
  razorpayPaymentId   String?
  razorpaySignature   String?
  
  // Payment details
  transactionId       String?
  receiptNumber       String    @unique
  notes               String?
  metadata            Json?
  
  // Timestamps
  paidAt              DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  // Relations
  order               Order     @relation(fields: [orderId], references: [id])
  customer            Customer  @relation(fields: [customerId], references: [id])

  @@index([orderId])
  @@index([customerId])
  @@index([paymentStatus])
  @@index([createdAt])
}

// Update Order model
model Order {
  // ... existing fields ...
  payments            Payment[]
}

// Update Customer model
model Customer {
  // ... existing fields ...
  payments            Payment[]
}
```

Run migration:
```bash
pnpm db:push
```

---

### Step 2: Install Dependencies

```bash
pnpm add razorpay @types/razorpay jspdf qrcode
```

---

### Step 3: Create Payment Service

#### File: `lib/payments/payment-service.ts`

```typescript
import { prisma } from '@/lib/db'
import Razorpay from 'razorpay'

export interface PaymentCreateData {
  orderId: string
  customerId: string
  amount: number
  paymentMethod: 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'RAZORPAY'
  notes?: string
  transactionId?: string
}

export interface RazorpayOrderData {
  orderId: string
  amount: number
  customerName: string
  customerEmail?: string
  customerPhone: string
}

export class PaymentService {
  private razorpay: Razorpay | null = null

  constructor() {
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      this.razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      })
    }
  }

  /**
   * Generate unique receipt number
   */
  private async generateReceiptNumber(): Promise<string> {
    const date = new Date()
    const year = date.getFullYear().toString().slice(-2)
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    
    // Get count of payments this month
    const count = await prisma.payment.count({
      where: {
        createdAt: {
          gte: new Date(date.getFullYear(), date.getMonth(), 1),
        },
      },
    })

    const sequence = (count + 1).toString().padStart(4, '0')
    return `RCP-${year}${month}-${sequence}`
  }

  /**
   * Record a payment
   */
  async recordPayment(data: PaymentCreateData): Promise<any> {
    const receiptNumber = await this.generateReceiptNumber()

    // Create payment record
    const payment = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          orderId: data.orderId,
          customerId: data.customerId,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          paymentStatus: 'COMPLETED',
          receiptNumber,
          transactionId: data.transactionId,
          notes: data.notes,
          paidAt: new Date(),
        },
        include: {
          order: {
            include: {
              customer: true,
            },
          },
        },
      })

      // Update order balance
      await tx.order.update({
        where: { id: data.orderId },
        data: {
          advancePaid: {
            increment: data.amount,
          },
          balanceAmount: {
            decrement: data.amount,
          },
        },
      })

      return payment
    })

    return payment
  }

  /**
   * Create Razorpay order
   */
  async createRazorpayOrder(data: RazorpayOrderData): Promise<any> {
    if (!this.razorpay) {
      throw new Error('Razorpay not configured')
    }

    try {
      const order = await prisma.order.findUnique({
        where: { id: data.orderId },
        include: { customer: true },
      })

      if (!order) {
        throw new Error('Order not found')
      }

      // Create Razorpay order
      const razorpayOrder = await this.razorpay.orders.create({
        amount: Math.round(data.amount * 100), // Convert to paise
        currency: 'INR',
        receipt: `order_${order.orderNumber}`,
        notes: {
          orderId: data.orderId,
          customerName: data.customerName,
          orderNumber: order.orderNumber,
        },
      })

      // Create pending payment record
      const receiptNumber = await this.generateReceiptNumber()
      const payment = await prisma.payment.create({
        data: {
          orderId: data.orderId,
          customerId: data.customerId,
          amount: data.amount,
          paymentMethod: 'RAZORPAY',
          paymentStatus: 'PENDING',
          receiptNumber,
          razorpayOrderId: razorpayOrder.id,
        },
      })

      return {
        razorpayOrder,
        payment,
      }
    } catch (error) {
      console.error('Razorpay order creation error:', error)
      throw error
    }
  }

  /**
   * Verify Razorpay payment signature
   */
  verifyRazorpaySignature(
    orderId: string,
    paymentId: string,
    signature: string
  ): boolean {
    if (!this.razorpay) return false

    const crypto = require('crypto')
    const text = `${orderId}|${paymentId}`
    const generated = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(text)
      .digest('hex')

    return generated === signature
  }

  /**
   * Complete Razorpay payment
   */
  async completeRazorpayPayment(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ): Promise<any> {
    // Verify signature
    const isValid = this.verifyRazorpaySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    )

    if (!isValid) {
      throw new Error('Invalid payment signature')
    }

    // Update payment record
    const payment = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { razorpayOrderId },
      })

      if (!payment) {
        throw new Error('Payment not found')
      }

      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          paymentStatus: 'COMPLETED',
          razorpayPaymentId,
          razorpaySignature,
          paidAt: new Date(),
        },
        include: {
          order: true,
          customer: true,
        },
      })

      // Update order balance
      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          advancePaid: {
            increment: payment.amount,
          },
          balanceAmount: {
            decrement: payment.amount,
          },
        },
      })

      return updated
    })

    return payment
  }

  /**
   * Get payment history for order
   */
  async getOrderPayments(orderId: string): Promise<any[]> {
    return await prisma.payment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Get payment history for customer
   */
  async getCustomerPayments(customerId: string): Promise<any[]> {
    return await prisma.payment.findMany({
      where: { customerId },
      include: {
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Get outstanding payments
   */
  async getOutstandingPayments(): Promise<any[]> {
    const orders = await prisma.order.findMany({
      where: {
        balanceAmount: { gt: 0 },
        status: { notIn: ['CANCELLED', 'DELIVERED'] },
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { deliveryDate: 'asc' },
    })

    return orders.map((order) => ({
      orderId: order.id,
      orderNumber: order.orderNumber,
      customer: order.customer,
      totalAmount: order.totalAmount,
      paidAmount: order.advancePaid,
      balanceAmount: order.balanceAmount,
      deliveryDate: order.deliveryDate,
      lastPayment: order.payments[0] || null,
    }))
  }
}

// Export singleton
export const paymentService = new PaymentService()
```

---

### Step 4: Create Receipt Generator

#### File: `lib/payments/receipt-generator.ts`

```typescript
import jsPDF from 'jspdf'
import QRCode from 'qrcode'

export interface ReceiptData {
  receiptNumber: string
  orderNumber: string
  customerName: string
  customerPhone: string
  amount: number
  paymentMethod: string
  paidAt: Date
  orderTotal: number
  previousPaid: number
  balanceRemaining: number
}

export async function generateReceipt(data: ReceiptData): Promise<string> {
  const doc = new jsPDF()
  
  // Shop Logo/Header
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('Hamees Attire', 105, 20, { align: 'center' })
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Bespoke Tailoring & Wedding Attire', 105, 28, { align: 'center' })
  doc.text('Amritsar, Punjab', 105, 34, { align: 'center' })
  doc.text('Phone: +91-8400008096', 105, 40, { align: 'center' })
  
  // Line separator
  doc.line(20, 45, 190, 45)
  
  // Receipt title
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('PAYMENT RECEIPT', 105, 55, { align: 'center' })
  
  // Receipt details
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  
  let y = 70
  
  doc.text(`Receipt No:`, 20, y)
  doc.setFont('helvetica', 'bold')
  doc.text(data.receiptNumber, 70, y)
  
  y += 8
  doc.setFont('helvetica', 'normal')
  doc.text(`Date:`, 20, y)
  doc.setFont('helvetica', 'bold')
  doc.text(data.paidAt.toLocaleDateString('en-IN'), 70, y)
  
  y += 8
  doc.setFont('helvetica', 'normal')
  doc.text(`Order No:`, 20, y)
  doc.setFont('helvetica', 'bold')
  doc.text(data.orderNumber, 70, y)
  
  y += 12
  doc.line(20, y, 190, y)
  
  // Customer details
  y += 10
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Customer Details', 20, y)
  
  y += 8
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Name:`, 20, y)
  doc.text(data.customerName, 70, y)
  
  y += 8
  doc.text(`Phone:`, 20, y)
  doc.text(data.customerPhone, 70, y)
  
  y += 12
  doc.line(20, y, 190, y)
  
  // Payment details
  y += 10
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Payment Details', 20, y)
  
  y += 10
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  
  // Table header
  doc.setFillColor(240, 240, 240)
  doc.rect(20, y - 5, 170, 8, 'F')
  doc.text('Description', 25, y)
  doc.text('Amount', 165, y, { align: 'right' })
  
  y += 10
  
  // Order total
  doc.text('Order Total:', 25, y)
  doc.text(`₹${data.orderTotal.toLocaleString('en-IN')}`, 165, y, { align: 'right' })
  
  y += 8
  doc.text('Previously Paid:', 25, y)
  doc.text(`₹${data.previousPaid.toLocaleString('en-IN')}`, 165, y, { align: 'right' })
  
  y += 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Amount Paid Now:', 25, y)
  doc.text(`₹${data.amount.toLocaleString('en-IN')}`, 165, y, { align: 'right' })
  
  y += 10
  doc.line(20, y, 190, y)
  
  y += 8
  doc.setFontSize(12)
  doc.text('Balance Remaining:', 25, y)
  doc.text(`₹${data.balanceRemaining.toLocaleString('en-IN')}`, 165, y, { align: 'right' })
  
  y += 8
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Payment Method: ${data.paymentMethod}`, 25, y)
  
  y += 15
  doc.line(20, y, 190, y)
  
  // Generate QR code
  try {
    const qrData = `Receipt: ${data.receiptNumber}\nOrder: ${data.orderNumber}\nAmount: ₹${data.amount}`
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      width: 100,
      margin: 1,
    })
    
    doc.addImage(qrCodeDataUrl, 'PNG', 150, y + 5, 30, 30)
  } catch (error) {
    console.error('QR code generation error:', error)
  }
  
  // Footer
  y += 40
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.text('Thank you for your business!', 105, y, { align: 'center' })
  doc.text('This is a computer-generated receipt.', 105, y + 5, { align: 'center' })
  
  // Return as base64
  return doc.output('dataurlstring')
}
```

---

### Step 5: Create Payment API Routes

#### File: `app/api/payments/record/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-permissions'
import { paymentService } from '@/lib/payments/payment-service'
import { z } from 'zod'

const paymentSchema = z.object({
  orderId: z.string().min(1),
  customerId: z.string().min(1),
  amount: z.number().positive(),
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'RAZORPAY']),
  transactionId: z.string().optional(),
  notes: z.string().optional(),
})

export async function POST(request: Request) {
  const { error } = await requireAnyPermission(['create_order', 'manage_customers'])
  if (error) return error

  try {
    const body = await request.json()
    const data = paymentSchema.parse(body)

    const payment = await paymentService.recordPayment(data)

    return NextResponse.json({ payment }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error recording payment:', error)
    return NextResponse.json(
      { error: 'Failed to record payment' },
      { status: 500 }
    )
  }
}
```

#### File: `app/api/payments/razorpay/create-order/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-permissions'
import { paymentService } from '@/lib/payments/payment-service'
import { z } from 'zod'

const razorpayOrderSchema = z.object({
  orderId: z.string().min(1),
  amount: z.number().positive(),
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().min(10),
})

export async function POST(request: Request) {
  const { error } = await requireAnyPermission(['create_order'])
  if (error) return error

  try {
    const body = await request.json()
    const data = razorpayOrderSchema.parse(body)

    const { razorpayOrder, payment } = await paymentService.createRazorpayOrder({
      orderId: data.orderId,
      amount: data.amount,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
    })

    return NextResponse.json({
      razorpayOrder,
      payment,
      key: process.env.RAZORPAY_KEY_ID,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating Razorpay order:', error)
    return NextResponse.json(
      { error: 'Failed to create Razorpay order' },
      { status: 500 }
    )
  }
}
```

#### File: `app/api/payments/razorpay/verify/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { paymentService } from '@/lib/payments/payment-service'
import { z } from 'zod'

const verifySchema = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const data = verifySchema.parse(body)

    const payment = await paymentService.completeRazorpayPayment(
      data.razorpay_order_id,
      data.razorpay_payment_id,
      data.razorpay_signature
    )

    return NextResponse.json({ success: true, payment })
  } catch (error) {
    console.error('Payment verification error:', error)
    return NextResponse.json(
      { error: 'Payment verification failed' },
      { status: 400 }
    )
  }
}
```

#### File: `app/api/payments/receipt/[id]/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { generateReceipt } from '@/lib/payments/receipt-generator'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAnyPermission(['view_orders'])
  if (error) return error

  try {
    const { id } = await params
    
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        order: true,
        customer: true,
      },
    })

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Calculate previous payments
    const previousPayments = await prisma.payment.findMany({
      where: {
        orderId: payment.orderId,
        createdAt: { lt: payment.createdAt },
      },
    })

    const previousPaid = previousPayments.reduce((sum, p) => sum + p.amount, 0)

    const receiptData = {
      receiptNumber: payment.receiptNumber,
      orderNumber: payment.order.orderNumber,
      customerName: payment.customer.name,
      customerPhone: payment.customer.phone,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      paidAt: payment.paidAt || payment.createdAt,
      orderTotal: payment.order.totalAmount,
      previousPaid,
      balanceRemaining: payment.order.balanceAmount,
    }

    const pdfBase64 = await generateReceipt(receiptData)

    return NextResponse.json({ receipt: pdfBase64 })
  } catch (error) {
    console.error('Error generating receipt:', error)
    return NextResponse.json(
      { error: 'Failed to generate receipt' },
      { status: 500 }
    )
  }
}
```

#### File: `app/api/payments/outstanding/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-permissions'
import { paymentService } from '@/lib/payments/payment-service'

export async function GET() {
  const { error } = await requireAnyPermission(['view_orders'])
  if (error) return error

  try {
    const outstandingPayments = await paymentService.getOutstandingPayments()
    return NextResponse.json({ payments: outstandingPayments })
  } catch (error) {
    console.error('Error fetching outstanding payments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch outstanding payments' },
      { status: 500 }
    )
  }
}
```

---

### Step 6: Create Payment UI Components

#### File: `components/payments/payment-form.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Banknote, CreditCard, Smartphone } from 'lucide-react'

interface PaymentFormProps {
  orderId: string
  customerId: string
  balanceAmount: number
  onSuccess?: () => void
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash', icon: Banknote },
  { value: 'UPI', label: 'UPI', icon: Smartphone },
  { value: 'CARD', label: 'Card', icon: CreditCard },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer', icon: Banknote },
]

export function PaymentForm({
  orderId,
  customerId,
  balanceAmount,
  onSuccess,
}: PaymentFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [amount, setAmount] = useState(balanceAmount.toString())
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [transactionId, setTransactionId] = useState('')
  const [notes, setNotes] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/payments/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          customerId,
          amount: parseFloat(amount),
          paymentMethod,
          transactionId: transactionId || undefined,
          notes: notes || undefined,
        }),
      })

      if (!response.ok) throw new Error('Failed to record payment')

      const data = await response.json()
      
      // Show receipt
      alert('Payment recorded successfully!')
      router.refresh()
      onSuccess?.()
    } catch (error) {
      console.error('Error recording payment:', error)
      alert('Failed to record payment')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Record Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <div className="grid grid-cols-2 gap-3">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => setPaymentMethod(method.value)}
                  className={`p-4 border-2 rounded-lg flex items-center gap-3 transition-colors ${
                    paymentMethod === method.value
                      ? 'border-primary bg-primary/5'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <method.icon className="h-5 w-5" />
                  <span className="font-medium">{method.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount *</Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-500">₹</span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-8"
                required
              />
            </div>
            <p className="text-sm text-slate-600">
              Balance: ₹{balanceAmount.toLocaleString('en-IN')}
            </p>
          </div>

          {paymentMethod !== 'CASH' && (
            <div className="space-y-2">
              <Label htmlFor="transactionId">Transaction ID</Label>
              <Input
                id="transactionId"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="Enter transaction reference"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              className="w-full min-h-[60px] px-3 py-2 border border-slate-200 rounded-md"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? 'Recording...' : 'Record Payment'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
```

#### File: `components/payments/payment-history.tsx`

```typescript
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

interface PaymentHistoryProps {
  payments: any[]
}

export function PaymentHistory({ payments }: PaymentHistoryProps) {
  const handleDownloadReceipt = async (paymentId: string) => {
    try {
      const response = await fetch(`/api/payments/receipt/${paymentId}`)
      const data = await response.json()
      
      // Open PDF in new tab
      const pdfWindow = window.open('')
      if (pdfWindow) {
        pdfWindow.document.write(
          `<iframe width='100%' height='100%' src='${data.receipt}'></iframe>`
        )
      }
    } catch (error) {
      console.error('Error downloading receipt:', error)
    }
  }

  if (payments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-slate-600">No payments recorded yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {payments.map((payment) => (
            <div
              key={payment.id}
              className="flex items-center justify-between p-4 border border-slate-200 rounded-lg"
            >
              <div>
                <p className="font-semibold">₹{payment.amount.toLocaleString('en-IN')}</p>
                <p className="text-sm text-slate-600">
                  {payment.paymentMethod} • {payment.receiptNumber}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(payment.paidAt || payment.createdAt).toLocaleString()}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownloadReceipt(payment.id)}
              >
                <Download className="h-4 w-4 mr-2" />
                Receipt
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

---

### Step 7: Create Payment Dashboard Page

#### File: `app/(dashboard)/payments/page.tsx`

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Banknote, TrendingUp, AlertCircle } from 'lucide-react'
import Link from 'next/link'

async function getPaymentStats() {
  const [todayPayments, totalOutstanding, recentPayments] = await Promise.all([
    prisma.payment.aggregate({
      where: {
        paidAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.order.aggregate({
      where: {
        balanceAmount: { gt: 0 },
        status: { notIn: ['CANCELLED'] },
      },
      _sum: { balanceAmount: true },
    }),
    prisma.payment.findMany({
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

  return {
    todayCollections: todayPayments._sum.amount || 0,
    todayCount: todayPayments._count,
    totalOutstanding: totalOutstanding._sum.balanceAmount || 0,
    recentPayments,
  }
}

export default async function PaymentsPage() {
  const session = await auth()
  if (!session?.user) redirect('/')

  const stats = await getPaymentStats()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Banknote className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Payments</h1>
              <p className="text-sm text-slate-600">Payment tracking and collection</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid gap-6 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Today's Collections</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                ₹{stats.todayCollections.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-slate-600">{stats.todayCount} payments</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                ₹{stats.totalOutstanding.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-slate-600">Pending collections</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/payments/outstanding">
                <Button variant="outline" className="w-full justify-start">
                  View Outstanding
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 border border-slate-200 rounded-lg"
                >
                  <div>
                    <p className="font-semibold">{payment.customer.name}</p>
                    <p className="text-sm text-slate-600">
                      {payment.order.orderNumber} • {payment.receiptNumber}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(payment.paidAt || payment.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">
                      +₹{payment.amount.toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-slate-600">{payment.paymentMethod}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
```

---

### Step 8: Environment Variables

#### Update: `.env`

```bash
# Razorpay Configuration
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

---

### Testing Phase 14

```bash
# 1. Run migration
pnpm db:push

# 2. Test recording payment
curl -X POST http://localhost:3009/api/payments/record \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order_id_here",
    "customerId": "customer_id_here",
    "amount": 1000,
    "paymentMethod": "CASH"
  }'

# 3. Manual testing:
- [ ] Navigate to an order detail page
- [ ] Record a payment
- [ ] Download receipt
- [ ] View payment history
- [ ] Check payments dashboard
- [ ] Test Razorpay integration (if configured)
```

---

# PHASE 15: BARCODE/QR CODE SYSTEM

## Objective
Implement comprehensive barcode and QR code generation, scanning, and label printing for inventory management.

## Duration
5-7 days

---

### Step 1: Install Dependencies

```bash
pnpm add qrcode @zxing/library react-qr-code qr-code-styling
```

---

### Step 2: Create QR/Barcode Service

#### File: `lib/barcode/barcode-service.ts`

```typescript
import QRCode from 'qrcode'
import { prisma } from '@/lib/db'

export interface BarcodeData {
  sku: string
  name: string
  type: 'cloth' | 'accessory'
  currentStock?: number
  pricePerMeter?: number
  pricePerUnit?: number
}

export class BarcodeService {
  /**
   * Generate QR code as data URL
   */
  async generateQRCode(data: string, size = 200): Promise<string> {
    try {
      return await QRCode.toDataURL(data, {
        width: size,
        margin: 1,
        errorCorrectionLevel: 'M',
      })
    } catch (error) {
      console.error('QR code generation error:', error)
      throw error
    }
  }

  /**
   * Generate QR code for inventory item
   */
  async generateInventoryQR(itemId: string, type: 'cloth' | 'accessory'): Promise<string> {
    const item = type === 'cloth'
      ? await prisma.clothInventory.findUnique({ where: { id: itemId } })
      : await prisma.accessoryInventory.findUnique({ where: { id: itemId } })

    if (!item) {
      throw new Error('Item not found')
    }

    const data = {
      type,
      sku: type === 'cloth' ? item.sku : `ACC-${item.id}`,
      name: item.name,
      id: itemId,
    }

    return await this.generateQRCode(JSON.stringify(data))
  }

  /**
   * Generate batch QR codes for multiple items
   */
  async generateBatchQRCodes(
    items: Array<{ id: string; type: 'cloth' | 'accessory' }>
  ): Promise<Array<{ id: string; qrCode: string }>> {
    const results = []

    for (const item of items) {
      try {
        const qrCode = await this.generateInventoryQR(item.id, item.type)
        results.push({ id: item.id, qrCode })
      } catch (error) {
        console.error(`Error generating QR for ${item.id}:`, error)
      }
    }

    return results
  }

  /**
   * Generate printable label with QR code
   */
  async generateLabel(itemId: string, type: 'cloth' | 'accessory'): Promise<string> {
    const item = type === 'cloth'
      ? await prisma.clothInventory.findUnique({ where: { id: itemId } })
      : await prisma.accessoryInventory.findUnique({ where: { id: itemId } })

    if (!item) {
      throw new Error('Item not found')
    }

    const qrCode = await this.generateInventoryQR(itemId, type)

    // Generate HTML for label
    const sku = type === 'cloth' ? item.sku : `ACC-${item.id}`
    const price = type === 'cloth' 
      ? `₹${item.pricePerMeter}/m`
      : `₹${item.pricePerUnit}/unit`

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              margin: 0;
              padding: 10px;
              font-family: Arial, sans-serif;
            }
            .label {
              width: 80mm;
              height: 40mm;
              border: 2px solid #000;
              padding: 8px;
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .qr {
              flex-shrink: 0;
            }
            .info {
              flex: 1;
            }
            .sku {
              font-size: 12px;
              font-weight: bold;
              margin-bottom: 4px;
            }
            .name {
              font-size: 14px;
              font-weight: bold;
              margin-bottom: 4px;
            }
            .details {
              font-size: 11px;
              color: #666;
            }
            .price {
              font-size: 16px;
              font-weight: bold;
              color: #000;
              margin-top: 4px;
            }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="qr">
              <img src="${qrCode}" width="80" height="80" />
            </div>
            <div class="info">
              <div class="sku">${sku}</div>
              <div class="name">${item.name}</div>
              ${type === 'cloth' ? `
                <div class="details">${item.type} • ${item.color}</div>
                <div class="details">Stock: ${item.currentStock}m</div>
              ` : `
                <div class="details">${item.type}</div>
                <div class="details">Stock: ${item.currentStock}</div>
              `}
              <div class="price">${price}</div>
            </div>
          </div>
        </body>
      </html>
    `

    return html
  }
}

// Export singleton
export const barcodeService = new BarcodeService()
```

---

### Step 3: Create Barcode API Routes

#### File: `app/api/barcode/generate/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-permissions'
import { barcodeService } from '@/lib/barcode/barcode-service'
import { z } from 'zod'

const generateSchema = z.object({
  itemId: z.string().min(1),
  type: z.enum(['cloth', 'accessory']),
})

export async function POST(request: Request) {
  const { error } = await requireAnyPermission(['view_inventory'])
  if (error) return error

  try {
    const body = await request.json()
    const { itemId, type } = generateSchema.parse(body)

    const qrCode = await barcodeService.generateInventoryQR(itemId, type)

    return NextResponse.json({ qrCode })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error generating QR code:', error)
    return NextResponse.json(
      { error: 'Failed to generate QR code' },
      { status: 500 }
    )
  }
}
```

#### File: `app/api/barcode/label/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-permissions'
import { barcodeService } from '@/lib/barcode/barcode-service'
import { z } from 'zod'

const labelSchema = z.object({
  itemId: z.string().min(1),
  type: z.enum(['cloth', 'accessory']),
})

export async function POST(request: Request) {
  const { error } = await requireAnyPermission(['view_inventory'])
  if (error) return error

  try {
    const body = await request.json()
    const { itemId, type } = labelSchema.parse(body)

    const label = await barcodeService.generateLabel(itemId, type)

    return NextResponse.json({ label })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error generating label:', error)
    return NextResponse.json(
      { error: 'Failed to generate label' },
      { status: 500 }
    )
  }
}
```

#### File: `app/api/barcode/batch/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-permissions'
import { barcodeService } from '@/lib/barcode/barcode-service'
import { z } from 'zod'

const batchSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      type: z.enum(['cloth', 'accessory']),
    })
  ),
})

export async function POST(request: Request) {
  const { error } = await requireAnyPermission(['view_inventory'])
  if (error) return error

  try {
    const body = await request.json()
    const { items } = batchSchema.parse(body)

    const qrCodes = await barcodeService.generateBatchQRCodes(items)

    return NextResponse.json({ qrCodes })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error generating batch QR codes:', error)
    return NextResponse.json(
      { error: 'Failed to generate QR codes' },
      { status: 500 }
    )
  }
}
```

---

### Step 4: Create Label Printing Page

#### File: `app/(dashboard)/inventory/labels/page.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Printer, QrCode } from 'lucide-react'

export default function LabelsPage() {
  const [items, setItems] = useState<any[]>([])
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchInventory()
  }, [])

  const fetchInventory = async () => {
    try {
      const response = await fetch('/api/inventory/cloth')
      const data = await response.json()
      setItems(data)
    } catch (error) {
      console.error('Error fetching inventory:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleItem = (id: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedItems(newSelected)
  }

  const handlePrintLabels = async () => {
    if (selectedItems.size === 0) {
      alert('Please select items to print')
      return
    }

    const itemsArray = Array.from(selectedItems).map((id) => ({
      id,
      type: 'cloth' as const,
    }))

    try {
      const response = await fetch('/api/barcode/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsArray }),
      })

      const data = await response.json()

      // Generate labels HTML
      const labelsHTML = await Promise.all(
        data.qrCodes.map(async ({ id, qrCode }: any) => {
          const item = items.find((i) => i.id === id)
          return `
            <div class="label" style="page-break-after: always;">
              <div style="border: 2px solid #000; padding: 10px; width: 80mm; height: 40mm; display: flex; gap: 10px;">
                <img src="${qrCode}" width="80" height="80" />
                <div>
                  <div style="font-weight: bold;">${item.sku}</div>
                  <div style="font-size: 14px; font-weight: bold;">${item.name}</div>
                  <div style="font-size: 11px; color: #666;">${item.type} • ${item.color}</div>
                  <div style="font-size: 16px; font-weight: bold; margin-top: 4px;">₹${item.pricePerMeter}/m</div>
                </div>
              </div>
            </div>
          `
        })
      )

      // Open print window
      const printWindow = window.open('', '', 'width=800,height=600')
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Print Labels</title>
              <style>
                @media print {
                  @page { margin: 0; }
                  body { margin: 0; }
                  .label { page-break-after: always; }
                }
              </style>
            </head>
            <body>
              ${labelsHTML.join('')}
              <script>window.print(); window.close();</script>
            </body>
          </html>
        `)
        printWindow.document.close()
      }
    } catch (error) {
      console.error('Error printing labels:', error)
      alert('Failed to generate labels')
    }
  }

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <QrCode className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Print Labels</h1>
                <p className="text-sm text-slate-600">
                  {selectedItems.size} items selected
                </p>
              </div>
            </div>
            <Button
              onClick={handlePrintLabels}
              disabled={selectedItems.size === 0}
            >
              <Printer className="h-4 w-4 mr-2" />
              Print Labels
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Select Items to Print</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                  onClick={() => toggleItem(item.id)}
                >
                  <Checkbox
                    checked={selectedItems.has(item.id)}
                    onCheckedChange={() => toggleItem(item.id)}
                  />
                  <div className="flex-1">
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-slate-600">
                      {item.sku} • {item.type} • {item.color}
                    </p>
                  </div>
                  <p className="text-sm font-medium">
                    ₹{item.pricePerMeter}/m
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
```

---

### Step 5: Update Inventory Page with QR Code Display

#### Update: `app/(dashboard)/inventory/page.tsx`

Add QR code button to each inventory item:

```typescript
// Add this inside the inventory item card
<Button
  variant="ghost"
  size="sm"
  onClick={() => handleGenerateQR(item.id)}
>
  <QrCode className="h-4 w-4" />
</Button>
```

Add handler function:

```typescript
const handleGenerateQR = async (itemId: string) => {
  const response = await fetch('/api/barcode/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId, type: 'cloth' }),
  })
  
  const data = await response.json()
  
  // Show QR code in modal or download
  const qrWindow = window.open('', '', 'width=400,height=400')
  if (qrWindow) {
    qrWindow.document.write(`
      <html>
        <body style="display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
          <img src="${data.qrCode}" style="max-width: 300px;" />
        </body>
      </html>
    `)
  }
}
```

---

### Step 6: Create Missing UI Component

#### File: `components/ui/checkbox.tsx`

```typescript
import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const Checkbox = React.forwardRef
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn('flex items-center justify-center text-current')}
    >
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
```

Install required dependency:
```bash
pnpm add @radix-ui/react-checkbox
```

---

### Step 7: Update CLAUDE.md

Add documentation for all completed phases:

```markdown
### ✅ WhatsApp Integration (Phase 12 - v0.6.0)
- Automated order confirmations, ready notifications, payment reminders
- Template management system
- Message history tracking
- Low stock alerts to owner

### ✅ Reports & Analytics (Phase 13 - v0.7.0)
- Inventory reports (stock levels, turnover, value)
- Sales reports (revenue trends, top customers)
- Material usage reports (consumption, wastage)
- Export to Excel/PDF

### ✅ Payment Integration (Phase 14 - v0.8.0)
- Payment recording (Cash, UPI, Card, Bank Transfer)
- Razorpay integration
- Digital receipt generation with QR codes
- Payment history and tracking
- Outstanding payments dashboard

### ✅ Barcode/QR System (Phase 15 - v0.9.0)
- QR code generation for inventory items
- Label printing system
- Batch label generation
- Mobile-optimized scanning
```

---

### Testing All Phases

```bash
# Phase 12 - WhatsApp
pnpm tsx prisma/seed-whatsapp-templates.ts

# Phase 14 - Payments
# Test payment recording via UI

# Phase 15 - QR Codes
# Generate and print labels

# Run all tests
pnpm db:studio  # Verify data
```

---

## 🎉 COMPLETE IMPLEMENTATION SUMMARY

You now have **complete implementation guides** for:

✅ **Phase 11:** Measurements System  
✅ **Phase 12:** WhatsApp Integration  
✅ **Phase 13:** Reports & Analytics  
✅ **Phase 14:** Payment Integration  
✅ **Phase 15:** Barcode/QR System  

Each phase includes:
- Database schemas
- API routes
- Services & utilities
- UI components
- Testing procedures
- Documentation

**Total Development Time:** 27-36 days (5-7 weeks)

Start implementing **Phase 11** and let me know if you need clarification on any specific part! 🚀