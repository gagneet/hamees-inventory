# Tailor Inventory System - Extended Features Guide
## Additional Features & Implementation Details

---

## PHASE 9: ADVANCED FEATURES (EXPANDED)

### Feature 1: Customer Measurements System

#### Implementation Details

**Database Schema Addition:**

```prisma
model Measurement {
  id              String    @id @default(cuid())
  customerId      String
  customer        Customer  @relation(fields: [customerId], references: [id])
  garmentType     String    // Shirt, Trouser, Suit, Sherwani
  measurements    Json      // Flexible JSON storage
  bodyType        BodyType  @default(REGULAR)
  notes           String?
  takenBy         String?   // Staff member who took measurements
  takenDate       DateTime  @default(now())
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([customerId, garmentType])
}

// Measurement Templates for different garment types
model MeasurementTemplate {
  id              String    @id @default(cuid())
  garmentType     String    @unique
  fields          Json      // Field definitions with validation rules
  displayOrder    Json      // Order of fields in UI
  validationRules Json      // Min/max values, required fields
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

**Measurement JSON Structure:**

```json
{
  "shirt": {
    "neck": 15.5,
    "chest": 40,
    "waist": 36,
    "hip": 38,
    "shoulder": 17,
    "sleeveLength": 24,
    "shirtLength": 30,
    "bicep": 14,
    "wrist": 8,
    "unit": "inches",
    "notes": "Customer prefers loose fit"
  },
  "trouser": {
    "waist": 34,
    "hip": 38,
    "thigh": 24,
    "knee": 16,
    "ankle": 9,
    "inseam": 32,
    "outseam": 42,
    "rise": 11,
    "bottomOpening": 8,
    "unit": "inches"
  },
  "suit": {
    // Combination of shirt + trouser + jacket specific
    "jacketLength": 28,
    "lapelWidth": 3.5,
    "ventType": "double",
    "buttonCount": 2
  },
  "sherwani": {
    "length": 42,
    "chest": 42,
    "waist": 38,
    "shoulder": 18,
    "sleeveLength": 26,
    "neck": 16,
    "armhole": 20,
    "colllarType": "mandarin"
  }
}
```

**API Endpoints:**

```typescript
// app/api/measurements/route.ts
export async function GET(req: Request) {
  // Get all measurements for a customer
  // Filter by garment type
}

export async function POST(req: Request) {
  // Create new measurement
  // Validate against template
}

// app/api/measurements/[id]/route.ts
export async function GET(req: Request) {
  // Get specific measurement
}

export async function PATCH(req: Request) {
  // Update measurement
}

// app/api/measurements/compare/route.ts
export async function POST(req: Request) {
  // Compare two measurements
  // Highlight differences
}

// app/api/measurements/templates/route.ts
export async function GET(req: Request) {
  // Get measurement template for garment type
}
```

**Components:**

```typescript
// components/measurements/measurement-form.tsx
// Dynamic form that adapts based on garment type
// Real-time validation
// Unit conversion (inches <-> cm)
// Visual measurement guide
// Photo upload for reference

// components/measurements/measurement-history.tsx
// Timeline view of past measurements
// Compare measurements
// Trend analysis

// components/measurements/measurement-guide.tsx
// Visual guide for taking measurements
// Animated illustrations
// Tips and best practices
```

---

### Feature 2: Barcode/QR Code System

#### Implementation

**Dependencies:**

```bash
npm install react-qr-code qr-code-styling
npm install @zxing/library  # For QR scanning
npm install jspdf  # For PDF generation
```

**Database Addition:**

```prisma
model InventoryBarcode {
  id              String    @id @default(cuid())
  inventoryId     String    @unique
  inventory       ClothInventory @relation(fields: [inventoryId], references: [id])
  barcodeData     String    @unique  // QR code data
  barcodeType     String    @default("QR")  // QR, EAN-13, etc.
  printedCount    Int       @default(0)
  lastPrinted     DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model BarcodeScans {
  id              String    @id @default(cuid())
  barcodeData     String
  inventoryId     String?
  scannedBy       String
  scanLocation    String?   // GPS coordinates
  action          String    // view, adjust, reorder
  metadata        Json?
  createdAt       DateTime  @default(now())
}
```

**API Endpoints:**

```typescript
// app/api/barcode/generate/route.ts
export async function POST(req: Request) {
  // Generate QR code for inventory item
  // Store in database
  // Return QR code image data
}

// app/api/barcode/scan/route.ts
export async function POST(req: Request) {
  // Process scanned barcode
  // Look up inventory item
  // Log scan event
  // Return item details
}

// app/api/barcode/print/route.ts
export async function POST(req: Request) {
  // Generate printable labels
  // Include item details
  // Return PDF for printing
}
```

**Components:**

```typescript
// components/barcode/qr-generator.tsx
// Generate QR codes for items
// Customizable size and style
// Download options

// components/barcode/qr-scanner.tsx
// Mobile camera scanning
// Real-time detection
// Quick actions after scan

// components/barcode/label-printer.tsx
// Batch label generation
// Print preview
// Label template customization
```

---

### Feature 3: WhatsApp Business Integration

#### Setup & Implementation

**Dependencies:**

```bash
npm install @whiskeysockets/baileys  # WhatsApp Web API
# OR use official WhatsApp Business API
```

**Environment Variables:**

```bash
WHATSAPP_API_KEY=your_api_key
WHATSAPP_PHONE_NUMBER=+911234567890
WHATSAPP_WEBHOOK_SECRET=your_secret
```

**Database Schema:**

```prisma
model WhatsAppMessage {
  id              String    @id @default(cuid())
  phoneNumber     String
  customerId      String?
  customer        Customer? @relation(fields: [customerId], references: [id])
  messageType     String    // text, template, image
  content         String
  status          String    // sent, delivered, read, failed
  templateName    String?
  orderId         String?
  metadata        Json?
  sentAt          DateTime  @default(now())
  deliveredAt     DateTime?
  readAt          DateTime?
  
  @@index([phoneNumber, sentAt])
}

model WhatsAppTemplate {
  id              String    @id @default(cuid())
  name            String    @unique
  category        String    // transactional, marketing
  language        String    @default("en")
  content         String
  variables       Json      // Placeholders
  approved        Boolean   @default(false)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

**Message Templates:**

```typescript
const templates = {
  orderConfirmation: {
    name: "order_confirmation",
    content: "Hello {{customer_name}}! Your order #{{order_number}} has been confirmed. Estimated delivery: {{delivery_date}}. Total: ₹{{amount}}. Thank you for choosing us!",
    variables: ["customer_name", "order_number", "delivery_date", "amount"]
  },
  orderReady: {
    name: "order_ready",
    content: "Hi {{customer_name}}! Great news! Your order #{{order_number}} is ready for pickup. Please visit us at your convenience. Balance amount: ₹{{balance}}.",
    variables: ["customer_name", "order_number", "balance"]
  },
  paymentReminder: {
    name: "payment_reminder",
    content: "Dear {{customer_name}}, this is a reminder that your order #{{order_number}} has a pending balance of ₹{{balance}}. Please make payment at your earliest convenience.",
    variables: ["customer_name", "order_number", "balance"]
  },
  lowStockAlert: {
    name: "low_stock_internal",
    content: "⚠️ ALERT: {{cloth_name}} (SKU: {{sku}}) is running low. Current stock: {{current_stock}}m. Minimum: {{minimum}}m. Please reorder soon!",
    variables: ["cloth_name", "sku", "current_stock", "minimum"]
  }
};
```

**API Endpoints:**

```typescript
// app/api/whatsapp/send/route.ts
export async function POST(req: Request) {
  // Send WhatsApp message
  // Use template or free text
  // Log message
}

// app/api/whatsapp/webhook/route.ts
export async function POST(req: Request) {
  // Receive delivery status
  // Update message status
  // Handle incoming messages (optional)
}

// app/api/whatsapp/templates/route.ts
export async function GET(req: Request) {
  // List approved templates
}
```

**Automated Workflows:**

```typescript
// lib/notifications/whatsapp-workflows.ts

export async function sendOrderConfirmation(orderId: string) {
  const order = await getOrder(orderId);
  await sendWhatsApp({
    to: order.customer.phone,
    template: "order_confirmation",
    variables: {
      customer_name: order.customer.name,
      order_number: order.orderNumber,
      delivery_date: formatDate(order.deliveryDate),
      amount: order.totalAmount
    }
  });
}

export async function sendLowStockAlert(itemId: string, recipients: string[]) {
  const item = await getInventoryItem(itemId);
  for (const recipient of recipients) {
    await sendWhatsApp({
      to: recipient,
      template: "low_stock_internal",
      variables: {
        cloth_name: item.name,
        sku: item.sku,
        current_stock: item.currentStock,
        minimum: item.minimum
      }
    });
  }
}
```

---

### Feature 4: Advanced Analytics Dashboard

#### Implementation

**Dependencies:**

```bash
npm install recharts date-fns
npm install @tremor/react  # Beautiful dashboard components
npm install react-to-print  # For exporting reports
```

**API Endpoints:**

```typescript
// app/api/analytics/inventory/route.ts
export async function GET(req: Request) {
  // Inventory value over time
  // Stock turnover rate
  // Wastage percentage
  // Most/least used fabrics
}

// app/api/analytics/sales/route.ts
export async function GET(req: Request) {
  // Revenue by period
  // Orders by status
  // Top customers
  // Average order value
}

// app/api/analytics/efficiency/route.ts
export async function GET(req: Request) {
  // Order completion time
  // Material usage efficiency
  // Tailor productivity
  // On-time delivery rate
}
```

**Dashboard Components:**

```typescript
// components/analytics/revenue-chart.tsx
// Line chart showing revenue trends
// Compare periods (MoM, YoY)
// Breakdown by garment type

// components/analytics/inventory-value.tsx
// Current inventory value
// Value by fabric type
// Low vs healthy stock value

// components/analytics/top-performers.tsx
// Top selling fabrics
// Top customers
// Most efficient tailors

// components/analytics/kpi-cards.tsx
// Key metrics at a glance
// Trend indicators
// Comparison to previous period
```

**Reports:**

```typescript
// lib/reports/inventory-report.ts
export async function generateInventoryReport(dateRange) {
  // Fetch data
  // Calculate metrics
  // Generate PDF
  // Include charts
}

// lib/reports/sales-report.ts
export async function generateSalesReport(dateRange) {
  // Revenue breakdown
  // Customer analysis
  // Product mix
  // Payment collection
}
```

---

### Feature 5: Multi-Location Support

#### Database Schema Changes:

```prisma
model Location {
  id              String    @id @default(cuid())
  name            String
  code            String    @unique  // Branch code
  address         String
  city            String
  state           String
  phone           String
  email           String?
  manager         String?
  active          Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  inventory       ClothInventory[]
  orders          Order[]
  users           UserLocation[]
}

model UserLocation {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  locationId      String
  location        Location  @relation(fields: [locationId], references: [id])
  role            String    // Manager, Staff
  assignedAt      DateTime  @default(now())
  
  @@unique([userId, locationId])
}

model StockTransfer {
  id              String    @id @default(cuid())
  inventoryId     String
  inventory       ClothInventory @relation(fields: [inventoryId], references: [id])
  fromLocationId  String
  fromLocation    Location  @relation("TransfersFrom", fields: [fromLocationId], references: [id])
  toLocationId    String
  toLocation      Location  @relation("TransfersTo", fields: [toLocationId], references: [id])
  quantity        Float
  status          String    // pending, in_transit, completed, cancelled
  requestedBy     String
  approvedBy      String?
  dispatchedAt    DateTime?
  receivedAt      DateTime?
  notes           String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

**Features:**

- Location-wise inventory tracking
- Inter-location stock transfers
- Consolidated reporting across locations
- Location-specific pricing
- Transfer approval workflow

---

### Feature 6: Payment Integration

#### Razorpay Integration

**Dependencies:**

```bash
npm install razorpay
npm install @types/razorpay
```

**Environment Variables:**

```bash
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
```

**Database Schema:**

```prisma
model Payment {
  id              String    @id @default(cuid())
  orderId         String
  order           Order     @relation(fields: [orderId], references: [id])
  amount          Float
  currency        String    @default("INR")
  method          String    // cash, card, upi, razorpay
  status          String    // pending, completed, failed
  razorpayOrderId String?
  razorpayPaymentId String?
  razorpaySignature String?
  receiptNumber   String?
  paidAt          DateTime?
  metadata        Json?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([orderId, status])
}
```

**API Endpoints:**

```typescript
// app/api/payments/create-order/route.ts
export async function POST(req: Request) {
  // Create Razorpay order
  // Store payment intent
  // Return order details for frontend
}

// app/api/payments/verify/route.ts
export async function POST(req: Request) {
  // Verify payment signature
  // Update payment status
  // Update order balance
}

// app/api/payments/send-link/route.ts
export async function POST(req: Request) {
  // Generate payment link
  // Send via WhatsApp/SMS
}
```

**Components:**

```typescript
// components/payments/razorpay-checkout.tsx
// Razorpay button integration
// Handle success/failure
// Update UI

// components/payments/payment-history.tsx
// Show all payments for order
// Payment status
// Receipt download
```

---

### Feature 7: Customer Portal

#### Implementation

**Public Routes:**

```typescript
// app/portal/[customerId]/orders/page.tsx
// Customer can view their orders
// Protected by customer-specific token

// app/portal/[customerId]/orders/[orderId]/page.tsx
// Order details
// Status tracking
// Payment options

// app/portal/[customerId]/measurements/page.tsx
// View saved measurements
// Request updates
```

**Features:**

- Token-based authentication (no password needed)
- Order tracking
- Payment via link
- Measurement history
- Digital receipt download

---

### Feature 8: Voice Input Support

**Dependencies:**

```bash
npm install react-speech-recognition
```

**Implementation:**

```typescript
// components/voice/voice-search.tsx
// Voice search for inventory
// Voice commands for common actions
// Multi-language support (Hindi, English, Punjabi)

// Voice Commands:
// "Check stock of blue cotton"
// "Create order for Rajesh"
// "Show pending orders"
// "Mark order 1234 as ready"
```

---

### Feature 9: Offline Support (PWA)

**Configuration:**

```typescript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development'
});

module.exports = withPWA({
  // ... other config
});
```

**Features:**

- Offline viewing of inventory
- Queue actions when offline
- Sync when online
- Background sync
- Push notifications

---

### Feature 10: Image Management

**Dependencies:**

```bash
npm install sharp  # Image optimization
npm install @uploadthing/react  # File uploads
```

**Features:**

- Cloth photo uploads
- Multiple photos per item
- Image optimization
- Photo gallery
- Before/after photos for orders

---

### Feature 11: Staff Management & Permissions

**Database Schema:**

```prisma
model Permission {
  id              String    @id @default(cuid())
  name            String    @unique
  description     String
  category        String    // inventory, orders, customers, etc.
  createdAt       DateTime  @default(now())
}

model RolePermission {
  id              String    @id @default(cuid())
  role            Role
  permissionId    String
  permission      Permission @relation(fields: [permissionId], references: [id])
  
  @@unique([role, permissionId])
}

model ActivityLog {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  action          String    // create, update, delete, view
  entity          String    // order, inventory, customer
  entityId        String
  changes         Json?     // What changed
  ipAddress       String?
  userAgent       String?
  createdAt       DateTime  @default(now())
  
  @@index([userId, createdAt])
  @@index([entity, entityId])
}
```

**Permission System:**

```typescript
const permissions = {
  inventory: {
    view: "inventory.view",
    create: "inventory.create",
    update: "inventory.update",
    delete: "inventory.delete",
  },
  orders: {
    view: "orders.view",
    create: "orders.create",
    update: "orders.update",
    approve: "orders.approve",
    cancel: "orders.cancel",
  },
  // ... more permissions
};

// Middleware to check permissions
export async function checkPermission(userId: string, permission: string) {
  const user = await getUser(userId);
  const rolePermissions = await getRolePermissions(user.role);
  return rolePermissions.includes(permission);
}
```

---

### Feature 12: Notification Preferences

**Database Schema:**

```prisma
model NotificationPreference {
  id              String    @id @default(cuid())
  userId          String    @unique
  user            User      @relation(fields: [userId], references: [id])
  channels        Json      // {email: true, sms: false, whatsapp: true, push: true}
  alertTypes      Json      // {lowStock: true, critical: true, orders: true, etc.}
  quietHours      Json?     // {start: "22:00", end: "08:00"}
  frequency       String    @default("realtime")  // realtime, daily_digest, weekly_digest
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

---

### Feature 13: Appointment Scheduling

**Database Schema:**

```prisma
model Appointment {
  id              String    @id @default(cuid())
  customerId      String
  customer        Customer  @relation(fields: [customerId], references: [id])
  appointmentType String    // measurement, fitting, pickup, consultation
  scheduledAt     DateTime
  duration        Int       // minutes
  assignedTo      String?   // Staff member
  status          String    // scheduled, confirmed, completed, cancelled
  notes           String?
  reminderSent    Boolean   @default(false)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([scheduledAt, status])
}
```

**Features:**

- Online booking
- Calendar view
- Automated reminders
- Staff assignment
- Conflict detection

---

## TESTING ENHANCEMENTS

### E2E Testing with Playwright

```bash
npm install -D @playwright/test
```

**Test Scenarios:**

```typescript
// tests/e2e/order-flow.spec.ts
test('complete order creation flow', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[name=email]', 'owner@tailorshop.com');
  await page.fill('[name=password]', 'admin123');
  await page.click('button[type=submit]');
  
  // Navigate to new order
  await page.click('text=New Order');
  
  // Fill form
  await page.selectOption('[name=customer]', '1');
  await page.selectOption('[name=garmentType]', 'shirt');
  await page.selectOption('[name=cloth]', '1');
  await page.fill('[name=quantity]', '2');
  
  // Submit
  await page.click('button:has-text("Create Order")');
  
  // Verify success
  await expect(page.locator('text=Order created')).toBeVisible();
  
  // Verify inventory updated
  await page.goto('/inventory');
  // Assert stock decreased
});
```

---

## DEPLOYMENT ENHANCEMENTS

### Docker Support

**Dockerfile:**

```dockerfile
FROM node:18-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

**docker-compose.yml:**

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://user:pass@db:5432/tailor
      NEXTAUTH_URL: http://localhost:3000
    depends_on:
      - db
  
  db:
    image: postgres:14
    environment:
      POSTGRES_PASSWORD: password
      POSTGRES_DB: tailor
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

---

## MONITORING & OBSERVABILITY

### Sentry Integration

```bash
npm install @sentry/nextjs
```

**sentry.client.config.js:**

```javascript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
});
```

### Analytics Integration

```typescript
// Google Analytics
// Mixpanel
// PostHog for product analytics
```

---

## SECURITY ENHANCEMENTS

### Rate Limiting

```typescript
// lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
});
```

### API Key Authentication

For mobile apps and external integrations:

```prisma
model ApiKey {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  key             String    @unique
  name            String
  permissions     Json
  lastUsedAt      DateTime?
  expiresAt       DateTime?
  active          Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

---

## TOTAL FEATURE COUNT

**MVP Features:** 15
**Phase 9 Advanced Features:** 13
**Total Features:** 28

This expanded guide provides comprehensive implementation details for all advanced features, making your tailor inventory system a complete, enterprise-grade solution!
