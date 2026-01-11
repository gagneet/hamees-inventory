# 🧵 Tailor Inventory Management System

A comprehensive inventory and order management system built specifically for tailor shops. Manage fabric inventory, track orders, monitor stock levels, and streamline your tailoring business operations.

## ✨ Features

### Inventory Management
- **Cloth Inventory**: Track fabrics by type, color, pattern, quality
- **Accessories**: Manage buttons, threads, zippers, and other supplies
- **Stock Levels**: Real-time available stock (current - reserved)
- **Auto Alerts**: Low stock and critical stock notifications
- **Supplier Tracking**: Link inventory to suppliers with pricing history

### Order Management
- **Order Creation**: Create orders with customer measurements
- **Garment Patterns**: Pre-configured patterns (Shirt, Trouser, Suit, Sherwani)
- **Material Calculation**: Automatic fabric calculation based on pattern and body type
- **Stock Reservation**: Auto-reserve fabric when order is created
- **Status Tracking**: NEW → CUTTING → STITCHING → FINISHING → READY → DELIVERED
- **Payment Tracking**: Advance payment and balance management

### Customer Management
- **Customer Profiles**: Contact info, address, order history
- **Measurements**: Store detailed measurements by garment type
- **Measurement History**: Track measurement changes over time

### Alerts & Notifications
- **Low Stock Alerts**: Automatic alerts when stock < minimum
- **Critical Alerts**: High-priority warnings for very low stock
- **Order Delays**: Track overdue orders

### Reporting & Analytics
- **Dashboard**: Real-time statistics and metrics
- **Stock Reports**: Inventory value, movement history
- **Order Analytics**: Sales trends, popular items
- **Supplier Performance**: Delivery times, pricing trends

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- pnpm (recommended)
- nginx (for production)
- PM2 (for production process management)

### Development Setup

1. **Clone or navigate to the project**
   ```bash
   cd tailor-inventory
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up PostgreSQL**

   See [SETUP.md](SETUP.md) for detailed PostgreSQL configuration.

   Quick setup:
   ```bash
   # Create PostgreSQL user (if needed)
   sudo -u postgres createuser -s $(whoami)

   # Create database
   createdb tailor_inventory
   ```

4. **Configure environment variables**
   ```bash
   # Copy example env file
   cp .env.example .env

   # Update DATABASE_URL in .env with your credentials
   ```

5. **Initialize database**
   ```bash
   # Push schema to database
   pnpm db:push

   # Seed with sample data
   pnpm db:seed
   ```

6. **Start development server**
   ```bash
   pnpm dev
   ```

7. **Open in browser**

   Visit http://localhost:3009 (development) or https://hamees.gagneet.com (production)

### Default Login

After seeding, use these credentials:

- **Email:** owner@tailorshop.com
- **Password:** admin123

## 🌐 Production Deployment

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
pnpm db:push          # Push schema changes to database
pnpm db:migrate       # Create and run migrations
pnpm db:seed          # Seed database with sample data
pnpm db:studio        # Open Prisma Studio (http://localhost:5555)
pnpm db:reset         # Reset database and reseed

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
│   │   ├── dashboard/      # Main dashboard
│   │   ├── inventory/      # Inventory management
│   │   ├── orders/         # Order management
│   │   ├── alerts/         # Alerts page
│   │   ├── customers/      # Customer management
│   │   └── suppliers/      # Supplier management
│   ├── api/                # API routes
│   │   ├── auth/           # Authentication
│   │   ├── inventory/      # Inventory endpoints
│   │   ├── orders/         # Order endpoints
│   │   └── alerts/         # Alert endpoints
│   ├── globals.css         # Global styles & design system
│   └── layout.tsx          # Root layout
├── components/             # React components
│   ├── ui/                 # Base UI components
│   ├── layout/             # Layout components
│   ├── inventory/          # Inventory components
│   └── orders/             # Order components
├── lib/                    # Utility libraries
│   ├── db.ts               # Prisma client
│   ├── auth.ts             # Auth configuration
│   └── utils.ts            # Helper functions
├── prisma/                 # Database files
│   ├── schema.prisma       # Database schema
│   ├── seed.ts             # Seed script
│   └── migrations/         # Migration files
├── types/                  # TypeScript type definitions
├── .env                    # Environment variables (not committed)
└── .env.example            # Environment template
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

### Phase 2: Authentication (In Progress)
- [ ] NextAuth setup
- [ ] Login/Logout
- [ ] Route protection
- [ ] Role-based access

### Phase 3: API Development
- [ ] Inventory CRUD
- [ ] Order management
- [ ] Alert system
- [ ] Customer/Supplier APIs

### Phase 4: UI Components
- [ ] shadcn/ui setup
- [ ] Layout components
- [ ] Feature components
- [ ] Forms

### Phase 5: Pages & Features
- [ ] Dashboard
- [ ] Inventory management
- [ ] Order tracking
- [ ] Alerts
- [ ] Reports

### Phase 6: Advanced Features
- [ ] Measurements system
- [ ] Barcode/QR codes
- [ ] Advanced reports
- [ ] Mobile app

## 🤝 Contributing

This is a custom project built for tailor shops. Contributions and suggestions are welcome!

## 📝 License

Private project - All rights reserved

## 🆘 Support

For setup issues, see [SETUP.md](SETUP.md) or check the troubleshooting section.

## 🎯 Goals

1. **Simplify Inventory**: Never run out of fabric or over-order
2. **Streamline Orders**: From measurement to delivery
3. **Reduce Waste**: Track material usage and wastage
4. **Improve Efficiency**: Automated calculations and alerts
5. **Better Insights**: Reports and analytics for business decisions

---

**Built with ❤️ for the tailoring community**

**Version:** 0.1.0
**Status:** Phase 1 Complete, Phase 2 In Progress
**Last Updated:** January 11, 2026
