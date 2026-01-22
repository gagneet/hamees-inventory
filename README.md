# 🧵 Tailor Inventory Management System

**Version 0.8.2** | Production Ready | [Live Demo](https://hamees.gagneet.com)

A comprehensive inventory and order management system built specifically for tailor shops. Manage fabric inventory, track orders, monitor stock levels, and streamline your tailoring business operations.

## 🎉 What's New in v0.8.2

This version introduces GST integration, a more interactive dashboard, and production-ready seed data. For a detailed list of changes, see the [CHANGELOG.md](CHANGELOG.md).

- **GST Integration**: Automatic 12% GST calculation (6% CGST + 6% SGST) on all orders.
- **Interactive Dashboard**: KPI cards are now clickable, showing detailed breakdowns.
- **Enhanced Analytics**: Improved charts and customer retention analysis.
- **Production Seed Data**: Includes 192 historical orders for realistic testing.
- **Bug Fixes**: Addressed issues with GST display, expense tracking, and more.

## ✨ Features

### Core Modules
- **Inventory Management**: Track cloth and accessory inventory with barcode/SKU support, automatic stock alerts, and supplier tracking.
- **Order Management**: Create and manage orders with GST compliance, automatic material calculation, and detailed status tracking.
- **Customer Management**: Maintain customer profiles with detailed measurements and order history.
- **Dashboard & Analytics**: Access real-time KPIs, interactive charts, and detailed reports on revenue, expenses, and customer retention.

### Authentication & Security
- **NextAuth.js v5**: Secure, role-based authentication (Owner, Admin, Inventory Manager, Sales Manager, Tailor, Viewer).
- **Protected Routes**: Middleware-based route protection and secure JWT session management.

## 🚀 Quick Start (5-Minute Setup)

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- pnpm

### 1. Database Setup
First, create a PostgreSQL user and database.
```bash
# Create a user (if it doesn't exist)
sudo -u postgres psql -c "CREATE ROLE gagneet WITH LOGIN SUPERUSER CREATEDB CREATEROLE;"

# Create the database (if it doesn't exist)
sudo -u postgres psql -c "CREATE DATABASE tailor_inventory OWNER gagneet;"
```

### 2. Environment Configuration
Copy the example environment file and update the `DATABASE_URL` with your credentials.
```bash
cp .env.example .env
```
Your `DATABASE_URL` should look like this:
`DATABASE_URL="postgresql://gagneet:<YOUR_PASSWORD>@localhost:5432/tailor_inventory?schema=public"`

### 3. Installation and Setup
Install dependencies, push the database schema, and seed the database with sample data.
```bash
pnpm install
pnpm db:push
pnpm db:seed
```

### 4. Run the Development Server
Start the development server, which will be available at **http://localhost:3009**.
```bash
pnpm dev
```

### Default Login
- **Email:** `owner@hameesattire.com`
- **Password:** `admin123`

## 🌐 Production Deployment

For detailed instructions on deploying the application to a production environment, please refer to the [SETUP.md](SETUP.md) guide. This document covers:
- Dedicated database user setup
- Environment configuration for production
- Application deployment with PM2
- Nginx reverse proxy setup
- SSL certificate installation with Certbot

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
