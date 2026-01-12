# Tailor Inventory System - Setup Guide

## 🎯 Project Status

✅ Phase 1 Complete: Project initialization, database schema, and seed data
⏳ Phase 2 In Progress: Authentication and API routes

## 📋 Prerequisites

- Node.js v18+ (currently using v20.19.6) ✅
- PostgreSQL 16+ (currently installed) ✅
- pnpm (installed) ✅
- Git (installed) ✅

## 🚀 Quick Start

### 1. Configure PostgreSQL

Your PostgreSQL needs to be configured with a user that can create databases. Run these commands:

```bash
# Switch to postgres user
sudo -i -u postgres

# Create a PostgreSQL user for your system account
createuser -s gagneet

# Set a password for the user (or create without password for local development)
psql -c "ALTER USER gagneet WITH PASSWORD 'your_password';"

# Exit postgres user
exit
```

Then update your `.env` file with the correct credentials:

```env
DATABASE_URL="postgresql://gagneet:your_password@localhost:5432/tailor_inventory?schema=public"
```

### 2. Create Database and Run Migrations

```bash
# Create the database
createdb tailor_inventory

# Run Prisma migrations
pnpm db:push

# Or use migrate for production-ready migrations
pnpm db:migrate

# Seed the database with sample data
pnpm db:seed
```

### 3. Verify Database Setup

```bash
# Open Prisma Studio to view your data
pnpm db:studio
```

This will open a web interface at http://localhost:5555 where you can:
- View all seeded data
- Verify users, inventory, orders, etc.
- Make manual adjustments if needed

### 4. Start Development Server

```bash
pnpm dev
```

Visit http://localhost:3000

## 🔑 Default Login Credentials

After seeding:

- **Email:** owner@tailorshop.com
- **Password:** admin123

Also available:
- **Email:** inventory@tailorshop.com
- **Password:** admin123

## 📦 Seeded Data

The database will be populated with:

- **2 Users** (Owner, Inventory Manager)
- **2 Suppliers** (ABC Fabrics, XYZ Textiles)
- **4 Cloth Items** (Cotton Blue, Silk Red, Cotton White, Linen Beige)
- **3 Accessories** (Buttons, Thread, Zipper)
- **4 Garment Patterns** (Shirt, Trouser, Suit, Sherwani)
- **2 Customers** (with measurements)
- **1 Sample Order** (with stock movements)
- **1 Alert** (low stock notification)
- **7 Settings** (shop details, thresholds)

## 🛠️ Available Scripts

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint

pnpm db:push      # Push schema changes (development)
pnpm db:migrate   # Create and run migrations (production)
pnpm db:seed      # Seed database with sample data
pnpm db:studio    # Open Prisma Studio
pnpm db:reset     # Reset database and reseed
```

## 📁 Project Structure

```
tailor-inventory/
├── app/
│   ├── (dashboard)/        # Protected dashboard routes
│   │   ├── dashboard/      # Main dashboard
│   │   ├── inventory/      # Inventory management
│   │   ├── orders/         # Order management
│   │   ├── alerts/         # Alerts & notifications
│   │   ├── settings/       # Settings
│   │   ├── customers/      # Customer management
│   │   └── suppliers/      # Supplier management
│   ├── api/                # API routes
│   │   ├── auth/           # NextAuth API
│   │   ├── inventory/      # Inventory endpoints
│   │   ├── orders/         # Order endpoints
│   │   ├── alerts/         # Alert endpoints
│   │   └── cron/           # Background jobs
│   ├── globals.css         # Global styles with design system
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Landing page
├── components/
│   ├── ui/                 # Base UI components (shadcn)
│   ├── layout/             # Layout components
│   ├── inventory/          # Inventory components
│   ├── orders/             # Order components
│   ├── alerts/             # Alert components
│   ├── customers/          # Customer components
│   └── suppliers/          # Supplier components
├── lib/
│   ├── db.ts               # Prisma client
│   ├── utils.ts            # Utility functions
│   └── auth.ts             # NextAuth configuration (to be created)
├── prisma/
│   ├── schema.prisma       # Database schema
│   ├── seed.ts             # Seed script
│   └── migrations/         # Database migrations
├── types/
│   └── next-auth.d.ts      # TypeScript type extensions
├── .env                    # Environment variables (not committed)
├── .env.example            # Environment variables template
└── package.json            # Dependencies and scripts
```

## 🎨 Design System

The project uses a custom design system with these colors:

- **Primary:** Indigo (#1E3A8A) - Main brand color
- **Secondary:** Burgundy (#991B1B) - Accent color
- **Accent:** Gold (#F59E0B) - Highlights
- **Success:** Green (#10B981) - Success states
- **Warning:** Orange (#F59E0B) - Warnings
- **Error:** Red (#EF4444) - Errors
- **Info:** Blue (#3B82F6) - Information

## 🔐 Security Notes

1. **Change default passwords** before deploying to production
2. **Update NEXTAUTH_SECRET** in `.env` with a secure random string:
   ```bash
   openssl rand -base64 32
   ```
3. **Never commit `.env`** file to version control
4. **Use environment variables** for all sensitive data

## 🐛 Troubleshooting

### PostgreSQL Connection Issues

If you get "role does not exist" errors:

```bash
# Create PostgreSQL role matching your username
sudo -u postgres createuser -s $(whoami)

# Or specify a different user in DATABASE_URL
```

### Prisma Client Not Found

```bash
npx prisma generate
```

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 pnpm dev
```

### Database Migration Issues

```bash
# Reset database and start fresh
pnpm db:reset

# Or manually drop and recreate
dropdb tailor_inventory
createdb tailor_inventory
pnpm db:push
pnpm db:seed
```

## 📚 Next Steps

### Phase 2: Authentication (In Progress)
- [ ] Set up NextAuth.js with credentials provider
- [ ] Create login/logout pages
- [ ] Add middleware for route protection
- [ ] Implement role-based access control

### Phase 3: API Development
- [ ] Inventory CRUD endpoints
- [ ] Order management endpoints
- [ ] Alert system endpoints
- [ ] Customer/Supplier endpoints

### Phase 4: UI Components
- [ ] Install and configure shadcn/ui
- [ ] Create layout components (Header, BottomNav)
- [ ] Build inventory components
- [ ] Build order components

### Phase 5: Pages & Features
- [ ] Dashboard with real-time stats
- [ ] Inventory management interface
- [ ] Order creation and tracking
- [ ] Alert notifications
- [ ] Settings management

## 📞 Support

If you encounter issues:
1. Check this SETUP.md file
2. Review the error messages carefully
3. Check database connection in `.env`
4. Verify PostgreSQL is running: `pg_isready`
5. Check Prisma Studio for data: `pnpm db:studio`

## 🎉 Success Indicators

You'll know everything is working when:
- ✅ `pnpm dev` starts without errors
- ✅ `pnpm db:studio` shows all seeded data
- ✅ You can login with default credentials
- ✅ Dashboard displays inventory and orders
- ✅ No console errors in browser

---

**Current Status:** Database and seed data ready. Next: Implement authentication.
