# Gaps, Issues & Technical Debt

**Generated:** April 2026  
**Version:** 0.29.3 (package.json)  
**Codebase:** /home/gagneet/hamees

This document catalogues all identified gaps, outdated dependencies, missing infrastructure, security concerns, and technical debt found during a thorough review of the codebase.

---

## Executive Summary

The system is functionally comprehensive — it covers the full lifecycle of a tailor shop including inventory, orders, payments, GST compliance, WhatsApp notifications, and role-based access. However, several foundational concerns exist: no automated tests, no formal database migration strategy, a missing `middleware.ts` file (critical for route protection), outdated/unstable dependencies, and security gaps including secrets committed to `.env` (not `.env.example`). These issues range from minor technical debt to items that should be addressed before the next production release.

**Priority breakdown:**
- Critical (must fix): 4 items
- High (fix soon): 8 items
- Medium (address in next quarter): 10 items
- Low (nice to have): 8 items

---

## 1. Dependency Issues

### 1.1 `next-auth` — Outdated Beta (HIGH)

**Current:** `5.0.0-beta.30`  
**Latest stable:** `5.0.0` (stable) or `^5.0.0`

The application uses an old beta release of NextAuth v5. Beta.30 is many releases behind the stable v5 release. Beta versions can have breaking changes, security patches, and bugs that are fixed in stable.

**Impact:** Potential security vulnerabilities in the authentication layer; upgrade path may require minor code changes.

**Action:** `pnpm add next-auth@^5.0.0`

---

### 1.2 `@whiskeysockets/baileys` — Release Candidate (HIGH)

**Current:** `7.0.0-rc.9`  
**Status:** Release candidate, unstable

This WhatsApp library is listed as a dependency but is **not imported anywhere in the codebase**. Neither `lib/`, `app/`, nor `components/` reference it. The actual WhatsApp integration in `lib/whatsapp/whatsapp-service.ts` uses the official Meta Graph API via `fetch`.

**Impact:** This package adds unnecessary weight (~50MB+ with dependencies including sharp, ffmpeg bindings, Baileys socket library) to `node_modules` and increases attack surface.

**Action:** Remove from `package.json`. The WhatsApp service does not use it.

```bash
pnpm remove @whiskeysockets/baileys
```

---

### 1.3 `html5-qrcode` — Unmaintained Library (MEDIUM)

**Current:** `2.3.8`  
**Status:** Package is unmaintained (last published 2022)

The improved barcode scanner (`components/barcode-scanner-improved.tsx`) uses the native Barcode Detection API and explicitly mentions replacing html5-qrcode. However, the **old `components/barcode-scanner.tsx` still imports `html5-qrcode`**, and `components/InventoryPageClient.tsx` dynamically imports the old scanner as a fallback comment.

**Impact:** Dead code carrying an unmaintained library with known issues (crashes on mobile, no timeout support).

**Action:** Audit whether the old `components/barcode-scanner.tsx` is still referenced. If not, remove the file and the package.

---

### 1.4 `eslint-config-next` Version Mismatch (LOW)

**Current:** `^16.1.6`  
**Next.js version:** `^16.2.3`

The ESLint config is pinned to a lower minor version than Next.js itself. While unlikely to cause issues, they should track each other.

**Action:** Update `eslint-config-next` to `^16.2.3` to match the Next.js version.

---

### 1.5 `axios` — Unused Dependency (LOW)

**Current:** `^1.15.0`  
**Usage:** Zero imports found in `app/`, `lib/`, or `components/`

The `axios` package is listed as a production dependency but is not used anywhere in the codebase. All HTTP calls use the native `fetch` API.

**Action:** `pnpm remove axios`

---

### 1.6 `pino` — Unused Logger (LOW)

**Current:** `^10.2.0`  
**Usage:** Zero imports found in source files

The `pino` structured logger was added (likely alongside `@whiskeysockets/baileys`) but is not imported anywhere. The codebase uses `console.error`, `console.log`, and `console.warn` in 108+ places in API routes instead.

**Action:** Remove `pino` and `qrcode-terminal` from dependencies, or adopt `pino` consistently as the logging solution.

---

### 1.7 `qrcode-terminal` — Unused Dependency (LOW)

**Current:** `^0.12.0`  
**Usage:** Zero imports found in source files

Added alongside Baileys for WhatsApp QR pairing. Not used.

**Action:** `pnpm remove qrcode-terminal`

---

### 1.8 `@types/qrcode` vs `qrcode` — Separate Type Package (LOW)

`@types/qrcode` is in `dependencies` (not `devDependencies`). Type packages should always be devDependencies.

**Action:** Move `@types/qrcode` to `devDependencies`.

---

## 2. Security Concerns

### 2.1 `.env` Contains Production Secrets (CRITICAL)

The file `/home/gagneet/hamees/.env` contains:
- A real `NEXTAUTH_SECRET` (base64-encoded, 32-byte key)
- Real `WHATSAPP_API_KEY` (long token)
- Real `WHATSAPP_PHONE_NUMBER_ID`
- Real `WHATSAPP_BUSINESS_ACCOUNT_ID`
- Database password in `DATABASE_URL`

While `.env` is listed in `.gitignore`, the `.env.example` file only documents `DATABASE_URL`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL` — it does **not** document the WhatsApp variables. Anyone setting up the project fresh would not know these are required.

**Action:**
1. Rotate `NEXTAUTH_SECRET` — it appears to be static and has never been rotated.
2. Update `.env.example` to document all required environment variables with placeholders.
3. Add `WHATSAPP_API_KEY`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_URL`, and `WHATSAPP_BUSINESS_ACCOUNT_ID` to `.env.example`.

---

### 2.2 Missing `middleware.ts` — Routes Are Not Protected (CRITICAL)

There is **no `middleware.ts`** file at the project root. NextAuth v5 requires a middleware file for route protection. Without it, all routes under `app/(dashboard)/` are accessible without authentication at the server-render level.

Currently, authentication is only checked via `auth()` calls inside individual page components (e.g., `const session = await auth()`). This means:
- Pages may partially render before the auth check
- The redirect to `/` (login) happens inside the component, not at the edge
- There is no centralized protection — each page must handle its own auth check

**Action:** Create `middleware.ts` at the project root:

```typescript
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { nextUrl, auth: session } = req
  const isLoggedIn = !!session?.user

  const isAuthPage = nextUrl.pathname === '/'
  const isDashboardPage = nextUrl.pathname.startsWith('/dashboard') ||
    nextUrl.pathname.startsWith('/orders') ||
    nextUrl.pathname.startsWith('/inventory') ||
    nextUrl.pathname.startsWith('/customers') ||
    nextUrl.pathname.startsWith('/expenses') ||
    nextUrl.pathname.startsWith('/reports') ||
    nextUrl.pathname.startsWith('/alerts') ||
    nextUrl.pathname.startsWith('/purchase-orders') ||
    nextUrl.pathname.startsWith('/suppliers') ||
    nextUrl.pathname.startsWith('/garment-types') ||
    nextUrl.pathname.startsWith('/bulk-upload') ||
    nextUrl.pathname.startsWith('/admin')

  if (!isLoggedIn && isDashboardPage) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon).*)'],
}
```

---

### 2.3 No Rate Limiting on API Endpoints (HIGH)

None of the API routes implement rate limiting. The authentication endpoint (`/api/auth/[...nextauth]`) and all CRUD endpoints are unprotected against:
- Brute-force password attacks on the login form
- API abuse (creating thousands of orders, customers, etc.)
- Denial of service via expensive database queries

**Action:** Implement rate limiting. Options:
- Use `@upstash/ratelimit` with Redis (recommended for production)
- Use `next-rate-limit` package
- Add nginx-level rate limiting for the Cloudflare tunnel entry point

At minimum, rate limit the auth endpoint to 5 requests per minute per IP.

---

### 2.4 No Input Sanitization Beyond Zod Validation (MEDIUM)

Zod validates data types and shapes but does not sanitize HTML or prevent stored XSS. Fields such as:
- `order.notes`
- `customer.address`
- `expense.notes`
- `expense.description`
- `measurement.notes`
- `tailor notes` fields

...accept arbitrary strings that are stored and rendered back in the UI. If any of these are rendered with `dangerouslySetInnerHTML` or injected into the DOM without escaping, XSS is possible.

**Action:** Audit all fields that accept free-form text and ensure they are rendered safely. React's default rendering escapes HTML, so this is only a risk if `dangerouslySetInnerHTML` is used anywhere. Search the codebase for this pattern.

---

### 2.5 `NEXTAUTH_SECRET` Never Rotated (MEDIUM)

The `NEXTAUTH_SECRET` in `.env` appears to be the original generated key that has never been rotated. JWT tokens signed with this secret remain valid until expiry. If the secret is compromised, all sessions must be immediately invalidated by rotating the secret.

**Action:** Implement a rotation schedule (e.g., every 90 days) and document the rotation procedure. After rotation, all users will need to log in again.

---

### 2.6 No CSRF Protection Beyond NextAuth Built-in (MEDIUM)

NextAuth provides CSRF tokens for its own form actions, but custom API endpoints (`PATCH`, `DELETE`, `POST`) do not verify CSRF tokens. They rely solely on session cookies. This is somewhat mitigated by Cloudflare's WAF, but should be explicitly addressed.

**Action:** For state-changing API routes, verify the `Origin` header matches the expected domain, or implement a CSRF token verification layer.

---

### 2.7 Database Password Hardcoded in `prisma.config.ts` (MEDIUM)

`prisma.config.ts` contains a fallback connection string with the production password:

```typescript
url: process.env.DATABASE_URL || "postgresql://hamees_user:hamees_secure_2026@/tailor_inventory..."
```

This means the production database password is committed to source control.

**Action:** Remove the fallback connection string. Make `DATABASE_URL` a required environment variable that throws an error on startup if missing.

---

## 3. Missing Infrastructure

### 3.1 No Automated Tests — Zero Test Coverage (CRITICAL)

No test files exist anywhere in the codebase. There are no:
- Unit tests for business logic (pricing calculations, GST calculations, balance calculations)
- Integration tests for API routes
- End-to-end tests for user workflows
- Component tests

This is particularly risky given the financial nature of the application. Multiple bugs in balance calculations, double-counting of advance payments, and GST calculation errors have been manually fixed (documented in CLAUDE.md). These could have been caught by tests.

**Action (phased):**
1. Add Vitest or Jest for unit/integration tests
2. Add Playwright for E2E tests
3. Start with critical business logic: `lib/permissions.ts`, pricing calculations in `app/api/orders/route.ts`, balance calculations in `app/api/orders/[id]/route.ts`
4. Add CI pipeline (GitHub Actions) to run tests on each push

---

### 3.2 No Database Migration Strategy (HIGH)

The project has **no Prisma migration files**. The `prisma/migrations/` directory contains only raw `.sql` files for manual fixes — not Prisma-managed migrations. Development uses `pnpm db:push` which can silently drop columns or cause data loss.

The gap between development schema and production is tracked manually via ad-hoc SQL scripts, creating significant risk of schema drift.

**Action:**
1. Run `prisma migrate dev --name initial` to create a baseline migration from the current schema
2. Switch to `pnpm db:migrate` for all future schema changes
3. Never use `pnpm db:push` on a database with real data
4. Add `prisma migrate deploy` to the deployment checklist

---

### 3.3 No Health Check Endpoint (HIGH)

No `/api/health` endpoint exists. PM2 uses its own monitoring, but there is no application-level health check that could be used by:
- Uptime monitoring services (UptimeRobot, Better Uptime, etc.)
- Cloudflare health checks
- Load balancers (if added in future)
- Automated deployment verification scripts

**Action:** Create `app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
  } catch {
    return NextResponse.json({ status: 'error', database: 'unreachable' }, { status: 503 })
  }
}
```

---

### 3.4 No Deployment Script (MEDIUM)

While `clean-build.sh` handles the build process, there is no formal deployment script that covers:
- Pre-deployment checks (environment variables set, database reachable)
- Building the application
- Running database migrations
- Restarting PM2
- Post-deployment verification (health check)
- Rollback instructions

**Action:** Create `scripts/deploy.sh` that wraps the full deployment flow.

---

### 3.5 No CI/CD Pipeline (MEDIUM)

No GitHub Actions, GitLab CI, or other CI pipeline exists. Each deployment is manual. This means:
- No automated linting on PRs
- No type checking on commits
- No build verification before deploy

**Action:** Add `.github/workflows/ci.yml` with at minimum: `pnpm lint`, `pnpm build`, and (once added) `pnpm test`.

---

### 3.6 `.env.example` Incomplete (MEDIUM)

The `.env.example` only documents 4 variables. The application requires:
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `WHATSAPP_API_KEY` (optional, for WhatsApp integration)
- `WHATSAPP_PHONE_NUMBER_ID` (optional)
- `WHATSAPP_API_URL` (optional)
- `WHATSAPP_BUSINESS_ACCOUNT_ID` (optional)
- `NODE_ENV`

A new developer or server setup would miss the WhatsApp variables entirely.

---

## 4. Performance Issues

### 4.1 N+1 Query Patterns in API Routes (HIGH)

The file `docs/N+1_QUERY_OPTIMIZATION.md` documents known N+1 query issues. Review of the API routes confirms that some routes still perform per-item database lookups inside loops rather than using Prisma's `include` or batch queries.

Notable locations:
- Dashboard enhanced stats route performs multiple sequential aggregations that could be parallelized
- Order creation performs per-item garment pattern lookups

**Action:** Audit all API routes. Use `Promise.all()` for independent parallel queries. Use Prisma `include` for relations instead of sequential lookups. The existing `docs/N+1_QUERY_OPTIMIZATION.md` has guidance.

---

### 4.2 108 `console.log/error/warn` Calls in API Routes (MEDIUM)

API routes contain 108 `console.*` calls for debugging. In production these:
- Have no structured format (no request ID, no timestamp correlation)
- Cannot be filtered or aggregated by severity
- May log sensitive data (user IDs, order details)
- Add I/O overhead on every request

**Action:** Replace `console.*` calls with `pino` (already installed) or remove debug-only logs. At minimum, wrap them in `if (process.env.NODE_ENV !== 'production')` checks.

---

### 4.3 No Connection Pool Configuration (MEDIUM)

`lib/db.ts` creates a `Pool` with default settings. For PostgreSQL, the default pool size is 10 connections. With a single-instance PM2 setup, this is fine. But there is no explicit configuration for:
- Max pool connections
- Connection timeout
- Idle timeout
- Statement timeout (prevents runaway queries from blocking)

**Action:** Add explicit pool configuration:

```typescript
const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
})
```

---

### 4.4 Large Bundle: `html5-qrcode` Loaded Synchronously (LOW)

`components/barcode-scanner.tsx` imports `html5-qrcode` (~100KB gzipped) at the top level. The comment in `InventoryPageClient.tsx` mentions dynamic import, but the old scanner component itself is statically imported.

**Action:** Once the old scanner is removed (see 1.3), this is resolved automatically.

---

## 5. Code Quality Issues

### 5.1 139 Uses of `any` Type in API Routes (MEDIUM)

Running a search across `app/api/` reveals 139 uses of TypeScript's `any` type. While many are in Prisma transaction callbacks (`tx: any`) or array callbacks (documented as fixed in v0.23.1), the number indicates ongoing type safety gaps.

**Action:** Progressively replace `any` types. For Prisma transactions, use the pattern:
```typescript
type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
```

---

### 5.2 `package.json` Version Stale (LOW)

**Current:** `0.29.3`  
**Actual (per CLAUDE.md):** v0.29.4

The `package.json` version was not updated to match the latest deployed version.

**Action:** `npm version 0.29.4` or manually update to match the deployed version.

---

### 5.3 Two Conflicting Barcode Scanner Components (MEDIUM)

Two barcode scanner components coexist:
- `components/barcode-scanner.tsx` — old, uses unmaintained `html5-qrcode`
- `components/barcode-scanner-improved.tsx` — new, uses native Barcode Detection API

`InventoryPageClient.tsx` imports the improved version but has a comment referencing the old one. Having two versions creates confusion about which is canonical.

**Action:** Delete `components/barcode-scanner.tsx` and remove the `html5-qrcode` package once confirmed the old component is not imported anywhere critical.

---

### 5.4 `any` Type for Icon Props in DashboardLayout (LOW)

In `components/DashboardLayout.tsx`:
```typescript
type NavItem = {
  href: string;
  icon: any;  // Should be React.ComponentType
  label: string;
```

**Action:** Replace with `icon: React.ComponentType<{ className?: string }>`.

---

### 5.5 TODO Comments in Production Code (LOW)

Two TODO comments remain in production code:

1. `app/api/expenses/route.ts:210`: `// TODO: Add GST to stock movements`
2. `components/InventoryPageClient.tsx:453`: `// TODO: Implement purchase order creation`

These indicate incomplete features that users may expect to work.

---

### 5.6 Hardcoded GST Rate (MEDIUM)

The GST rate of 12% (6% CGST + 6% SGST) is hardcoded in multiple places across the codebase including:
- `app/api/orders/route.ts`
- `components/orders/print-invoice-button.tsx`
- Various calculation functions

If the GST rate changes (a real possibility in India), it would require a search-and-replace across multiple files.

**Action:** Extract to a configuration constant or to the `Settings`/`BusinessSettings` database model (both already exist in the schema).

---

## 6. Feature Gaps

### 6.1 WhatsApp Integration Is Incomplete (MEDIUM)

While the WhatsApp service infrastructure exists (`lib/whatsapp/whatsapp-service.ts`, database models `WhatsAppMessage` and `WhatsAppTemplate`), the integration is partial:
- The `@whiskeysockets/baileys` peer-to-peer WhatsApp library is installed but unused
- The implementation uses the Meta Business API but the `.env.example` does not document the required credentials
- There is no UI for managing WhatsApp templates or viewing message history
- There is no retry mechanism for failed messages
- Messages are sent fire-and-forget with no delivery confirmation

**Action:** Either complete the integration (add template management UI, delivery tracking, retry logic) or clearly mark it as "planned but not active" in documentation.

---

### 6.2 No Password Reset / Forgot Password Flow (HIGH)

The system has no mechanism for users to reset their own passwords. Password changes must be done by an ADMIN through the Admin Settings page. If an admin user forgets their password, recovery requires direct database access.

**Action:** Add a password reset flow. Options:
1. Email-based reset (requires email service like SendGrid/SES)
2. Admin-only password reset (current) — at minimum, document the database reset procedure

---

### 6.3 No Email Notifications (MEDIUM)

The WhatsApp notification system is in place, but there is no email notification system for:
- Order status updates
- Low stock alerts
- Payment reminders
- Account/password management

**Action:** Add an email service integration (Resend, SendGrid, or Nodemailer with SMTP). The existing alert system provides the triggers.

---

### 6.4 No Supplier Contact API Integration (LOW)

The supplier model tracks contact information but there is no integration with supplier portals or automated purchase order sending.

---

### 6.5 QR Code / Label Printing Not Surfaced in UI (LOW)

`lib/barcode/qrcode-service.ts` and the `/api/barcode/` endpoints exist for generating QR codes and printable labels, but there is no UI button/workflow to generate and print labels from the inventory page.

---

### 6.6 Expense Reports Missing Customer Reports UI (LOW)

`/api/reports/customers` exists and returns customer analytics data, but there is no corresponding UI page at `/reports/customers`. The financial and expense reports have UI pages; customer analytics only has an API.

---

## 7. Database & Schema Issues

### 7.1 No Prisma Migration History (CRITICAL)

As noted in section 3.2, there are no Prisma-managed migration files. The `prisma/migrations/` directory contains only manual SQL fix scripts. This means:
- `prisma migrate status` will show no migrations
- Production schema and development schema may drift silently
- There is no reliable way to set up the database from scratch (the seed scripts assume the schema exists)
- Rollback of schema changes is not documented

---

### 7.2 `prisma db:push` Used in Development (HIGH)

The `package.json` `db:push` script uses `prisma db push` which:
- Does not create migration files
- Can silently drop columns that are removed from the schema
- Is not safe for databases with real data
- Provides no rollback capability

**Action:** Replace `db:push` workflow with `prisma migrate dev` for all schema changes.

---

### 7.3 `Settings` and `BusinessSettings` Duplicate Models (MEDIUM)

The Prisma schema contains two separate settings models:
- `model Settings` — appears to be for user/app preferences
- `model BusinessSettings` — appears to be for business configuration (GST number, address, etc.)

There is no apparent UI for either model. The GST rate (hardcoded at 12%) should be configurable here.

**Action:** Consolidate into a single `BusinessSettings` model and surface it in the Admin Settings UI.

---

### 7.4 `UploadHistory` Model Has No UI (LOW)

The `UploadHistory` model is populated by the bulk upload system but there is no UI to view upload history or audit past imports.

---

### 7.5 `engineType = "binary"` in Prisma Schema (MEDIUM)

The Prisma generator uses `engineType = "binary"` which downloads and bundles a binary Prisma engine. In serverless or edge environments, `engineType = "library"` or `engineType = "edge"` would be preferred. For the current PM2-based deployment, binary is acceptable but worth reviewing when Next.js updates are applied.

---

## 8. Testing

### 8.1 No Test Framework Configured (CRITICAL)

No testing framework (`jest`, `vitest`, `playwright`) is installed or configured. There are no test files, no test scripts in `package.json`, and no test configuration files.

**Minimum recommended test coverage:**
1. **Unit tests:** `lib/permissions.ts` (RBAC logic), pricing calculations, balance calculations, GST calculations
2. **API integration tests:** Authentication flow, order creation, payment recording
3. **E2E tests:** Login → create order → update status → print invoice workflow

**Action:**
```bash
pnpm add -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom
pnpm add -D playwright @playwright/test
```

---

### 8.2 No Test Data Factory (MEDIUM)

Related to the lack of tests: there are no reusable test data factories or fixtures. The seed scripts are comprehensive but are designed for manual database seeding, not for creating isolated test fixtures.

---

## 9. Documentation

### 9.1 `README.md` Is Outdated (HIGH)

The existing README does not accurately reflect the current tech stack, deployment configuration, or feature set. It references v0.4.0 deployment notes and does not mention many features built since then.

**Action:** Rewrite README (done in this session).

---

### 9.2 No Architecture Diagram (MEDIUM)

`docs/DATABASE_ARCHITECTURE.md` exists but there is no high-level architecture diagram showing:
- Request flow (Cloudflare → nginx → PM2 → Next.js → PostgreSQL)
- Component/module boundaries
- Data flow between the frontend, API routes, and database

---

### 9.3 API Documentation Partially Outdated (LOW)

`docs/API_DOCUMENTATION.md` exists but may not reflect all current endpoints. The API surface has grown significantly since it was written (adding WhatsApp, barcode, bulk-upload, split order, reports, etc.).

**Action:** Auto-generate API documentation using a tool like `swagger-jsdoc` or `ts-morph`.

---

### 9.4 CLAUDE.md Is the Primary Documentation Source (LOW)

`CLAUDE.md` has become a 4000+ line change log that doubles as architecture documentation. While comprehensive, it makes it hard to find current information about how the system works vs. how it evolved.

**Action:** Extract stable documentation (architecture, API reference, deployment guide, permission matrix) into dedicated docs files and keep CLAUDE.md focused on guidance for AI-assisted development.

---

## Summary Table

| ID | Issue | Severity | Category |
|----|-------|----------|----------|
| 2.2 | Missing `middleware.ts` — routes unprotected | Critical | Security |
| 8.1 | No test framework or test files | Critical | Testing |
| 3.1 | Zero automated test coverage | Critical | Testing |
| 7.1 | No Prisma migration history | Critical | Database |
| 1.2 | `@whiskeysockets/baileys` unused RC package | High | Dependencies |
| 2.1 | Production secrets in `.env` not templated | High | Security |
| 2.3 | No rate limiting on API endpoints | High | Security |
| 3.2 | No database migration strategy | High | Infrastructure |
| 3.3 | No health check endpoint | High | Infrastructure |
| 6.2 | No password reset flow | High | Feature Gap |
| 7.2 | `db:push` used instead of migrations | High | Database |
| 9.1 | README outdated | High | Documentation |
| 1.1 | `next-auth` on old beta | High | Dependencies |
| 4.1 | N+1 query patterns | High | Performance |
| 2.7 | Database password in `prisma.config.ts` | Medium | Security |
| 2.4 | No input sanitization beyond Zod | Medium | Security |
| 2.5 | `NEXTAUTH_SECRET` never rotated | Medium | Security |
| 2.6 | No CSRF protection on custom API routes | Medium | Security |
| 3.4 | No deployment script | Medium | Infrastructure |
| 3.5 | No CI/CD pipeline | Medium | Infrastructure |
| 3.6 | `.env.example` incomplete | Medium | Infrastructure |
| 4.2 | 108 console.* calls in API routes | Medium | Performance |
| 4.3 | No connection pool configuration | Medium | Performance |
| 5.1 | 139 `any` types in API routes | Medium | Code Quality |
| 5.3 | Two conflicting barcode scanner components | Medium | Code Quality |
| 5.6 | Hardcoded GST rate | Medium | Code Quality |
| 6.1 | WhatsApp integration incomplete | Medium | Feature Gap |
| 6.3 | No email notifications | Medium | Feature Gap |
| 7.3 | Duplicate Settings/BusinessSettings models | Medium | Database |
| 7.5 | `engineType = "binary"` in schema | Medium | Database |
| 8.2 | No test data factory | Medium | Testing |
| 9.2 | No architecture diagram | Medium | Documentation |
| 1.3 | `html5-qrcode` unmaintained | Low | Dependencies |
| 1.4 | `eslint-config-next` version mismatch | Low | Dependencies |
| 1.5 | `axios` unused dependency | Low | Dependencies |
| 1.6 | `pino` unused dependency | Low | Dependencies |
| 1.7 | `qrcode-terminal` unused dependency | Low | Dependencies |
| 1.8 | `@types/qrcode` in wrong dependency section | Low | Dependencies |
| 4.4 | html5-qrcode loaded synchronously | Low | Performance |
| 5.2 | `package.json` version stale (0.29.3 vs 0.29.4) | Low | Code Quality |
| 5.4 | `any` type for icon props | Low | Code Quality |
| 5.5 | TODO comments in production code | Low | Code Quality |
| 6.4 | No supplier API integration | Low | Feature Gap |
| 6.5 | QR label printing not in UI | Low | Feature Gap |
| 6.6 | Customer reports API without UI | Low | Feature Gap |
| 7.4 | UploadHistory model has no UI | Low | Database |
| 9.3 | API documentation partially outdated | Low | Documentation |
| 9.4 | CLAUDE.md too large / dual purpose | Low | Documentation |
