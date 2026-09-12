# API Documentation

This document outlines the available API endpoints for the Tailor Inventory Management System.

## Base URL

`/api`

## Authentication

Authentication is handled by NextAuth.js. Authenticated users will have a session token that grants access to protected routes.

Every route below requires a session **and** a permission from `lib/permissions.ts`, with the object
scopes in `lib/authz.ts` applied to order and customer data, except these four, which are public by
design and enumerated (and enforced) in `tests/unit/api/public-surface.test.ts`:

| Route | Why it is public |
|---|---|
| `GET /api/health` | uptime check; reports only whether the database is reachable |
| `/api/auth/*` | NextAuth's own handlers |
| `POST /api/public/enquiries` | the public order enquiry form; write-only |
| `POST /api/excel/submit-order` | not session-based: guarded by the `X-Excel-Api-Key` header (`lib/excel-api-auth.ts`) |

## Endpoints

### `/api/alerts`

- **GET /**: Fetches all alerts.
- **POST /**: Creates a new alert.

### `/api/auth/*`

- NextAuth.js authentication routes.

### `/api/customers`

- **GET /**: Retrieves a list of all customers.
- **POST /**: Creates a new customer.
- **GET /{id}**: Retrieves a specific customer by ID.
- **PUT /{id}**: Updates a specific customer.
- **DELETE /{id}**: Deletes a specific customer.

### `/api/dashboard`

- **GET /**: Retrieves data for the main dashboard.

### `/api/enquiries`

Staff handling of enquiries left through the public `/order` page.

- **GET /**: Lists enquiries, filterable by `status` and a search term `q`. Requires `view_enquiries`. Never returns the stored IP hash or user agent.
- **PATCH /{id}**: Moves an enquiry between `NEW`, `CONTACTED` and `CLOSED` and records staff notes. Requires `manage_enquiries`. An enquiry already `CONVERTED` cannot be moved back.
- **POST /{id}/convert**: Finds or creates the customer for an enquiry and returns them; it does **not** create the order. Requires `manage_enquiries`, `manage_customers` and `create_order` together. Returns `409 MULTIPLE_CUSTOMERS` with candidates when the phone number matches more than one customer.

The enquiry is marked `CONVERTED` by `POST /api/orders` when that order is created with `enquiryId`, so an abandoned new-order form leaves no half-made order.

### `/api/expenses`

- **GET /**: Retrieves a list of all expenses.
- **POST /**: Creates a new expense.

### `/api/garment-patterns`

- **GET /**: Retrieves a list of all garment patterns.
- **POST /**: Creates a new garment pattern.

### `/api/inventory`

- **GET /cloth**: Retrieves a list of all cloth inventory items.
- **POST /cloth**: Creates a new cloth inventory item.
- **GET /accessories**: Retrieves a list of all accessory inventory items.
- **POST /accessories**: Creates a new accessory inventory item.
- **GET /barcode?barcode={sku}**: Looks up an inventory item by barcode/SKU.

### `/api/orders`

- **GET /**: Retrieves a list of all orders.
- **POST /**: Creates a new order.
- **GET /{id}**: Retrieves a specific order by ID.
- **PUT /{id}**: Updates a specific order.
- **DELETE /{id}**: Deletes a specific order.

### `/api/purchase-orders`

- **GET /**: Retrieves a list of all purchase orders.
- **POST /**: Creates a new purchase order.

### `/api/public/*`

Unauthenticated. The only write an anonymous visitor can perform.

- **POST /public/enquiries**: Records one order enquiry (name, phone, garment type, quantity, preferred date, notes). Creates no order and reserves no stock. Rate-limited to 5 per IP address and 3 per phone number per hour (`429` with `Retry-After`); carries a hidden honeypot field; stores only a salted hash of the IP address; refuses a phone number that cannot be dialled with `400`. It is the only route in this namespace.

The garment type names shown on the form are read directly by the `/order` server component; there is no public endpoint for them.

### `/api/suppliers`

- **GET /**: Retrieves a list of all suppliers.
- **POST /**: Creates a new supplier.
- **GET /{id}**: Retrieves a specific supplier by ID.
- **PUT /{id}**: Updates a specific supplier.
- **DELETE /{id}**: Deletes a specific supplier.
