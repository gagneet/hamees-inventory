# PostgreSQL Setup Steps

## Quick Setup (Copy and paste these commands)

### Step 1: Create PostgreSQL User Role

```bash
sudo -u postgres psql -c "CREATE ROLE gagneet WITH LOGIN SUPERUSER CREATEDB CREATEROLE;"
```

If you get "role already exists", run:
```bash
sudo -u postgres psql -c "ALTER ROLE gagneet WITH LOGIN SUPERUSER CREATEDB CREATEROLE;"
```

### Step 2: Create Database

```bash
sudo -u postgres psql -c "CREATE DATABASE tailor_inventory OWNER gagneet;"
```

### Step 3: Update .env File

Update your `.env` file with this connection string:

```env
DATABASE_URL="postgresql://gagneet@localhost:5432/tailor_inventory?schema=public"
```

### Step 4: Test Connection

```bash
psql -d tailor_inventory -c "SELECT version();"
```

You should see PostgreSQL version information.

### Step 5: Initialize Database with Prisma

```bash
# Push schema to database
pnpm db:push

# Seed with sample data
pnpm db:seed
```

### Step 6: View Data in Prisma Studio

```bash
pnpm db:studio
```

This will open http://localhost:5555 where you can browse all your data!

---

## Alternative: Manual Setup via psql

If you prefer, you can do it interactively:

```bash
# Enter PostgreSQL as postgres user
sudo -u postgres psql

# Then run these commands:
CREATE ROLE gagneet WITH LOGIN SUPERUSER CREATEDB CREATEROLE;
CREATE DATABASE tailor_inventory OWNER gagneet;
\q
```

---

## Troubleshooting

### "peer authentication failed"
Edit `/etc/postgresql/16/main/pg_hba.conf` and change:
```
local   all             postgres                                peer
```
to:
```
local   all             postgres                                trust
```

Then restart: `sudo systemctl restart postgresql`

### "database already exists"
That's fine! Just continue with the next steps.

### "role already exists"
That's fine! Use the ALTER command instead of CREATE.

---

## Verification Checklist

After setup, verify everything works:

- [ ] Can connect to PostgreSQL: `psql -d tailor_inventory -c "SELECT 1;"`
- [ ] Prisma can connect: `pnpm db:push` (should succeed)
- [ ] Database is seeded: `pnpm db:seed` (should create data)
- [ ] Can view data: `pnpm db:studio` (opens web interface)
- [ ] App can connect: `pnpm dev` (should start without database errors)

---

**Once these steps are complete, your database will be fully set up and ready for development!**
