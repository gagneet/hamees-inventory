# Discounts, tax, revenue and payments — review, validation and plan

Origin: a read-only review of `release/0.32.0-features` at `84acc547` (external), plus the Amazon Q
review on [PR #112](https://github.com/gagneet/hamees-inventory/pull/112#pullrequestreview-5184180473).
This document records **which findings were confirmed against the code**, **what was fixed in
v0.50.0**, and **what is deliberately left for later**, with the design for each remaining item.

---

## 1. Validation of the review findings

Every claim below was checked against the branch. "Confirmed" means the defect was reproduced in
the code, not merely asserted.

| # | Finding | Verdict | Evidence |
|---|---------|---------|----------|
| 1 | Discounts do not reduce the tax base | **Confirmed** | `app/api/orders/route.ts` set `taxableAmount = subTotal` and taxed the full subtotal; `PATCH /api/orders/[id]` changed only `discount` and `balanceAmount`, never the tax columns or `totalAmount`. The printed invoice showed the discount *below* the tax-inclusive total. |
| 2 | Financial reporting overstates revenue and profit | **Confirmed** | `app/api/reports/financial/route.ts` summed `Order.totalAmount` (tax included, discount not deducted) for delivered orders, grouped by `createdAt`. `cashReceived` summed every installment regardless of payment mode. The dashboard's `deliveredRevenue()` had the same tax-inclusive definition. |
| 3 | Advances and payments cannot be reliably audited | **Confirmed** | `Order.advancePaid` is a scalar `BigInt` with no payment mode, receipt date, reference, cashier or reversal history; `PaymentInstallment` has all of those. There is no way to attribute an advance to cash vs UPI. |
| 4 | An editable order is being used as an invoice | **Confirmed** | `Order.invoiceNumber`, `invoiceDate` and `placeOfSupply` exist in `prisma/schema.prisma` but are never written; the invoice prints `orderNumber` and `createdAt`. There is no immutable snapshot and no credit-note model. Changing shop settings re-labels historical invoices. |
| 5 | The tax engine supports only one rate per order | **Confirmed** | `lib/tax.ts` applies one percentage to the whole subtotal in all three modes. `BusinessSettings.fabricGstRate` exists in the schema but is referenced **nowhere** in the application — it is dead configuration. |
| 6 | Order splitting compounds the problem | **Confirmed** | `POST /api/orders/[id]/split` taxed each **pre-discount** subtotal and then apportioned the discount by **post-tax** totals — two different bases, so neither the tax nor the discount allocation was right. |
| 7 | Discount governance is incomplete | **Confirmed** | One order-level amount plus a free-text reason. The discount was gated on `record_payment`, conflating pricing approval with receipting money. |
| Q | `fromMinor` can silently lose precision | **Confirmed** | `Number(bigint)` with no range check. The suggested fix (`Number.isSafeInteger`) would have **broken** `sumFromMinor(Number(rawSqlSum))`, where `SUM("currentStock" * "pricePerMeter")` is legitimately non-integer — the guard implemented checks magnitude instead. |

### Corrections to the review

- The review's step 1 says "remove the second discount subtraction from balance calculation". That
  is right, but only **together with** moving the discount into `totalAmount`. Doing it alone would
  silently increase every discounted customer's balance.
- The review implies existing discounted orders should simply be migrated. They should not be
  rewritten wholesale: see §3.
- The suggested `Number.isSafeInteger` guard is too strict for this codebase (see row Q).

### Additional defects found during the review (not in the original list)

1. **False "balance mismatch" warnings on every order with an advance.** The order detail page
   computed `expectedBalance = totalAmount − discount − allInstallments`, omitting `advancePaid`
   and not excluding a legacy duplicate-advance row. Since v0.28.4 the advance is not an
   installment, so the check logged a warning for normal orders.
2. **False "advance payment mismatch" warnings.** The same page compared `advancePaid` with
   installment #1 unconditionally, so an ordinary first balance payment tripped it.
3. **Per-item invoice pages did not add back to the order.** Costs, tax and payments were split
   with floating-point ratios, so the printed pages could be a paisa or two off the order total.
4. **A `Date.now()` call in the new-order page** was flagged by the React Compiler's purity rule
   (`react-hooks/purity`) as a render-phase side effect.

---

## 2. What was fixed (v0.50.0)

### The pricing model

`lib/order-pricing.ts` (new, pure — no Prisma, usable from client components, scripts and tests) is
now the single definition:

```
taxableAmount = subTotal − discount      a discount reduces the TAXABLE value; it is not a payment
totalAmount   = taxableAmount + tax      tax is charged on the discounted value
balanceAmount = totalAmount − advancePaid − Σ installment payments
```

The discount is therefore *inside* `totalAmount` and is no longer subtracted from the balance a
second time. `lib/order-finance.ts` keeps the database-aware wrappers and re-exports the rest.

This is what India's CGST s.15 requires for a discount recorded on the invoice, what HMRC requires
("VAT is charged on the discounted price") and what the ATO and Japan's Qualified Invoice rules
assume. Deducting the discount *after* tax over-declares output tax.

Applied everywhere an order is priced:

- `POST /api/orders` — accepts an optional `discount` + `discountReason` at the point of sale (so
  it appears on the invoice from the start) and taxes `subTotal − discount`.
- `PATCH /api/orders/[id]` — a discount change re-prices the order: `taxableAmount`, `cgst`, `sgst`,
  `igst`, `gstAmount`, `totalAmount` and `balanceAmount` all move, inside the existing row lock, and
  the new invoice total is written to `OrderHistory`. The order keeps **its own** rate and tax
  structure, so a later change to the shop's tax settings never rewrites history. Tax columns are
  rewritten **only when the discount actually changes**, so editing a note never restates an invoice.
- `PATCH /api/orders/[id]/items/[itemId]` — a fabric change re-prices on the same basis, and caps a
  discount that no longer fits the smaller subtotal.
- `POST /api/orders/[id]/split` — the discount is now allocated on the **pre-tax** value with
  `allocateMoney()` (exact to the paisa), and each side is taxed on its own discounted value.
- The printed invoice shows *Item Subtotal → Less: Discount (reason) → Taxable Value → tax lines →
  Item Total*, and every order-level amount is allocated with `allocateMoney()`, so the per-item
  pages add back to the order exactly.

### Reporting

`GET /api/reports/financial` now reports the full chain and no longer counts tax as income:

```
gross value (subTotal)        list value of the work
− discounts
= net sales excluding tax     ← "revenue"; profit is measured against this
+ tax charged                 collected for the tax authority, never income
= invoiced total
```

- Orders are counted in the month they were **supplied** (`completedDate`, set on delivery), falling
  back to `createdAt` only for legacy delivered rows with no supply date. This matches the dashboard.
- `deliveredRevenue()` in `app/api/dashboard/enhanced-stats/sections.ts` uses the same definition,
  so the dashboard and the report agree.
- Receipts are a separate cash-flow measure with a **per-payment-mode breakdown**. Advances carry no
  payment mode, so they are reported under `UNRECORDED` — visible rather than silently counted as
  cash. `cashReceived` now means cash, and `receiptsTotal` means all money in.
- Both routes fall back to `subTotal − discount` for rows written before this release, so historical
  months still read correctly without a data migration.

### Governance

- New permission **`apply_discount`**, separate from `record_payment`. It is granted to exactly the
  roles that hold `record_payment` today (OWNER, ADMIN), so **who** can do what is unchanged — the
  two responsibilities are now distinguishable in code and can diverge later without a refactor.
- The discount dialog works against the pre-tax value, caps at `subTotal` (not `totalAmount`), and
  previews the new taxable value, tax, total and balance before applying.

### Amazon Q's finding

`fromMinor()` throws a `RangeError` for a `bigint` outside ±`Number.MAX_SAFE_INTEGER` and for a
non-finite `number`, rather than returning a quietly rounded amount. Non-integer `number` input is
still accepted, because raw-SQL sums such as `SUM("currentStock" * "pricePerMeter")` are legitimately
fractional in minor units — this is why the guard checks magnitude, not `Number.isSafeInteger`.

### Other fixes

- The order detail page's balance and advance self-checks use the real formula and only warn about a
  legacy duplicate-advance row that has drifted, instead of warning on every normal order.
- The payment summary card shows value before tax → discount → taxable value → tax → total.
- `formatLocalDate` / `defaultDeliveryDate` hoisted out of the new-order component (purity rule).
- `settingsFromRow()` extracted to `lib/settings-row.ts` (pure), so scripts can map a settings row
  without pulling in the app's Prisma singleton.

Found in a second audit pass over this same change, after the first round was already written:

- **The dashboard growth rate mixed two revenue bases.** `revenueForecast` summed `totalAmount`
  (tax included) for the current month while `lastMonthRevenue` came from `deliveredRevenue()`,
  which this change had just made tax-exclusive. `growthRate` therefore compared a tax-inclusive
  figure with a tax-exclusive one and overstated growth by roughly the tax rate. Both sides now use
  net sales. This is the hazard of changing one definition: every consumer of it has to be found.
- **The order page's balance self-check contradicted the documented rule** in three ways: it
  detected a legacy advance row by amount alone (CLAUDE.md says never to), it excluded installment
  #1 unconditionally so a genuine first balance payment vanished, and it filtered on
  `status === 'PAID'` so PARTIAL payments were ignored. It now calls the same
  `sumInstallmentPayments` / `orderBalance` the server uses, which is the only way the check can
  stay true as the formula moves.
- Customer lifetime spend (`/api/reports/customers`, the dashboard's top-customer card) summed
  amounts with floating-point `reduce`. Switched to `sumMoney`. Its basis stays deliberately
  tax-inclusive — it is what the customer paid, not the shop's revenue — and now says so in the
  code, because a reader comparing it with the P&L would otherwise think one of them is wrong.
- `scripts/archived/fix-split-order-installments.ts` and `fix-split-order-payments.ts` still carry
  the old `totalAmount − discount − payments` formula. They are historical one-offs that have
  already been run, but re-running one after this change would understate every balance it touched,
  so both now carry a SUPERSEDED banner pointing at `orderBalance`.

### Tests

`tests/unit/business/payment.test.ts` was rewritten to exercise the **production** helpers
(`orderBalance`, `clampDiscount`, `repriceOrder`, `allocateMoney`, `sumInstallmentPayments`) instead
of re-implementing the formulas — a test that copies the formula cannot catch a change to it. It now
covers the tax-exclusive worked example, split-tax halving, clamping, the v0.28.6 double-advance
bug, and exact allocation. Added: `fromMinor` range tests; financial-report revenue-semantics tests
(tax excluded, discounts deducted, receipts by mode, legacy fallback); an `apply_discount` matrix
test; and re-priced discount cases in `tests/unit/api/money.test.ts`.

Also added: `tests/unit/api/enquiries.test.ts` (17 tests over the public and staff enquiry
endpoints — rate limiting, honeypot, phone normalisation, permission gates, conversion) and
`tests/unit/api/public-surface.test.ts`, which enumerates every `app/api/**/route.ts` file and
asserts each one is permission-guarded or on an explicit four-entry allowlist. That second file is
a standing guard on the whole API surface, not a test of one change.

**1,002 unit tests pass across 42 files**; `tsc` reports no errors and `eslint` is clean on every
changed file.

---

## 3. Migrating existing discounted orders

`scripts/reprice-discounted-orders.ts` re-prices orders written under the old model.

```bash
pnpm tsx scripts/reprice-discounted-orders.ts              # dry run, lists every change
pnpm tsx scripts/reprice-discounted-orders.ts --apply      # open orders only
pnpm tsx scripts/reprice-discounted-orders.ts --apply --include-closed
```

**Delivered and cancelled orders are skipped by default, and that default should stand.** On the
production database all seven discounted orders are DELIVERED and fully settled. Re-pricing them
would relieve ₹1,677.68 of over-charged GST and leave each customer with a credit balance:

| Order | Tax before → after | Total before → after | Balance after |
|---|---|---|---|
| ORD-2025-0002 | 1,567.68 → 1,357.11 | 14,631.68 → 12,666.32 | −210.57 |
| ORD-2025-0005 | 607.20 → 559.60 | 5,667.20 → 5,222.90 | −47.60 |
| ORD-2025-0013 | 1,128.00 → 1,001.66 | 10,528.00 → 9,348.86 | −126.34 |
| ORD-1769327607178-935 | 14,353.91 → 14,117.53 | 133,969.81 → 131,763.62 | −236.38 |
| ORD-1769338355430-738 | 7,456.24 → 7,076.86 | 69,591.54 → 66,050.70 | −379.38 |
| ORD-1769340093159-602 | 5,166.42 → 5,060.95 | 48,219.96 → 47,235.56 | −105.46 |
| ORD-1769430318363-60 | 6,417.07 → 5,845.13 | 59,892.63 → 54,554.55 | −571.94 |

Rewriting a supply that has already been invoiced and reported is not a data fix — the correct
treatment is a **credit note**, which this system cannot yet issue (§4.3). Until it can, leave those
orders as invoiced and handle any refund outside the system. Use `--include-closed` only if the
periods are unfiled and an accountant has agreed to restate them.

---

## 4. Deliberately not done, and how to do it

These are architectural and were not attempted in this pass. Each is described well enough to be
picked up directly.

### 4.1 Normalise payments into a ledger (review item 3)

**Problem.** `Order.advancePaid` is a scalar with no mode, date, reference or reversal. Cash
reconciliation, receipt-date tax reporting and refunds are all impossible; the financial report has
to report advances as `UNRECORDED`.

**Design.** A `Payment` model — `orderId`, `amount`, `paidAt`, `mode`, `reference`, `receivedById`,
`kind` (`RECEIPT` | `REFUND` | `REVERSAL`), `reversesId`, `notes` — with every advance, installment
and refund as a row. `Order.advancePaid` becomes a derived/cached column during a transition period,
then goes away; `PaymentInstallment` keeps only the *schedule* (expected amount, due date).
Migration: one `Payment` per non-zero `advancePaid` (dated `orderDate`, mode null) and one per
installment with `paidAmount > 0`, carrying its mode and date. `computeOrderBalance()` then sums
payments instead of two sources, and the legacy duplicate-advance special case disappears.

**Interim step, if the full ledger is too large:** add `advancePaymentMode`, `advancePaidDate` and
`advanceTransactionRef` to `Order` (three nullable columns, an additive migration) plus the fields on
the new-order form. That alone makes cash reconciliation work and removes the `UNRECORDED` bucket.

### 4.2 Line-level tax (review item 5)

**Problem.** One rate for the whole order. Fabric, finished garments and tailoring services can
attract different rates; the UK has standard/reduced/zero-rated lines, Japan has 10% and 8%,
Australia has taxable, GST-free and input-taxed supplies. `BusinessSettings.fabricGstRate` is dead
configuration that implies otherwise — either wire it up or remove it.

**Design.** A `TaxCode` table (code, name, rate, effective-from/to, jurisdiction) and a `taxCodeId`
on `OrderItem` plus on each order-level charge, defaulted from the garment pattern / inventory item.
Order-level discounts allocate across lines with `allocateMoney()` weighted by line value (the
mechanism already exists), then each line is taxed on its own discounted value. The order's tax
columns become the sum per rate group, which is what a Qualified Invoice (Japan) and a GST return
(India) both need. Rates must be effective-dated so historical orders keep the rate in force on
their supply date.

### 4.3 Immutable invoices and credit/debit notes (review item 4)

**Problem.** The order *is* the invoice. Nothing is frozen, so editing an order, or changing shop
settings, silently alters an already-issued document; and there is no way to correct one properly.

**Design.** An `Invoice` snapshot issued from an order: number, supply date, currency and exponent,
seller registration and address, customer tax details, place of supply, tax regime and rate version,
price-includes-tax flag, and every line with its discount allocation and tax. Once issued it is
read-only; the order stays editable for operations. Corrections become `CreditNote` / `DebitNote`
rows linked to the invoice. This is the prerequisite for §3's "issue a credit note instead", and for
`placeOfSupply` / `invoiceNumber` / `invoiceDate` (already in the schema) to mean anything.

### 4.4 Discount governance (review item 7)

`apply_discount` exists now, but the discount is still one order-level amount with a free-text
reason. Still missing: line vs order discount, promotion vs discretionary, pre- vs post-invoice,
tax-inclusive vs tax-exclusive basis, discount code/category, who approved it, approval thresholds,
and the link to a credit note. A `Discount` child table with those fields (plus `grantedById` and
`approvedById`) fits naturally once §4.2 and §4.3 are in.

### 4.5 Internationalisation gaps

- `MONEY_SCALE` is fixed at 100 for every currency. This is **deliberate** — it must not depend on
  the configured currency, or re-labelling the currency would rescale every stored amount. JPY needs
  a zero-decimal *display and input* rule, not a different storage scale. INR, GBP and AUD must keep
  minor-unit precision regardless, because tax calculations generate paise/pence/cents.
- Forms still use `step="0.01"` and `toFixed(2)` unconditionally; these should come from the
  currency's exponent.
- Fixed premiums in `app/api/orders/route.ts` (`5000` full canvas, `5000` premium lining,
  `1500`/fitting) become £5,000 / A$5,000 / ¥5,000 when the shop currency changes. They belong in
  settings, per currency.
- No Japan preset and no `ja-JP` locale option.
- The secondary exchange rate is global and indicative, so historical amounts move when it changes
  (already listed as a known limitation of 0.32.0).
- UI, status and invoice text remain hard-coded English. What exists is locale *formatting*, not
  language internationalisation.

### 4.6 Tax-inclusive pricing

The application assumes tax-exclusive pricing throughout. A shop quoting tax-inclusive retail prices
needs a `priceIncludesTax` setting and the reverse calculation (a 1,100 tax-inclusive price less a
100 discount is 1,000 gross, containing 909.09 taxable value and 90.91 tax). This is a prerequisite
for most UK/AU/JP retail configurations and should land with §4.2.

---

## 5. Country notes

Presets, not legal determinations — confirm garment and tailoring classifications with a local
accountant before enabling a country.

| Country | Required behaviour |
|---|---|
| India | Rate per line by classification; CGST+SGST intra-state, IGST inter-state. A discount given before or at supply is excluded from taxable value **only when duly recorded on the invoice** — which is why §2 records it on the order at creation. Post-supply discounts have stricter agreement, invoice-linking and ITC-reversal conditions. [CBIC — CGST Act](https://cbic-gst.gov.in/hindi/CGST-bill-e.html) |
| United Kingdom | VAT on the **discounted** price; standard, reduced and zero-rated lines; mixed-rate offers need apportionment. Cash Accounting changes *when* VAT is paid to HMRC, not whether the sale is taxable. [GOV.UK — VAT on discounts](https://www.gov.uk/charge-reclaim-record-vat/vat-on-discounts-and-gifts) · [VAT Cash Accounting](https://www.gov.uk/vat-cash-accounting-scheme) |
| Australia | GST 10% on taxable supplies; lines may be GST-free or input-taxed. Later price reductions can require an adjustment note. Cash-basis accounting changes BAS timing only. [ATO — How GST works](https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/how-gst-works) · [Adjustment notes](https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/in-detail/managing-gst-in-your-business/reporting-paying-and-activity-statements/making-adjustments-on-your-activity-statements/adjustment-notes) |
| Japan | Standard 10% and reduced 8% categories, with Qualified Invoice rate grouping. JPY input normally requires whole-yen precision. [JETRO — Consumption tax](https://www.jetro.go.jp/en/invest/setting_up/section3/page6.html) |

A cash sale is never untaxed because it was cash, and a discount is never income: it may appear in a
managerial "gross retail value" KPI but must be deducted from net sales, taxable turnover and
revenue — which is exactly what §2's reporting change does.

---

## 6. Release readiness

| Review's release blocker | Status |
|---|---|
| Discount / tax calculation | **Fixed** (§2) |
| Revenue reporting | **Fixed** (§2) |
| Payment normalisation | **Not done** — advances are reported as `UNRECORDED` rather than mis-attributed; design in §4.1 |
| Mutable invoice model | **Not done** — design in §4.3; blocks proper credit notes (§3) |

The arithmetic and the reporting are now correct for a single-rate, tax-exclusive shop. Multi-rate
lines, tax-inclusive pricing, an auditable payment ledger and immutable invoices remain open, and
the two open blockers should be scheduled before the shop's next tax filing period.

---

## 7. The public order enquiry page (`/order`)

This was asked for separately — "can a customer place an order from the public website?" The answer
was no: before this change the only thing an unauthenticated visitor could reach was the login page
and `GET /api/health`. What has been added is deliberately an **enquiry**, not an order.

### Why an enquiry and not an order

A bespoke garment cannot be priced from a web form. The price depends on measurements taken in
person, the fabric chosen from stock, the stitching tier and any workmanship premiums. Letting a
visitor create an `Order` would mean:

- reserving fabric for someone who has not been measured and may never come in;
- writing a price and a tax amount that the shop has not agreed to and would then have to revise on
  an invoice that already exists (which, without the credit-note work in §4.3, it cannot do
  cleanly); and
- putting a row into the production pipeline that the workshop must then learn to ignore.

So `POST /api/public/enquiries` writes exactly one row to one table, `CustomerEnquiry`. It touches
no stock, no pricing, no customer record and no order. A member of staff converts it.

### The public surface, stated explicitly

| Route | Auth | What it exposes |
|---|---|---|
| `GET /api/health` | none | database reachable, yes/no |
| `GET/POST /api/auth/[...nextauth]` | none | NextAuth's own handlers |
| `POST /api/public/enquiries` | none | **write only** — creates one enquiry |
| `POST /api/excel/submit-order` | `X-Excel-Api-Key` header | pre-existing; not a session, so it is listed here too |
| `GET /order` | none (a page, not an API route) | shop name, and the *names* of the garment types offered |

The four API routes are enforced, not just documented: `tests/unit/api/public-surface.test.ts`
enumerates every route file under `app/api/` and fails if one of them has no permission check and is
not on that four-entry allowlist — and a second test fails if the allowlist itself grows. A new
unguarded route breaks the test run rather than quietly opening a hole. The `/order` page reads the
garment type names directly in its server component; there is no public API for them.

`/order` renders no prices, no stock levels, no customer data and no order data. It is
`force-dynamic` so the shop's branding and garment list follow Admin Settings immediately, and so
that `pnpm build` does not need a reachable database to prerender it.

### Abuse handling

The endpoint is unauthenticated, so it is rate-limited on two axes using the existing in-memory
limiter: **5 submissions per IP address per hour** and **3 per phone number per hour**, answering
with `429` and `Retry-After`. A hidden `company` field acts as a honeypot — a bot that fills it gets
`201` and nothing is written, because telling a bot it was detected only teaches it. The phone
number is normalised to E.164 and a number that cannot be dialled is refused with `400`, which stops
the commonest junk and guarantees the shop can actually call back. A preferred date in the past is
discarded rather than rejected.

Only a salted SHA-256 hash of the IP address is stored (truncated to 32 hex characters), plus the
user agent, for blocking a repeat abuser. The raw address is never persisted, and neither field is
ever returned by the staff API.

### Conversion

`POST /api/enquiries/[id]/convert` requires `manage_enquiries`, `manage_customers` **and**
`create_order` together — converting is all three actions, so holding only one of them is not
enough. It finds or creates the customer and returns them; it does **not** create the order. The
order is created by the normal new-order form, and the enquiry is marked `CONVERTED` inside that
order's transaction. An abandoned form therefore leaves no half-made order, and the same enquiry
cannot be converted twice (`updateMany` with `status: { not: 'CONVERTED' }`).

Families share a phone number, so when the number matches more than one customer the endpoint
returns `409 MULTIPLE_CUSTOMERS` with the candidates and asks staff to pick, rather than attaching
the enquiry to whichever row came back first.

### Not done

- **No email or WhatsApp notification** when an enquiry arrives; staff see it in the dashboard. The
  WhatsApp service exists and could send one, but sending to a number that has not consented is a
  different decision from receiving a form.
- **No CAPTCHA.** The honeypot plus two rate limits is proportionate for a single shop; if real spam
  arrives, a CAPTCHA is the next step, not a third rate limit.
- **The rate limiter is in-memory**, so it resets on restart and would not be shared across
  instances. This shop runs one instance (see CLAUDE.md), which is the same assumption the login
  rate limiter already makes.
- **No enquiry analytics** (conversion rate, time to contact). The data to compute them is stored.
