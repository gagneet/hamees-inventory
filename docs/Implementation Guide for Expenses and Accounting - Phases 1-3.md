# Implementation Guide for Expenses and Accounting - Phases 1-3

**Version:** 0.7.0
**Date:** January 15, 2026
**Feature:** Advanced Accounting Module with GST Compliance

---

## Table of Contents
1. [Overview](#overview)
2. [Current Limitations](#current-limitations)
3. [Phase 1: Core Accounting & GST Foundation](#phase-1-core-accounting--gst-foundation)
4. [Phase 2: Advanced Features & Compliance](#phase-2-advanced-features--compliance)
5. [Phase 3: Comprehensive Accounting Suite](#phase-3-comprehensive-accounting-suite)
6. [Database Schema Changes](#database-schema-changes)
7. [GST Implementation Details](#gst-implementation-details)
8. [API Endpoints](#api-endpoints)
9. [UI Components](#ui-components)
10. [Testing & Validation](#testing--validation)

---

## Overview

This guide outlines the implementation of a comprehensive accounting and expense management system for the tailor shop inventory management application. The system will include GST compliance for India, advanced date range filtering, financial year support, and detailed expense tracking.

### Key Features
- **Advanced Date Range Picker** with financial year (FY) support (Apr 1 - Mar 31)
- **GST Compliance** for India (CGST, SGST, IGST)
- **Expense Management** with categorization
- **Financial Reports** (P&L, Cash Flow, Balance Sheet)
- **Tax Compliance** (GSTR-1, GSTR-3B, TDS tracking)
- **Export Functionality** (Excel, PDF, CSV)
- **7-year data retention** for audit compliance

---

## Current Limitations

### Expenses Page (https://hamees.gagneet.com/expenses)
- ❌ Only month-by-month navigation (no date range picker)
- ❌ No financial year view (important for Indian accounting)
- ❌ No GST tracking (critical for Indian businesses)
- ❌ Limited expense categorization (only orders vs purchases)
- ❌ No export functionality for audits
- ❌ No advanced filtering (customer, supplier, amount range)
- ❌ No payment tracking (installments, overdue)
- ❌ No tax reports (GSTR-1, GSTR-3B)

---

## Phase 1: Core Accounting & GST Foundation

**Status:** 🚧 In Progress
**Target Completion:** January 2026
**Version:** 0.7.0

### 1.1 Advanced Date Range Picker

**Component:** `/components/date-range-picker.tsx`

**Features:**
- ✅ Quick presets:
  - This Month / Last Month
  - This Quarter / Last Quarter
  - This Financial Year / Last Financial Year (Apr 1 - Mar 31)
  - Year-to-Date (YTD)
  - Custom Range (date picker with 7-year history)

- ✅ Financial Year Detection:
  - Automatically detects current FY based on date
  - FY 2025-26 = Apr 1, 2025 to Mar 31, 2026
  - Supports historical FY selection (up to 7 years)

**Implementation:**
```typescript
type DateRangePreset =
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'last_quarter'
  | 'this_fy'
  | 'last_fy'
  | 'ytd'
  | 'custom'

interface DateRange {
  from: Date
  to: Date
  preset?: DateRangePreset
  label: string
}
```

### 1.2 Database Schema Changes

#### 1.2.1 Order Model (GST for Sales)
```prisma
model Order {
  // ... existing fields ...

  // GST Fields
  subTotal        Float        @default(0)   // Amount before GST
  gstRate         Float        @default(0)   // 5%, 12%, 18%, or 28%
  cgst            Float        @default(0)   // Central GST (intra-state)
  sgst            Float        @default(0)   // State GST (intra-state)
  igst            Float        @default(0)   // Integrated GST (inter-state)
  gstAmount       Float        @default(0)   // Total GST charged
  taxableAmount   Float        @default(0)   // Base for GST calculation

  // Invoice details
  invoiceNumber   String?      @unique       // GST invoice number
  invoiceDate     DateTime?                  // GST invoice date
  placeOfSupply   String?                    // State for GST

  // Note: totalAmount = subTotal + gstAmount
}
```

#### 1.2.2 Customer Model (GST Details)
```prisma
model Customer {
  // ... existing fields ...

  // GST Fields
  gstin           String?                    // GST Identification Number (B2B)
  state           String?      // Already exists, needed for GST calculation
  customerType    String       @default("B2C") // B2B or B2C
}
```

#### 1.2.3 PurchaseOrder Model (GST for Purchases - Input Tax Credit)
```prisma
model PurchaseOrder {
  // ... existing fields ...

  // GST Fields
  subTotal        Float        @default(0)
  gstRate         Float        @default(0)
  cgst            Float        @default(0)
  sgst            Float        @default(0)
  igst            Float        @default(0)
  gstAmount       Float        @default(0)

  // Input Tax Credit tracking
  isInputTaxCredit Boolean     @default(true) // Eligible for ITC
  itcClaimed      Boolean      @default(false) // ITC claimed in returns

  // Invoice details
  supplierInvoiceNumber String?
  supplierInvoiceDate   DateTime?

  // Note: totalAmount = subTotal + gstAmount
}
```

#### 1.2.4 NEW: Expense Model
```prisma
enum ExpenseCategory {
  RENT
  UTILITIES          // Electricity, Water, Internet
  SALARIES          // Staff payments
  TRANSPORT         // Delivery, logistics
  MARKETING         // Ads, promotions
  MAINTENANCE       // Equipment repair
  OFFICE_SUPPLIES
  PROFESSIONAL_FEES // CA, Lawyer
  INSURANCE
  DEPRECIATION
  BANK_CHARGES
  MISCELLANEOUS
}

enum PaymentMode {
  CASH
  UPI
  CARD
  BANK_TRANSFER
  CHEQUE
  NET_BANKING
}

model Expense {
  id              String          @id @default(cuid())
  category        ExpenseCategory
  description     String
  amount          Float                      // Amount before GST
  gstAmount       Float           @default(0)
  gstRate         Float           @default(0)
  totalAmount     Float                      // amount + gstAmount

  expenseDate     DateTime        @default(now())
  vendorName      String?
  vendorGstin     String?
  invoiceNumber   String?

  paymentMode     PaymentMode     @default(CASH)
  paidBy          String                     // User ID
  paidByUser      User            @relation(fields: [paidBy], references: [id])

  // Tax deduction tracking
  tdsAmount       Float           @default(0)  // TDS deducted (if applicable)
  tdsRate         Float           @default(0)  // TDS rate %

  // Recurring expense support
  isRecurring     Boolean         @default(false)
  recurringPeriod String?                    // MONTHLY, QUARTERLY, YEARLY

  notes           String?
  attachments     Json?                      // Store file paths/URLs

  active          Boolean         @default(true)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@index([category])
  @@index([expenseDate])
  @@index([paidBy])
  @@index([createdAt])
}
```

#### 1.2.5 NEW: BusinessSettings Model (GST Configuration)
```prisma
model BusinessSettings {
  id              String   @id @default(cuid())
  businessName    String
  gstin           String   @unique           // Business GST number
  state           String                      // State for CGST/SGST calculation
  address         String?
  city            String?
  pincode         String?
  phone           String?
  email           String?

  // Default GST rates for different items
  fabricGstRate   Float    @default(5)       // Default GST for fabrics
  garmentGstRate  Float    @default(12)      // Default GST for readymade garments

  // Financial year settings
  fyStartMonth    Int      @default(4)       // April = 4 (Indian FY)

  // Invoice settings
  invoicePrefix   String   @default("INV")
  invoiceCounter  Int      @default(1)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([gstin])
}
```

### 1.3 GST Calculation Logic

#### 1.3.1 Sales GST (on Orders)
```typescript
interface GSTCalculation {
  subTotal: number
  gstRate: number
  cgst: number
  sgst: number
  igst: number
  gstAmount: number
  totalAmount: number
}

function calculateSalesGST(
  subTotal: number,
  customerState: string,
  businessState: string,
  gstRate: number = 5
): GSTCalculation {
  const isSameState = customerState === businessState

  let cgst = 0
  let sgst = 0
  let igst = 0

  if (isSameState) {
    // Intra-state: CGST + SGST
    cgst = (subTotal * gstRate) / 200  // Half of GST rate
    sgst = (subTotal * gstRate) / 200  // Half of GST rate
  } else {
    // Inter-state: IGST
    igst = (subTotal * gstRate) / 100
  }

  const gstAmount = cgst + sgst + igst
  const totalAmount = subTotal + gstAmount

  return {
    subTotal,
    gstRate,
    cgst,
    sgst,
    igst,
    gstAmount,
    totalAmount
  }
}
```

#### 1.3.2 Purchase GST (Input Tax Credit)
```typescript
function calculatePurchaseGST(
  subTotal: number,
  supplierState: string,
  businessState: string,
  gstRate: number
): GSTCalculation {
  // Same logic as sales GST
  return calculateSalesGST(subTotal, supplierState, businessState, gstRate)
}

function calculateInputTaxCredit(
  purchaseOrders: PurchaseOrder[],
  startDate: Date,
  endDate: Date
): number {
  // Sum all GST paid on eligible purchases
  return purchaseOrders
    .filter(po => po.isInputTaxCredit && !po.itcClaimed)
    .filter(po => po.createdAt >= startDate && po.createdAt <= endDate)
    .reduce((sum, po) => sum + po.gstAmount, 0)
}
```

#### 1.3.3 Net GST Liability
```typescript
interface GSTLiability {
  outputGST: number      // GST collected from customers
  inputTaxCredit: number // GST paid to suppliers (ITC)
  netGST: number         // outputGST - inputTaxCredit
}

function calculateGSTLiability(
  orders: Order[],
  purchaseOrders: PurchaseOrder[],
  startDate: Date,
  endDate: Date
): GSTLiability {
  const outputGST = orders
    .filter(o => o.invoiceDate >= startDate && o.invoiceDate <= endDate)
    .reduce((sum, o) => sum + o.gstAmount, 0)

  const inputTaxCredit = calculateInputTaxCredit(purchaseOrders, startDate, endDate)

  const netGST = outputGST - inputTaxCredit

  return {
    outputGST,
    inputTaxCredit,
    netGST
  }
}
```

### 1.4 Textile GST Rate Guidelines (India)

| Item | HSN Code | GST Rate | Condition |
|------|----------|----------|-----------|
| Cotton fabric | 5208 | **5%** | Price ≤ ₹1,000/meter |
| Cotton fabric | 5208 | **12%** | Price > ₹1,000/meter |
| Silk fabric | 5007 | **5%** | Handloom, Khadi |
| Silk fabric | 5007 | **12%** | Mill-made, designer |
| Readymade garments | 62/63 | **12%** | Standard garments |
| Readymade garments | 62/63 | **12%** | Custom tailoring services |
| Accessories (buttons, threads) | Various | **12%** | Standard rate |

**Implementation Note:** Default to 5% for fabrics, 12% for readymade garments. Allow override during order creation.

### 1.5 Phase 1 Deliverables

- ✅ Database migration with GST fields
- ✅ Date range picker component with FY support
- ✅ Updated expenses API with date range queries
- ✅ Basic expense management (create, list, delete)
- ✅ GST calculation utilities
- ✅ Updated expenses page UI
- ✅ Basic P&L report with GST breakdown

---

## Phase 2: Advanced Features & Compliance

**Status:** 📋 Planned
**Target Completion:** February 2026
**Version:** 0.8.0

### 2.1 GST on Purchases (ITC Tracking)
- Track GST paid to suppliers
- Calculate Input Tax Credit
- Mark ITC as claimed/unclaimed
- ITC reversal for ineligible items

### 2.2 Export Functionality
- **Excel Export:**
  - Detailed transaction list
  - GST summary sheets
  - Month-wise breakdown
  - Category-wise analysis

- **PDF Export:**
  - Formatted for printing
  - Professional invoice templates
  - GST-compliant invoice format

- **CSV Export:**
  - Import to Tally/other accounting software
  - Bank reconciliation format

### 2.3 Advanced Filtering
- Filter by customer name/phone
- Filter by supplier name
- Filter by expense category
- Filter by payment mode
- Filter by amount range (min-max)
- Filter by GST applicability
- Combine multiple filters

### 2.4 Payment Installment Tracking
```prisma
model PaymentInstallment {
  id              String   @id @default(cuid())
  orderId         String
  order           Order    @relation(fields: [orderId], references: [id])

  installmentNumber Int
  amount          Float
  dueDate         DateTime
  paidDate        DateTime?
  paidAmount      Float    @default(0)
  paymentMode     PaymentMode?

  status          String   @default("PENDING") // PENDING, PARTIAL, PAID, OVERDUE
  notes           String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([orderId])
  @@index([dueDate])
  @@index([status])
}
```

### 2.5 GST Reports
- **GSTR-1** (Monthly outward supplies)
  - B2B invoices
  - B2C invoices (consolidated)
  - Export JSON for GST portal upload

- **GSTR-3B** (Monthly return summary)
  - Outward taxable supplies
  - Inward supplies (ITC)
  - Interest/late fee calculation
  - Tax liability calculation

### 2.6 Phase 2 Deliverables
- GST on purchase orders with ITC tracking
- Excel/PDF/CSV export functionality
- Advanced multi-filter system
- Payment installment module
- GSTR-1 and GSTR-3B report generation
- Automated payment reminders

---

## Phase 3: Comprehensive Accounting Suite

**Status:** 💡 Conceptual
**Target Completion:** March 2026
**Version:** 0.9.0

### 3.1 Financial Statements

#### 3.1.1 Profit & Loss Statement (P&L)
```typescript
interface ProfitAndLoss {
  revenue: {
    orderRevenue: number
    otherIncome: number
    total: number
  }

  costOfGoodsSold: {
    fabricCost: number
    accessoryCost: number
    total: number
  }

  grossProfit: number
  grossProfitMargin: number  // %

  operatingExpenses: {
    rent: number
    salaries: number
    utilities: number
    marketing: number
    maintenance: number
    others: number
    total: number
  }

  operatingProfit: number
  operatingProfitMargin: number  // %

  otherExpenses: {
    interest: number
    depreciation: number
    total: number
  }

  netProfit: number
  netProfitMargin: number  // %
}
```

#### 3.1.2 Cash Flow Statement
```typescript
interface CashFlow {
  operatingActivities: {
    cashFromOrders: number
    cashPaidToSuppliers: number
    cashPaidForExpenses: number
    netCashFromOperations: number
  }

  investingActivities: {
    purchaseOfAssets: number
    saleOfAssets: number
    netCashFromInvesting: number
  }

  financingActivities: {
    loansReceived: number
    loansRepaid: number
    capitalIntroduced: number
    netCashFromFinancing: number
  }

  netCashFlow: number
  openingBalance: number
  closingBalance: number
}
```

#### 3.1.3 Balance Sheet (Simplified)
```typescript
interface BalanceSheet {
  assets: {
    currentAssets: {
      cash: number
      accountsReceivable: number
      inventory: number
      total: number
    }
    fixedAssets: {
      equipment: number
      furniture: number
      lessDepreciation: number
      total: number
    }
    totalAssets: number
  }

  liabilities: {
    currentLiabilities: {
      accountsPayable: number
      overduePayments: number
      total: number
    }
    longTermLiabilities: {
      loans: number
      total: number
    }
    totalLiabilities: number
  }

  equity: {
    capital: number
    retainedEarnings: number
    currentYearProfit: number
    total: number
  }

  // Assets = Liabilities + Equity (always balanced)
}
```

### 3.2 Books of Accounts

- **General Ledger** - Complete transaction history
- **Cash Book** - Daily cash transactions
- **Bank Book** - Bank reconciliation
- **Sales Register** - All orders with GST details
- **Purchase Register** - All purchases with GST and ITC
- **Accounts Receivable Aging** - Outstanding customer payments
- **Accounts Payable Aging** - Outstanding supplier payments

### 3.3 Tax Compliance

#### 3.3.1 TDS (Tax Deducted at Source)
```prisma
model TDSEntry {
  id              String   @id @default(cuid())
  expenseId       String?
  expense         Expense? @relation(fields: [expenseId], references: [id])

  payeeName       String
  payeePAN        String   // PAN for TDS
  amount          Float    // Payment amount
  tdsRate         Float    // TDS rate %
  tdsAmount       Float    // TDS deducted
  netPayable      Float    // amount - tdsAmount

  tdsSection      String   // 194C, 194J, etc.
  paymentDate     DateTime
  quarterlyReturn String?  // Q1-FY2026, Q2-FY2026, etc.

  challanNumber   String?  // TDS payment challan
  challanDate     DateTime?

  createdAt       DateTime @default(now())

  @@index([quarterlyReturn])
}
```

#### 3.3.2 Professional Tax
- Track monthly professional tax payments
- State-wise slab calculation

#### 3.3.3 Income Tax Provisional Calculations
- Quarterly profit estimates
- Advance tax calculation
- Income tax liability projection

### 3.4 Phase 3 Deliverables
- Complete P&L, Cash Flow, Balance Sheet
- General Ledger and subsidiary books
- Bank reconciliation module
- TDS tracking and quarterly returns
- Form 26AS reconciliation
- Integration hooks for Tally/QuickBooks

---

## Database Schema Changes

### Migration Script (Phase 1)

```sql
-- Add GST fields to Order table
ALTER TABLE "Order"
  ADD COLUMN "subTotal" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN "gstRate" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN "cgst" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN "sgst" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN "igst" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN "gstAmount" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN "taxableAmount" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN "invoiceNumber" TEXT,
  ADD COLUMN "invoiceDate" TIMESTAMP,
  ADD COLUMN "placeOfSupply" TEXT;

-- Add unique constraint on invoiceNumber
CREATE UNIQUE INDEX "Order_invoiceNumber_key" ON "Order"("invoiceNumber") WHERE "invoiceNumber" IS NOT NULL;

-- Add GST fields to Customer table
ALTER TABLE "Customer"
  ADD COLUMN "gstin" TEXT,
  ADD COLUMN "customerType" TEXT DEFAULT 'B2C';

-- Add GST fields to PurchaseOrder table
ALTER TABLE "PurchaseOrder"
  ADD COLUMN "subTotal" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN "gstRate" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN "cgst" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN "sgst" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN "igst" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN "gstAmount" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN "isInputTaxCredit" BOOLEAN DEFAULT true,
  ADD COLUMN "itcClaimed" BOOLEAN DEFAULT false,
  ADD COLUMN "supplierInvoiceNumber" TEXT,
  ADD COLUMN "supplierInvoiceDate" TIMESTAMP;

-- Create ExpenseCategory enum
CREATE TYPE "ExpenseCategory" AS ENUM (
  'RENT',
  'UTILITIES',
  'SALARIES',
  'TRANSPORT',
  'MARKETING',
  'MAINTENANCE',
  'OFFICE_SUPPLIES',
  'PROFESSIONAL_FEES',
  'INSURANCE',
  'DEPRECIATION',
  'BANK_CHARGES',
  'MISCELLANEOUS'
);

-- Create PaymentMode enum
CREATE TYPE "PaymentMode" AS ENUM (
  'CASH',
  'UPI',
  'CARD',
  'BANK_TRANSFER',
  'CHEQUE',
  'NET_BANKING'
);

-- Create Expense table
CREATE TABLE "Expense" (
  "id" TEXT PRIMARY KEY,
  "category" "ExpenseCategory" NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "gstAmount" DOUBLE PRECISION DEFAULT 0,
  "gstRate" DOUBLE PRECISION DEFAULT 0,
  "totalAmount" DOUBLE PRECISION NOT NULL,
  "expenseDate" TIMESTAMP NOT NULL DEFAULT NOW(),
  "vendorName" TEXT,
  "vendorGstin" TEXT,
  "invoiceNumber" TEXT,
  "paymentMode" "PaymentMode" DEFAULT 'CASH',
  "paidBy" TEXT NOT NULL,
  "tdsAmount" DOUBLE PRECISION DEFAULT 0,
  "tdsRate" DOUBLE PRECISION DEFAULT 0,
  "isRecurring" BOOLEAN DEFAULT false,
  "recurringPeriod" TEXT,
  "notes" TEXT,
  "attachments" JSONB,
  "active" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),

  CONSTRAINT "Expense_paidBy_fkey" FOREIGN KEY ("paidBy") REFERENCES "User"("id")
);

CREATE INDEX "Expense_category_idx" ON "Expense"("category");
CREATE INDEX "Expense_expenseDate_idx" ON "Expense"("expenseDate");
CREATE INDEX "Expense_paidBy_idx" ON "Expense"("paidBy");
CREATE INDEX "Expense_createdAt_idx" ON "Expense"("createdAt");

-- Create BusinessSettings table
CREATE TABLE "BusinessSettings" (
  "id" TEXT PRIMARY KEY,
  "businessName" TEXT NOT NULL,
  "gstin" TEXT UNIQUE NOT NULL,
  "state" TEXT NOT NULL,
  "address" TEXT,
  "city" TEXT,
  "pincode" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "fabricGstRate" DOUBLE PRECISION DEFAULT 5,
  "garmentGstRate" DOUBLE PRECISION DEFAULT 12,
  "fyStartMonth" INTEGER DEFAULT 4,
  "invoicePrefix" TEXT DEFAULT 'INV',
  "invoiceCounter" INTEGER DEFAULT 1,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX "BusinessSettings_gstin_idx" ON "BusinessSettings"("gstin");
```

---

## API Endpoints

### Phase 1 APIs

#### GET `/api/expenses` (Enhanced)
**Query Parameters:**
- `from` - Start date (ISO 8601)
- `to` - End date (ISO 8601)
- `preset` - Date range preset (this_month, this_fy, etc.)
- `category` - Expense category filter
- `minAmount` - Minimum amount filter
- `maxAmount` - Maximum amount filter

**Response:**
```typescript
{
  dateRange: {
    from: string
    to: string
    label: string
  },
  summary: {
    totalRevenue: number
    totalExpenses: number
    netProfit: number
    orderCount: number
    purchaseCount: number
    expenseCount: number
    gstCollected: number    // Output GST
    gstPaid: number         // Input GST
    netGST: number          // Output - Input
  },
  orders: Order[],
  purchases: Purchase[],
  expenses: Expense[]
}
```

#### POST `/api/expenses/create`
**Request:**
```typescript
{
  category: ExpenseCategory
  description: string
  amount: number
  gstRate?: number
  expenseDate: string
  vendorName?: string
  vendorGstin?: string
  invoiceNumber?: string
  paymentMode: PaymentMode
  notes?: string
}
```

#### GET `/api/expenses/categories`
**Response:**
```typescript
{
  categories: {
    category: ExpenseCategory
    totalAmount: number
    count: number
    percentage: number
  }[]
}
```

#### GET `/api/gst/liability`
**Query Parameters:**
- `from` - Start date
- `to` - End date

**Response:**
```typescript
{
  period: string
  outputGST: {
    cgst: number
    sgst: number
    igst: number
    total: number
  },
  inputTaxCredit: {
    cgst: number
    sgst: number
    igst: number
    total: number
  },
  netGST: {
    cgst: number
    sgst: number
    igst: number
    total: number
  }
}
```

---

## UI Components

### Phase 1 Components

#### 1. Date Range Picker Component
**File:** `/components/date-range-picker.tsx`

**Features:**
- Popover with calendar
- Quick preset buttons
- Financial year selector
- Custom range picker
- Displays selected range label

#### 2. Expense Form Dialog
**File:** `/components/expense-form.tsx`

**Features:**
- Category dropdown
- Amount input with GST calculation
- Vendor details (optional for B2B)
- Payment mode selector
- Date picker
- Notes textarea

#### 3. GST Summary Card
**File:** `/components/gst-summary-card.tsx`

**Features:**
- Output GST (collected from customers)
- Input Tax Credit (paid to suppliers)
- Net GST liability
- Color-coded indicators

#### 4. Expense Category Chart
**File:** `/components/expense-category-chart.tsx`

**Features:**
- Pie chart showing expense breakdown
- Category-wise percentage
- Click to filter by category

---

## Testing & Validation

### Phase 1 Testing Checklist

#### Database Migration
- [ ] Run migration on development database
- [ ] Verify all new columns created
- [ ] Test default values
- [ ] Verify indexes created
- [ ] Test constraints (unique, foreign keys)

#### GST Calculation
- [ ] Test intra-state GST (CGST + SGST)
- [ ] Test inter-state GST (IGST)
- [ ] Verify GST rate application (5%, 12%, 18%)
- [ ] Test edge cases (zero GST, exempt items)
- [ ] Validate totalAmount = subTotal + gstAmount

#### Date Range Picker
- [ ] Test all presets (this month, last month, etc.)
- [ ] Test financial year calculation
- [ ] Test custom range selection
- [ ] Verify date validation (from < to)
- [ ] Test 7-year history access

#### Expenses API
- [ ] Test date range filtering
- [ ] Test category filtering
- [ ] Test amount range filtering
- [ ] Verify GST calculations in response
- [ ] Test pagination for large datasets

#### UI Components
- [ ] Test responsive design (mobile, tablet, desktop)
- [ ] Verify accessibility (ARIA labels, keyboard navigation)
- [ ] Test form validations
- [ ] Verify error handling
- [ ] Test loading states

### Sample Test Data

```typescript
// Sample order with GST (intra-state)
{
  orderNumber: "ORD-2026-001",
  customerId: "customer-1",
  customerState: "Maharashtra",
  businessState: "Maharashtra",
  subTotal: 10000,
  gstRate: 5,
  cgst: 250,      // 2.5%
  sgst: 250,      // 2.5%
  igst: 0,
  gstAmount: 500,
  totalAmount: 10500
}

// Sample order with GST (inter-state)
{
  orderNumber: "ORD-2026-002",
  customerId: "customer-2",
  customerState: "Gujarat",
  businessState: "Maharashtra",
  subTotal: 20000,
  gstRate: 12,
  cgst: 0,
  sgst: 0,
  igst: 2400,     // 12%
  gstAmount: 2400,
  totalAmount: 22400
}

// Sample expense
{
  category: "RENT",
  description: "Shop rent for January 2026",
  amount: 15000,
  gstAmount: 0,    // Rent is exempt from GST
  totalAmount: 15000,
  expenseDate: "2026-01-01",
  paymentMode: "BANK_TRANSFER"
}
```

---

## Version History

### v0.7.0 (Phase 1) - January 2026
- ✅ Advanced date range picker with FY support
- ✅ GST fields in Order, Customer, PurchaseOrder models
- ✅ Expense model with category tracking
- ✅ GST calculation utilities
- ✅ Enhanced expenses API
- ✅ Updated expenses page UI
- ✅ Basic P&L report

### v0.8.0 (Phase 2) - February 2026 (Planned)
- GST on purchases with ITC tracking
- Export functionality (Excel, PDF, CSV)
- Advanced filtering
- Payment installment tracking
- GSTR-1 and GSTR-3B reports

### v0.9.0 (Phase 3) - March 2026 (Planned)
- Complete financial statements (P&L, Cash Flow, Balance Sheet)
- Books of accounts (General Ledger, Cash Book, etc.)
- TDS tracking and returns
- Bank reconciliation
- Integration with accounting software

---

## References

### GST Resources
- [GST Portal India](https://www.gst.gov.in/)
- [HSN Code Lookup](https://www.gst.gov.in/help/hsn)
- [Textile GST Rates](https://www.cbic.gov.in/resources//htdocs-cbec/gst/Textile.pdf)

### Financial Year (India)
- FY 2025-26: April 1, 2025 to March 31, 2026
- FY 2024-25: April 1, 2024 to March 31, 2025

### Accounting Standards
- Indian Accounting Standards (Ind AS)
- Small Business Accounting Requirements

---

## Notes for Implementation

1. **Data Migration**: Before applying schema changes, backup the production database
2. **GST Rates**: Allow override during order creation (don't hardcode)
3. **State Codes**: Use standard 2-letter state codes for GST calculations
4. **Date Storage**: Store all dates in UTC, convert to IST for display
5. **Currency**: All amounts in INR with 2 decimal precision
6. **Audit Trail**: Log all GST-related calculations for audit purposes
7. **Performance**: Add database indexes on frequently queried date fields
8. **Validation**: Use Zod schemas for all API inputs with GST validation rules

---

**End of Document**
