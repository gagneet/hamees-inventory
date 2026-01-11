# Hamees Attire - Inventory Management System

A comprehensive inventory management system designed for Hamees Attire tailoring business. This system manages inventory items (fabrics, accessories, garments) and handles tailoring orders with customer measurements and requirements.

## Features

### Inventory Management
- **Track Items**: Manage fabrics, accessories, threads, buttons, and other materials
- **Stock Levels**: Monitor quantities with automatic low-stock alerts
- **Categories**: Organize items by category (fabric, accessory, garment, etc.)
- **Supplier Information**: Store supplier details for reordering
- **Units**: Support various units (meters, yards, pieces, etc.)

### Tailoring Order Management
- **Customer Records**: Maintain customer information and contact details
- **Detailed Measurements**: Store comprehensive body measurements (chest, waist, shoulder, sleeve length, etc.)
- **Order Tracking**: Track orders through their lifecycle (pending → in_progress → completed → delivered)
- **Inventory Integration**: Link orders to inventory items used
- **Payment Tracking**: Record total price, advance payments, and balance due
- **Special Instructions**: Capture custom requirements for each order

### Reporting & Analytics
- **Low Stock Alerts**: Automatically identify items needing reorder
- **Order Statistics**: View pending, in-progress, and completed orders
- **System Overview**: Dashboard statistics for business insights

## Technology Stack

- **Backend**: Python Flask
- **Database**: SQLite (easily upgradeable to PostgreSQL/MySQL)
- **ORM**: SQLAlchemy
- **API**: RESTful JSON API

## Installation

### Prerequisites
- Python 3.8 or higher
- pip (Python package manager)

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/gagneet/hamees-inventory.git
   cd hamees-inventory
   ```

2. **Create a virtual environment** (recommended)
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Initialize the database**
   ```bash
   python app.py
   ```
   This will create the SQLite database with all necessary tables.

## Usage

### Starting the Server

```bash
python app.py
```

The server will start on `http://localhost:5000`

### API Endpoints

#### Customer Management

- **GET** `/api/customers` - List all customers
- **POST** `/api/customers` - Create a new customer
- **GET** `/api/customers/<id>` - Get customer details
- **PUT** `/api/customers/<id>` - Update customer
- **DELETE** `/api/customers/<id>` - Delete customer

#### Inventory Management

- **GET** `/api/inventory` - List all inventory items
  - Query params: `?category=fabric` - Filter by category
- **POST** `/api/inventory` - Add new inventory item
- **GET** `/api/inventory/<id>` - Get item details
- **PUT** `/api/inventory/<id>` - Update inventory item
- **DELETE** `/api/inventory/<id>` - Remove item
- **GET** `/api/inventory/low-stock` - Get low stock items

#### Order Management

- **GET** `/api/orders` - List all orders
  - Query params: `?status=pending` or `?customer_id=1`
- **POST** `/api/orders` - Create new tailoring order
- **GET** `/api/orders/<id>` - Get order details
- **PUT** `/api/orders/<id>` - Update order
- **DELETE** `/api/orders/<id>` - Delete order
- **POST** `/api/orders/<id>/complete` - Complete order and deduct inventory

#### Statistics

- **GET** `/api/stats` - Get system statistics

### Example API Calls

#### Create a Customer
```bash
curl -X POST http://localhost:5000/api/customers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "phone": "+1234567890",
    "email": "john@example.com",
    "address": "123 Main St, City"
  }'
```

#### Add Inventory Item
```bash
curl -X POST http://localhost:5000/api/inventory \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Premium Cotton Fabric",
    "category": "fabric",
    "description": "High quality cotton fabric for shirts",
    "quantity": 50,
    "unit": "meters",
    "price_per_unit": 25.50,
    "reorder_level": 10,
    "supplier_name": "ABC Textiles",
    "supplier_contact": "+9876543210"
  }'
```

#### Create Tailoring Order
```bash
curl -X POST http://localhost:5000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

#### Complete an Order
```bash
curl -X POST http://localhost:5000/api/orders/1/complete
```

## Data Models

### Customer
- id, name, phone, email, address, created_at

### InventoryItem
- id, name, category, description, quantity, unit, price_per_unit
- reorder_level, supplier_name, supplier_contact
- created_at, updated_at

### TailoringOrder
- id, customer_id, order_date, delivery_date, status, garment_type
- Measurements: chest, waist, shoulder, sleeve_length, shirt_length, neck, hip, inseam
- special_instructions, total_price, advance_payment
- created_at, updated_at

### OrderItem (Junction Table)
- id, order_id, inventory_item_id, quantity_used

## Business Logic

### Order Completion Flow
1. Order is created with status "pending"
2. Order can be updated to "in_progress" when work begins
3. When order is marked as "completed", inventory is automatically deducted
4. System validates sufficient inventory before completion
5. Order can be marked as "delivered" after customer pickup

### Low Stock Alerts
- Items are flagged when quantity <= reorder_level
- Use `/api/inventory/low-stock` endpoint to get all items needing reorder

## Future Enhancements

Potential features for future versions:
- User authentication and authorization
- Invoice generation (PDF)
- SMS/Email notifications for order updates
- Barcode/QR code support for inventory items
- Advanced reporting and analytics
- Multi-branch support
- Payment gateway integration
- Customer portal for order tracking

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For questions or support, please contact the repository owner or open an issue on GitHub.
