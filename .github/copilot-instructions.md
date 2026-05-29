# Copilot Instructions for Hamees Inventory

## Project snapshot

Hamees Inventory is a Next.js 16 App Router app for a bespoke tailor shop. It manages login, inventory reservation, customer orders, measurements, purchase orders, reports, expenses, WhatsApp notifications, and admin/user management.

## Build, test, and lint

- `pnpm dev` — run the app on port 3009
- `pnpm build` — production build
- `pnpm start` — start the production server on port 3009
- `pnpm lint` — run ESLint
- `pnpm test` — run all Vitest tests
- `pnpm test:unit` — run unit tests only (`tests/unit/`)
- `pnpm test:integration` — run integration tests only (`tests/integration/`)
- `pnpm test:coverage` — run coverage
- Single test file: `pnpm vitest run tests/unit/lib/permissions.test.ts`

Database commands:

- `pnpm db:push` — push schema changes in development
- `pnpm db:migrate` — create and run Prisma migrations
- `pnpm db:seed` — seed sample data
- `pnpm db:reset` — reset and reseed
- `pnpm db:studio` — open Prisma Studio

## High-level architecture

- `app/page.tsx` is the public login page.
- `app/(dashboard)/` contains protected user-facing routes; there is no middleware-based route guard.
- `app/api/` contains route handlers, which typically authenticate via helpers in `lib/api-permissions.ts`.
- `app/layout.tsx` sets the global fonts, `SessionProvider`, and both toast systems.
- `components/DashboardLayout.tsx` renders the protected sidebar/header shell and filters navigation by role permissions.
- `lib/auth.ts` uses NextAuth v5 with credentials login and JWT sessions; `auth()` is wrapped in `React.cache()`.
- `lib/db.ts` is the only Prisma client entrypoint; it uses `@prisma/adapter-pg` with a `pg.Pool` singleton.
- `prisma/schema.prisma` defines the domain models; `prisma.config.ts` supplies the datasource URL.

## Key conventions

- Use `import { prisma } from '@/lib/db'`; do not create new Prisma clients elsewhere.
- Prisma 7 in this repo reads `DATABASE_URL` from `prisma.config.ts`, and schema `where` enum values use string literals.
- Route handlers should use `requirePermission()`, `requireAnyPermission()`, or `requireAuth()` instead of ad hoc auth checks.
- RBAC is centralized in `lib/permissions.ts`; `OWNER` is intentionally not allowed to delete records or manage users/settings.
- `useSession()` callers should handle `status === 'loading'` before reading `session.user.role`.
- Stock reservation is stateful: available stock is `currentStock - reserved`, and order create/status flows must stay transactional.
- Order financials are split between item-level costs and order-level adjustments; advance payment lives only in `Order.advancePaid`, not as an installment.
- Multi-item order costs are distributed proportionally by each item's fabric + accessories cost.
- `DashboardLayout.tsx` filters navigation items by permission and hides empty sections.
- Shadcn UI components here use explicit Tailwind classes rather than CSS-variable color tokens.
- Recharts charts should be wrapped in a fixed-height container to avoid hydration issues.
- Unit tests mock `@/lib/db`, `@/lib/auth`, `next/server`, and the WhatsApp service in `vitest.setup.ts`; integration tests unmock the db layer when needed.

