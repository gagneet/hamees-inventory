/**
 * @featuretrace Public order enquiry page
 * @route GET /order  (public — no session; see proxy.ts)
 * @calls POST /api/public/enquiries
 * @reads BusinessSettings, GarmentPattern (names only)
 *
 * The only page in the application a visitor can open without signing in, besides the login
 * screen. It takes an enquiry, not an order: nothing here is priced and no stock is touched.
 * Staff see it under Enquiries and convert it into a real order.
 *
 * Only garment NAMES are exposed. Prices, fabric stock and every other business figure stay
 * behind the login.
 */
import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { getAppSettings } from '@/lib/settings'
import { EnquiryForm } from '@/components/public/enquiry-form'
import { formatPhone, phoneHref } from '@/lib/phone'

/**
 * Rendered per request, not at build time. Prerendering would freeze the shop's name, address and
 * garment list into the deployed bundle until the next release, and would make `pnpm build`
 * depend on a reachable database — which no other page in this application does.
 */
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getAppSettings()
  return {
    title: `Place an order | ${settings.businessName}`,
    description: `Tell ${settings.businessName} what you would like made and we will call you back.`,
    // The rest of the app is deliberately excluded from search engines; this page is the shopfront.
    robots: { index: true, follow: true },
  }
}

export default async function PublicOrderPage() {
  const settings = await getAppSettings()

  // Names only — the public form must never expose prices or stock
  const patterns =
    (await prisma.garmentPattern.findMany({
      where: { active: true },
      select: { name: true },
      orderBy: { name: 'asc' },
    })) ?? []
  const garmentTypes = Array.from(new Set(patterns.map((p) => p.name))).slice(0, 60)

  const address = [settings.address, settings.city, settings.postalCode].filter(Boolean).join(', ')

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-8 sm:py-10">
          <h1 className="font-[family-name:var(--font-cormorant-garamond)] text-3xl sm:text-4xl font-semibold text-slate-900">
            {settings.businessName}
          </h1>
          {settings.tagline && <p className="mt-1 text-slate-600">{settings.tagline}</p>}
          {address && <p className="mt-3 text-sm text-slate-500">{address}</p>}
          {settings.phone && (
            <p className="mt-1 text-sm text-slate-500">
              <a
                className="hover:text-slate-900 underline underline-offset-2"
                href={phoneHref(settings.phone) ?? undefined}
              >
                {formatPhone(settings.phone, { defaultRegion: settings.phoneRegion })}
              </a>
            </p>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-slate-900">Tell us what you would like made</h2>
          <p className="mt-2 text-slate-600">
            Leave your details and we will call you to take measurements, agree the fabric and give
            you a price. Nothing is ordered or charged from this page.
          </p>
        </div>

        <EnquiryForm garmentTypes={garmentTypes} phoneRegion={settings.phoneRegion} />

        <p className="mt-8 text-xs text-slate-500">
          We use your phone number only to contact you about this enquiry.
        </p>
      </div>
    </main>
  )
}
