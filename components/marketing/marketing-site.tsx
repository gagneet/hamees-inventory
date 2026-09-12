'use client'

/**
 * FEATURETRACE: Public marketing site (hameesattire.com / hamees.gagneet.com root)
 *
 * Client component: language switch + page switch + order tabs are all local state,
 * persisted in localStorage. No data access, so it renders statically and is safe to
 * index. Staff sign-in is a plain link to /login.
 *
 * Styling is inline on purpose — this page is deliberately independent of the
 * dashboard's Tailwind theme (burgundy/gold), and follows the Instagram identity
 * (cream / taupe / ink) instead.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  STR, LANGS, PAGES, COLLECTIONS, IG_IMGS, STEPS, SERVICES, FAQS, TESTIMONIALS,
  ROLES, HOUR_TIMES, type Lang, type Page,
} from './strings'

const INK = '#2B211A'
const CREAM = '#F3EDE3'
const TAUPE = '#8A7561'
const RULE = '#DED2BF'
const BODY = '#5A4B3E'
const MUTED = '#6B5A49'
const MAROON = '#5E1F27'

// next/font (app/layout.tsx) hashes the real family names, so go through its CSS variables and
// keep the plain names as the fallback for anyone who has the fonts locally.
const SCRIPTS = "var(--font-gurmukhi), var(--font-devanagari), var(--font-noto-jp), 'Noto Sans Gurmukhi', 'Noto Sans Devanagari', 'Noto Serif JP'"
const SERIF = `var(--font-cormorant-garamond), 'Cormorant Garamond', ${SCRIPTS}, serif`
const SANS = `var(--font-jost), 'Jost', ${SCRIPTS}, system-ui, sans-serif`
const MONO = "ui-monospace, Menlo, monospace"

const eyebrow: React.CSSProperties = {
  fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: TAUPE, margin: '0 0 18px',
}
const h1: React.CSSProperties = {
  fontFamily: SERIF, fontWeight: 300, fontSize: 'clamp(34px, 5.4vw, 60px)', margin: '0 0 20px',
}
const btnDark: React.CSSProperties = {
  background: INK, color: CREAM, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase',
  padding: '16px 30px', minHeight: 48, display: 'inline-flex', alignItems: 'center', border: 'none', cursor: 'pointer',
  fontFamily: 'inherit', textDecoration: 'none',
}
const btnGhost: React.CSSProperties = {
  border: `1px solid ${INK}`, color: INK, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase',
  padding: '16px 30px', minHeight: 48, display: 'inline-flex', alignItems: 'center', background: 'transparent',
  cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none',
}
const field: React.CSSProperties = {
  fontFamily: 'inherit', fontSize: 15, padding: '13px 14px', minHeight: 48, border: '1px solid #C9B89C',
  background: '#FAF6EF', color: INK, borderRadius: 2, width: '100%',
}
const fieldLabel: React.CSSProperties = {
  display: 'grid', gap: 7, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: TAUPE,
}
const cover: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }
const note: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: MUTED }

const ADDRESS = ['767, Gumtala Sub Urban', 'D-Block, Ranjit Avenue', 'Amritsar, Punjab 143001']
const PHONE = '+91 84000 08096'
const WHATSAPP = 'https://wa.me/918400008096'
const INSTAGRAM = 'https://www.instagram.com/hameesattire/'
const EMAIL = 'contact@hameesattire.com'
// The only customer-facing route the app exposes today: the public enquiry page (app/order).
// '/orders' is the staff dashboard and would bounce a customer to the staff login.
const ENQUIRY_URL = '/order'

export function MarketingSite() {
  const [lang, setLang] = useState<Lang>('en')
  const [page, setPage] = useState<Page>('home')
  const [tab, setTab] = useState(0)
  const [openFaq, setOpenFaq] = useState(0)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('hamees.site') || '{}')
      if (saved.lang && STR[saved.lang as Lang]) setLang(saved.lang)
      if (saved.page && (PAGES as readonly string[]).includes(saved.page)) setPage(saved.page)
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('hamees.site', JSON.stringify({ lang, page }))
    } catch {}
  }, [lang, page])

  const t = STR[lang]
  const go = (p: Page) => (e: React.MouseEvent) => {
    e.preventDefault()
    setPage(p)
    setTab(0)
    window.scrollTo(0, 0)
  }

  return (
    <div style={{ fontFamily: SANS, color: INK, background: CREAM, minHeight: '100vh', overflowX: 'hidden' }}>
      <style>{`
        a.ha-link { color: ${MAROON}; text-decoration: none; }
        a.ha-link:hover { color: #8A6A3B; }
        .ha-dark:hover { background: ${MAROON} !important; }
        .ha-ghost:hover { background: ${INK} !important; color: ${CREAM} !important; }
        @keyframes ha-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
      `}</style>

      <div style={{
        background: INK, color: '#E8DCC8', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
        padding: '9px 20px', display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap', textAlign: 'center',
      }}>
        <span>{t.ribbon}</span>
        <span style={{ opacity: 0.45 }}>·</span>
        <span>Amritsar, Punjab</span>
      </div>

      <header style={{
        position: 'sticky', top: 0, zIndex: 40, background: 'rgba(243,237,227,0.94)',
        backdropFilter: 'blur(10px)', borderBottom: `1px solid ${RULE}`,
      }}>
        <div style={{
          maxWidth: 1220, margin: '0 auto', padding: '14px 22px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 20, flexWrap: 'wrap',
        }}>
          <a href="#home" onClick={go('home')} style={{ display: 'flex', alignItems: 'center', gap: 12, lineHeight: 1, flexShrink: 0, textDecoration: 'none' }}>
            <img src="/logo.svg" alt="Hamees Attire" width={42} height={42} style={{ display: 'block' }} />
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontFamily: SERIF, fontSize: 25, fontWeight: 500, letterSpacing: '0.26em', color: INK }}>HAMEES</span>
              <span style={{ fontSize: 9, letterSpacing: '0.52em', color: TAUPE, marginTop: 5, paddingLeft: 2 }}>ATTIRE</span>
            </span>
          </a>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {PAGES.map((p, i) => (
                <a key={p} href={`#${p}`} onClick={go(p)} style={{
                  fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', paddingBottom: 3,
                  textDecoration: 'none', borderBottom: `1px solid ${page === p ? TAUPE : 'transparent'}`,
                  color: page === p ? MAROON : INK,
                }}>{t.nav[i]}</a>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 1, background: RULE, padding: 1, borderRadius: 2 }}>
              {LANGS.map((l) => (
                <button key={l.code} onClick={() => setLang(l.code)} title={l.full} style={{
                  fontFamily: 'inherit', border: 'none', cursor: 'pointer', fontSize: 11, letterSpacing: '0.06em',
                  padding: '6px 9px', minHeight: 32,
                  background: lang === l.code ? INK : CREAM, color: lang === l.code ? CREAM : BODY,
                }}>{l.label}</button>
              ))}
            </div>

            <Link href="/login" className="ha-ghost" style={{
              fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', border: `1px solid ${INK}`,
              padding: '11px 14px', color: INK, whiteSpace: 'nowrap', lineHeight: 1.4, textDecoration: 'none',
            }}>{t.staff}</Link>
          </nav>
        </div>
      </header>

      {page === 'home' && (
        <main>
          <section style={{
            maxWidth: 1220, margin: '0 auto', padding: '64px 22px 40px', display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 52, alignItems: 'center',
          }}>
            <div style={{ animation: 'ha-rise 700ms ease-out both' }}>
              <p style={{ ...eyebrow, margin: '0 0 22px' }}>{t.heroEyebrow}</p>
              <h1 style={{ ...h1, fontSize: 'clamp(38px, 6.2vw, 72px)', lineHeight: 1.06, margin: '0 0 24px', textWrap: 'pretty' } as React.CSSProperties}>{t.heroTitle}</h1>
              <p style={{ fontSize: 16, lineHeight: 1.75, color: BODY, maxWidth: '46ch', margin: '0 0 34px' }}>{t.heroBody}</p>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <a href="#lookbook" onClick={go('lookbook')} className="ha-dark" style={btnDark}>{t.ctaPrimary}</a>
                <a href="#contact" onClick={go('contact')} style={{ ...btnGhost, border: '1px solid #B9A88F' }}>{t.ctaSecondary}</a>
              </div>
              <div style={{ display: 'flex', gap: 34, marginTop: 46, flexWrap: 'wrap' }}>
                {[
                  { n: '7,000+', l: t.statFollowers },
                  { n: '3', l: t.statFittings },
                  { n: 'Ranjit Ave.', l: t.statAtelier },
                ].map((s) => (
                  <div key={s.l}>
                    <div style={{ fontFamily: SERIF, fontSize: 30 }}>{s.n}</div>
                    <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: TAUPE, marginTop: 4 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ position: 'relative', padding: 18 }}>
              <div style={{ position: 'absolute', inset: 0, border: '1px solid #D3C4AC', borderRadius: '46% 46% 6px 6px / 26% 26% 4px 4px' }} />
              <div style={{
                position: 'relative', aspectRatio: '4 / 5', overflow: 'hidden', background: '#E4D8C4',
                borderRadius: '46% 46% 4px 4px / 26% 26% 3px 3px',
              }}>
                <img src="/marketing/cafe.png" alt="Two men in Hamees Attire tailoring, seated in an Amritsar café"
                  style={{ ...cover, objectPosition: '50% 30%' }} />
              </div>
            </div>
          </section>

          <section style={{ background: INK, color: '#E8DCC8', padding: '26px 22px' }}>
            <div style={{
              maxWidth: 1220, margin: '0 auto', display: 'flex', gap: 34, flexWrap: 'wrap',
              justifyContent: 'center', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
            }}>
              {['Bespoke', 'Wedding & Groom', 'Suits', 'Hand-painted', 'Accessories'].map((m) => <span key={m}>{m}</span>)}
            </div>
          </section>

          <section style={{ maxWidth: 1220, margin: '0 auto', padding: '78px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 38 }}>
              <h2 style={{ ...h1, fontSize: 'clamp(28px, 4vw, 44px)', margin: 0 }}>{t.collectionsTitle}</h2>
              <a href="#lookbook" onClick={go('lookbook')} className="ha-link" style={{
                fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
                borderBottom: '1px solid #B9A88F', paddingBottom: 3,
              }}>{t.viewAll}</a>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 26 }}>
              {COLLECTIONS.map((c) => (
                <a key={c.key} href="#lookbook" onClick={go('lookbook')} style={{ display: 'block', color: INK, textDecoration: 'none' }}>
                  <div style={{ aspectRatio: '3 / 4', overflow: 'hidden', background: '#E7DCC9', borderRadius: '44% 44% 3px 3px / 24% 24% 2px 2px' }}>
                    <img src={c.img} alt={c.name} loading="lazy" style={cover} />
                  </div>
                  <h3 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 22, margin: '16px 0 6px' }}>{c.name}</h3>
                  <p style={{ fontSize: 13, lineHeight: 1.6, color: MUTED, margin: 0 }}>{c.note}</p>
                </a>
              ))}
            </div>
          </section>

          <section style={{ background: '#EAE1D2', borderTop: `1px solid ${RULE}`, borderBottom: `1px solid ${RULE}` }}>
            <div style={{ maxWidth: 880, margin: '0 auto', padding: '80px 22px', textAlign: 'center' }}>
              <p style={{ ...eyebrow, margin: '0 0 24px' }}>The Sartorial Hour</p>
              <p style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3.2vw, 32px)', fontWeight: 300, lineHeight: 1.5, margin: 0 }}>{t.pullQuote}</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 30 }}>
                {[TAUPE, '#B9A88F', TAUPE].map((c, i) => (
                  <span key={i} style={{ width: 6, height: 6, background: c, transform: 'rotate(45deg)', display: 'block' }} />
                ))}
              </div>
            </div>
          </section>

          <section style={{ maxWidth: 1220, margin: '0 auto', padding: '78px 22px' }}>
            <h2 style={{ ...h1, fontSize: 'clamp(28px, 4vw, 44px)', margin: '0 0 38px' }}>{t.processTitle}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 30 }}>
              {STEPS.map((s) => (
                <div key={s.num} style={{ borderTop: `1px solid ${RULE}`, paddingTop: 20 }}>
                  <div style={{ fontFamily: SERIF, fontSize: 15, color: TAUPE, letterSpacing: '0.2em' }}>{s.num}</div>
                  <h3 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 23, margin: '12px 0 8px' }}>{s.title}</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: MUTED, margin: 0 }}>{s.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section style={{ background: INK, color: '#E8DCC8' }}>
            <div style={{ maxWidth: 1220, margin: '0 auto', padding: '78px 22px' }}>
              <h2 style={{ ...h1, fontSize: 'clamp(28px, 4vw, 40px)', margin: '0 0 40px', color: CREAM }}>{t.wordsTitle}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 34 }}>
                {TESTIMONIALS.map((q) => (
                  <figure key={q.who} style={{ margin: 0, borderLeft: `1px solid ${MUTED}`, paddingLeft: 22 }}>
                    <blockquote style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 300, lineHeight: 1.6, margin: '0 0 16px', fontStyle: 'italic' }}>{q.quote}</blockquote>
                    <figcaption style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#C9B89C' }}>{q.who}</figcaption>
                  </figure>
                ))}
              </div>
              <p style={{ ...note, color: '#B9A88F', margin: '34px 0 0' }}>placeholder quotes — replace with real customer and artist credits</p>
            </div>
          </section>

          <section style={{ maxWidth: 1220, margin: '0 auto', padding: '78px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 30 }}>
              <div>
                <h2 style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 'clamp(28px, 4vw, 40px)', margin: 0 }}>@hameesattire</h2>
                <p style={{ fontSize: 13, color: MUTED, margin: '8px 0 0' }}>{t.igNote}</p>
              </div>
              <a href={INSTAGRAM} target="_blank" rel="noopener" className="ha-ghost" style={{ ...btnGhost, padding: '13px 22px', minHeight: 44 }}>{t.follow}</a>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
              {IG_IMGS.map((src, i) => (
                <a key={i} href={INSTAGRAM} target="_blank" rel="noopener" style={{ aspectRatio: '1', overflow: 'hidden', background: '#E7DCC9', display: 'block' }}>
                  <img src={src} alt={`Instagram post ${i + 1}`} loading="lazy" style={cover} />
                </a>
              ))}
            </div>
          </section>
        </main>
      )}

      {page === 'lookbook' && (
        <main style={{ maxWidth: 1220, margin: '0 auto', padding: '64px 22px 78px' }}>
          <p style={eyebrow}>{t.lookbookEyebrow}</p>
          <h1 style={h1}>{t.lookbookTitle}</h1>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: BODY, maxWidth: '58ch', margin: '0 0 52px' }}>{t.lookbookBody}</p>
          <div style={{ display: 'grid', gap: 60 }}>
            {COLLECTIONS.map((c) => (
              <article key={c.key} style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 34,
                alignItems: 'center', borderTop: `1px solid ${RULE}`, paddingTop: 34,
              }}>
                <div style={{ aspectRatio: '4 / 3', borderRadius: 3, overflow: 'hidden', background: '#E7DCC9' }}>
                  <img src={c.img} alt={c.name} loading="lazy" style={cover} />
                </div>
                <div>
                  <h2 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(26px, 3.4vw, 36px)', margin: '0 0 12px' }}>{c.name}</h2>
                  <p style={{ fontSize: 15, lineHeight: 1.75, color: BODY, margin: '0 0 18px', maxWidth: '48ch' }}>{c.long}</p>
                  <p style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: TAUPE, margin: 0 }}>{c.meta}</p>
                </div>
              </article>
            ))}
          </div>
        </main>
      )}

      {page === 'services' && (
        <main style={{ maxWidth: 1000, margin: '0 auto', padding: '64px 22px 78px' }}>
          <p style={eyebrow}>{t.servicesEyebrow}</p>
          <h1 style={h1}>{t.servicesTitle}</h1>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: BODY, maxWidth: '58ch', margin: '0 0 46px' }}>{t.servicesBody}</p>
          <div>
            {SERVICES.map((s) => (
              <div key={s.name} style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 18,
                padding: '22px 0', borderBottom: `1px solid ${RULE}`, alignItems: 'baseline',
              }}>
                <div style={{ gridColumn: 'span 2', minWidth: 0 }}>
                  <h3 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 22, margin: '0 0 6px' }}>{s.name}</h3>
                  <p style={{ fontSize: 13, lineHeight: 1.6, color: MUTED, margin: 0 }}>{s.detail}</p>
                </div>
                <div style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: TAUPE }}>{s.time}</div>
                <div style={{ fontFamily: SERIF, fontSize: 21 }}>{s.price}</div>
              </div>
            ))}
          </div>
          <p style={{ ...note, margin: '24px 0 44px' }}>indicative pricing — confirm before publishing</p>
          <a href="#order" onClick={go('order')} className="ha-dark" style={btnDark}>{t.ctaSecondary}</a>
        </main>
      )}

      {page === 'about' && (
        <main style={{ maxWidth: 1000, margin: '0 auto', padding: '64px 22px 78px' }}>
          <p style={eyebrow}>{t.aboutEyebrow}</p>
          <h1 style={{ ...h1, margin: '0 0 34px', maxWidth: '24ch' }}>{t.aboutTitle}</h1>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 44, alignItems: 'start' }}>
            <div>
              <p style={{ fontSize: 17, lineHeight: 1.8, color: '#3E332A', margin: '0 0 20px' }}>
                Hamees Attire works out of Ranjit Avenue in Amritsar, cutting for grooms, their families and men who want one suit that fits properly rather than five that do not.
              </p>
              <p style={{ fontSize: 15, lineHeight: 1.8, color: BODY, margin: '0 0 20px' }}>
                The house style is restrained: Punjabi silhouette, soft shoulder, hand-finished detail, cloth chosen in daylight. Pieces are built over three fittings, so you watch the garment take shape rather than receive a surprise.
              </p>
              <p style={{ fontSize: 15, lineHeight: 1.8, color: BODY, margin: 0 }}>
                Alongside the tailoring, our creative head Harlagan Singh develops hand-painted linen and art pieces — work closer to a canvas than a shirt, which has found its way into musicians’ and film wardrobes.
              </p>
            </div>
            <div style={{ padding: 14, border: '1px solid #D3C4AC' }}>
              <div style={{ aspectRatio: '3 / 4', overflow: 'hidden', background: '#E4D8C4' }}>
                <img src="/marketing/doors.png" alt="The atelier doorway" loading="lazy" style={cover} />
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 28, marginTop: 58 }}>
            {STEPS.map((s) => (
              <div key={s.num} style={{ borderTop: `1px solid ${RULE}`, paddingTop: 18 }}>
                <div style={{ fontFamily: SERIF, fontSize: 14, color: TAUPE, letterSpacing: '0.2em' }}>{s.num}</div>
                <h3 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 21, margin: '10px 0 8px' }}>{s.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: MUTED, margin: 0 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </main>
      )}

      {page === 'order' && (
        <main style={{ maxWidth: 900, margin: '0 auto', padding: '64px 22px 78px' }}>
          <p style={eyebrow}>{t.orderEyebrow}</p>
          <h1 style={{ ...h1, fontSize: 'clamp(34px, 5.4vw, 56px)', margin: '0 0 34px' }}>{t.orderTitle}</h1>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: `1px solid ${RULE}`, paddingBottom: 2, marginBottom: 34 }}>
            {t.orderTabs.map((label, i) => (
              <button key={i} onClick={() => setTab(i)} style={{
                fontFamily: 'inherit', cursor: 'pointer', border: 'none', background: 'transparent',
                borderBottom: `2px solid ${tab === i ? MAROON : 'transparent'}`, fontSize: 12,
                letterSpacing: '0.1em', textTransform: 'uppercase', padding: '12px 14px', minHeight: 44,
                color: tab === i ? INK : TAUPE,
              }}>{label}</button>
            ))}
          </div>

          {tab === 0 && (
            <form action={ENQUIRY_URL} method="get" style={{ display: 'grid', gap: 18, maxWidth: 460 }}>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: BODY, margin: 0 }}>{t.trackIntro}</p>
              <label style={fieldLabel}>{t.fOrderNo}
                <input name="order" placeholder="HA-2026-0148" style={field} />
              </label>
              <label style={fieldLabel}>{t.fPhone}
                <input name="phone" type="tel" placeholder="+91 98xxx xxxxx" style={field} />
              </label>
              <button type="submit" className="ha-dark" style={{ ...btnDark, padding: '16px 24px' }}>{t.fTrack}</button>
              <p style={note}>TODO: no public order-tracking route yet; this lands on the enquiry page.</p>
            </form>
          )}

          {tab === 1 && (
            <div style={{ maxWidth: 460, display: 'grid', gap: 20 }}>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: BODY, margin: 0 }}>{t.loginIntro}</p>
              <label style={fieldLabel}>{t.fPhone}
                <input type="tel" placeholder="+91 98xxx xxxxx" style={field} />
              </label>
              <Link href={ENQUIRY_URL} className="ha-dark" style={{ ...btnDark, padding: '16px 24px', justifyContent: 'center' }}>{t.fOtp}</Link>
              <p style={note}>TODO: needs a customer-facing OTP route; currently links to {ENQUIRY_URL}</p>
            </div>
          )}

          {tab === 2 && (
            <div style={{ maxWidth: 560, display: 'grid', gap: 18 }}>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: BODY, margin: 0 }}>{t.enquiryIntro}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 18 }}>
                <label style={fieldLabel}>{t.fName}<input style={field} /></label>
                <label style={fieldLabel}>{t.fPhone}<input type="tel" style={field} /></label>
                <label style={fieldLabel}>{t.fGarment}
                  <select style={field}>
                    <option>Sherwani</option>
                    <option>Two-piece suit</option>
                    <option>Three-piece suit</option>
                    <option>Bandhgala / Jodhpuri</option>
                    <option>Hand-painted piece</option>
                    <option>Other</option>
                  </select>
                </label>
                <label style={fieldLabel}>{t.fDate}<input type="date" style={field} /></label>
              </div>
              <label style={fieldLabel}>{t.fNotes}
                <textarea rows={4} style={{ ...field, minHeight: 0, resize: 'vertical' }} />
              </label>
              <a href={WHATSAPP} target="_blank" rel="noopener" className="ha-dark" style={{ ...btnDark, padding: '16px 24px', justifyContent: 'center' }}>{t.fSend}</a>
            </div>
          )}

          {tab === 3 && (
            <div style={{ maxWidth: 560, display: 'grid', gap: 18 }}>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: BODY, margin: 0 }}>{t.fittingIntro}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 18 }}>
                <label style={fieldLabel}>{t.fName}<input style={field} /></label>
                <label style={fieldLabel}>{t.fDate}<input type="date" style={field} /></label>
              </div>
              <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>{t.closedMondays}</p>
              <a href="tel:+918400008096" className="ha-ghost" style={{ ...btnGhost, padding: '16px 24px', justifyContent: 'center' }}>{t.fCall}</a>
            </div>
          )}
        </main>
      )}

      {page === 'contact' && (
        <main style={{ maxWidth: 1000, margin: '0 auto', padding: '64px 22px 78px' }}>
          <p style={eyebrow}>{t.contactEyebrow}</p>
          <h1 style={{ ...h1, margin: '0 0 40px' }}>{t.contactTitle}</h1>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 44, alignItems: 'start' }}>
            <div>
              <h2 style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: TAUPE, margin: '0 0 12px', fontWeight: 400 }}>{t.theAtelier}</h2>
              <p style={{ fontSize: 16, lineHeight: 1.8, margin: '0 0 26px', color: '#3E332A' }}>
                {ADDRESS.map((line) => <span key={line}>{line}<br /></span>)}India
              </p>
              <h2 style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: TAUPE, margin: '0 0 12px', fontWeight: 400 }}>{t.reachUs}</h2>
              <p style={{ fontSize: 16, lineHeight: 1.9, margin: 0 }}>
                <a className="ha-link" href="tel:+918400008096">{PHONE}</a><br />
                <a className="ha-link" href={WHATSAPP} target="_blank" rel="noopener">WhatsApp</a><br />
                <a className="ha-link" href={`mailto:${EMAIL}`}>{EMAIL}</a><br />
                <a className="ha-link" href={INSTAGRAM} target="_blank" rel="noopener">@hameesattire</a>
              </p>
            </div>
            <div>
              <h2 style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: TAUPE, margin: '0 0 16px', fontWeight: 400 }}>{t.hours}</h2>
              <div style={{ marginBottom: 28 }}>
                {t.days.map((day, i) => (
                  <div key={day} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '11px 0', borderBottom: `1px solid ${RULE}`, fontSize: 15 }}>
                    <span style={{ color: '#3E332A' }}>{day}</span>
                    <span style={{ color: MUTED }}>{HOUR_TIMES[i] === 'closed' ? t.closed : HOUR_TIMES[i]}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 13, color: MUTED, margin: '0 0 26px' }}>{t.hoursNote}</p>
              <iframe
                title="Hamees Attire on the map"
                src="https://www.google.com/maps?q=767+Gumtala+Sub+Urban+D+Block+Ranjit+Avenue+Amritsar+143001&output=embed"
                loading="lazy"
                style={{ width: '100%', aspectRatio: '16 / 10', border: `1px solid ${RULE}` }}
              />
            </div>
          </div>
        </main>
      )}

      {page === 'faq' && (
        <main style={{ maxWidth: 820, margin: '0 auto', padding: '64px 22px 78px' }}>
          <p style={eyebrow}>{t.faqEyebrow}</p>
          <h1 style={{ ...h1, fontSize: 'clamp(34px, 5.4vw, 56px)', margin: '0 0 40px' }}>{t.faqTitle}</h1>
          <div>
            {FAQS.map((f, i) => (
              <div key={f.q} style={{ borderBottom: `1px solid ${RULE}` }}>
                <button onClick={() => setOpenFaq(openFaq === i ? -1 : i)} style={{
                  fontFamily: 'inherit', width: '100%', textAlign: 'left', cursor: 'pointer', background: 'transparent',
                  border: 'none', padding: '22px 0', minHeight: 48, display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', gap: 18, fontSize: 17, color: INK,
                }}>
                  <span>{f.q}</span>
                  <span style={{ fontFamily: SERIF, fontSize: 22, color: TAUPE, flexShrink: 0 }}>{openFaq === i ? '−' : '+'}</span>
                </button>
                {openFaq === i && (
                  <p style={{ fontSize: 15, lineHeight: 1.8, color: BODY, margin: '0 0 24px', maxWidth: '62ch' }}>{f.a}</p>
                )}
              </div>
            ))}
          </div>
          <section style={{ marginTop: 64, borderTop: `1px solid ${RULE}`, paddingTop: 40 }}>
            <p style={eyebrow}>{t.staffEyebrow}</p>
            <h2 style={{ ...h1, fontSize: 'clamp(26px, 4vw, 40px)', margin: '0 0 20px' }}>{t.staffTitle}</h2>
            <p style={{ fontSize: 16, lineHeight: 1.75, color: BODY, maxWidth: '56ch', margin: '0 0 30px' }}>{t.staffBody}</p>
            <Link href="/login" className="ha-dark" style={btnDark}>{t.staffCta}</Link>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 22, marginTop: 44 }}>
              {ROLES.map((r) => (
                <div key={r.name} style={{ border: `1px solid ${RULE}`, padding: 20, background: '#EFE8DB' }}>
                  <h3 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 20, margin: '0 0 8px' }}>{r.name}</h3>
                  <p style={{ fontSize: 13, lineHeight: 1.65, color: MUTED, margin: 0 }}>{r.scope}</p>
                </div>
              ))}
            </div>
          </section>
        </main>
      )}

      <footer style={{ background: INK, color: '#C9B89C' }}>
        <div style={{
          maxWidth: 1220, margin: '0 auto', padding: '60px 22px 30px', display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 40,
        }}>
          <div>
            <img src="/logo.svg" alt="" width={52} height={52} style={{ display: 'block', marginBottom: 16 }} />
            <div style={{ fontFamily: SERIF, fontSize: 22, letterSpacing: '0.24em', color: CREAM }}>HAMEES</div>
            <div style={{ fontSize: 9, letterSpacing: '0.5em', marginTop: 5 }}>ATTIRE</div>
            <p style={{ fontSize: 14, lineHeight: 1.7, margin: '20px 0 0', maxWidth: '30ch' }}>{t.footerTag}</p>
          </div>
          <div>
            <h3 style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#B9A88F', margin: '0 0 14px', fontWeight: 400 }}>{t.explore}</h3>
            <div style={{ display: 'grid', gap: 9 }}>
              {PAGES.map((p, i) => (
                <a key={p} href={`#${p}`} onClick={go(p)} style={{ fontSize: 14, color: '#C9B89C', textDecoration: 'none' }}>{t.nav[i]}</a>
              ))}
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#B9A88F', margin: '0 0 14px', fontWeight: 400 }}>{t.visit}</h3>
            <p style={{ fontSize: 14, lineHeight: 1.8, margin: 0 }}>
              {ADDRESS.map((line) => <span key={line}>{line}<br /></span>)}
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#B9A88F', margin: '0 0 14px', fontWeight: 400 }}>{t.reachUs}</h3>
            <div style={{ display: 'grid', gap: 9, fontSize: 14 }}>
              <a href="tel:+918400008096" style={{ color: '#C9B89C', textDecoration: 'none' }}>{PHONE}</a>
              <a href={WHATSAPP} target="_blank" rel="noopener" style={{ color: '#C9B89C', textDecoration: 'none' }}>WhatsApp</a>
              <a href={`mailto:${EMAIL}`} style={{ color: '#C9B89C', textDecoration: 'none' }}>{EMAIL}</a>
              <a href={INSTAGRAM} target="_blank" rel="noopener" style={{ color: '#C9B89C', textDecoration: 'none' }}>@hameesattire</a>
              <Link href="/login" style={{ color: '#B9A88F', textDecoration: 'none' }}>{t.staff}</Link>
            </div>
          </div>
        </div>
        <div style={{
          maxWidth: 1220, margin: '0 auto', padding: 22, borderTop: '1px solid #4A3B2E', display: 'flex',
          justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', fontSize: 12, color: '#B9A88F',
        }}>
          <span>© {new Date().getFullYear()} Hamees Attire, Amritsar</span>
          <span>hameesattire.com</span>
        </div>
      </footer>
    </div>
  )
}
