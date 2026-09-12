# Public site & customer forms — open items (v1.0.0)

Everything known to be outstanding after the 1.0.0 release (PR #114: public marketing site at `/`,
staff login at `/login`, customer-facing enquiry / fitting / order-tracking forms).

Written 2026-09-12. Each item says whether it was **introduced** by this release, was **deferred**
on purpose, or is **pre-existing**. Nothing here is a guess: items that could not be verified are
listed as such in section G rather than stated as fact.

Severity is about the shop, not the code: **High** = a customer or staff member hits it;
**Medium** = it will bite on the next change; **Low** = cosmetic or bookkeeping.

---

## A. Needs action

| # | Item | Sev | Origin |
|---|------|-----|--------|
| A1 | **Redeploy to pick up the second-pass fixes.** The running build was made at 10:19:37; the garment-default and form-reset fixes were committed after it. Until a redeploy, the live enquiry form still pre-selects "Sherwani" and still keeps the previous answers behind "Send another". | High | Introduced |
| A2 | **WhatsApp has no API credentials on this deployment**, so `whatsappService` logs messages instead of sending them. Order tracking therefore does not work end to end for a customer: the form accepts the request and answers normally, but no link is ever delivered. Set `WHATSAPP_API_KEY` and `WHATSAPP_PHONE_NUMBER_ID`. | High | Pre-existing |
| A3 | **`NEXT_PUBLIC_SITE_URL` is unset in production**, so the marketing page's canonical URL, OpenGraph tags and JSON-LD all say `hameesattire.com` while the site is served from `hamees.gagneet.com`. It is baked in at build time — set it in `.env` and redeploy. Tracking links no longer depend on it (they use `NEXTAUTH_URL`). | Medium | Introduced |

Run the deploy as the user PM2 runs the app as (`gagneet`), never with `sudo` — see section H.

---

## B. Content still to replace

| # | Item | Sev | Origin |
|---|------|-----|--------|
| B1 | **The imagery is placeholder.** `public/marketing/*.png` are eight Instagram screenshots, ~19 MB in total and soft at full width. Replace them under the same filenames; no code change needed. Worth converting to WebP/AVIF at the same time — 19 MB of PNG is the page's whole weight. | Medium | Deferred |
| B2 | **Prices, testimonials and celebrity credits are drafts**, all in `components/marketing/strings.ts`. They read as real on a public page — have the shop confirm or replace them before promoting the site. | High | Deferred |
| B3 | **Hindi, Punjabi and Japanese copy is machine-drafted** and wants a native speaker's review. Same file; each language is one object, so a reviewer can work through it without touching code. | Medium | Deferred |

---

## C. Product gaps left open on purpose

These were decided against during the release, not missed. Recorded so nobody re-derives them.

| # | Item | Why it was left |
|---|------|-----------------|
| C1 | **No customer accounts or login.** | The shop's workflow is a phone call and three fittings. An account area means a second auth surface, a session and a scoping boundary to get wrong, for little gain over a 30-minute tracking link. The tab that implied one was deleted. |
| C2 | **Fittings are requests, not bookings.** Nothing checks a calendar, reserves a slot or confirms a time. | Confirming the hour stays a phone call. A calendar model is a real feature, not a schema tweak. |
| C3 | **The public forms cannot attach photos.** | Anonymous uploads need storage, virus scanning and a size policy. Customers send reference images over WhatsApp today. |
| C4 | **The staff inbox has no UI control for `kind`.** The API supports `GET /api/enquiries?kind=FITTING`, and each row carries a badge, but the page filters by status only (`app/(dashboard)/enquiries/page.tsx`). | Small follow-up: add `kind` beside the existing status filter. |
| C5 | **Server-side error messages are English only** (rate limits, an undialable number). The four-language copy covers everything the page renders itself. | The endpoints answer in English; localising them means moving the strings server-side. |
| C6 | **No `app/robots.ts` or `app/sitemap.ts`.** The public pages set their own `robots` metadata and the dashboard is `noindex` app-wide, so nothing leaks — but there is no sitemap for the marketing page. | Worth adding when the site is promoted. |

---

## D. Known trade-offs in the tracking design

Accepted deliberately; listed so a future reader does not treat them as bugs.

| # | Trade-off | Mitigation in place |
|---|-----------|---------------------|
| D1 | **A tracking token travels in the URL**, so it is written to nginx and Cloudflare access logs, and to any proxy in between. | Read-only, scoped to one order, no money or measurements on the page, expires in 30 minutes. |
| D2 | **A token cannot be revoked before it expires.** | The price of a stateless HMAC (no table, no cleanup job). Rotating `NEXTAUTH_SECRET` invalidates every outstanding link at once. |
| D3 | **A token can be replayed inside its 30-minute window** by anyone who obtains the link (e.g. a forwarded WhatsApp message). | Short TTL; the page shows production stage only. |
| D4 | **Rate limiting is in-memory** (`lib/rate-limit.ts`), so the per-IP and per-phone budgets are per process. | Correct today: this deployment is a single PM2 fork. **It silently weakens the moment the app is scaled to more than one instance** — that is the trigger to move the limiter to Postgres or Redis. |

---

## E. Pre-existing issues surfaced while auditing

Not caused by this release, but found and worth tracking.

| # | Item | Sev |
|---|------|-----|
| E1 | **75 Dependabot vulnerabilities on the default branch** (5 critical, 38 high, 29 moderate, 3 low), reported by GitHub on every push. Nobody has triaged them. | High |
| E2 | **ESLint baseline is 1,170 errors across 261 files** repo-wide. None are in the files this release touched (verified per-file), but the aggregate means `pnpm lint` cannot gate CI as it stands. | Medium |
| E3 | **`/login?error=signout` renders nothing.** Sign-out failure redirects with that parameter and no page reads it; the user simply sees the login screen. Present on `master` too — the docstring in `lib/actions.ts` has been corrected to stop implying otherwise. | Low |
| E4 | **The contact page embeds a Google Maps iframe** (`components/marketing/marketing-site.tsx`), so the public page makes a third-party request on load. Fine functionally; relevant if a cookie/consent policy is ever needed. | Low |

---

## F. Follow-ups worth doing

| # | Item |
|---|------|
| F1 | Add a `kind` filter to the enquiry inbox (C4) — the API already supports it. |
| F2 | Compress `public/marketing/*` and serve modern formats (B1). |
| F3 | Add `app/robots.ts` and `app/sitemap.ts` when the site is promoted (C6). |
| F4 | Move the rate limiter to shared storage **before** the app is ever run as more than one instance (D4). |
| F5 | Consider a component-level test harness: the two form defects found in the second audit pass (garment default, stale values after "Send another") were both invisible to the unit suite, which has no component tests. |

---

## G. Verified vs unverified

**Verified against the running deployment:** `/`, `/login` and `/order` return 200; `/dashboard`,
`/admin/settings` and `/track` redirect to `/login`; `/track/garbage` refuses politely; the fresh
build contains the audit fixes; Noto Serif JP carries real hiragana/katakana/kanji ranges in the
served CSS, so the Japanese copy renders in the intended face; all four languages declare exactly
three order tabs; client form payloads match the endpoint's zod schema field for field; the JSON-LD
business facts all trace to handoff constants or existing repo data.

**Not verified, and why:**

| # | Item |
|---|------|
| G1 | **`_prisma_migrations` state in production.** Production `SELECT` reads are blocked by the session's auto-mode classifier and were not worked around. Confidence that the `enquiry_kind` migration applied cleanly rests on the schema matching, the app running against it without error, and the migration history retaining its original timestamps — not on a row count. |
| G2 | **The request origin inside a route handler.** Measured directly for the proxy: a request carrying `x-forwarded-proto: https` and the public host still redirects to `http://localhost:3009/…`, because the URL is rebuilt from the listen address. Route handlers are assumed to reconstruct the URL the same way; that specific case was inferred, not measured. It does not affect correctness — `trackingUrl()` prefers `NEXTAUTH_URL` and never reaches the origin fallback in production. |

---

## H. Operating rules learned the hard way

Recorded because each one cost an incident during this release.

1. **Run `./scripts/deploy.sh` as the user PM2 runs the app as (`gagneet`) — never with `sudo`.**
   PM2 keeps a separate process list per user, so a root deploy talks to root's daemon, which knows
   nothing about the running app: it stops nothing, swaps `.next` under a live server, and then
   fails to bind port 3009. Symptoms are `ChunkLoadError` in the browser and `EADDRINUSE :::3009`
   in the logs. A root build also leaves `.next` root-owned, so the app can no longer write its
   prerender cache (`EACCES`).
2. **Never pass the production `DATABASE_URL` as `--shadow-database-url`.** Doing so during this
   release applied a pending migration straight to production at 09:15 on 2026-09-12. The schema is
   correct and the migration history intact, but it happened outside a reviewed deploy.
3. **`prisma migrate status` regenerates the Prisma client** in `node_modules` as a side effect.
   That is a write into the live directory while the app is serving from it.
4. **The live directory is the running app.** Never run `pnpm install`, `prisma generate`, a build
   or a branch checkout there by hand — use a separate clone or worktree.
5. **Verify what is deployed, not what is committed.** The first audit pass reported six fixes as
   done while the running build predated all of them by four minutes.
