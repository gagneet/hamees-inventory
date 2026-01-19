# React Best Practices Checklist

**Version:** 1.0.0  
**Repository:** gagneet/hamees-inventory  
**Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Prisma 7, NextAuth.js v5  
**Source:** [vercel-labs/agent-skills/react-best-practices](https://github.com/vercel-labs/agent-skills/blob/ac6a79af08f6d32c34ee03c829824990f3de0a6d/skills/react-best-practices/AGENTS.md)

> This document is tailored for the Hamees Inventory Management System codebase. It contains actionable React and Next.js best practices organized by priority and impact.

---

## Table of Contents

1. [Eliminating Waterfalls](#1-eliminating-waterfalls-critical) — **CRITICAL**
2. [Bundle Size Optimization](#2-bundle-size-optimization-critical) — **CRITICAL**
3. [Server-Side Performance](#3-server-side-performance-high) — **HIGH**
4. [Client-Side Data Fetching](#4-client-side-data-fetching-medium-high) — **MEDIUM-HIGH**
5. [Re-render Optimization](#5-re-render-optimization-medium) — **MEDIUM**
6. [Rendering Performance](#6-rendering-performance-medium) — **MEDIUM**
7. [JavaScript Performance](#7-javascript-performance-low-medium) — **LOW-MEDIUM**
8. [Advanced Patterns](#8-advanced-patterns-low) — **LOW**

---

## 1. Eliminating Waterfalls (CRITICAL)

**Impact:** CRITICAL — Waterfalls are the #1 performance killer. Each sequential await adds full network latency.

### ✅ Applicable Rules for This Codebase

#### 1.1 Defer Await Until Needed
- **Where:** API routes (`app/api/**/*.ts`)
- **Pattern:** Move `await` into branches where data is actually used
- **Example:** Early return checks should happen before expensive operations
```typescript
// ❌ Bad: Fetches permissions even if resource not found
async function updateResource(resourceId: string, userId: string) {
  const permissions = await fetchPermissions(userId)
  const resource = await getResource(resourceId)
  if (!resource) return { error: 'Not found' }
  // ...
}

// ✅ Good: Check resource existence first
async function updateResource(resourceId: string, userId: string) {
  const resource = await getResource(resourceId)
  if (!resource) return { error: 'Not found' }
  const permissions = await fetchPermissions(userId)
  // ...
}
```

#### 1.2 Promise.all() for Independent Operations
- **Where:** API routes, Server Components
- **Pattern:** Execute independent async operations concurrently
```typescript
// ❌ Bad: Sequential (3 round trips)
const user = await fetchUser()
const orders = await fetchOrders()
const inventory = await fetchInventory()

// ✅ Good: Parallel (1 round trip)
const [user, orders, inventory] = await Promise.all([
  fetchUser(),
  fetchOrders(),
  fetchInventory()
])
```

#### 1.3 Prevent Waterfall Chains in API Routes
- **Where:** All API routes under `app/api/`
- **Pattern:** Start independent operations immediately, await later
```typescript
// ❌ Bad: auth blocks config, data waits for both
export async function GET(request: Request) {
  const session = await auth()
  const config = await fetchConfig()
  const data = await fetchData(session.user.id)
  return Response.json({ data, config })
}

// ✅ Good: Start both, await as needed
export async function GET(request: Request) {
  const sessionPromise = auth()
  const configPromise = fetchConfig()
  const session = await sessionPromise
  const [config, data] = await Promise.all([
    configPromise,
    fetchData(session.user.id)
  ])
  return Response.json({ data, config })
}
```

#### 1.4 Strategic Suspense Boundaries
- **Where:** Server Components in `app/(dashboard)/`
- **Pattern:** Use Suspense to show layout immediately while data loads
- **Note:** Especially valuable for dashboard pages with heavy data fetching
```tsx
// ❌ Bad: Entire page waits for data
async function Page() {
  const stats = await fetchStats() // Blocks everything
  return (
    <DashboardLayout>
      <Header />
      <StatsDisplay stats={stats} />
      <Footer />
    </DashboardLayout>
  )
}

// ✅ Good: Layout shows immediately
function Page() {
  return (
    <DashboardLayout>
      <Header />
      <Suspense fallback={<StatsLoading />}>
        <StatsDisplay />
      </Suspense>
      <Footer />
    </DashboardLayout>
  )
}

async function StatsDisplay() {
  const stats = await fetchStats() // Only blocks this component
  return <div>{/* ... */}</div>
}
```

---

## 2. Bundle Size Optimization (CRITICAL)

**Impact:** CRITICAL — Reducing initial bundle size improves Time to Interactive and Largest Contentful Paint.

### ✅ Applicable Rules for This Codebase

#### 2.1 Avoid Barrel File Imports
- **Where:** All component files, especially using `lucide-react` and `@radix-ui/react-*`
- **Current Issue:** Files import like `import { Check, X } from 'lucide-react'` (loads 1,583 modules)
- **Fix:** Use direct imports or Next.js `optimizePackageImports`
```typescript
// ❌ Bad: Imports entire library (1,583 modules, ~2.8s in dev)
import { Check, X, Menu } from 'lucide-react'

// ✅ Good: Direct imports (only 3 modules)
import Check from 'lucide-react/dist/esm/icons/check'
import X from 'lucide-react/dist/esm/icons/x'
import Menu from 'lucide-react/dist/esm/icons/menu'
```

**Recommended:** Add to `next.config.ts`:
```typescript
export default {
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-select']
  }
}
```

#### 2.2 Dynamic Imports for Heavy Components
- **Where:** Barcode scanner, rich text editor components, chart libraries
- **Current Candidates:**
  - `components/barcode-scanner.tsx` (html5-qrcode is ~100KB)
  - Chart components using `recharts`
  - Excel export functionality
```tsx
// ❌ Bad: BarcodeScanner bundles with main chunk
import { BarcodeScanner } from '@/components/barcode-scanner'

// ✅ Good: Load on demand
const BarcodeScanner = dynamic(
  () => import('@/components/barcode-scanner').then(m => m.BarcodeScanner),
  { ssr: false, loading: () => <LoadingSkeleton /> }
)
```

#### 2.3 Defer Non-Critical Third-Party Libraries
- **Where:** `app/layout.tsx` (analytics, error tracking)
- **Pattern:** Load after hydration using `next/dynamic` with `ssr: false`

---

## 3. Server-Side Performance (HIGH)

**Impact:** HIGH — Optimizing server-side rendering and data fetching eliminates server-side waterfalls.

### ✅ Applicable Rules for This Codebase

#### 3.1 Minimize Serialization at RSC Boundaries
- **Where:** All Server Components passing props to Client Components
- **Pattern:** Only serialize fields that Client Components actually use
```tsx
// ❌ Bad: Serializes all 50+ fields
async function Page() {
  const order = await prisma.order.findUnique({ where: { id } })
  return <OrderDisplay order={order} /> // Client Component
}

// ✅ Good: Only needed fields
async function Page() {
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      orderNumber: true,
      status: true,
      totalAmount: true,
      deliveryDate: true
    }
  })
  return <OrderDisplay order={order} />
}
```

#### 3.2 Per-Request Deduplication with React.cache()
- **Where:** `lib/auth.ts`, database queries in `lib/db-helpers.ts` (to be created)
- **Current:** Multiple calls to `auth()` in same request execute multiple times
- **Fix:** Wrap with `React.cache()`
```typescript
import { cache } from 'react'

export const getCurrentUser = cache(async () => {
  const session = await auth()
  if (!session?.user?.id) return null
  return await prisma.user.findUnique({
    where: { id: session.user.id }
  })
})
```

#### 3.3 Parallel Data Fetching with Component Composition
- **Where:** Dashboard pages with multiple data sources
- **Pattern:** Fetch in parallel at component level, not sequentially in parent
```tsx
// ❌ Bad: Sequential
async function Dashboard() {
  const stats = await fetchStats()
  return (
    <div>
      <StatsDisplay stats={stats} />
      <RecentOrders />  {/* Waits for stats */}
    </div>
  )
}

async function RecentOrders() {
  const orders = await fetchOrders()
  return <OrderList orders={orders} />
}

// ✅ Good: Parallel
async function StatsDisplay() {
  const stats = await fetchStats()
  return <div>{/* ... */}</div>
}

async function RecentOrders() {
  const orders = await fetchOrders()
  return <OrderList orders={orders} />
}

function Dashboard() {
  return (
    <div>
      <StatsDisplay />  {/* Fetches in parallel */}
      <RecentOrders />
    </div>
  )
}
```

#### 3.4 Use after() for Non-Blocking Operations
- **Where:** API routes with logging, analytics, notifications
- **Current:** Logging blocks response in many routes
- **Fix:** Use Next.js `after()` for side effects
```typescript
import { after } from 'next/server'

export async function POST(request: Request) {
  await updateDatabase(request)
  
  // ✅ Logs after response sent
  after(async () => {
    const userAgent = (await headers()).get('user-agent')
    await logUserAction({ userAgent })
  })
  
  return Response.json({ status: 'success' })
}
```

---

## 4. Client-Side Data Fetching (MEDIUM-HIGH)

**Impact:** MEDIUM-HIGH — Efficient client-side patterns reduce redundant network requests.

### ✅ Applicable Rules for This Codebase

#### 4.1 Use Passive Event Listeners for Scrolling
- **Where:** Any scroll/touch event handlers
- **Pattern:** Add `{ passive: true }` to enable immediate scrolling
```typescript
// ❌ Bad: Blocks scrolling
useEffect(() => {
  const handleScroll = () => console.log(window.scrollY)
  window.addEventListener('scroll', handleScroll)
  return () => window.removeEventListener('scroll', handleScroll)
}, [])

// ✅ Good: Non-blocking
useEffect(() => {
  const handleScroll = () => console.log(window.scrollY)
  window.addEventListener('scroll', handleScroll, { passive: true })
  return () => window.removeEventListener('scroll', handleScroll)
}, [])
```

#### 4.2 Cache Storage API Calls
- **Where:** Any usage of `localStorage`, `sessionStorage`, `document.cookie`
- **Pattern:** Cache reads in memory using a Map
```typescript
// ❌ Bad: Reads storage on every call (expensive I/O)
function getTheme() {
  return localStorage.getItem('theme') ?? 'light'
}

// ✅ Good: Cache in memory
const storageCache = new Map<string, string | null>()

function getLocalStorage(key: string) {
  if (!storageCache.has(key)) {
    storageCache.set(key, localStorage.getItem(key))
  }
  return storageCache.get(key)
}
```

---

## 5. Re-render Optimization (MEDIUM)

**Impact:** MEDIUM — Reducing unnecessary re-renders minimizes wasted computation.

### ✅ Applicable Rules for This Codebase

#### 5.1 Use Functional setState Updates
- **Where:** Any `setState` that depends on current state
- **Benefit:** Stable callback references, prevents stale closures
```typescript
// ❌ Bad: Requires state as dependency
const addItem = useCallback((item: Item) => {
  setItems([...items, item])
}, [items]) // Recreated on every items change

// ✅ Good: Stable callback
const addItem = useCallback((item: Item) => {
  setItems(curr => [...curr, item])
}, []) // Never recreated
```

#### 5.2 Use Lazy State Initialization
- **Where:** Expensive initial state computations
- **Pattern:** Pass function to `useState`
```typescript
// ❌ Bad: Runs on every render
const [settings, setSettings] = useState(
  JSON.parse(localStorage.getItem('settings') || '{}')
)

// ✅ Good: Runs only once
const [settings, setSettings] = useState(() => {
  const stored = localStorage.getItem('settings')
  return stored ? JSON.parse(stored) : {}
})
```

#### 5.3 Narrow Effect Dependencies
- **Where:** All `useEffect` hooks
- **Pattern:** Use primitive dependencies instead of objects
```typescript
// ❌ Bad: Re-runs on any user field change
useEffect(() => {
  console.log(user.id)
}, [user])

// ✅ Good: Re-runs only when id changes
useEffect(() => {
  console.log(user.id)
}, [user.id])
```

---

## 6. Rendering Performance (MEDIUM)

**Impact:** MEDIUM — Optimizing the rendering process reduces browser work.

### ✅ Applicable Rules for This Codebase

#### 6.1 Hoist Static JSX Elements
- **Where:** Loading skeletons, static icons, error messages
- **Pattern:** Extract static JSX outside component
```tsx
// ❌ Bad: Recreates on every render
function Container() {
  return (
    <div>
      {loading && <div className="animate-pulse h-20 bg-gray-200" />}
    </div>
  )
}

// ✅ Good: Reuses same element
const loadingSkeleton = <div className="animate-pulse h-20 bg-gray-200" />

function Container() {
  return (
    <div>
      {loading && loadingSkeleton}
    </div>
  )
}
```

#### 6.2 Animate SVG Wrapper Instead of SVG Element
- **Where:** All animated SVGs (loading spinners, icons)
- **Pattern:** Wrap SVG in div, animate the wrapper for GPU acceleration
```tsx
// ❌ Bad: No hardware acceleration
<svg className="animate-spin" width="24" height="24">
  <circle cx="12" cy="12" r="10" />
</svg>

// ✅ Good: Hardware accelerated
<div className="animate-spin">
  <svg width="24" height="24">
    <circle cx="12" cy="12" r="10" />
  </svg>
</div>
```

#### 6.3 Use Explicit Conditional Rendering
- **Where:** All conditional renders that could be falsy numbers
- **Pattern:** Use ternary operators instead of `&&`
```tsx
// ❌ Bad: Renders "0" when count is 0
<div>{count && <Badge>{count}</Badge>}</div>

// ✅ Good: Renders nothing when count is 0
<div>{count > 0 ? <Badge>{count}</Badge> : null}</div>
```

---

## 7. JavaScript Performance (LOW-MEDIUM)

**Impact:** LOW-MEDIUM — Micro-optimizations for hot paths add up.

### ✅ Applicable Rules for This Codebase

#### 7.1 Build Index Maps for Repeated Lookups
- **Where:** Filtering/matching operations on large arrays
- **Pattern:** Convert arrays to Maps for O(1) lookups
```typescript
// ❌ Bad: O(n) per lookup
function processOrders(orders: Order[], users: User[]) {
  return orders.map(order => ({
    ...order,
    user: users.find(u => u.id === order.userId)
  }))
}

// ✅ Good: O(1) per lookup
function processOrders(orders: Order[], users: User[]) {
  const userById = new Map(users.map(u => [u.id, u]))
  return orders.map(order => ({
    ...order,
    user: userById.get(order.userId)
  }))
}
```

#### 7.2 Use Set/Map for O(1) Lookups
- **Where:** Membership checks in filters
- **Pattern:** Convert arrays to Set
```typescript
// ❌ Bad: O(n) per check
const allowed = ['a', 'b', 'c']
items.filter(item => allowed.includes(item.id))

// ✅ Good: O(1) per check
const allowed = new Set(['a', 'b', 'c'])
items.filter(item => allowed.has(item.id))
```

#### 7.3 Use toSorted() Instead of sort()
- **Where:** All array sorting operations (prevents mutation bugs)
- **Pattern:** Use immutable `.toSorted()` instead of `.sort()`
```typescript
// ❌ Bad: Mutates original array
const sorted = useMemo(
  () => users.sort((a, b) => a.name.localeCompare(b.name)),
  [users]
)

// ✅ Good: Creates new sorted array
const sorted = useMemo(
  () => users.toSorted((a, b) => a.name.localeCompare(b.name)),
  [users]
)
```

---

## 8. Advanced Patterns (LOW)

**Impact:** LOW — Advanced patterns for specific cases.

### ✅ Applicable Rules for This Codebase

#### 8.1 Store Event Handlers in Refs
- **Where:** Custom hooks with event subscriptions
- **Pattern:** Use refs to avoid re-subscribing on handler changes
```tsx
// ❌ Bad: Re-subscribes on every render
function useWindowEvent(event: string, handler: () => void) {
  useEffect(() => {
    window.addEventListener(event, handler)
    return () => window.removeEventListener(event, handler)
  }, [event, handler])
}

// ✅ Good: Stable subscription (or use React's useEffectEvent)
function useWindowEvent(event: string, handler: () => void) {
  const handlerRef = useRef(handler)
  
  useEffect(() => {
    handlerRef.current = handler
  }, [handler])
  
  useEffect(() => {
    const listener = () => handlerRef.current()
    window.addEventListener(event, listener)
    return () => window.removeEventListener(event, listener)
  }, [event])
}
```

---

## Quick Reference: Priority Matrix

| Category | Impact | Effort | Priority | Key Areas |
|----------|--------|--------|----------|-----------|
| Eliminating Waterfalls | CRITICAL | Medium | 🔴 Do First | API routes, Server Components |
| Bundle Size | CRITICAL | Low-Medium | 🔴 Do First | Icon imports, dynamic imports |
| Server-Side Perf | HIGH | Medium | 🟡 Do Second | RSC boundaries, React.cache() |
| Client-Side Fetching | MEDIUM-HIGH | Low | 🟡 Do Second | Event listeners, storage caching |
| Re-render Optimization | MEDIUM | Low | 🟢 Do Third | setState patterns, effect deps |
| Rendering Performance | MEDIUM | Low | 🟢 Do Third | JSX hoisting, SVG animations |
| JavaScript Performance | LOW-MEDIUM | Low | 🔵 Nice to Have | Loops, lookups, sorting |
| Advanced Patterns | LOW | Medium | 🔵 Nice to Have | Custom hooks, refs |

---

## Codebase-Specific Notes

### Architecture Context
- **App Router:** All pages use Next.js 13+ App Router (`app/` directory)
- **Server Components:** Most page components are Server Components by default
- **Client Components:** Explicitly marked with `'use client'` directive
- **API Routes:** Located in `app/api/` with route handlers
- **Database:** Prisma ORM with PostgreSQL

### High-Impact Files to Audit
1. **API Routes:** `app/api/orders/[id]/route.ts`, `app/api/dashboard/enhanced-stats/route.ts`
2. **Dashboard Pages:** `app/(dashboard)/dashboard/page.tsx`
3. **Component Libraries:** All files importing from `lucide-react`, `@radix-ui`
4. **Auth:** `lib/auth.ts` (add React.cache wrapper)
5. **Heavy Components:** `components/barcode-scanner.tsx`, chart components

### Testing Checklist
- [ ] Run `pnpm lint` to check for errors
- [ ] Run `pnpm build` to verify production build works
- [ ] Test API routes with Postman or curl
- [ ] Verify UI components render correctly
- [ ] Check bundle size with `pnpm build` output
- [ ] Test authentication flow
- [ ] Verify database queries work correctly

---

## References

- **Upstream Source:** [vercel-labs/agent-skills/react-best-practices](https://github.com/vercel-labs/agent-skills/blob/ac6a79af08f6d32c34ee03c829824990f3de0a6d/skills/react-best-practices/AGENTS.md)
- **React Docs:** https://react.dev
- **Next.js Docs:** https://nextjs.org
- **Prisma Docs:** https://prisma.io
- **Bundle Size Analysis:** https://vercel.com/blog/how-we-optimized-package-imports-in-next-js
