# Changelog - Version 0.7.0

**Release Date:** January 15, 2026
**Feature:** Advanced Accounting Module with GST Compliance (Phase 1)

---

## 🎉 Major Features

### Advanced Date Range Picker with Financial Year Support
- **Date range selection** with multiple preset options
- **Financial Year (FY) support** - April 1 to March 31 (Indian FY)
- **Quick presets:**
  - This Month / Last Month
  - This Quarter / Last Quarter
  - This Financial Year / Last Financial Year
  - Year-to-Date (YTD)
  - Custom Range (up to 7 years back for audit compliance)
- **Responsive calendar UI** with dual-month view

### GST (Goods and Services Tax) Implementation
- **Full GST compliance** for Indian taxation
- **Automatic GST calculation:**
  - CGST (Central GST) for intra-state transactions
  - SGST (State GST) for intra-state transactions
  - IGST (Integrated GST) for inter-state transactions
- **GST tracking on:**
  - Customer orders (output GST)
  - Purchase orders (input tax credit)
  - Business expenses
- **Net GST liability calculation** (Output GST - Input Tax Credit)

### Expense Management System
- **Comprehensive expense tracking** with 12 categories:
  - Rent
  - Utilities (Electricity, Water, Internet)
  - Salaries
  - Transport & Logistics
  - Marketing & Advertising
  - Maintenance & Repairs
  - Office Supplies
  - Professional Fees (CA, Lawyer)
  - Insurance
  - Depreciation
  - Bank Charges
  - Miscellaneous
- **Payment mode tracking:**
  - Cash, UPI, Card, Bank Transfer, Cheque, Net Banking
- **Vendor management** with GSTIN validation
- **TDS (Tax Deducted at Source) tracking**
- **Recurring expense support**

### Enhanced Expenses Page
- **Advanced date range filtering** (replaces month-by-month navigation)
- **GST Summary Card** showing:
  - Output GST collected from customers
  - Input Tax Credit paid on purchases/expenses
  - Net GST liability (payable or refundable)
- **Three-section layout:**
  1. Delivered Orders (revenue)
  2. Inventory Purchases (cost of goods)
  3. Business Expenses (operating costs)
- **Updated KPI cards:**
  - Total Revenue
  - Total Expenses
  - Net Profit/Loss
  - Net GST Liability

---

## 📊 Database Schema Changes

### New Models

#### `Expense` Model
- Complete expense tracking with GST support
- Category-based organization
- Payment mode and vendor details
- TDS calculation and tracking
- Recurring expense support
- Attachment storage (JSON)

#### `BusinessSettings` Model
- Company GST information (GSTIN)
- Default GST rates configuration
- Financial year settings
- Invoice numbering configuration

### Enhanced Models

#### `Order` Model (Sales)
- `subTotal` - Amount before GST
- `gstRate` - GST percentage (5%, 12%, 18%, 28%)
- `cgst` - Central GST amount
- `sgst` - State GST amount
- `igst` - Integrated GST amount
- `gstAmount` - Total GST charged
- `taxableAmount` - Base for GST calculation
- `invoiceNumber` - Unique GST invoice number
- `invoiceDate` - GST invoice date
- `placeOfSupply` - State for GST compliance

#### `Customer` Model
- `gstin` - Customer's GST number (for B2B)
- `customerType` - B2B or B2C classification

#### `PurchaseOrder` Model (Purchases)
- All GST fields (cgst, sgst, igst, etc.)
- `isInputTaxCredit` - ITC eligibility flag
- `itcClaimed` - ITC claim status
- `supplierInvoiceNumber` - Supplier's invoice reference
- `supplierInvoiceDate` - Supplier's invoice date

### New Enums

#### `ExpenseCategory`
```typescript
RENT | UTILITIES | SALARIES | TRANSPORT | MARKETING |
MAINTENANCE | OFFICE_SUPPLIES | PROFESSIONAL_FEES |
INSURANCE | DEPRECIATION | BANK_CHARGES | MISCELLANEOUS
```

#### `PaymentMode`
```typescript
CASH | UPI | CARD | BANK_TRANSFER | CHEQUE | NET_BANKING
```

---

## 🛠️ New Files & Components

### Components
- `components/date-range-picker.tsx` - Advanced date range picker with FY support

### Utilities
- `lib/gst-utils.ts` - GST calculation functions:
  - `calculateSalesGST()` - Calculate GST for customer orders
  - `calculatePurchaseGST()` - Calculate GST for supplier purchases
  - `calculateExpenseGST()` - Calculate GST for business expenses
  - `calculateGSTLiability()` - Net GST liability calculation
  - `getTextileGSTRate()` - Textile-specific GST rates
  - `validateGSTIN()` - GSTIN format validation
  - `reverseGSTCalculation()` - Calculate GST from total amount

### Documentation
- `docs/Implementation Guide for Expenses and Accounting - Phases 1-3.md` - Complete implementation roadmap

---

## 🔧 API Changes

### Enhanced `/api/expenses` Endpoint

**New Query Parameters:**
- `from` - Start date (ISO 8601 format)
- `to` - End date (ISO 8601 format)
- `month` - Month in "MMM yyyy" format (backward compatible)

**Enhanced Response:**
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
    expenseCount: number       // NEW
    gstCollected: number       // NEW
    gstPaid: number           // NEW
    netGST: number            // NEW
  },
  orders: [...],      // Enhanced with GST fields
  purchases: [...],
  expenses: [...]     // NEW - Business expenses array
}
```

---

## 🎨 UI/UX Improvements

### Expenses Page (`/expenses`)
- **Modern date range picker** replaces month navigation arrows
- **Financial Year support** for Indian accounting periods
- **GST Summary Card** with visual breakdown
- **4-column KPI layout** (was 3-column)
- **New Expenses table** with category badges
- **Color-coded GST indicators:**
  - Green: Output GST (collected)
  - Orange: Input GST (paid)
  - Purple: Net GST payable
  - Blue: Net GST refundable

---

## 🔍 GST Calculation Logic

### Sales GST (on Orders)
```typescript
// Intra-state (same state as business)
CGST = subTotal × (gstRate ÷ 200)
SGST = subTotal × (gstRate ÷ 200)
Total GST = CGST + SGST

// Inter-state (different state)
IGST = subTotal × (gstRate ÷ 100)
Total GST = IGST
```

### Textile GST Rates (India)
| Item | Price Condition | GST Rate |
|------|----------------|----------|
| Cotton fabric | ≤ ₹1,000/meter | 5% |
| Cotton fabric | > ₹1,000/meter | 12% |
| Silk fabric (handloom) | Any | 5% |
| Readymade garments | Any | 12% |
| Tailoring services | Any | 12% |
| Accessories | Any | 12% |

### Net GST Liability
```typescript
Net GST = Output GST - Input Tax Credit

Where:
- Output GST = GST collected from customers
- Input Tax Credit = GST paid on purchases & expenses (eligible items only)

If positive: Amount payable to government
If negative: Amount refundable from government
```

---

## 📝 Migration Notes

### Database Migration
```bash
# Schema changes applied via:
pnpm prisma db push --accept-data-loss

# Prisma client regenerated:
pnpm prisma generate
```

### Backward Compatibility
- Old `/api/expenses?month=Jan%202026` format still supported
- Existing orders have default GST values (0)
- No data loss during migration

---

## 🧪 Testing

### TypeScript Validation
✅ All type errors resolved
✅ Strict type checking passed

### Production Build
✅ Build successful
✅ No compilation errors
✅ All routes compiled

---

## 🚀 Next Steps (Phase 2 - Planned for v0.8.0)

### GST Compliance
- [ ] GSTR-1 report generation (monthly outward supplies)
- [ ] GSTR-3B report generation (monthly return summary)
- [ ] Export to JSON for GST portal upload

### Export Functionality
- [ ] Excel export with detailed breakdowns
- [ ] PDF export for printing
- [ ] CSV export for Tally/QuickBooks integration

### Advanced Features
- [ ] Payment installment tracking
- [ ] Overdue payment alerts
- [ ] Payment reminders (automated)
- [ ] Multi-filter system (customer, supplier, amount range)

### Purchase Order GST
- [ ] Add GST fields to purchase order creation
- [ ] Track ITC (Input Tax Credit) eligibility
- [ ] Mark ITC as claimed/unclaimed

---

## 📖 Documentation

### User Guide
- See `/docs/Implementation Guide for Expenses and Accounting - Phases 1-3.md` for complete feature documentation
- GST utility functions documented in `lib/gst-utils.ts`
- Date range picker component documented in `components/date-range-picker.tsx`

### Developer Notes
- Schema changes documented in implementation guide
- API contract changes backward compatible
- All new utilities have JSDoc comments

---

## 🐛 Bug Fixes

- Fixed TypeScript type conflicts in date range picker
- Resolved duplicate interface definitions
- Fixed missing imports in expenses page

---

## 🎯 Version Highlights

**v0.7.0** represents a major milestone in transforming the tailor shop inventory system into a comprehensive accounting platform with full GST compliance for Indian businesses.

**Key Metrics:**
- 3 new database models
- 15 new database fields across 3 models
- 2 new enums
- 1 new component (date range picker)
- 1 new utility library (GST calculations)
- 50+ pages of documentation

---

## 📞 Support

For issues or questions about GST implementation:
1. Review the implementation guide
2. Check GST utility functions documentation
3. Refer to Indian GST guidelines at https://www.gst.gov.in/

---

**Upgrade Command:**
```bash
# Pull latest changes
git pull

# Install dependencies (if any new)
pnpm install

# Push schema changes
pnpm prisma db push

# Regenerate Prisma client
pnpm prisma generate

# Build for production
pnpm build

# Restart application
pm2 restart hamees-inventory
```

---

**End of Changelog**
