import type { Metadata } from 'next'
import { MarketingSite } from '@/components/marketing/marketing-site'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hameesattire.com'
const TITLE = 'Hamees Attire — Bespoke Tailoring & Wedding Attire, Amritsar'
const DESCRIPTION =
  'Classic tailoring reimagined as modern luxury couture. Bespoke suits, groom sherwanis and hand-painted pieces, made to measure in Ranjit Avenue, Amritsar. By appointment.'

// Public marketing page: static, indexable, no database access.
export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'bespoke tailoring Amritsar', 'sherwani shop Amritsar', 'groom wear Punjab',
    'custom suits India', 'Hamees Attire', 'luxury menswear Amritsar',
  ],
  // Overrides the app-wide `robots: { index: false }` in app/layout.tsx
  robots: { index: true, follow: true },
  // No hreflang map: the four languages are a client-side switch on this one URL, and /hi,
  // /pa and /ja are not routes — the proxy would bounce a crawler from them to /login.
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: 'Hamees Attire',
    locale: 'en_IN',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
}

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'ClothingStore',
  name: 'Hamees Attire',
  description: 'Bespoke tailoring and wedding attire specialists in Amritsar.',
  image: `${SITE_URL}/logo.svg`,
  url: SITE_URL,
  telephone: '+91-84000-08096',
  email: 'contact@hameesattire.com',
  priceRange: '$$$',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '767, Gumtala Sub Urban, D-Block, Ranjit Avenue',
    addressLocality: 'Amritsar',
    addressRegion: 'Punjab',
    postalCode: '143001',
    addressCountry: 'IN',
  },
  sameAs: ['https://www.instagram.com/hameesattire/'],
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: '11:00',
      closes: '21:00',
    },
  ],
}

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <MarketingSite />
    </>
  )
}
