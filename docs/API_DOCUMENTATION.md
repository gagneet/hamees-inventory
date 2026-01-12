# API Documentation - Hamees Attire Inventory Management System

## Base URL
```
http://localhost:5000
```

## Endpoints Overview

### System
- `GET /` - Welcome message and API endpoints
- `GET /api/stats` - System statistics

### Customers
- `GET /api/customers` - List all customers
- `POST /api/customers` - Create new customer
- `GET /api/customers/{id}` - Get customer details
- `PUT /api/customers/{id}` - Update customer
- `DELETE /api/customers/{id}` - Delete customer

### Inventory
- `GET /api/inventory` - List all inventory items
- `POST /api/inventory` - Add new inventory item
- `GET /api/inventory/{id}` - Get item details
- `PUT /api/inventory/{id}` - Update inventory item
- `DELETE /api/inventory/{id}` - Delete item
- `GET /api/inventory/low-stock` - Get low stock items

### Orders
- `GET /api/orders` - List all orders
- `POST /api/orders` - Create new order
- `GET /api/orders/{id}` - Get order details
- `PUT /api/orders/{id}` - Update order
- `DELETE /api/orders/{id}` - Delete order
- `POST /api/orders/{id}/complete` - Complete order and deduct inventory

---

## Detailed Endpoint Documentation

### 1. System Endpoints

#### GET /
Get welcome message and available endpoints.

**Response:**
```json
{
  "message": "Welcome to Hamees Attire Inventory Management System",
  "version": "1.0.0",
  "endpoints": {
    "customers": "/api/customers",
    "inventory": "/api/inventory",
    "orders": "/api/orders",
    "low_stock": "/api/inventory/low-stock"
  }
}
```

#### GET /api/stats
Get system statistics.

**Response:**
```json
{
  "customers": 4,
  "inventory_items": 12,
  "total_orders": 4,
  "orders": {
    "pending": 2,
    "in_progress": 1,
    "completed": 1
  },
  "low_stock_items": 2
}
```

---

### 2. Customer Endpoints

#### GET /api/customers
List all customers.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Ahmed Khan",
    "phone": "+92-300-1234567",
    "email": "ahmed.khan@example.com",
    "address": "123 Main Street, Karachi",
    "created_at": "2024-01-11T07:52:47.145159"
  }
]
```

#### POST /api/customers
Create a new customer.

**Request Body:**
```json
{
  "name": "John Doe",
  "phone": "+1234567890",
  "email": "john@example.com",
  "address": "123 Main St, City"
}
```

**Required Fields:**
- `name` (string): Customer name
- `phone` (string): Phone number

**Optional Fields:**
- `email` (string): Email address
- `address` (string): Physical address

**Response:** 201 Created
```json
{
  "id": 5,
  "name": "John Doe",
  "phone": "+1234567890",
  "email": "john@example.com",
  "address": "123 Main St, City",
  "created_at": "2024-01-11T08:00:00"
}
```

#### GET /api/customers/{id}
Get details of a specific customer.

**Response:**
```json
{
  "id": 1,
  "name": "Ahmed Khan",
  "phone": "+92-300-1234567",
  "email": "ahmed.khan@example.com",
  "address": "123 Main Street, Karachi",
  "created_at": "2024-01-11T07:52:47.145159"
}
```

#### PUT /api/customers/{id}
Update customer information.

**Request Body:** (all fields optional)
```json
{
  "name": "Updated Name",
  "phone": "+9876543210",
  "email": "newemail@example.com",
  "address": "New Address"
}
```

**Response:** 200 OK with updated customer data

#### DELETE /api/customers/{id}
Delete a customer.

**Response:** 204 No Content

---

### 3. Inventory Endpoints

#### GET /api/inventory
List all inventory items or filter by category.

**Query Parameters:**
- `category` (optional): Filter by category (e.g., fabric, thread, button, accessory)

**Example:**
```
GET /api/inventory?category=fabric
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Premium Cotton Fabric - White",
    "category": "fabric",
    "description": "High quality 100% cotton fabric ideal for shirts",
    "quantity": 100.0,
    "unit": "meters",
    "price_per_unit": 25.50,
    "reorder_level": 15.0,
    "supplier_name": "ABC Textiles Ltd",
    "supplier_contact": "+92-21-11111111",
    "is_low_stock": false,
    "created_at": "2024-01-11T07:52:47.148499",
    "updated_at": "2024-01-11T07:52:47.148500"
  }
]
```

#### POST /api/inventory
Add a new inventory item.

**Request Body:**
```json
{
  "name": "Premium Cotton Fabric",
  "category": "fabric",
  "description": "High quality cotton",
  "quantity": 50,
  "unit": "meters",
  "price_per_unit": 25.50,
  "reorder_level": 10,
  "supplier_name": "ABC Textiles",
  "supplier_contact": "+1234567890"
}
```

**Required Fields:**
- `name` (string): Item name
- `category` (string): Item category
- `quantity` (float): Current quantity
- `unit` (string): Unit of measurement
- `price_per_unit` (float): Price per unit

**Optional Fields:**
- `description` (string): Item description
- `reorder_level` (float): Low stock threshold (default: 10)
- `supplier_name` (string): Supplier name
- `supplier_contact` (string): Supplier contact

**Response:** 201 Created with item data

#### GET /api/inventory/{id}
Get details of a specific inventory item.

**Response:** Item object (same structure as list response)

#### PUT /api/inventory/{id}
Update inventory item.

**Request Body:** (all fields optional)
```json
{
  "quantity": 75.5,
  "price_per_unit": 28.00,
  "reorder_level": 15
}
```

**Response:** 200 OK with updated item data

#### DELETE /api/inventory/{id}
Delete an inventory item.

**Response:** 204 No Content

#### GET /api/inventory/low-stock
Get all items at or below their reorder level.

**Response:**
```json
[
  {
    "id": 5,
    "name": "Denim Fabric - Dark Blue",
    "category": "fabric",
    "quantity": 8.0,
    "unit": "meters",
    "reorder_level": 10.0,
    "is_low_stock": true,
    ...
  }
]
```

---

### 4. Order Endpoints

#### GET /api/orders
List all orders with optional filters.

**Query Parameters:**
- `status` (optional): Filter by status (pending, in_progress, completed, delivered)
- `customer_id` (optional): Filter by customer ID

**Example:**
```
GET /api/orders?status=pending
GET /api/orders?customer_id=1
```

**Response:**
```json
[
  {
    "id": 1,
    "customer_id": 1,
    "customer_name": "Ahmed Khan",
    "order_date": "2024-01-01T07:52:47.151515",
    "delivery_date": "2024-01-13T07:52:47.151527",
    "status": "completed",
    "garment_type": "shirt",
    "measurements": {
      "chest": 40.0,
      "waist": 34.0,
      "shoulder": 18.0,
      "sleeve_length": 24.0,
      "shirt_length": 30.0,
      "neck": 15.5,
      "hip": null,
      "inseam": null
    },
    "special_instructions": "Blue color with white collar",
    "total_price": 1500.00,
    "advance_payment": 500.00,
    "balance_due": 1000.00,
    "items_used": [
      {
        "id": 1,
        "order_id": 1,
        "inventory_item_id": 2,
        "inventory_item_name": "Premium Cotton Fabric - Blue",
        "quantity_used": 2.5,
        "unit": "meters"
      }
    ],
    "created_at": "2024-01-11T07:52:47.153581",
    "updated_at": "2024-01-11T07:52:47.153583"
  }
]
```

#### POST /api/orders
Create a new tailoring order.

**Request Body:**
```json
{
  "customer_id": 1,
  "garment_type": "shirt",
  "delivery_date": "2024-02-15T00:00:00",
  "chest": 40,
  "waist": 34,
  "shoulder": 18,
  "sleeve_length": 24,
  "shirt_length": 30,
  "neck": 15.5,
  "special_instructions": "Extra button on collar",
  "total_price": 150.00,
  "advance_payment": 50.00,
  "items_used": [
    {
      "inventory_item_id": 1,
      "quantity_used": 2.5
    }
  ]
}
```

**Required Fields:**
- `customer_id` (integer): Customer ID
- `garment_type` (string): Type of garment (shirt, pant, suit, dress, etc.)
- `total_price` (float): Total order price

**Optional Fields:**
- `delivery_date` (string): ISO 8601 formatted date
- Measurements: `chest`, `waist`, `shoulder`, `sleeve_length`, `shirt_length`, `neck`, `hip`, `inseam` (all float)
- `special_instructions` (string): Custom requirements
- `advance_payment` (float): Advance payment (default: 0)
- `items_used` (array): List of inventory items used

**Response:** 201 Created with order data

#### GET /api/orders/{id}
Get details of a specific order.

**Response:** Order object (same structure as list response)

#### PUT /api/orders/{id}
Update order information.

**Request Body:** (all fields optional)
```json
{
  "status": "in_progress",
  "delivery_date": "2024-02-20T00:00:00",
  "total_price": 175.00,
  "special_instructions": "Updated instructions"
}
```

**Special Behavior:**
- If `status` is changed to "completed", inventory will be automatically deducted for all items in the order

**Response:** 200 OK with updated order data

#### DELETE /api/orders/{id}
Delete an order.

**Response:** 204 No Content

#### POST /api/orders/{id}/complete
Mark an order as completed and deduct inventory.

**Special Behavior:**
- Validates sufficient inventory before completion
- Automatically deducts quantities from inventory items
- Changes order status to "completed"

**Response:** 200 OK with order data

**Error Response (Insufficient Inventory):**
```json
{
  "error": "Insufficient quantity for Premium Cotton Fabric",
  "available": 2.0,
  "required": 2.5
}
```

---

## Data Models

### Customer
```json
{
  "id": integer,
  "name": string,
  "phone": string,
  "email": string (optional),
  "address": string (optional),
  "created_at": datetime
}
```

### Inventory Item
```json
{
  "id": integer,
  "name": string,
  "category": string,
  "description": string (optional),
  "quantity": float,
  "unit": string,
  "price_per_unit": float,
  "reorder_level": float,
  "supplier_name": string (optional),
  "supplier_contact": string (optional),
  "is_low_stock": boolean,
  "created_at": datetime,
  "updated_at": datetime
}
```

### Tailoring Order
```json
{
  "id": integer,
  "customer_id": integer,
  "customer_name": string,
  "order_date": datetime,
  "delivery_date": datetime (optional),
  "status": string,
  "garment_type": string,
  "measurements": {
    "chest": float,
    "waist": float,
    "shoulder": float,
    "sleeve_length": float,
    "shirt_length": float,
    "neck": float,
    "hip": float,
    "inseam": float
  },
  "special_instructions": string (optional),
  "total_price": float,
  "advance_payment": float,
  "balance_due": float (calculated),
  "items_used": array of OrderItem,
  "created_at": datetime,
  "updated_at": datetime
}
```

### Order Item
```json
{
  "id": integer,
  "order_id": integer,
  "inventory_item_id": integer,
  "inventory_item_name": string,
  "quantity_used": float,
  "unit": string
}
```

---

## Status Codes

- `200 OK` - Successful GET, PUT request
- `201 Created` - Successful POST request
- `204 No Content` - Successful DELETE request
- `400 Bad Request` - Invalid request data
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

---

## Common Categories

**Inventory Categories:**
- `fabric` - Fabrics (cotton, silk, wool, denim, etc.)
- `thread` - Sewing threads
- `button` - Buttons
- `accessory` - Zippers, shoulder pads, interfacing, etc.
- `garment` - Finished garments

**Garment Types:**
- `shirt` - Shirts
- `pant` / `trouser` - Trousers
- `suit` - Suits
- `dress` - Dresses
- `jacket` - Jackets
- `kurta` - Traditional kurtas
- Custom types as needed

**Order Status:**
- `pending` - Order received, not started
- `in_progress` - Work in progress
- `completed` - Work completed, inventory deducted
- `delivered` - Order delivered to customer

---

## Error Handling

All error responses follow this format:
```json
{
  "error": "Error message description"
}
```

**Common Errors:**
- Missing required fields
- Invalid data types
- Resource not found
- Insufficient inventory
- Foreign key constraints (e.g., invalid customer_id)
