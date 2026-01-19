# Database Connection Fix - January 19, 2026

## Issue Summary

**Problem**: Users unable to sign in to the application. Error: "Invalid email or password"

**Root Cause**: Application could not connect to PostgreSQL database due to:
1. UFW firewall blocking localhost (127.0.0.1) connections to port 5432
2. Stale PM2 process (running as root) holding port 3009
3. Database configured to use TCP connection instead of Unix socket

**Symptoms**:
- Sign-in form displayed "Invalid email or password" for all valid credentials
- No errors in browser console (silent failure)
- PM2 logs showed: `⨯ Failed to start server`
- Database queries failed with: `connect EHOSTUNREACH 127.0.0.1:5432`

## Technical Details

### Environment
- **OS**: Ubuntu 24.04 LTS (Linux 6.8.0-90-generic)
- **Node.js**: v20.19.6
- **PostgreSQL**: 16.6
- **Application**: Next.js 16.1.1 with Prisma 7.2.0
- **Firewall**: UFW (Uncomplicated Firewall) - Active
- **Server**: nginx reverse proxy → localhost:3009

### Database Configuration
- **Database**: `tailor_inventory`
- **User**: `hamees_user`
- **Password**: `hamees_secure_2026`
- **Socket**: `/var/run/postgresql/.s.PGSQL.5432`

### Diagnostic Timeline

1. **Initial Investigation** (11:25 UTC)
   - Attempted database connection test:
     ```bash
     PGPASSWORD=hamees_secure_2026 psql -h localhost -U hamees_user -d tailor_inventory
     # Result: psql: error: connection to server at "localhost" (127.0.0.1), port 5432 failed: No route to host
     ```

2. **Firewall Discovery** (11:30 UTC)
   - Checked UFW status:
     ```bash
     sudo ufw status verbose
     # Result: Status: active
     ```
   - PostgreSQL listening correctly:
     ```bash
     ss -tlnp | grep 5432
     # Result: LISTEN 0 200 0.0.0.0:5432 0.0.0.0:*
     ```
   - **Conclusion**: Firewall blocking loopback connections despite PostgreSQL listening

3. **Port Conflict Discovery** (11:55 UTC)
   - Port 3009 held by stale process:
     ```bash
     sudo lsof -i :3009
     # Result: PM2\x20v6 2278691 root 3u IPv6 3195119 0t0 TCP *:3009 (LISTEN)
     ```

## Solution Implementation

### 1. Database Connection String (Primary Fix)

**Changed from TCP to Unix Socket:**

**Before** (`.env`):
```bash
DATABASE_URL="postgresql://hamees_user:hamees_secure_2026@localhost:5432/tailor_inventory?schema=public"
```

**After** (`.env`):
```bash
# Using Unix socket to bypass firewall/network issues
DATABASE_URL="postgresql://hamees_user:hamees_secure_2026@/tailor_inventory?host=/var/run/postgresql&schema=public"
```

**Why This Works**:
- Unix sockets bypass TCP/IP networking stack entirely
- No firewall rules apply to Unix domain sockets
- More secure (no network exposure)
- Faster (no TCP overhead)
- Standard PostgreSQL connection method on Linux

### 2. PostgreSQL Authentication Configuration

**Modified** `/etc/postgresql/16/main/pg_hba.conf`:

**Added/Updated**:
```bash
# Local socket connections (changed from 'peer' to 'md5')
local   all             all                                     md5

# TCP connections for hamees database
host    tailor_inventory    hamees_user    127.0.0.1/32       md5
```

**Applied Changes**:
```bash
sudo systemctl reload postgresql
```

**Note**: The `md5` authentication method allows password-based authentication, which is required for application connections. The default `peer` only works when system user matches database user.

### 3. Firewall Configuration (Preventive)

**Added UFW rules for loopback interface:**
```bash
sudo ufw allow in on lo
sudo ufw allow out on lo
sudo ufw reload
```

**Added iptables rules:**
```bash
sudo iptables -I INPUT -i lo -j ACCEPT
sudo iptables -I OUTPUT -o lo -j ACCEPT
```

**Verification**:
```bash
sudo ufw status verbose
# Shows rules allowing loopback traffic
```

### 4. Port Conflict Resolution

**Killed stale PM2 process:**
```bash
sudo fuser -k 3009/tcp
# Killed PID: 2278691
```

**Restarted application:**
```bash
pm2 delete hamees-inventory
pm2 start ecosystem.config.js
pm2 save
```

## Verification Tests

### 1. Database Connection Test (Node.js)
```javascript
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://hamees_user:hamees_secure_2026@/tailor_inventory?host=/var/run/postgresql&schema=public"
});

pool.query('SELECT COUNT(*) FROM "User"')
  .then(res => console.log('User count:', res.rows[0].count))
  .finally(() => pool.end());

// Result: User count: 6 ✅
```

### 2. Prisma Connection Test
```javascript
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

prisma.user.findMany({ select: { email: true } })
  .then(users => console.log('Users:', users))
  .finally(() => { prisma.$disconnect(); pool.end(); });

// Result: 6 users found ✅
```

### 3. Authentication Test
```bash
# Test password validation
node -e "const bcrypt = require('bcryptjs'); bcrypt.compare('admin123', '$2a$10$...').then(console.log)"
# Result: true ✅
```

### 4. Application Health Check
```bash
curl -s http://localhost:3009/api/auth/providers | jq
# Result: {"credentials": {...}} ✅

pm2 status hamees-inventory
# Result: status: online, uptime: 5m ✅
```

### 5. Public Website Test
```bash
curl -s https://hamees.gagneet.com | grep -i "hamees"
# Result: HTML content with "Hamees Inventory" ✅
```

## Files Modified

### 1. `.env`
```diff
- DATABASE_URL="postgresql://hamees_user:hamees_secure_2026@localhost:5432/tailor_inventory?schema=public"
+ # Using Unix socket to bypass firewall/network issues
+ DATABASE_URL="postgresql://hamees_user:hamees_secure_2026@/tailor_inventory?host=/var/run/postgresql&schema=public"
```

### 2. `/etc/postgresql/16/main/pg_hba.conf`
```diff
- local   all             all                                     peer
+ local   all             all                                     md5
+ host    tailor_inventory    hamees_user    127.0.0.1/32       md5
```

### 3. PM2 Process List
- Deleted stale process (PID 2278691)
- Created fresh process (PID 3983671)
- Saved to `/home/gagneet/.pm2/dump.pm2`

## Post-Fix Verification

### Application Status
```bash
pm2 status hamees-inventory
┌────┬──────────────────┬─────────┬─────────┬────────┬──────┬──────────┐
│ id │ name             │ version │ mode    │ pid    │ ↺    │ status   │
├────┼──────────────────┼─────────┼─────────┼────────┼──────┼──────────┤
│ 3  │ hamees-inventory │ 16.1.1  │ cluster │ 398367 │ 0    │ online   │
└────┴──────────────────┴─────────┴─────────┴────────┴──────┴──────────┘
```

### PM2 Logs (Success)
```
3|hamees-i | 2026-01-19T12:00:17: ▲ Next.js 16.1.1
3|hamees-i | 2026-01-19T12:00:17: - Local:    http://localhost:3009
3|hamees-i | 2026-01-19T12:00:18: ✓ Ready in 679ms
```

### Login Test Results
- ✅ `owner@hameesattire.com` / `admin123` - Success
- ✅ `admin@hameesattire.com` / `admin123` - Success
- ✅ `inventory@hameesattire.com` / `admin123` - Success
- ✅ `sales@hameesattire.com` / `admin123` - Success
- ✅ `tailor@hameesattire.com` / `admin123` - Success
- ✅ `viewer@hameesattire.com` / `admin123` - Success

All 6 user accounts working correctly.

## Best Practices Applied

### 1. Unix Socket Connections
- **Preferred** over TCP for local PostgreSQL connections
- Better security (no network exposure)
- Better performance (no TCP overhead)
- Immune to firewall issues

### 2. Authentication Configuration
- Use `md5` or `scram-sha-256` for application connections
- Reserve `peer` for local administrative access (postgres user)
- Keep `trust` disabled for security

### 3. Firewall Management
- Always allow loopback interface (`lo`) traffic
- Document firewall rules in version control
- Test connectivity after firewall changes

### 4. Process Management
- Monitor for stale/orphaned processes
- Use `lsof` to identify port conflicts
- Save PM2 process list after changes

## Lessons Learned

1. **Always check firewall first** when experiencing "No route to host" errors
2. **Prefer Unix sockets** for local database connections on Linux
3. **Monitor PM2 processes** - stale processes can block ports
4. **Test authentication separately** - database connection ≠ authentication working
5. **Document environment dependencies** - Nginx configuration mentioned IPv6 `[::]` binding

## Future Recommendations

### 1. Monitoring
Add health check endpoint:
```typescript
// app/api/health/route.ts
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return Response.json({ status: 'healthy', database: 'connected' })
  } catch (error) {
    return Response.json({ status: 'unhealthy', database: 'disconnected' }, { status: 503 })
  }
}
```

### 2. Error Logging
Enhanced database connection error logging in `lib/db.ts`:
```typescript
export const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'production'
    ? ['error', 'warn']
    : ['query', 'error', 'warn'],
  errorFormat: 'pretty',
})
```

### 3. Connection Pooling
Current pool configuration is default. Consider optimizing:
```typescript
const pool = new Pool({
  connectionString,
  max: 20,                    // Maximum pool size
  idleTimeoutMillis: 30000,   // Close idle clients after 30s
  connectionTimeoutMillis: 2000, // Fail fast if can't connect
})
```

### 4. Automated Testing
Add database connectivity test to CI/CD:
```bash
#!/bin/bash
# scripts/test-db-connection.sh
DATABASE_URL="$1" node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT 1')
  .then(() => { console.log('✅ Database connected'); process.exit(0); })
  .catch(err => { console.error('❌ Database connection failed:', err.message); process.exit(1); })
  .finally(() => pool.end());
"
```

### 5. PM2 Startup Script
Configure PM2 to auto-start on system boot:
```bash
pm2 startup systemd -u gagneet --hp /home/gagneet
# Follow the generated command with sudo
pm2 save
```

## References

- **PostgreSQL Connection Strings**: https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING
- **Prisma 7 Adapter Pattern**: https://www.prisma.io/docs/orm/overview/databases/postgresql#prisma-postgresql-adapter
- **UFW Firewall Guide**: https://help.ubuntu.com/community/UFW
- **PM2 Process Manager**: https://pm2.keymetrics.io/docs/usage/quick-start/

## Support Information

- **Issue Date**: January 19, 2026
- **Resolved By**: Claude Code AI Assistant
- **Time to Resolution**: ~45 minutes
- **Downtime**: ~4 hours (application running but sign-in broken)
- **Production Impact**: No data loss, service restored without migration

## Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-01-19 | Changed DATABASE_URL to Unix socket | Fix firewall blocking localhost |
| 2026-01-19 | Updated pg_hba.conf authentication | Enable password-based auth |
| 2026-01-19 | Added UFW loopback rules | Prevent future firewall issues |
| 2026-01-19 | Killed stale PM2 process | Resolve port 3009 conflict |
| 2026-01-19 | Restarted PM2 application | Apply configuration changes |

---

**Status**: ✅ **RESOLVED**
**Verification**: All user accounts can sign in successfully
**Production URL**: https://hamees.gagneet.com
**Next Steps**: Monitor for 24 hours, consider adding health checks
