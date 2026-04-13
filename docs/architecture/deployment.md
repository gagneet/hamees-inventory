# Deployment

## Infrastructure Overview

```mermaid
flowchart TD
    subgraph Internet
        USER[Browser / Mobile]
        CF_DNS[Cloudflare DNS\nhamees.gagneet.com]
        CF_SSL[Cloudflare SSL Termination\nHTTPS → HTTP]
    end

    subgraph Server["VPS / Server"]
        direction TB
        subgraph Tunnel["Cloudflare Tunnel (cloudflared)"]
            CFD[cloudflared daemon\n/etc/cloudflared/config.yml]
        end

        subgraph Proxy["nginx Reverse Proxy"]
            NGINX[nginx\n/etc/nginx/sites-available/hamees]
        end

        subgraph App["Application (PM2)"]
            PM2[PM2 Process Manager\nhamees-inventory]
            NEXT[Next.js 16 Server\nport 3009]
        end

        subgraph Data["Data Layer"]
            PG[(PostgreSQL 16\ntailor_inventory\nhamees_user)]
            FS[Local Filesystem\n/uploads/designs/]
        end
    end

    USER -->|HTTPS :443| CF_DNS
    CF_DNS --> CF_SSL
    CF_SSL -->|Tunnel| CFD
    CFD -->|HTTP localhost:80| NGINX
    NGINX -->|proxy_pass localhost:3009| PM2
    PM2 --> NEXT
    NEXT -->|Unix socket| PG
    NEXT --> FS
```

## Port Allocation

This server hosts multiple applications. Ports must not conflict:

| Port | Application | Domain |
|------|-------------|--------|
| 80 | nginx (HTTP, Cloudflare → nginx) | All domains |
| 443 | nginx (HTTPS, via Cloudflare) | All domains |
| 3000 | healthapp-nextjs | (internal) |
| 3002 | healthapp | healthapp.gagneet.com |
| 3003 | expenses app | expenses.gagneet.com |
| **3009** | **Hamees Inventory** | **hamees.gagneet.com** |
| 8000 | eastgate-backend | (internal) |
| 8001 | property backend | (internal) |

**When troubleshooting port conflicts:**
```bash
pm2 status                                           # See all PM2 processes
grep -r "proxy_pass" /etc/nginx/sites-enabled/       # Check nginx configs
sudo lsof -i :3009                                   # Who is using port 3009
```

## PM2 Configuration

**File:** `ecosystem.config.js`

```javascript
module.exports = {
  apps: [
    {
      name: 'hamees-inventory',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: '/home/gagneet/hamees',
      exec_mode: 'fork',     // fork mode — required for Next.js 16 compatibility
      instances: 1,          // Single instance (fork mode, not cluster)
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3009,
      },
    },
  ],
}
```

**Critical: `exec_mode: 'fork'`** — PM2 cluster mode causes monitoring issues with Next.js 16. Fork mode is stable. The PM2 status may show "errored" even when the app is working; always verify with `curl localhost:3009`.

### PM2 Commands

```bash
# Start application
pm2 start ecosystem.config.js

# Restart after code changes
pm2 restart hamees-inventory

# View real-time logs
pm2 logs hamees-inventory

# View process status
pm2 status

# Monitor CPU/Memory
pm2 monit

# Save process list for auto-restart on server reboot
pm2 save

# Configure PM2 to start on boot (run once, requires sudo)
pm2 startup
```

## nginx Configuration

**File:** `/etc/nginx/sites-available/hamees`

```nginx
server {
    listen 80;
    server_name hamees.gagneet.com;

    location / {
        proxy_pass http://localhost:3009;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # File uploads (design files)
    client_max_body_size 15M;
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/hamees /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

## Cloudflare Tunnel

**Config file:** `/etc/cloudflared/config.yml` (NOT `~/.cloudflared/config.yml` — the service reads from `/etc/`)

```yaml
tunnel: <tunnel-uuid>
credentials-file: /etc/cloudflared/<tunnel-uuid>.json

ingress:
  - hostname: hamees.gagneet.com
    service: http://localhost:80
  - hostname: healthapp.gagneet.com
    service: http://localhost:3002
  - hostname: expenses.gagneet.com
    service: http://localhost:3003
  # Add other domains here...
  - service: http_status:404    # Catch-all must be LAST
```

**Ordering matters:** Specific hostnames must appear before the catch-all `http_status:404` rule.

```bash
# Restart cloudflared after config changes
sudo systemctl restart cloudflared

# Check tunnel status
sudo systemctl status cloudflared

# Expected: active (running) with 4 registered connections
```

## Database

**Database:** PostgreSQL 16
**Database name:** `tailor_inventory`
**User:** `hamees_user`
**Connection:** Unix socket (not Docker)

```bash
# Connect as hamees_user
PGPASSWORD=<password> psql -h /var/run/postgresql -U hamees_user -d tailor_inventory

# Common verification queries
SELECT COUNT(*) FROM "Order";
SELECT COUNT(*) FROM "ClothInventory";

# Check outstanding balances
SELECT SUM("balanceAmount") FROM "Order" WHERE status <> 'CANCELLED';
```

### DATABASE_URL format (Unix socket):

```
DATABASE_URL="postgresql://hamees_user:PASSWORD@localhost/tailor_inventory?host=/var/run/postgresql"
```

## Environment Variables

**File:** `/home/gagneet/hamees/.env`

```bash
# Required
DATABASE_URL="postgresql://hamees_user:PASSWORD@localhost/tailor_inventory?host=/var/run/postgresql"
NEXTAUTH_URL="https://hamees.gagneet.com"
NEXTAUTH_SECRET="<32-byte base64 string from openssl rand -base64 32>"
NODE_ENV="production"

# Optional — WhatsApp Business API
WHATSAPP_API_KEY="your_api_key"
WHATSAPP_PHONE_NUMBER_ID="your_phone_number_id"
WHATSAPP_API_URL="https://graph.facebook.com/v17.0"
WHATSAPP_BUSINESS_ACCOUNT_ID="your_business_account_id"
```

## Build and Deploy

### Standard Deployment

```bash
cd /home/gagneet/hamees

# 1. Pull latest changes
git pull origin master

# 2. Install dependencies
pnpm install

# 3. Build application
pnpm build
# Expected: ~34 seconds, zero TypeScript errors

# 4. Restart PM2
pm2 restart hamees-inventory

# 5. Verify
curl -I http://localhost:3009
# Expected: HTTP/1.1 200 OK

# 6. Save PM2 state
pm2 save
```

### Database Schema Changes

```bash
# Development — push schema directly (no migration file)
pnpm db:push

# Production — create migration and apply
pnpm db:migrate

# After schema changes, regenerate Prisma client
pnpm exec prisma generate

# Reseed database (development only)
pnpm db:seed
# Or with comprehensive data:
pnpm tsx prisma/seed-complete.ts
```

## Troubleshooting Guide

### Full Stack Test Sequence

```bash
# Test from bottom up — find which layer is failing

# 1. Application
curl -I http://localhost:3009
# Expected: HTTP/1.1 200 OK ✅

# 2. nginx
curl -H "Host: hamees.gagneet.com" http://localhost
# Expected: HTTP/1.1 200 OK ✅

# 3. Cloudflare
curl -I https://hamees.gagneet.com
# Expected: HTTP/2 200 ✅
```

### Site Returns 404

1. **Check PM2:**
   ```bash
   pm2 status
   # hamees-inventory should be "online"
   pm2 logs hamees-inventory --lines 50
   ```

2. **If not running:**
   ```bash
   cd ~/hamees
   pm2 start ecosystem.config.js
   ```

3. **Check Cloudflare config file location:**
   ```bash
   sudo systemctl cat cloudflared | grep ExecStart
   # Tells you which config file is actually used
   sudo cat /etc/cloudflared/config.yml
   # Verify hamees.gagneet.com is in the ingress list
   ```

4. **Restart Cloudflare tunnel:**
   ```bash
   sudo systemctl restart cloudflared
   sudo systemctl status cloudflared
   ```

### PM2 Shows "errored" But App Works

This is a known PM2 monitoring quirk with Next.js 16 in fork mode. The app IS working if `curl localhost:3009` returns 200. The PM2 status column can be misleading. Use `pm2 logs` to see actual application logs.

### Database Connection Failures

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection directly
PGPASSWORD=<password> psql -h /var/run/postgresql -U hamees_user -d tailor_inventory -c "SELECT 1"

# Check .env DATABASE_URL is correct
grep DATABASE_URL /home/gagneet/hamees/.env
```

### Chart Hydration Warnings

If Recharts `ResponsiveContainer` causes SSR/client hydration mismatches, wrap in a fixed-height div:

```tsx
// Correct pattern
<div className="w-full h-[350px]">
  <ResponsiveContainer width="100%" height="100%">
    <PieChart>...</PieChart>
  </ResponsiveContainer>
</div>

// NOT:
<ResponsiveContainer width="100%" height={350}>
  <PieChart>...</PieChart>
</ResponsiveContainer>
```

## Log Locations

```bash
# PM2 logs (real-time)
pm2 logs hamees-inventory

# PM2 log files
~/.pm2/logs/hamees-inventory-out.log   # stdout
~/.pm2/logs/hamees-inventory-error.log # stderr

# nginx access log
sudo tail -f /var/log/nginx/access.log

# nginx error log
sudo tail -f /var/log/nginx/error.log

# Cloudflared log
sudo journalctl -u cloudflared -f
```

## Deployment Checklist

- [ ] PostgreSQL running and accessible
- [ ] `.env` file present with all required variables
- [ ] `pnpm build` completes with zero TypeScript errors
- [ ] PM2 process `hamees-inventory` is online
- [ ] `curl localhost:3009` returns HTTP 200
- [ ] nginx config has `hamees.gagneet.com` in `server_name`
- [ ] `/etc/cloudflared/config.yml` has `hamees.gagneet.com` in ingress
- [ ] cloudflared service is active with 4 registered connections
- [ ] `curl https://hamees.gagneet.com` returns HTTP/2 200
- [ ] `pm2 save` run to persist process list across reboots
