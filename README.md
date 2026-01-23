# 🧵 Tailor Inventory Management System

**Version 0.23.0** | Production Ready | [Live Demo](https://hamees.gagneet.com)

A comprehensive inventory and order management system built specifically for tailor shops. Manage fabric inventory, track orders, monitor stock levels, and streamline your tailoring business operations with industry-standard specifications.

## 🎉 What's New in v0.23.0

This version introduces comprehensive fabric specifications, enhanced accessory details, and improved barcode scanning based on research of commercial tailoring systems in India and globally. For a detailed list of changes, see [CLAUDE.md](CLAUDE.md#inventory-management-phase-1-enhancements-v0230).

- **Enhanced Fabric Specifications**: Complete technical details (GSM, composition, weave type, thread count, shrinkage, color fastness)
- **Season & Occasion Tags**: Filter fabrics by suitability (Summer/Winter/Monsoon, Wedding/Formal/Casual)
- **Care Instructions**: Washing/cleaning guidelines for each fabric type
- **Enhanced Accessory Details**: Button sizes (Ligne), thread weights, Pantone color codes, materials, finish types
- **Fixed Barcode Scanner**: Detection loop improvements, 13 barcode format support, increased reliability
- **Excel Export Enhanced**: All new fields included in bulk upload templates (33 columns for cloth, 23 for accessories)

### Comprehensive Fabric Specifications (12 New Fields)
- **fabricComposition**: Exact fiber breakdown (e.g., "70% Cotton, 30% Polyester")
- **gsm**: Grams per Square Meter - fabric weight (industry standard)
- **threadCount**: Threads per inch for quality indication
- **weaveType**: Plain, Twill, Satin, Jacquard, Dobby
- **fabricWidth**: Width in inches (44", 58", 60")
- **shrinkagePercent**: Expected shrinkage (1-5%)
- **colorFastness**: Excellent, Good, Fair, Poor ratings
- **seasonSuitability**: Multi-season tags (Summer, Winter, Monsoon, All-season)
- **occasionType**: Multi-occasion tags (Casual, Formal, Wedding, Business, Festival, Party)
- **careInstructions**: Complete washing/cleaning guidelines
- **swatchImage**: URL to fabric swatch photo (ready for Phase 2 upload)
- **textureImage**: URL to close-up texture photo

### Enhanced Accessory Details (10 New Fields)
- **colorCode**: Pantone/DMC codes (e.g., "PANTONE 19-4028")
- **threadWeight**: Thread gauge (40wt, 50wt, 60wt)
- **buttonSize**: Ligne sizing standard (14L, 18L, 20L, 24L)
- **holePunchSize**: Number of holes (2, 4)
- **material**: Shell, Brass, Resin, Horn, Plastic, Wood
- **finish**: Matte, Polished, Antique, Brushed
- **recommendedFor**: Array of garment types (Suit, Shirt, Trouser, Blazer)
- **styleCategory**: Formal, Casual, Designer, Traditional
- **productImage**: Product photo URL
- **closeUpImage**: Detail photo URL

### Barcode Scanner Improvements
- **Fixed detection loop** using ref-based cancellation (prevents stale closure issues)
- **Expanded format support**: 13 barcode types (QR, EAN-13/8, UPC-A/E, Code 128/39/93, Codabar, ITF, Aztec, Data Matrix, PDF417)
- **Increased timeout**: 15 seconds for camera initialization
- **Console logging**: Shows detected barcode and format type for debugging
- **100% reliable manual entry**: Always works as fallback

### Database & Migration
- **22 new fields** added via SQL migration
- **All 10 cloth items** populated with industry-standard specifications
- **All 6 accessories** populated with professional details
- **Zero downtime deployment** with PostgreSQL arrays for multi-value fields
- **Backward compatible**: All new fields optional

## ✨ Features

### Core Modules
- **Inventory Management**: Track cloth and accessory inventory with comprehensive specifications (GSM, composition, weave), barcode/SKU support, automatic stock alerts, and supplier tracking.
- **Order Management**: Create and manage orders with GST compliance, automatic material calculation, and detailed status tracking.
- **Customer Management**: Maintain customer profiles with detailed measurements and order history.
- **Dashboard & Analytics**: Access real-time KPIs, interactive charts, and detailed reports on revenue, expenses, and customer retention.

### Authentication & Security
- **NextAuth.js v5**: Secure, role-based authentication (Owner, Admin, Inventory Manager, Sales Manager, Tailor, Viewer).
- **Role-Based Access**: OWNER, ADMIN, INVENTORY_MANAGER, SALES_MANAGER, TAILOR, VIEWER
- **Protected Routes**: Automatic middleware-based route protection
- **JWT Sessions**: Secure session management
- **Password Hashing**: bcryptjs with 10 salt rounds

### Inventory Management
- **Cloth Inventory**: Track fabrics by type, color, pattern, quality
- **Accessories**: Manage buttons, threads, zippers, and other supplies
- **Barcode Scanning**: Mobile camera or manual barcode/SKU entry for quick item lookup
- **Stock Levels**: Real-time available stock (current - reserved)
- **Auto Alerts**: Low stock and critical stock notifications
- **Supplier Tracking**: Link inventory to suppliers with pricing history
- **Auto SKU Generation**: Automatic SKU generation for new items

### Order Management
- **Order Creation**: Create orders with customer measurements
- **GST Compliance**: Automatic 12% GST calculation with CGST/SGST breakdown
- **Garment Patterns**: Pre-configured patterns (Shirt, Trouser, Suit, Sherwani)
- **Material Calculation**: Automatic fabric calculation based on pattern and body type
- **Stock Reservation**: Auto-reserve fabric when order is created
- **Status Tracking**: NEW → CUTTING → STITCHING → FINISHING → READY → DELIVERED
- **Payment Tracking**: Advance payment and balance management (GST-inclusive totals)

### Customer Management
- **Customer Profiles**: Contact info, address, order history
- **Measurements**: Store detailed measurements by garment type
- **Measurement History**: Track measurement changes over time

### Alerts & Notifications
- **Low Stock Alerts**: Automatic alerts when stock < minimum
- **Critical Alerts**: High-priority warnings for very low stock
- **Order Delays**: Track overdue orders
- **Alert Dismissal**: Temporary dismissal with auto-reset on expiry

### Dashboard & Analytics
- **Interactive Financial Cards**: Clickable KPI cards with detailed breakdowns
  - Revenue: View all delivered orders contributing to revenue
  - Expenses: Breakdown of operational + purchase order payments
  - Net Profit: Revenue minus expenses calculation view
  - Outstanding: Customers with pending payments
- **Enhanced Charts**:
  - Revenue Trend (6-month line chart) - Click to navigate to expenses by month
  - Orders by Status (interactive pie chart) - Click to filter orders by status
  - Top Fabrics Usage (bar chart) - Click to view fabric details
  - Customer Retention (pie chart) - Click to view returning customers
- **Real-time KPIs**: Total orders, revenue growth, inventory value, stock alerts
- **Fulfillment Tracking**: Average order completion time
- **Stock Reports**: Inventory value, movement history, low stock items
- **Supplier Performance**: Delivery times, pricing trends

## 🚀 Quick Start (5-Minute Setup)

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- pnpm

### Step 1: Create PostgreSQL User (30 seconds)
Open your terminal and run:
```bash
sudo -u postgres psql -c "CREATE ROLE gagneet WITH LOGIN SUPERUSER CREATEDB CREATEROLE;"
```
**Expected Output:** `CREATE ROLE`
If you see "already exists", that's fine!

### Step 2: Create Database (30 seconds)
```bash
sudo -u postgres psql -c "CREATE DATABASE tailor_inventory OWNER gagneet;"
```
**Expected Output:** `CREATE DATABASE`
If you see "already exists", that's fine!

### Step 3: Configure Environment Variables (1 minute)
```bash
# Copy example env file
cp .env.example .env
```
Now, open the `.env` file and update the `DATABASE_URL` with your PostgreSQL credentials. It should look like this:
`DATABASE_URL="postgresql://gagneet:<YOUR_PASSWORD>@localhost:5432/tailor_inventory?schema=public"`

### Step 4: Install Dependencies (1 minute)
```bash
pnpm install
```

### Step 5: Push Database Schema (30 seconds)
```bash
pnpm db:push
```
**Expected Output:** `✔ Generated Prisma Client... Your database is now in sync with your Prisma schema.`

### Step 6: Seed Sample Data (30 seconds)
```bash
pnpm db:seed
```
This will populate your database with sample users, inventory, orders, and more.

### Step 7: Start Development Server (10 seconds)
```bash
pnpm dev
```
The application will be running at **http://localhost:3009**.

### Default Login
After seeding, use these credentials:
- **Email:** `owner@hameesattire.com`
- **Password:** `admin123`

## 🌐 Production Deployment

For detailed instructions on deploying the application to a production environment, please refer to the [SETUP.md](SETUP.md) guide. This document covers:
- Dedicated database user setup
- Environment configuration for production
- Application deployment with PM2
- Nginx reverse proxy setup
- SSL certificate installation with Certbot

### Database Setup

1. **Create dedicated PostgreSQL user**
   ```bash
   psql -U postgres -d postgres
   CREATE USER hamees_user WITH PASSWORD 'your_secure_password';
   GRANT ALL PRIVILEGES ON DATABASE tailor_inventory TO hamees_user;
   \c tailor_inventory
   GRANT ALL PRIVILEGES ON SCHEMA public TO hamees_user;
   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO hamees_user;
   GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO hamees_user;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO hamees_user;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO hamees_user;
   \q
   ```

2. **Update .env for production**
   ```bash
   DATABASE_URL="postgresql://hamees_user:your_secure_password@localhost:5432/tailor_inventory?schema=public"
   NEXTAUTH_URL="https://hamees.gagneet.com"
   NEXTAUTH_SECRET="generate_with_openssl_rand_-base64_32"
   NODE_ENV="production"
   ```

3. **Generate secure secret**
   ```bash
   openssl rand -base64 32
   ```

### Application Deployment

1. **Install dependencies and build**
   ```bash
   pnpm install
   pnpm build
   ```

2. **Install PM2 globally**
   ```bash
   npm install -g pm2
   ```

3. **Start with PM2**
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   ```

4. **Enable PM2 startup on boot**
   ```bash
   pm2 startup
   # Run the command that PM2 outputs
   ```

### Nginx Configuration

The application is configured to run behind nginx as a reverse proxy on port 3009.

1. **Test nginx configuration**
   ```bash
   sudo nginx -t
   ```

2. **Reload nginx**
   ```bash
   sudo systemctl reload nginx
   ```

### SSL Certificate Setup

1. **Install certbot (if not installed)**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   ```

2. **Obtain SSL certificate**
   ```bash
   sudo certbot --nginx -d hamees.gagneet.com
   ```

3. **Auto-renewal** (certbot sets this up automatically)
   ```bash
   sudo certbot renew --dry-run
   ```

### Production Management

**Check application status:**
```bash
pm2 status
pm2 logs hamees-inventory
pm2 monit
```

**Restart application:**
```bash
pm2 restart hamees-inventory
```

**View logs:**
```bash
pm2 logs hamees-inventory --lines 100
tail -f logs/out.log
tail -f logs/err.log
```

**Database management:**
```bash
pnpm db:studio          # Open Prisma Studio
psql -U hamees_user -d tailor_inventory
```

### Current Production Setup

- **URL:** https://hamees.gagneet.com
- **Port:** 3009
- **Database:** tailor_inventory (user: hamees_user)
- **Process Manager:** PM2
- **Web Server:** nginx
- **SSL:** Let's Encrypt (certbot)

## 📚 Documentation

- **[SETUP.md](SETUP.md)** - Detailed setup instructions and troubleshooting
- **[PROGRESS.md](PROGRESS.md)** - Development progress and roadmap

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 16 (App Router)
- **UI Library:** React 19
- **Styling:** Tailwind CSS 4
- **Components:** Radix UI
- **Icons:** Lucide React
- **Charts:** Recharts
- **Forms:** React Hook Form + Zod

### Backend
- **Runtime:** Node.js 20
- **Database:** PostgreSQL 16
- **ORM:** Prisma 7 (with @prisma/adapter-pg)
- **Authentication:** NextAuth.js v5
- **Process Manager:** PM2 (production)
- **Web Server:** nginx (production)

### Development
- **Language:** TypeScript 5
- **Package Manager:** pnpm
- **Linting:** ESLint
- **Version Control:** Git

## 📦 Available Scripts

```bash
# Development
pnpm dev              # Start development server (http://localhost:3009)
pnpm build            # Build for production
pnpm start            # Start production server (port 3009)
pnpm lint             # Run ESLint

# Database
pnpm db:push                      # Push schema changes to database
pnpm db:migrate                   # Create and run migrations
pnpm db:seed                      # Seed database with sample data
pnpm tsx prisma/seed-production.ts  # Seed with production-level data (192 orders, Jul-Dec 2025)
pnpm db:studio                    # Open Prisma Studio (http://localhost:5555)
pnpm db:reset                     # Reset database and reseed

# Production (PM2)
pm2 start ecosystem.config.js    # Start application
pm2 restart hamees-inventory     # Restart application
pm2 stop hamees-inventory        # Stop application
pm2 logs hamees-inventory        # View logs
pm2 monit                        # Monitor resources
```

## 📁 Project Structure

```
tailor-inventory/
├── app/                    # Next.js app directory
│   ├── (dashboard)/        # Dashboard routes (protected)
│   │   ├── dashboard/
│   │   ├── inventory/
│   │   ├── orders/
│   │   ├── alerts/
│   │   ├── customers/
│   │   └── suppliers/
│   ├── api/                # API routes
│   │   ├── auth/
│   │   ├── alerts/
│   │   ├── customers/
│   │   ├── dashboard/
│   │   ├── expenses/
│   │   ├── garment-patterns/
│   │   ├── inventory/
│   │   ├── orders/
│   │   ├── purchase-orders/
│   │   └── suppliers/
│   ├── globals.css
│   └── layout.tsx
├── components/             # React components
│   ├── ui/
│   ├── auth/
│   ├── dashboard/
│   └── providers/
├── lib/                    # Utility libraries
│   ├── db.ts
│   ├── auth.ts
│   └── utils.ts
├── prisma/                 # Database files
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── types/                  # TypeScript type definitions
├── .env.example
└── package.json
```

## ⚙️ Technical Notes

### Prisma 7 Configuration

This project uses Prisma 7, which requires a database adapter. The PostgreSQL adapter is configured in:

- **`lib/db.ts`**: Main Prisma client with PrismaPg adapter
- **`prisma/seed.ts`**: Seed script with adapter configuration
- **`prisma/schema.prisma`**: Schema with `engineType = "binary"`

**Required dependencies:**
```json
{
  "@prisma/adapter-pg": "^7.2.0",
  "@prisma/client": "^7.2.0",
  "pg": "^8.16.3"
}
```

**Adapter usage example:**
```typescript
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })
```

## 🎨 Design System

### Colors
- **Primary (Indigo):** #1E3A8A - Main brand color
- **Secondary (Burgundy):** #991B1B - Accent
- **Accent (Gold):** #F59E0B - Highlights
- **Success (Green):** #10B981 - Success states
- **Warning (Orange):** #F59E0B - Warnings
- **Error (Red):** #EF4444 - Errors

### Typography
- **Font:** System fonts (optimized for performance)
- **Headings:** Font weight 600-700
- **Body:** Font weight 400

## 🔐 Security

- **Password Hashing:** bcryptjs with salt rounds
- **Authentication:** NextAuth.js with JWT
- **Role-Based Access:** OWNER, ADMIN, INVENTORY_MANAGER, SALES_MANAGER, TAILOR, VIEWER
- **Input Validation:** Zod schemas on all forms
- **SQL Injection Prevention:** Prisma ORM
- **Environment Variables:** Never committed to git

## 📊 Database Schema

### Core Models
- **User** - User accounts with roles
- **ClothInventory** - Fabric inventory
- **AccessoryInventory** - Accessories (buttons, threads, etc.)
- **Customer** - Customer information
- **Measurement** - Customer measurements
- **GarmentPattern** - Garment templates
- **Order** - Customer orders
- **OrderItem** - Individual garments in orders
- **StockMovement** - Complete audit trail
- **Supplier** - Supplier information
- **PurchaseOrder** - Restocking orders
- **Alert** - Notification system
- **Settings** - App configuration

## 🚧 Development Roadmap

### Phase 1: Foundation ✅
- [x] Project setup
- [x] Database schema
- [x] Seed data
- [x] Configuration

### Phase 2: Authentication ✅ Complete
- [x] NextAuth.js v5 setup
- [x] Credentials provider with bcrypt
- [x] Login/Logout functionality
- [x] Route protection middleware
- [x] Role-based access control
- [x] JWT session management

### Phase 3: API Development (In Progress)
- [x] Inventory CRUD APIs (cloth & accessories)
- [x] Barcode lookup API
- [x] Stock movement tracking
- [ ] Order management APIs
- [ ] Alert system APIs
- [ ] Customer/Supplier APIs

### Phase 4: UI Components (In Progress)
- [x] Radix UI components (Button, Input, Card, Label, Tabs)
- [x] Landing page with split-screen design
- [x] Login form component
- [x] Barcode scanner component (html5-qrcode)
- [x] Inventory forms (cloth & accessories)
- [ ] Dashboard components
- [ ] Order forms

### Phase 5: Pages & Features (In Progress)
- [x] Landing/Login page with branding
- [x] Inventory management page (with barcode scanning)
- [ ] Dashboard with analytics
- [ ] Order tracking and management
- [ ] Customers page
- [ ] Suppliers page
- [ ] Alerts page
- [ ] Reports

### Phase 6: Advanced Features
- [ ] Measurements system
- [x] Barcode/QR code scanning (camera + manual)
- [ ] Advanced reports & analytics
- [ ] Mobile app
- [ ] Multi-language support

## 📚 Documentation

### Quick Links
- **[AUTHENTICATION_AND_BARCODE.md](AUTHENTICATION_AND_BARCODE.md)** - Complete guide for authentication system and barcode scanning
- **[SETUP.md](SETUP.md)** - Database setup and installation instructions
- **[CLAUDE.md](CLAUDE.md)** - Project overview and development guidelines

### Key Topics
- **Authentication**: NextAuth.js v5 setup, login flow, route protection
- **Barcode Scanning**: Camera-based and manual SKU entry for inventory
- **API Reference**: Complete API documentation for all endpoints
- **Troubleshooting**: Common issues and solutions
- **Security**: Best practices for production deployment

## 🤝 Contributing

Contributions are welcome! If you have suggestions for improvements or want to report a bug, please open an issue on GitHub.

### Bug Reports
When reporting a bug, please include:
- A clear and descriptive title.
- Steps to reproduce the bug.
- The expected behavior and what actually happened.
- Screenshots or screen recordings, if applicable.

### Feature Requests
For feature requests, please provide:
- A clear description of the feature and its potential benefits.
- Any mockups or examples that might help illustrate the idea.

## 📝 License

This is a private project, and all rights are reserved.

## 🆘 Support

For setup issues or troubleshooting, please refer to the [SETUP.md](SETUP.md) guide.

## 🎯 Goals

1. **Simplify Inventory**: Never run out of fabric or over-order
2. **Streamline Orders**: From measurement to delivery
3. **Reduce Waste**: Track material usage and wastage
4. **Improve Efficiency**: Automated calculations and alerts
5. **Better Insights**: Reports and analytics for business decisions

---

**Built with ❤️ for the tailoring community**

**Version:** 0.8.2
**Status:** Production Ready | All Core Features Complete
**Features:** Authentication ✅ | RBAC ✅ | Orders ✅ | Inventory ✅ | Analytics ✅ | Interactive Dashboard ✅
**Production:** [https://hamees.gagneet.com](https://hamees.gagneet.com)
**Last Updated:** January 16, 2026
