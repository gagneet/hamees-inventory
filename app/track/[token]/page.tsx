/**
 * @featuretrace Public order tracking page
 * @route GET /track/[token]  (public — no session; see proxy.ts)
 * @reads Order, OrderItem, GarmentPattern (names only), BusinessSettings
 *
 * Opened from the signed link that POST /api/public/track-request sends over WhatsApp to the
 * number on the customer's record. The token (lib/order-tracking.ts) is the only credential and
 * it lasts 30 minutes.
 *
 * It shows production progress and nothing else. No prices, no balance, no advance, no
 * measurements, no other order and no other customer — a link that leaks out of a WhatsApp chat
 * must not become a window onto the shop's books. Money stays behind the staff login.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getAppSettings } from '@/lib/settings'
import { formatDate } from '@/lib/locale'
import { verifyTrackingToken } from '@/lib/order-tracking'
import { formatPhone, phoneHref } from '@/lib/phone'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Your order',
  // A tracking link is private to the customer who received it: keep it out of every index.
  robots: { index: false, follow: false, nocache: true },
}

/** The production stages a garment passes through, in order, for the progress bar. */
const STAGES = [
  { key: 'NEW', label: 'Order taken' },
  { key: 'MATERIAL_SELECTED', label: 'Fabric chosen' },
  { key: 'CUTTING', label: 'Cutting' },
  { key: 'STITCHING', label: 'Stitching' },
  { key: 'FINISHING', label: 'Finishing' },
  { key: 'READY', label: 'Ready to collect' },
] as const

const STAGE_INDEX = new Map(STAGES.map((stage, index) => [stage.key, index]))

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <h1 className="font-[family-name:var(--font-cormorant-garamond)] text-3xl font-semibold text-slate-900 sm:text-4xl">
          {title}
        </h1>
        {children}
      </div>
    </main>
  )
}

export default async function TrackOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const settings = await getAppSettings()
  const result = verifyTrackingToken(token)

  if (!result.ok) {
    const expired = result.reason === 'expired'
    return (
      <Shell title={settings.businessName}>
        <p className="mt-4 text-lg text-slate-700">
          {expired
            ? 'This tracking link has expired.'
            : 'This tracking link is not valid.'}
        </p>
        <p className="mt-3 text-slate-600">
          Links last 30 minutes for your privacy. Ask for a new one and we will send it to the
          number we have on file.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/order"
            className="rounded-md bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-700"
          >
            Ask for a new link
          </Link>
          {settings.phone && (
            <a
              href={phoneHref(settings.phone, settings.phoneRegion) ?? undefined}
              className="rounded-md border border-slate-300 px-5 py-3 text-sm font-medium text-slate-900 hover:bg-white"
            >
              Call {formatPhone(settings.phone, { defaultRegion: settings.phoneRegion })}
            </a>
          )}
        </div>
      </Shell>
    )
  }

  const order = await prisma.order.findUnique({
    where: { id: result.orderId },
    select: {
      orderNumber: true,
      status: true,
      orderDate: true,
      deliveryDate: true,
      completedDate: true,
      customer: { select: { name: true } },
      items: {
        select: {
          id: true,
          status: true,
          quantityOrdered: true,
          garmentPattern: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  // A valid signature for an order that no longer exists: say so plainly rather than 500.
  if (!order) {
    return (
      <Shell title={settings.businessName}>
        <p className="mt-4 text-lg text-slate-700">We could not find that order any more.</p>
        <p className="mt-3 text-slate-600">Please call the shop and we will look it up for you.</p>
      </Shell>
    )
  }

  const cancelled = order.status === 'CANCELLED'
  const delivered = order.status === 'DELIVERED'
  const currentIndex = STAGE_INDEX.get(order.status as (typeof STAGES)[number]['key']) ?? 0
  const firstName = order.customer.name.split(' ')[0]

  return (
    <Shell title={settings.businessName}>
      <p className="mt-2 text-slate-600">
        {firstName}, here is where order <span className="font-medium text-slate-900">{order.orderNumber}</span> has
        got to.
      </p>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        {cancelled ? (
          <p className="text-lg font-medium text-slate-900">This order was cancelled.</p>
        ) : delivered ? (
          <p className="text-lg font-medium text-slate-900">Collected — thank you.</p>
        ) : (
          <ol className="space-y-3">
            {STAGES.map((stage, index) => {
              const done = index < currentIndex
              const now = index === currentIndex
              return (
                <li key={stage.key} className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={
                      'h-2.5 w-2.5 shrink-0 rounded-full ' +
                      (done ? 'bg-slate-400' : now ? 'bg-slate-900' : 'bg-slate-200')
                    }
                  />
                  <span className={now ? 'font-medium text-slate-900' : done ? 'text-slate-600' : 'text-slate-400'}>
                    {stage.label}
                    {now && <span className="ml-2 text-xs uppercase tracking-wider text-slate-500">in progress</span>}
                  </span>
                </li>
              )
            })}
          </ol>
        )}

        <dl className="mt-6 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wider text-slate-500">Order taken</dt>
            <dd className="mt-1 text-slate-900">{formatDate(order.orderDate)}</dd>
          </div>
          {!cancelled && (
            <div>
              <dt className="text-xs uppercase tracking-wider text-slate-500">
                {delivered ? 'Collected' : 'Expected'}
              </dt>
              {/* deliveryDate is the date promised; completedDate is when it was actually handed over. */}
              <dd className="mt-1 text-slate-900">
                {formatDate(delivered ? (order.completedDate ?? order.deliveryDate) : order.deliveryDate)}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {order.items.length > 0 && !cancelled && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">Your garments</h2>
          <ul className="mt-4 space-y-3">
            {order.items.map((item) => {
              const stage = STAGES[STAGE_INDEX.get(item.status as (typeof STAGES)[number]['key']) ?? 0]
              return (
                <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-slate-900">
                    {item.garmentPattern.name}
                    {item.quantityOrdered > 1 && (
                      <span className="ml-2 text-slate-500">× {item.quantityOrdered}</span>
                    )}
                  </span>
                  <span className="text-sm text-slate-600">{delivered ? 'Collected' : stage.label}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <p className="mt-8 text-sm text-slate-500">
        Questions about this order?{' '}
        {settings.phone ? (
          <a
            className="underline hover:text-slate-900"
            href={phoneHref(settings.phone, settings.phoneRegion) ?? undefined}
          >
            Call {formatPhone(settings.phone, { defaultRegion: settings.phoneRegion })}
          </a>
        ) : (
          'Please call the shop.'
        )}
      </p>
    </Shell>
  )
}
