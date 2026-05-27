# Hamees Attire — UX Requirements & Design Specification

**Version:** 1.0  
**Date:** May 2026  
**Author:** UX Analysis based on codebase review  
**Application:** Tailor Management System — Hamees Attire, Amritsar

---

## Executive Summary

The application serves a high-end bespoke tailoring shop producing Sherwanis, Kurta Pajamas, Shirts, and other Hindustani garments for a wealthy clientele. The system has solid data models and RBAC but the user experience creates friction in every core workflow. The following requirements address:

1. Repeating customer friction — customers needing to visit physically because data isn't auto-populated
2. Tailor/Master Tailor workflow — no fast path from receiving an order to updating its status
3. Owner analytics — scattered reports, no single view of business health
4. Inventory management — stock shortages not surfaced proactively
5. General navigation — flat sidebar, no global search, no contextual actions

The goal is a system where a Sales Manager can take a repeat order in under 2 minutes, a Tailor can update production status in 1 click, and the Owner sees business health at a glance.

---

## 1. Navigation & Global Shell

### 1.1 Sidebar — Grouped Navigation

**Current problem:** 10 items in a flat list with no visual grouping, no active-route highlight, and operational items (Bulk Upload, Admin Settings) mixed with daily-use items.

**Requirements:**

- **Group items into labelled sections:**
  ```
  OPERATIONS
    Dashboard
    Orders           [badge: active count]
    Customers
  
  PRODUCTION
    Garment Types
    Inventory        [badge: low-stock alerts count]
    Alerts
  
  PROCUREMENT
    Purchase Orders  [badge: pending POs]
  
  FINANCE
    Expenses
    Reports ▾        [expandable sub-menu]
      Financial Report
      Expenses Report
  
  SYSTEM (collapsed by default)
    Bulk Upload
    Admin Settings
  ```
- Active route must receive a distinct highlight (filled background, left accent bar, and primary-colour icon) — currently there is **no active state** in the nav link styles.
- Badge counts must update on page navigation (call lightweight counts API).
- Sidebar width on desktop: 220 px (current) is fine. Add a collapse-to-icon mode toggled by a chevron button for screens < 1280 px.
- Role-filtered items already work — keep this, just apply the grouping above.

### 1.2 Global Command Palette / Search

**Current problem:** There is no global search. Finding a returning customer requires navigating to the Customers page and filtering.

**Requirements:**

- Implement a `Cmd/Ctrl + K` command palette (use `cmdk` library which is already a Radix dependency path).
- Palette searches across: **Customers** (name, phone), **Orders** (order number), **Inventory** (fabric name, SKU).
- Keyboard-navigable results; pressing Enter on a customer opens their detail page; on an order, opens the order detail page.
- Also expose quick actions: "New Order", "New Customer", "New Purchase Order".
- A search icon in the top header bar triggers the same palette for pointer users.

### 1.3 Header Bar

**Current problem:** The sticky header only contains the mobile hamburger menu. It is otherwise empty, wasting 60 px of prime screen space.

**Requirements:**

- Header left: Mobile hamburger (existing) | Breadcrumb (existing — move from page body to header).
- Header centre: Global search trigger (`Cmd K` shortcut label + search icon).
- Header right: 
  - Alerts bell icon with unread count badge (links to `/alerts`).
  - User avatar/name + role badge pill (e.g., "OWNER") with dropdown: Profile, Sign Out.
- Remove per-page breadcrumb from the page body — it duplicates the header.

### 1.4 Mobile Navigation

**Current problem:** The mobile Sheet navigation opens a plain link list with no role context and the user's identity is not visible.

**Requirements:**

- Show user name + role pill at the top of the mobile nav Sheet.
- Use the same grouped sections as the desktop sidebar.
- Add a bottom tab bar for the 4 most-used routes per role:
  - **TAILOR:** My Work Queue | Orders | Customers | Alerts
  - **SALES_MANAGER:** New Order | Orders | Customers | Reports
  - **INVENTORY_MANAGER:** Inventory | Alerts | Purchase Orders | Dashboard
  - **OWNER/ADMIN:** Dashboard | Orders | Reports | Customers

---

## 2. Dashboard — Role-Specific Views

### 2.1 Owner / Admin Dashboard

**Current state:** Multiple charts exist (Financial Trend, Gauge, Customer Retention, Orders Status, Inventory Summary, Top Customers, Garment Revenue). The structure is good. Gaps:

- No "Today at a glance" section above the fold — owner has to scroll through charts to find urgent items.
- No inventory reorder alerts surfaced on the dashboard.
- Report pages do not use the DashboardLayout (financial report renders without sidebar).

**Requirements:**

- **Top strip (above all charts):** 4 KPI cards in one row — Today's Orders Due | Cash Collected This Month | Outstanding Balance | Critical Stock Alerts. Each is a link to the relevant filtered view.
- **Section 2:** Financial trend chart (existing — good).
- **Section 3:** Two-column — left: Orders Status donut (existing); right: upcoming deliveries this week (list of 5–7 orders with customer name + delivery date, sorted soonest first).
- **Section 4:** Inventory health — horizontal bar chart of fabric stocks: green/amber/red based on available vs minimum. Clicking a bar opens the fabric detail.
- **Section 5:** Top Customers + Garment Revenue (existing charts — keep).
- Fix financial report page: wrap it in `DashboardLayout` so the sidebar is present.
- Add `/reports` as a sidebar entry that renders a landing page linking to Financial Report and Expenses Report (currently these are orphaned sub-routes).

### 2.2 Sales Manager Dashboard

**Requirements:**

- Strip: Orders taken this week | Revenue this week | Pending collections | Customers added this month.
- Quick-action card: **"Take New Order"** (prominent CTA, not buried as a small button).
- Recent order activity feed (last 10 orders with status).
- Outstanding payments list — customers with balance > 0 on delivered orders.

### 2.3 Tailor / Master Tailor Dashboard

**Current state:** Cards with counts (In Progress, Due Today, Overdue) and a workload chart. Missing a fast workflow path.

**Requirements:**

- **Production Kanban board** (primary view for tailors): Columns for each status stage — CUTTING | STITCHING | FINISHING | READY. Each card shows: order number, customer name, garment types, delivery date, overdue badge. Cards are sorted by delivery date ascending.
- Clicking a card opens an order detail sheet/drawer (not full navigation), allowing the tailor to:
  - See measurements for the garment items in that order.
  - Move the order to the next status stage with one tap (e.g., "Mark as Stitching ✓").
  - Add/edit tailor notes.
- Keep the KPI cards (In Progress, Due Today, Overdue) as a summary above the Kanban.
- **"My Queue" toggle** — if a tailor is assigned to orders, they can filter to only their assigned orders.
- The Kanban board must work on tablet (iPad is likely how tailors use this on the shop floor).

### 2.4 Inventory Manager Dashboard

**Requirements:**

- Critical stock table: fabrics with available stock < minimum threshold, sorted by urgency. Columns: Fabric Name | SKU | Available | Minimum | % Remaining | Quick-create PO button.
- Pending Purchase Orders: list with supplier, expected delivery date, status.
- Stock movement summary chart (last 30 days): bar chart of meters consumed by fabric type.
- Low-stock threshold alerts prominently above the fold.

---

## 3. Order Workflow

### 3.1 Order List Page

**Current state:** Card list with status pills and an advanced filters drawer. Functional but slow to scan.

**Requirements:**

- Add a **status pipeline tab bar** above the list: `All | New | Material | Cutting | Stitching | Finishing | Ready | Delivered | Cancelled`. Tabs show count badges. Clicking a tab filters instantly (replaces the current status dropdown).
- Add a **view toggle**: Card View (current) | Compact Table View. Table view shows: Order # | Customer | Garments | Delivery Date | Status | Amount | Balance — better for quick scanning of many orders.
- The "Arrears / View Arrears" toggle is good — keep it. Surface it as a tab variant.
- Search field: move out of the filter card into the page header, always visible with a magnifying glass icon. Instant search (debounced — already implemented, just move it).
- **Quick status update from the list**: In compact table view, clicking the status badge opens a small popover with the next logical status as a button (e.g., if CUTTING, show "Move to Stitching"). This saves tailors from opening each order.
- Show the delivery date in relative terms for upcoming/overdue (e.g., "Tomorrow", "In 3 days", "2 days ago") alongside the absolute date.
- "Overdue" entries: the entire row/card should have a red left border, not just a text label.

### 3.2 New Order — Customer Selection (Step 1)

**Current problem:** Customer selection is a plain `<select>` dropdown. With hundreds of customers this is completely unusable. There is no search, no auto-complete, and "Add New Customer" navigates away, losing all form progress.

**Requirements:**

- Replace the select dropdown with a **searchable combobox** (use `cmdk` or Radix's Combobox pattern). Typing filters by name OR phone number in real time.
- After selecting a returning customer, show a **customer profile card** that includes:
  - Name, Phone, City
  - Last order: order number, garment types, date
  - Saved measurements: list of garment types with measurements on file (e.g., "Sherwani ✓", "Kurta Pajama ✓")
  - A "Repeat Last Order" button — see §3.2.1 below.
- **Inline new customer creation**: If no match is found, show a "Create new customer" option in the dropdown results that expands an inline mini-form (Name, Phone, City) — creates the customer without leaving the order form. Full customer details can be completed later.
- This step should also auto-select the customer if the order was initiated from a customer's profile page (already implemented via `?customerId=` query param — just needs the UI to reflect the customer card immediately).

#### 3.2.1 Repeat Order Flow

**Requirements (new feature):**

- On the customer profile card (in step 1), the "Repeat Last Order" button pre-populates:
  - All garment items from the last order (garment type + fabric — user can change fabric).
  - The stitching tier from the last order.
  - The workmanship premiums from the last order.
  - Any applicable measurements on file for the customer.
- A clear **"Repeating order from #ORD-0001"** banner shows at the top of the form with a dismiss option.
- The user can modify any field before submitting.
- This is the primary feature that enables remote/phone repeat orders.

### 3.3 New Order — Order Items (Step 2)

**Current problem:** Fabric and garment type are plain dropdowns showing hundreds of text items. No visual cues. Accessories section is buried below and easy to miss. Measurements are not surfaced during item creation.

**Requirements:**

- **Garment type selection:** Use a card-based selector with a small icon and the garment name. Available types: Sherwani, Kurta Pajama, Shirt, Trouser, etc. Show them as a grid of cards, not a dropdown.
- **Fabric selection:** Group fabrics by type (Silk, Cotton, Linen, etc.) in the dropdown, and show the colour swatch (the `colorHex` field already exists) as a 16×16 px circle next to the name. Available stock shown inline (already in the dropdown text — style this better with a stock indicator).
- **Measurements panel:** When a garment type is selected for an item, show a collapsible "Measurements" panel beside it. If the customer has measurements on file for that garment type, show them pre-loaded (read-only with an edit icon). If no measurements exist, show a "Add Measurements" link/button that opens the measurement form in a side panel (not a navigation away).
- Accessory section: Render accessories as checkboxes with quantity spinners rather than a secondary select dropdown. Group by type (Buttons, Thread, Lining, etc.).
- **Item summary chip:** When an item is fully configured (garment + fabric selected), show a compact summary chip at the top of the item card: `[colour swatch] Sherwani · Raw Silk · Royal Blue · REGULAR`.

### 3.4 New Order — Pricing & Details (Step 3)

**Current problem:** Step 3 combines Order Details, Premium Pricing Configuration, Manual Price Overrides, and Order Summary into one enormous scrollable page. This is overwhelming for a Sales Manager and unnecessary for a Tailor.

**Requirements:**

- **Split by role:**
  - **SALES_MANAGER / OWNER / ADMIN:** See full step 3 with all pricing options.
  - All roles see: Delivery date, Advance payment, Notes.
- **Default to collapsed sections:** The "Premium Pricing Configuration" and "Manual Price Overrides" cards should be collapsed by default, expandable with a chevron. Show a summary line when collapsed (e.g., "Stitching Tier: BASIC · No premiums").
- **Pricing preview sidebar/panel:** On desktop, show the live cost breakdown as a sticky right-side panel as the user scrolls through step 3 (not just the top bar). On mobile, keep the bottom sticky summary bar (already exists — good).
- **Stitching tier selector:** Current radio-card design is good — keep it. Make tier descriptions more contextual (e.g., "LUXURY — for Sherwani and formal wear").
- **Delivery date:** Pre-suggest delivery dates at 7 days, 14 days, 21 days as quick-select chips. User can also pick from a calendar.
- **Advance payment:** Show the suggested 50% deposit as a quick-select chip (e.g., "50% = ₹12,500"). A custom amount field remains available.
- **Validation:** Show inline validation as fields are completed (not only at submit time). The current error display only appears at the top after the submit attempt.
- The current 3-step wizard can remain, but steps should be accessible from the top progress bar (allow clicking back to step 1/2 from step 3).

### 3.5 Order Detail Page

**Current state:** The order detail page is comprehensive with status updates, payment installments, tailor notes, split order, WhatsApp, and invoice print. Structure is good but dense.

**Requirements:**

- **Page header:** Show the order number, customer name (clickable → customer detail), status badge, and delivery date prominently.
- **Status progression bar:** A horizontal pipeline showing all 8 statuses with the current one highlighted and a timestamp for when each stage was reached. This gives the customer (via WhatsApp updates) and the Owner a clear progress view.
- **Action bar:** The primary actions (Update Status, Record Payment, Print Invoice, Send WhatsApp) should be in a fixed action strip at the top or bottom of the page — not buried in separate cards.
- **Measurements tab:** Add a tab on the order detail page that shows measurements for each order item (currently requires navigating to the customer profile separately). Tailors need this constantly.
- **Timeline/History:** The `OrderHistory` component exists — surface it as a collapsible "Activity Log" section at the bottom.
- **Quick payment entry:** The "Record Payment" dialog is good — add a secondary quick-entry at the top (amount field + "Collect ₹X" button for the exact balance).

---

## 4. Customer Management

### 4.1 Customer List

**Current state:** Basic list with search. Not reviewed in detail but assumed similar to the orders list.

**Requirements:**

- Table/card view toggle (same as orders).
- Sort by: Last order date | Name | Total spend | City.
- **VIP indicator:** Customers with lifetime spend > a threshold (configurable in settings) get a star/crown icon. This reflects the high-end clientele nature.
- "Add Measurement" quick action in the customer row (without opening the full profile).
- Filter by: Has pending orders | Has outstanding balance | City | Garment preferences.

### 4.2 Customer Detail Page

**Current state:** Shows customer info, measurements section, and order history. The Edit button opens a dialog. Structure is reasonable.

**Requirements:**

- **Prominent "New Order" CTA:** A primary button at the top right of the customer detail page that links to `/orders/new?customerId=X`. Currently this action requires going to the orders list and using "New Order". For a tailor shop taking repeat orders, this CTA must be the most visible element on the customer page.
- **Measurements section redesign:**
  - Show measurements grouped by garment type in tabs (Sherwani | Kurta Pajama | Shirt | Trouser | …).
  - For each garment type, show a silhouette diagram (SVG body outline) with measurement labels overlaid on the relevant body parts. This is far more intuitive for tailors than a table of numbers.
  - If a measurement is missing, show a "–" with a hint to add it.
  - Show who recorded the measurement and when.
  - "History" button to see measurement changes over time (the `MeasurementHistoryDialog` already exists — just surface it more clearly).
- **Order history timeline:** Show the customer's orders as a vertical timeline sorted by date, with garment type chips, status badge, and total amount. Clicking expands an order summary inline. This replaces the current plain card list.
- **Customer spend summary:** Total spend to date | Number of orders | Favourite garment type | Last visit date — displayed as KPI chips at the top of the customer detail.
- **"Repeat Last Order" button** on the customer detail page (pre-fills the order form — same as §3.2.1).

### 4.3 New Customer Form

**Current problem:** The new customer form navigates away from the order creation flow.

**Requirements:**

- The inline mini-form (Name, Phone, City) inside the order creation combobox covers the immediate need (§3.2).
- The full `/customers/new` page remains for standalone customer registration.
- Add fields: **WhatsApp number** (separate from phone if different), **preferred contact method**, **occasion notes** (e.g., "Wedding season customer — orders every Oct–Dec"). These are key for a high-end boutique CRM.
- City/State/Pincode fields remain but should use autocomplete (Indian cities).

---

## 5. Inventory Management

### 5.1 Inventory Page

**Current state:** Delegated entirely to `InventoryPageClient` — not read in detail. The schema has `ClothInventory` and `AccessoryInventory` with `currentStock` and `reserved` fields.

**Requirements:**

- **Tab-based layout:** Cloth Inventory | Accessories | Stock Movements.
- **Stock health indicators:** Each fabric row shows a horizontal mini-bar (green/amber/red) for available stock vs minimum. This is better than just numbers.
- **Colour swatch column:** Show the `colorHex` as a swatch circle, not just text. Fabric selection becomes visual.
- **Fabric card view option:** For the Owner / Inventory Manager, a card view showing fabric thumbnail (colour swatch + name + available meters in large text) gives a faster stock overview than a table.
- **Quick reorder:** Each low-stock fabric row has a "Create PO" quick action button that pre-fills a new Purchase Order with that fabric.
- **Stock forecast:** Based on average monthly consumption (derived from `StockMovement` history), show estimated days of stock remaining for each fabric. "~23 days remaining" next to the stock count.

### 5.2 Alerts Page

**Current problem:** Alerts exist but the link to take action is not clearly visible.

**Requirements:**

- Alerts should be clearly categorised: **Low Stock** | **Overdue Orders** | **Outstanding Payments** | **PO Delays**.
- Each alert must have a direct action button: Low stock → "Create PO"; Overdue order → "Open Order"; Outstanding payment → "Record Payment".
- Alert count badge in sidebar (already required in §1.1).
- Allow marking alerts as "Acknowledged" so they stop showing (they re-trigger if the condition persists).

---

## 6. Purchase Orders

**Current state:** Purchase Orders exist as a full CRUD module. Not detailed in code review.

**Requirements:**

- **Supplier quick-select:** Commonly used suppliers should appear as clickable chips at the top of the new PO form (not just in a dropdown).
- **PO from inventory alert:** Flow from §5.2 — clicking "Create PO" from a low-stock alert pre-populates the fabric and a suggested quantity (2× monthly average consumption).
- **Receiving workflow:** When a PO is marked received, a confirmation dialog asks for the actual quantity received (which may differ from the ordered quantity) and the receipt date. This updates stock levels atomically (already handled in the backend — just clarify the UI).
- Show PO status prominently: DRAFT | ORDERED | PARTIALLY_RECEIVED | RECEIVED | CANCELLED with colour coding.

---

## 7. Reports & Analytics

### 7.1 Reports Navigation

**Current problem:** Financial Report and Expenses Report are at `/reports/financial` and `/reports/expenses` but neither is linked from the sidebar. The Financial Report page renders without `DashboardLayout`.

**Requirements:**

- Add a **Reports** item in the sidebar (Finance section) that expands to show sub-links.
- Create a `/reports` landing page (inside `DashboardLayout`) with card links to each report.
- Fix `/reports/financial/page.tsx` to use `DashboardLayout`.

### 7.2 Owner Analytics Requirements

**Current state:** Multiple chart components exist (Revenue, Trend, Gauge, Customer Retention, Top Customers, Garment Revenue, Fabric Revenue). These are impressive but scattered.

**Requirements:**

- **Unified Dashboard tab on Owner's dashboard:** A "Reports" tab within the dashboard (not a separate page) that shows all charts in a curated layout with a date range picker at the top.
- **Date range picker:** Allow selecting: Last 7 days | Last 30 days | Last 3 months | Last 6 months | Last 12 months | Custom. The range drives all charts on the page simultaneously. A `DateRangeSelector` component already exists in the dashboard — standardise its use.
- **Inventory consumption report:** Which fabrics are consumed fastest, wastage by fabric type, and a suggested reorder quantity. This directly serves the procurement need ("work out what is being used and what is falling short").
- **Tailor productivity report:** For OWNER/ADMIN, show garments completed per tailor per week, average time per garment type, and on-time delivery rate per tailor.
- **Print / Export:** Each report page needs a Print button and a Download CSV button. Print already exists on the financial report — ensure all reports have it.

---

## 8. Production Workflow (Tailor / Master Tailor)

### 8.1 Production Pipeline

**Requirements (complements §2.3):**

- **Kanban board columns:** CUTTING → STITCHING → FINISHING → READY.
- NEW and MATERIAL_SELECTED orders appear in a "Queued" section before Cutting.
- DELIVERED orders are archived (not shown by default; "Show Delivered" toggle).
- Each Kanban card shows:
  - Order number (bold)
  - Customer name
  - Garment type chips (e.g., `Sherwani` `Kurta Pajama`)
  - Delivery date (coloured: green if > 3 days, amber if 1–3 days, red if tomorrow or overdue)
  - Assigned tailor name (if set)
  - Colour swatch of the fabric
- **Drag-and-drop** between columns updates the order status (Kanban drag is a stretch goal; button-based status update is the MVP).
- **One-click status advance:** Each card has a "Move to Next Stage →" button.

### 8.2 Tailor Assignment

**Current state:** `AssignTailorDialog` component exists on the order detail page.

**Requirements:**

- Tailor assignment must also be available from the Kanban card (quick action without opening the full order detail).
- The Tailor dashboard's "My Work Queue" shows only orders assigned to the logged-in tailor.
- Master Tailor (ADMIN role in the context of production) can see all assignments and re-assign.

### 8.3 Measurements in the Workflow

**Current problem:** Tailors have to navigate: Order → Customer profile → Measurements to get the measurements. This breaks their workflow.

**Requirements:**

- On the order detail page, each order item card must display the **measurement panel inline** (the measurement values for that garment type, sourced from the customer's measurement profile).
- If measurements are not yet recorded for that garment type, show a red "Measurements Missing" badge on the item card, which is a link to add them.
- The visual body diagram from `visual-measurements` page should be embeddable as a component within the order item card (read-only view for the tailor).

### 8.4 Status Update Communication

**Requirements:**

- When the tailor marks an order as READY, the system should prompt (not auto-send): "Send WhatsApp notification to [Customer Name]?" with a preview of the message. The `SendWhatsAppButton` already exists — wire this prompt into the status change confirmation flow.
- When any status changes, the timeline on the order detail page updates with a timestamp and the name of the person who made the change (the `OrderHistory` component exists — use it for this).

---

## 9. Repeat Order & Auto-Population

This is the highest-priority feature described by the business owner.

### 9.1 Requirements

- **Customer lookup auto-populate:** When a customer is selected in a new order form, automatically fetch and display their:
  - Most recently ordered garments.
  - Saved measurements for all garment types.
  - Preferred fabric types (derived from order history).
  - Last used stitching tier and workmanship premiums.
- **"Clone Last Order" button:** Available on the order detail page of any past order. Creates a new draft order pre-populated with all the same items, fabric selections, stitching tier, and pricing configuration. Customer and delivery date are reset (must be set fresh).
- **Measurement auto-attach:** When creating a new order item for a returning customer, the system checks if a measurement exists for that garment type and auto-attaches it to the order item. If none exists, the item shows a "Missing Measurements" warning badge (not a hard blocker — order can proceed).
- **Phone/remote order enablement:** The combination of auto-populated customer data, measurement history, and fabric preferences means a Sales Manager can take a complete repeat order over the phone without the customer visiting. The form should surface all the information needed to confirm: "Mr. Sharma, your last Sherwani was in Royal Blue Silk, Regular body type, Basic stitching. Same again?"

---

## 10. WhatsApp & Communication

**Current state:** `SendWhatsAppButton` exists on the order detail page.

**Requirements:**

- **Status update templates:** Pre-defined WhatsApp message templates for each status transition:
  - Order confirmed (NEW): "Dear [Name], your order #ORD-XXXX for [Garment] has been confirmed. Delivery by [Date]. – Hamees Attire"
  - READY: "Dear [Name], your [Garment] is ready for pickup/delivery. Please contact us to arrange. – Hamees Attire"
  - Custom message option always available.
- **Communication log:** Show a "Messages Sent" section on the customer detail page showing which WhatsApp messages were sent and when.
- **Delivery reminder:** The system should surface (not auto-send) a WhatsApp reminder prompt when an order is READY and the delivery date is approaching or past.

---

## 11. Form & Interaction Standards

### 11.1 Form UX

- **Inline validation:** Fields should validate on blur (when the user leaves the field), not only on submit. Error messages appear below the field in red.
- **Required vs optional labelling:** Mark required fields with an asterisk (*) and optional fields with "(Optional)". Currently inconsistent.
- **Currency inputs:** Use a styled currency input with ₹ prefix — not a plain number input. Enforce two decimal places on blur.
- **Date inputs:** Use a date picker component (calendar picker), not a raw `<input type="date">` which renders inconsistently across browsers and is hard on mobile.
- **Select dropdowns:** Replace all `<select>` elements that have more than 10 options with a searchable Combobox. This applies to: Customer selection, Fabric selection, Supplier selection, Garment pattern selection.

### 11.2 Loading States

- Replace all `animate-spin rounded-full` spinners with **skeleton screens** (placeholder cards that match the shape of the loaded content). This is less jarring and communicates structure.
- Skeleton screens for: Order list cards, Customer list, Inventory table.

### 11.3 Empty States

- Empty states should be informative and actionable. Current pattern ("No orders yet. Create your first order.") is acceptable. Ensure all pages have empty states.
- For the Tailor's Kanban board when all orders are done: show a congratulatory empty state ("All caught up! No orders in production.").

### 11.4 Toast Notifications

- **Consolidate to one toast system.** Currently both `@radix-ui/react-toast` (via `Toaster`) and `sonner` are used. Pick `sonner` as the standard and migrate all `toast()` calls to it. `sonner` is more capable (has promise-based API, undo actions, better animations).
- **Toast positioning:** Bottom-right on desktop. Bottom-centre on mobile (avoids the bottom tab bar if implemented).
- **Action toasts:** For destructive operations (cancel order, delete customer), show an Undo toast for 5 seconds.

### 11.5 Confirmation Dialogs

- Any irreversible action (cancelling an order, deleting inventory, removing a customer) requires a confirmation dialog.
- The dialog must name the specific item: "Cancel order #ORD-0042 for Rajinder Singh?" — not just "Are you sure?".
- Destructive buttons must be red. Cancel button must be visually less prominent.

---

## 12. Visual Design Direction

The application serves a **high-end boutique** for wealthy clients. The UI should reflect this positioning.

### 12.1 Colour Palette Refinement

- Current palette (slate/blue/neutral) is serviceable but generic.
- Introduce a **brand accent colour** derived from Hamees Attire's identity — a deep gold (`#B8860B` — "dark goldenrod") or a rich burgundy (`#722F37`) as the primary accent, replacing the generic blue (`blue-600`).
- Keep the neutral slate as the base. The accent colour is used for: primary buttons, active nav items, status badges for key states (READY), and KPI card highlights.
- This change alone will make the application feel premium instead of generic SaaS.

### 12.2 Typography

- The current font appears to be the system default. Introduce **Noto Serif** (supports Devanagari for future Hindi support) or **Cormorant Garamond** for headings (h1, h2) to give a luxury tailoring aesthetic.
- Body text remains sans-serif (Inter or system-ui) for readability.

### 12.3 Card & Surface Design

- Cards: softer shadows (`shadow-sm` → `shadow-md` on hover), slight border radius increase (current `rounded-lg` is good), consider subtle warm tint on card backgrounds (off-white `#FAFAF8` instead of pure white) to feel more craft-oriented than tech.
- Status badges: ensure consistent sizing and font weight across all pages (currently some use `px-3 py-1` and others use `Badge` component differently).

### 12.4 Iconography

- The current Lucide icon set is appropriate — continue using it.
- Add garment-specific icons (Sherwani silhouette, Kurta silhouette) as SVG illustrations for empty states and garment type selectors. These can be simple line illustrations.
- The body measurement diagram (already implemented in `visual-measurements`) should be made into a reusable component.

---

## 13. Role-Specific UX Requirements Summary

| Role | Primary Workflow | Key UX Needs |
|------|-----------------|--------------|
| **OWNER** | View business health, manage financials | Unified dashboard with all KPIs, export reports, no clutter |
| **ADMIN** | Same as Owner + user management | Full access, advanced settings easily accessible |
| **SALES_MANAGER** | Take orders, manage customers, track payments | Fast order creation (< 2 min repeat), customer auto-populate, payment collection |
| **INVENTORY_MANAGER** | Track stock, raise POs, receive goods | Stock health at a glance, one-click PO creation, receive-goods workflow |
| **TAILOR** | See work queue, update status, view measurements | Kanban board, one-click status update, inline measurements, no financial data |
| **VIEWER** | Read-only access | Clean read-only views, no edit/create buttons shown |

---

## 14. Prioritised Implementation Roadmap

### Phase 1 — Critical (Breaks Core Workflow Today)

| # | Requirement | Effort |
|---|------------|--------|
| 1 | Customer searchable combobox in new order form | Medium |
| 2 | Repeat order / Clone last order button | Medium |
| 3 | Measurements shown inline on order items | Small |
| 4 | Tailor Kanban board with one-click status update | Large |
| 5 | Active state on sidebar nav links | Small |
| 6 | Fix Financial Report to use DashboardLayout | Small |

### Phase 2 — High Value (UX significantly improved)

| # | Requirement | Effort |
|---|------------|--------|
| 7 | Global command palette (Cmd+K search) | Medium |
| 8 | Inline new customer creation in order form | Medium |
| 9 | Status pipeline tab bar on orders list | Small |
| 10 | Sidebar grouped navigation with badges | Small |
| 11 | Reports landing page + sidebar link | Small |
| 12 | Compact table view for orders | Medium |

### Phase 3 — Quality of Life

| # | Requirement | Effort |
|---|------------|--------|
| 13 | Skeleton loading screens | Medium |
| 14 | Consolidated toast system (sonner) | Small |
| 15 | WhatsApp status update prompts in workflow | Medium |
| 16 | Fabric colour swatch in selections | Small |
| 17 | Date picker component (replace native inputs) | Small |
| 18 | Owner dashboard "Today at a glance" strip | Small |
| 19 | Customer VIP indicators | Small |
| 20 | Brand accent colour + typography refinement | Medium |

### Phase 4 — Advanced Features

| # | Requirement | Effort |
|---|------------|--------|
| 21 | Visual body diagram embeddable in order items | Large |
| 22 | Tailor productivity report | Large |
| 23 | Inventory stock forecast (days remaining) | Medium |
| 24 | Mobile bottom tab bar per role | Medium |
| 25 | WhatsApp communication log | Large |

---

## 15. Technical Notes for Implementation

- **Combobox:** Use `cmdk` (Command Menu) — it is compatible with the Radix UI stack already in use. Pattern: `shadcn/ui` has a `<Combobox>` recipe built on cmdk.
- **Kanban board:** Use `@dnd-kit/core` and `@dnd-kit/sortable` for drag-and-drop (lighter than react-beautiful-dnd, works with React 19). Button-based status advance is the MVP.
- **Date picker:** `react-day-picker` (already a transitive dependency of many Radix packages). `shadcn/ui` has a `<DatePicker>` recipe.
- **Toast consolidation:** Remove `@radix-ui/react-toast` usage (keep `Toaster` only if no other components depend on it) and standardise on `sonner`. Both are already installed; `sonner` is already used in newer components.
- **Repeat order API:** Add a `GET /api/orders/:id/clone-data` endpoint that returns the order's items, pricing configuration, and the customer's current measurements — the new order form fetches this when "Repeat Order" is clicked.
- **Stock forecast:** Compute in the existing `/api/inventory` endpoint: `avgMonthlyConsumption = total consumed in last 90 days / 3`. `daysRemaining = (currentStock - reserved) / (avgMonthlyConsumption / 30)`.
- **Measurement auto-attach:** Modify the `POST /api/orders` handler to accept `autoAttachMeasurements: true`. The handler looks up active measurements for each `garmentPatternId` + customer combo and attaches them to the order items.

---

*End of UX Requirements Document*
