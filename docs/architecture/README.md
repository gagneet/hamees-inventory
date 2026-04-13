# Architecture Documentation — Hamees Inventory System

This directory contains comprehensive architecture documentation for the Hamees tailor shop inventory and order management system.

## Contents

| File | Description |
|------|-------------|
| [system-overview.md](./system-overview.md) | High-level system architecture, tech stack, and component relationships |
| [database-schema.md](./database-schema.md) | Complete ERD with all 22 models, fields, and relationships |
| [order-lifecycle.md](./order-lifecycle.md) | Order status flow, transitions, and stock effects |
| [stock-reservation.md](./stock-reservation.md) | How fabric and accessory stock reservation works |
| [authentication-flow.md](./authentication-flow.md) | NextAuth v5 auth flow, JWT strategy, session handling |
| [rbac-matrix.md](./rbac-matrix.md) | Full role × permission matrix (6 roles × 38 permissions) |
| [payment-flow.md](./payment-flow.md) | Payment system: advance, installments, GST, balance calculation |
| [api-routes.md](./api-routes.md) | All API endpoints organized by resource with methods and permissions |
| [deployment.md](./deployment.md) | Infrastructure: PM2, nginx, Cloudflare Tunnel, DNS |

## Quick Reference

### Tech Stack

- **Framework:** Next.js 16.2.3 (App Router) + React 19.2.3 + TypeScript 5
- **Database:** PostgreSQL 16 via Prisma 7.7.0 + `@prisma/adapter-pg`
- **Auth:** NextAuth.js v5 beta.30 (JWT, Credentials provider)
- **UI:** Tailwind CSS 4, Radix UI, Recharts, Sonner
- **Package Manager:** pnpm 10.28.0
- **Process Manager:** PM2 (fork mode, port 3009)
- **Production URL:** https://hamees.gagneet.com

### Key Business Rules

1. **Stock availability** = `currentStock - reserved` (never raw `currentStock`)
2. **GST rate** = 12% (6% CGST + 6% SGST for intra-state orders)
3. **Balance** = `totalAmount - advancePaid - discount - paidInstallments`
4. **Low stock** threshold = `available < minimum` but `>= minimum × 0.5`
5. **Critical stock** threshold = `available < minimum × 0.5`
6. **OWNER** cannot delete any data — only ADMIN can delete
7. **OWNER** cannot manage users or system settings — only ADMIN can

### User Roles Summary

| Role | Dashboard | Orders | Inventory | Customers | Expenses | Delete | Admin |
|------|-----------|--------|-----------|-----------|----------|--------|-------|
| OWNER | Yes | Full | Full | Full | View+Manage | No | No |
| ADMIN | Yes | Full | Full | Full | Full | Yes | Yes |
| INVENTORY_MANAGER | Yes | No | Full | No | No | No | No |
| SALES_MANAGER | Yes | Full | No | Full | No | No | No |
| TAILOR | Yes | View+Status | View | View+Measure | No | No | No |
| VIEWER | Yes | View | View | View | No | No | No |

### Default Credentials (seeded data, password: `admin123`)

```
owner@hameesattire.com      — OWNER
admin@hameesattire.com      — ADMIN
inventory@hameesattire.com  — INVENTORY_MANAGER
sales@hameesattire.com      — SALES_MANAGER
tailor@hameesattire.com     — TAILOR
viewer@hameesattire.com     — VIEWER
```
