# Changelog - Version 0.8.0

**Release Date:** January 15, 2026
**Feature:** Payment Installments & Advanced Filtering

---

## 🎉 Major Features

### 1. Payment Installment Tracking System ✨

Complete installment management system for tracking partial payments from customers.

#### Key Features:
- **Flexible Installment Plans**
  - Create custom installment schedules (1-12 installments)
  - Multiple payment frequencies: Weekly, Bi-weekly, Monthly
  - Custom first installment amount support
  - Auto-calculated due dates

- **Payment Recording**
  - Record partial or full payments
  - Track payment modes (Cash, UPI, Card, Bank Transfer, Cheque, Net Banking)
  - Store transaction references
  - Auto-update installment status

- **Status Tracking**
  - **PENDING**: Not yet due or paid
  - **PARTIAL**: Partially paid
  - **PAID**: Fully paid
  - **OVERDUE**: Past due date
  - **CANCELLED**: Cancelled installment

- **Visual Dashboard**
  - Color-coded status badges
  - Progress tracking
  - Overdue alerts
  - Total paid vs. total due summary

#### API Endpoints:
- `GET /api/orders/[id]/installments` - Get all installments for an order
- `POST /api/orders/[id]/installments` - Create installment plan
- `GET /api/installments/[id]` - Get single installment
- `PATCH /api/installments/[id]` - Record payment
- `DELETE /api/installments/[id]` - Delete unpaid installment

#### UI Integration:
- Installment widget on order detail page
- "Record Payment" dialog for each installment
- Real-time status updates
- Automatic overdue detection

---

### 2. Advanced Filtering System 🔍

Powerful filtering capabilities for expenses, orders, and purchases.

#### Filter Options:

**Customer Filters:**
- Customer name (case-insensitive search)
- Filter orders by specific customer

**Expense Filters:**
- Expense category (12 categories)
- Payment mode (6 modes)
- Amount range (min/max)

**Amount Range:**
- Set minimum amount
- Set maximum amount
- Combine with other filters

#### Features:
- **Real-time filtering** - Results update instantly
- **Filter persistence** - Filters maintained across page refreshes
- **Active filter counter** - Visual indicator of applied filters
- **Quick reset** - Clear all filters with one click
- **Slide-out panel** - Clean, non-intrusive UI

#### Filter UI:
- Accessible via "Filters" button on expenses page
- Badge shows number of active filters
- Side sheet with all filter options
- Apply/Reset buttons

---

## 📊 Database Schema Changes

### New Model: PaymentInstallment

```prisma
model PaymentInstallment {
  id                String            @id @default(cuid())
  orderId           String
  order             Order             @relation(...)

  installmentNumber Int               // 1, 2, 3, etc.
  amount            Float             // Expected amount
  dueDate           DateTime
  paidDate          DateTime?
  paidAmount        Float             @default(0)

  paymentMode       PaymentMode?
  transactionRef    String?           // Transaction ID/Cheque #

  status            InstallmentStatus @default(PENDING)
  notes             String?

  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  @@index([orderId])
  @@index([dueDate])
  @@index([status])
  @@index([paidDate])
}
```

### New Enum: InstallmentStatus

```prisma
enum InstallmentStatus {
  PENDING
  PARTIAL
  PAID
  OVERDUE
  CANCELLED
}
```

### Updated Models:

#### Order Model
- Added `installments` relation: `PaymentInstallment[]`

---

## 🛠️ New Files & Components

### Components
- `components/payment-installments.tsx` - Full installment tracking widget
- `components/expenses-filter.tsx` - Advanced filter panel

### API Routes
- `app/api/orders/[id]/installments/route.ts` - Installment management
- `app/api/installments/[id]/route.ts` - Individual installment operations

### Enhanced Files
- `app/api/expenses/route.ts` - Added filtering support
- `app/(dashboard)/expenses/page.tsx` - Integrated filter UI
- `app/(dashboard)/orders/[id]/page.tsx` - Added installments widget

---

## 🔧 API Enhancements

### Enhanced `/api/expenses` Endpoint

**New Query Parameters:**
```typescript
customerName?: string    // Filter by customer name
category?: string        // Filter by expense category
minAmount?: string       // Minimum amount filter
maxAmount?: string       // Maximum amount filter
paymentMode?: string     // Filter by payment mode
```

**Example Usage:**
```bash
# Filter by customer
GET /api/expenses?customerName=John&from=2026-01-01&to=2026-01-31

# Filter by expense category and amount
GET /api/expenses?category=RENT&minAmount=10000&maxAmount=50000

# Combined filters
GET /api/expenses?category=SALARIES&paymentMode=BANK_TRANSFER&minAmount=20000
```

---

## 🎨 UI/UX Improvements

### Expenses Page (`/expenses`)
- **Filter button** with active count badge
- **Side sheet** filter panel (non-blocking UI)
- **Real-time filtering** - instant results
- **Filter chips** showing active filters (coming in v0.9.0)

### Order Detail Page (`/orders/[id]`)
- **Installment widget** showing all payment schedules
- **Payment recording dialog** with form validation
- **Status badges** with color coding:
  - 🟢 Green: Paid
  - 🟡 Yellow: Partial
  - 🔴 Red: Overdue
  - 🔵 Blue: Pending
  - ⚫ Gray: Cancelled
- **Progress indicators** for total paid vs. due
- **Overdue alerts** in red

---

## 💼 Business Value

### For Shop Owners:
1. **Better Cash Flow Management**
   - Track which customers owe money
   - See upcoming installment due dates
   - Identify overdue payments instantly

2. **Reduced Manual Tracking**
   - No need for Excel sheets
   - Automated status updates
   - Built-in payment history

3. **Improved Customer Relations**
   - Flexible payment options
   - Professional installment plans
   - Clear payment tracking

### For Accountants:
1. **Advanced Filtering**
   - Quick access to specific transactions
   - Category-wise expense analysis
   - Amount range filtering for audits

2. **Better Reporting**
   - Filter by date range + category
   - Export capabilities (coming in v0.9.0)
   - GST-compliant records

---

## 📝 Usage Examples

### Creating an Installment Plan

**Scenario:** Customer orders garments worth ₹50,000. Paid ₹20,000 advance. Balance ₹30,000.

**Steps:**
1. Navigate to order detail page
2. Scroll to "Payment Installments" section
3. System shows balance amount: ₹30,000
4. Create installment plan:
   - Number of installments: 3
   - Frequency: Monthly
   - First installment: ₹10,000 (due today)
   - Remaining 2 installments: ₹10,000 each (auto-calculated)

**Result:**
- Installment #1: ₹10,000 due today
- Installment #2: ₹10,000 due in 1 month
- Installment #3: ₹10,000 due in 2 months

### Recording a Payment

**Scenario:** Customer pays second installment.

**Steps:**
1. Click "Record Payment" for installment #2
2. Enter payment details:
   - Amount: ₹10,000
   - Payment Mode: UPI
   - Transaction Ref: TXN123456789
3. Click "Record Payment"

**Result:**
- Installment #2 status: PAID
- Paid amount: ₹10,000
- Total paid progress updated

### Using Advanced Filters

**Scenario:** Find all RENT expenses paid via Bank Transfer between ₹15,000-₹25,000.

**Steps:**
1. Go to Expenses page
2. Click "Filters" button
3. Set filters:
   - Category: RENT
   - Payment Mode: BANK_TRANSFER
   - Min Amount: 15000
   - Max Amount: 25000
4. Click "Apply Filters"

**Result:**
- Only matching expenses displayed
- Filter badge shows "4" (4 active filters)
- Results update in real-time

---

## 🔐 Security & Validation

### Installment Creation:
- ✅ Validates order exists
- ✅ Prevents duplicate plans
- ✅ Validates installment count (1-12)
- ✅ Ensures amounts are positive
- ✅ Calculates due dates accurately

### Payment Recording:
- ✅ Prevents negative amounts
- ✅ Validates payment mode
- ✅ Auto-updates status based on amount
- ✅ Prevents deletion of paid installments
- ✅ Transaction reference optional

### Filtering:
- ✅ SQL injection prevention (Prisma ORM)
- ✅ Case-insensitive search
- ✅ Amount range validation
- ✅ Enum validation for categories/modes

---

## 🧪 Testing

### Database Migration:
```bash
✅ PaymentInstallment table created
✅ InstallmentStatus enum created
✅ Order.installments relation established
✅ Indexes created for performance
```

### API Endpoints:
```bash
✅ GET /api/orders/[id]/installments - Returns installments with summary
✅ POST /api/orders/[id]/installments - Creates plan successfully
✅ PATCH /api/installments/[id] - Records payment correctly
✅ DELETE /api/installments/[id] - Deletes unpaid installments only
✅ Filtering queries work with all combinations
```

### UI Components:
```bash
✅ Installment widget renders correctly
✅ Status badges display appropriate colors
✅ Payment dialog validates input
✅ Filter panel opens/closes smoothly
✅ Active filter count updates
✅ Reset button clears all filters
```

---

## 📈 Performance Optimizations

### Database:
- Indexed `dueDate` for fast date queries
- Indexed `status` for filtering
- Indexed `paidDate` for reporting
- Indexed `orderId` for lookups

### API:
- Efficient Prisma queries with `include`
- Pagination support (ready for large datasets)
- Case-insensitive filtering with `mode: 'insensitive'`

---

## 🚀 Future Enhancements (v0.9.0+)

### Installment Features:
- [ ] Automatic payment reminders (email/SMS)
- [ ] Bulk installment plan creation
- [ ] Installment plan templates
- [ ] Late payment penalties
- [ ] Early payment discounts

### Filtering Features:
- [ ] Save filter presets
- [ ] Filter by multiple customers
- [ ] Date range shortcuts
- [ ] Export filtered results to Excel/PDF

### Reporting:
- [ ] Installment aging report
- [ ] Collection efficiency metrics
- [ ] Overdue payment dashboard
- [ ] Payment trend analysis

---

## 🐛 Bug Fixes

- Fixed filter persistence across page navigation
- Resolved status badge color inconsistencies
- Fixed amount calculation rounding errors
- Corrected date timezone handling

---

## 📖 Documentation Updates

### New Documentation:
- `CHANGELOG-v0.8.0.md` (this file)
- API endpoint documentation for installments
- Filter usage guide

### Updated Documentation:
- `docs/Implementation Guide for Expenses and Accounting - Phases 1-3.md`
- `README.md` - Added installment tracking section
- `CLAUDE.md` - Updated with v0.8.0 features

---

## 🔄 Breaking Changes

**None.** This release is fully backward compatible with v0.7.0.

---

## 📦 Dependencies

No new dependencies added in this release.

---

## 🎯 Version Highlights

**v0.8.0** completes Phase 2 of the advanced accounting module, adding critical payment tracking and filtering capabilities.

**Key Metrics:**
- 1 new database model (PaymentInstallment)
- 1 new enum (InstallmentStatus)
- 4 new API endpoints
- 2 new UI components
- 5 query parameters for filtering
- 100% backward compatibility

---

## 📞 Support & Resources

### Documentation:
- Main implementation guide: `/docs/Implementation Guide for Expenses and Accounting - Phases 1-3.md`
- Changelog: `/CHANGELOG-v0.8.0.md`
- API docs: See inline comments in route files

### Common Issues:
1. **Installments not showing?**
   - Check if `balanceAmount > 0` on the order
   - Verify order ID is correct

2. **Filters not working?**
   - Check browser console for errors
   - Ensure API is running
   - Verify filter values are valid

3. **Status not updating?**
   - Refresh the page
   - Check network tab for API errors
   - Verify payment amount is correct

---

## 🔧 Upgrade Instructions

```bash
# Pull latest changes
git pull origin master

# Install dependencies (if any)
pnpm install

# Push database schema changes
pnpm prisma db push

# Regenerate Prisma client
pnpm prisma generate

# Build for production
pnpm build

# Restart PM2 service
pm2 restart hamees-inventory

# Verify deployment
pm2 logs hamees-inventory
```

---

## 🎊 What's Next?

**Phase 3 (v0.9.0)** will include:
- Excel/PDF export functionality
- GSTR-1 and GSTR-3B report generation
- Financial statements (P&L, Cash Flow, Balance Sheet)
- Bank reconciliation
- TDS tracking

Stay tuned for more powerful features!

---

**End of Changelog**
