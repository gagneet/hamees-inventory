# 🚀 START HERE - Complete Setup Guide

## Current Status: ✅ Phase 1 Complete, Ready for Database Setup

---

## 📋 Quick Setup (5 Minutes)

Follow these steps in order:

### Step 1: Create PostgreSQL User (30 seconds)

Open your terminal and run:

```bash
sudo -u postgres psql -c "CREATE ROLE gagneet WITH LOGIN SUPERUSER CREATEDB CREATEROLE;"
```

**Expected Output:** `CREATE ROLE`

If you see "already exists", that's fine! Run this instead:
```bash
sudo -u postgres psql -c "ALTER ROLE gagneet WITH LOGIN SUPERUSER CREATEDB CREATEROLE;"
```

---

### Step 2: Create Database (30 seconds)

```bash
sudo -u postgres psql -c "CREATE DATABASE tailor_inventory OWNER gagneet;"
```

**Expected Output:** `CREATE DATABASE`

If you see "already exists", that's fine! Continue to next step.

---

### Step 3: Verify Connection (10 seconds)

```bash
psql -d tailor_inventory -c "SELECT 'Connection successful!' as status;"
```

**Expected Output:**
```
       status
--------------------
 Connection successful!
(1 row)
```

If this works, you're good to go! ✅

---

### Step 4: Push Database Schema (1 minute)

```bash
pnpm db:push
```

**Expected Output:**
```
✔ Generated Prisma Client
Your database is now in sync with your Prisma schema.
```

This creates all 16 tables in your database.

---

### Step 5: Seed Sample Data (30 seconds)

```bash
pnpm db:seed
```

**Expected Output:**
```
🌱 Starting seed...
🗑️  Clearing existing data...
👤 Creating users...
✅ Users created
🏢 Creating suppliers...
✅ Suppliers created
📦 Creating cloth inventory...
✅ Cloth inventory created
🔘 Creating accessories...
✅ Accessories created
👔 Creating garment patterns...
✅ Garment patterns created
👥 Creating customers...
✅ Customers and measurements created
📝 Creating sample orders...
✅ Sample orders created
⚙️  Creating settings...
✅ Settings created
🔔 Creating alerts...
✅ Alerts created
🎉 Seed completed successfully!

📊 Summary:
  Users: 2
  Suppliers: 2
  Cloth Items: 4
  Accessories: 3
  Garment Patterns: 4
  Customers: 2
  Orders: 1
  Settings: 7

🔑 Login Credentials:
  Email: owner@tailorshop.com
  Password: admin123
```

---

### Step 6: View Your Data (Open in Browser)

```bash
pnpm db:studio
```

**This opens:** http://localhost:5555

You can now:
- ✅ Browse all tables
- ✅ View seeded data
- ✅ Edit records
- ✅ Verify everything is working

**Keep this running in a separate terminal!**

---

### Step 7: Start Development Server

Open a **new terminal** and run:

```bash
pnpm dev
```

**This opens:** http://localhost:3000

You should see the Next.js welcome page (we'll build the UI next).

---

## ✅ Verification Checklist

After completing all steps, verify:

- [ ] Step 1: PostgreSQL user created
- [ ] Step 2: Database created
- [ ] Step 3: Connection test passed
- [ ] Step 4: Schema pushed successfully
- [ ] Step 5: Data seeded (saw success message)
- [ ] Step 6: Prisma Studio opens at localhost:5555
- [ ] Step 7: Dev server runs at localhost:3000

---

## 🎯 What You Have Now

### Database (PostgreSQL)
- ✅ 16 tables created
- ✅ Sample data loaded
- ✅ Relationships configured
- ✅ Indexes set up

### Sample Data Loaded
- **2 Users:** Owner and Inventory Manager
- **2 Suppliers:** ABC Fabrics, XYZ Textiles
- **4 Cloth Types:** Cotton Blue, Silk Red, Cotton White, Linen Beige
- **3 Accessories:** Buttons, Thread, Zipper
- **4 Garment Patterns:** Shirt, Trouser, Suit, Sherwani
- **2 Customers:** With measurements
- **1 Sample Order:** With stock movement tracking
- **1 Alert:** Low stock notification

### Login Credentials
```
Email: owner@tailorshop.com
Password: admin123
```

---

## 🔍 Explore Your Data

### In Prisma Studio (localhost:5555)

Click through these tables to see your data:

1. **User** - See 2 users (owner, inventory manager)
2. **ClothInventory** - See 4 cloth items with stock levels
3. **Customer** - See 2 customers
4. **Order** - See 1 sample order
5. **GarmentPattern** - See 4 patterns (Shirt, Trouser, Suit, Sherwani)
6. **StockMovement** - See stock audit trail
7. **Alert** - See low stock alert
8. **Settings** - See shop configuration

### Try These Queries

Open a terminal and try:

```bash
# Count all inventory items
psql -d tailor_inventory -c "SELECT COUNT(*) FROM \"ClothInventory\";"

# View all users
psql -d tailor_inventory -c "SELECT email, name, role FROM \"User\";"

# Check stock levels
psql -d tailor_inventory -c "SELECT name, \"currentStock\", reserved, minimum FROM \"ClothInventory\";"

# View orders
psql -d tailor_inventory -c "SELECT \"orderNumber\", status FROM \"Order\";"
```

---

## 🐛 Troubleshooting

### Problem: "role gagneet does not exist"
**Solution:** Run Step 1 again

### Problem: "database already exists"
**Solution:** That's fine! Continue to next step

### Problem: "peer authentication failed"
**Solution:** See POSTGRES-SETUP-STEPS.md for pg_hba.conf fix

### Problem: Prisma can't connect
**Solution:** Check your .env file has the correct DATABASE_URL

### Problem: "table already exists"
**Solution:** Run `pnpm db:reset` to clear and start fresh

---

## 📚 Next Steps After Setup

Once everything above is working:

### Immediate Next Step
Continue to **Phase 2: Authentication**
- Set up NextAuth.js
- Create login page
- Protect routes
- Test login with seeded credentials

### Or Explore What's Built
- Read PROGRESS.md to see the roadmap
- Check README.md for feature overview
- Browse SETUP.md for advanced setup

---

## 💡 Pro Tips

1. **Keep Prisma Studio open** while developing - it's great for debugging
2. **Save the login credentials** - you'll need them after we build auth
3. **Bookmark localhost:5555** - you'll use it often
4. **Check the seed data** - it's realistic and shows how the system works

---

## 🎉 Success Indicators

You'll know everything is working when:

✅ `pnpm db:studio` shows all 16 tables with data
✅ `pnpm dev` starts without errors
✅ You can browse seed data in Prisma Studio
✅ No connection errors in terminal
✅ PostgreSQL queries return data

---

## 🆘 Need Help?

If anything doesn't work:
1. Check the error message carefully
2. Look in POSTGRES-SETUP-STEPS.md
3. Try `pnpm db:reset` and start over
4. Check that PostgreSQL is running: `systemctl status postgresql`

---

**Once you complete these 7 steps, come back and we'll continue with Phase 2: Authentication!** 🚀

Last updated: January 11, 2026
