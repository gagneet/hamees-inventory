# Quick Start Guide - Hamees Attire Inventory Management System

## 🚀 Get Started in 5 Minutes

### Step 1: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 2: Initialize Database with Sample Data
```bash
python sample_data.py
```
Type `yes` when prompted. This creates:
- 4 sample customers
- 12 inventory items (fabrics, threads, buttons, accessories)
- 4 sample tailoring orders
- Demonstrates the complete system workflow

### Step 3: Start the Server
```bash
python app.py
```
Server will start at `http://localhost:5000`

**For Development (with debug mode):**
```bash
export FLASK_DEBUG=true  # Enable debug mode for development only
python app.py
```
⚠️ **Warning:** Never enable debug mode in production environments!

### Step 4: Test the API

**View System Statistics:**
```bash
curl http://localhost:5000/api/stats
```

**Check Low Stock Items:**
```bash
curl http://localhost:5000/api/inventory/low-stock
```

**View All Orders:**
```bash
curl http://localhost:5000/api/orders
```

**View Pending Orders Only:**
```bash
curl http://localhost:5000/api/orders?status=pending
```

**View All Customers:**
```bash
curl http://localhost:5000/api/customers
```

---

## 📋 Common Operations

### Add a New Customer
```bash
curl -X POST http://localhost:5000/api/customers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ali Hassan",
    "phone": "+92-333-1234567",
    "email": "ali@example.com",
    "address": "Downtown, Karachi"
  }'
```

### Add Inventory Item
```bash
curl -X POST http://localhost:5000/api/inventory \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Linen Fabric - Beige",
    "category": "fabric",
    "description": "Premium linen fabric",
    "quantity": 40,
    "unit": "meters",
    "price_per_unit": 45.00,
    "reorder_level": 10,
    "supplier_name": "Premium Textiles",
    "supplier_contact": "+92-21-99999999"
  }'
```

### Create a Tailoring Order
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
    "special_instructions": "French cuffs",
    "total_price": 1600.00,
    "advance_payment": 600.00,
    "items_used": [
      {"inventory_item_id": 1, "quantity_used": 2.5}
    ]
  }'
```

### Update Order Status
```bash
curl -X PUT http://localhost:5000/api/orders/1 \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}'
```

### Complete an Order (Auto-deduct Inventory)
```bash
curl -X POST http://localhost:5000/api/orders/1/complete
```

---

## 🔍 Understanding the System

### Key Features

1. **Customer Management**: Store customer details, contact info, and addresses
2. **Inventory Tracking**: Track fabrics, threads, buttons, accessories with quantities
3. **Low Stock Alerts**: Automatically flag items needing reorder
4. **Tailoring Orders**: Complete order management with measurements
5. **Inventory Integration**: Link orders to materials used
6. **Payment Tracking**: Record advance payments and balance due
7. **Order Status Flow**: pending → in_progress → completed → delivered

### Data Flow Example

1. **Customer places order** → Creates order with measurements
2. **Assign materials** → Links inventory items to order
3. **Start work** → Update status to "in_progress"
4. **Complete order** → Marks completed and deducts inventory
5. **Deliver** → Update to "delivered" status

### Categories Supported

- **Fabrics**: Cotton, silk, wool, denim, linen, etc.
- **Threads**: Various colors for stitching
- **Buttons**: Different sizes and types
- **Accessories**: Zippers, shoulder pads, interfacing
- **Custom**: Add any category as needed

### Garment Types

- Shirts, Trousers/Pants, Suits
- Dresses, Jackets, Kurtas
- Any custom type needed

---

## 🧪 Run Tests

```bash
python -m unittest test_app.py -v
```

Expected output: 8 tests passing

---

## 🔒 Security Notes

**Development vs Production:**
- Debug mode is **disabled by default** for security
- Enable debug mode in development only: `export FLASK_DEBUG=true`
- **Never** enable debug mode in production
- Change the SECRET_KEY before production deployment
- Use a production WSGI server (Gunicorn, uWSGI) for production
- Use PostgreSQL/MySQL instead of SQLite for production

---

## 📚 Full Documentation

- **README.md** - Complete system documentation and setup
- **API_DOCUMENTATION.md** - Detailed API reference with examples

---

## 🛠️ Development Tips

### Fresh Start
To reset the database and reload sample data:
```bash
python sample_data.py
```

### Production Deployment
For production, update:
1. Change `SECRET_KEY` in app.py
2. Set `debug=False` in app.py
3. Use production WSGI server (gunicorn, uWSGI)
4. Use PostgreSQL/MySQL instead of SQLite
5. Add authentication/authorization

---

## 💡 Next Steps

1. **Try the sample data** - Explore existing customers, inventory, and orders
2. **Create your own data** - Add real customers and inventory items
3. **Process orders** - Create and complete tailoring orders
4. **Monitor stock** - Use low-stock alerts to manage inventory
5. **Customize** - Extend with your specific requirements

---

## ❓ Need Help?

- Check **API_DOCUMENTATION.md** for detailed endpoint reference
- Review **README.md** for comprehensive documentation
- Sample data in **sample_data.py** shows all features
- Tests in **test_app.py** demonstrate API usage

---

**Happy Tailoring! 🎨✂️👔**
