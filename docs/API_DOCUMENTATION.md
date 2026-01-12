# API Documentation

This document outlines the available API endpoints for the Tailor Inventory Management System.

## Base URL

`/api`

## Authentication

Authentication is handled by NextAuth.js. Authenticated users will have a session token that grants access to protected routes.

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

### `/api/suppliers`

- **GET /**: Retrieves a list of all suppliers.
- **POST /**: Creates a new supplier.
- **GET /{id}**: Retrieves a specific supplier by ID.
- **PUT /{id}**: Updates a specific supplier.
- **DELETE /{id}**: Deletes a specific supplier.
