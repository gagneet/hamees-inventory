"""
Hamees Attire Inventory Management System
Main Application
"""
from flask import Flask, request, jsonify
from datetime import datetime
from models import db, Customer, InventoryItem, TailoringOrder, OrderItem
import os

app = Flask(__name__)

# Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///hamees_inventory.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

# Initialize database
db.init_app(app)


def parse_delivery_date(date_string):
    """Parse delivery date string to datetime object with error handling"""
    if not date_string:
        return None
    try:
        return datetime.fromisoformat(date_string.replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        return None


@app.route('/')
def index():
    """Welcome endpoint"""
    return jsonify({
        'message': 'Welcome to Hamees Attire Inventory Management System',
        'version': '1.0.0',
        'endpoints': {
            'customers': '/api/customers',
            'inventory': '/api/inventory',
            'orders': '/api/orders',
            'low_stock': '/api/inventory/low-stock'
        }
    })


# Customer endpoints
@app.route('/api/customers', methods=['GET', 'POST'])
def customers():
    """Get all customers or create a new customer"""
    if request.method == 'GET':
        customers = Customer.query.all()
        return jsonify([customer.to_dict() for customer in customers])
    
    elif request.method == 'POST':
        data = request.json
        customer = Customer(
            name=data['name'],
            phone=data['phone'],
            email=data.get('email'),
            address=data.get('address')
        )
        db.session.add(customer)
        db.session.commit()
        return jsonify(customer.to_dict()), 201


@app.route('/api/customers/<int:customer_id>', methods=['GET', 'PUT', 'DELETE'])
def customer_detail(customer_id):
    """Get, update or delete a specific customer"""
    customer = Customer.query.get_or_404(customer_id)
    
    if request.method == 'GET':
        return jsonify(customer.to_dict())
    
    elif request.method == 'PUT':
        data = request.json
        customer.name = data.get('name', customer.name)
        customer.phone = data.get('phone', customer.phone)
        customer.email = data.get('email', customer.email)
        customer.address = data.get('address', customer.address)
        db.session.commit()
        return jsonify(customer.to_dict())
    
    elif request.method == 'DELETE':
        db.session.delete(customer)
        db.session.commit()
        return '', 204


# Inventory endpoints
@app.route('/api/inventory', methods=['GET', 'POST'])
def inventory():
    """Get all inventory items or create a new item"""
    if request.method == 'GET':
        category = request.args.get('category')
        if category:
            items = InventoryItem.query.filter_by(category=category).all()
        else:
            items = InventoryItem.query.all()
        return jsonify([item.to_dict() for item in items])
    
    elif request.method == 'POST':
        data = request.json
        item = InventoryItem(
            name=data['name'],
            category=data['category'],
            description=data.get('description'),
            quantity=data['quantity'],
            unit=data['unit'],
            price_per_unit=data['price_per_unit'],
            reorder_level=data.get('reorder_level', 10),
            supplier_name=data.get('supplier_name'),
            supplier_contact=data.get('supplier_contact')
        )
        db.session.add(item)
        db.session.commit()
        return jsonify(item.to_dict()), 201


@app.route('/api/inventory/<int:item_id>', methods=['GET', 'PUT', 'DELETE'])
def inventory_detail(item_id):
    """Get, update or delete a specific inventory item"""
    item = InventoryItem.query.get_or_404(item_id)
    
    if request.method == 'GET':
        return jsonify(item.to_dict())
    
    elif request.method == 'PUT':
        data = request.json
        item.name = data.get('name', item.name)
        item.category = data.get('category', item.category)
        item.description = data.get('description', item.description)
        item.quantity = data.get('quantity', item.quantity)
        item.unit = data.get('unit', item.unit)
        item.price_per_unit = data.get('price_per_unit', item.price_per_unit)
        item.reorder_level = data.get('reorder_level', item.reorder_level)
        item.supplier_name = data.get('supplier_name', item.supplier_name)
        item.supplier_contact = data.get('supplier_contact', item.supplier_contact)
        db.session.commit()
        return jsonify(item.to_dict())
    
    elif request.method == 'DELETE':
        db.session.delete(item)
        db.session.commit()
        return '', 204


@app.route('/api/inventory/low-stock', methods=['GET'])
def low_stock():
    """Get all inventory items that are at or below reorder level"""
    items = InventoryItem.query.filter(
        InventoryItem.quantity <= InventoryItem.reorder_level
    ).all()
    return jsonify([item.to_dict() for item in items])


# Tailoring Order endpoints
@app.route('/api/orders', methods=['GET', 'POST'])
def orders():
    """Get all orders or create a new order"""
    if request.method == 'GET':
        status = request.args.get('status')
        customer_id = request.args.get('customer_id')
        
        query = TailoringOrder.query
        if status:
            query = query.filter_by(status=status)
        if customer_id:
            query = query.filter_by(customer_id=customer_id)
        
        orders = query.all()
        return jsonify([order.to_dict() for order in orders])
    
    elif request.method == 'POST':
        data = request.json
        
        # Parse delivery date if provided
        delivery_date = parse_delivery_date(data.get('delivery_date'))
        
        order = TailoringOrder(
            customer_id=data['customer_id'],
            delivery_date=delivery_date,
            garment_type=data['garment_type'],
            chest=data.get('chest'),
            waist=data.get('waist'),
            shoulder=data.get('shoulder'),
            sleeve_length=data.get('sleeve_length'),
            shirt_length=data.get('shirt_length'),
            neck=data.get('neck'),
            hip=data.get('hip'),
            inseam=data.get('inseam'),
            special_instructions=data.get('special_instructions'),
            total_price=data['total_price'],
            advance_payment=data.get('advance_payment', 0)
        )
        db.session.add(order)
        db.session.flush()  # Get order ID before adding items
        
        # Add inventory items used in the order
        if 'items_used' in data:
            for item_data in data['items_used']:
                order_item = OrderItem(
                    order_id=order.id,
                    inventory_item_id=item_data['inventory_item_id'],
                    quantity_used=item_data['quantity_used']
                )
                db.session.add(order_item)
        
        db.session.commit()
        return jsonify(order.to_dict()), 201


@app.route('/api/orders/<int:order_id>', methods=['GET', 'PUT', 'DELETE'])
def order_detail(order_id):
    """Get, update or delete a specific order"""
    order = TailoringOrder.query.get_or_404(order_id)
    
    if request.method == 'GET':
        return jsonify(order.to_dict())
    
    elif request.method == 'PUT':
        data = request.json
        
        # Update delivery date if provided
        if 'delivery_date' in data:
            order.delivery_date = parse_delivery_date(data['delivery_date'])
        
        # Update order fields
        order.status = data.get('status', order.status)
        order.garment_type = data.get('garment_type', order.garment_type)
        order.chest = data.get('chest', order.chest)
        order.waist = data.get('waist', order.waist)
        order.shoulder = data.get('shoulder', order.shoulder)
        order.sleeve_length = data.get('sleeve_length', order.sleeve_length)
        order.shirt_length = data.get('shirt_length', order.shirt_length)
        order.neck = data.get('neck', order.neck)
        order.hip = data.get('hip', order.hip)
        order.inseam = data.get('inseam', order.inseam)
        order.special_instructions = data.get('special_instructions', order.special_instructions)
        order.total_price = data.get('total_price', order.total_price)
        order.advance_payment = data.get('advance_payment', order.advance_payment)
        
        # If order is being marked as completed, deduct inventory
        if data.get('status') == 'completed' and order.status != 'completed':
            for order_item in order.order_items:
                inventory_item = order_item.inventory_item
                inventory_item.quantity -= order_item.quantity_used
        
        db.session.commit()
        return jsonify(order.to_dict())
    
    elif request.method == 'DELETE':
        db.session.delete(order)
        db.session.commit()
        return '', 204


@app.route('/api/orders/<int:order_id>/complete', methods=['POST'])
def complete_order(order_id):
    """Mark an order as completed and deduct inventory"""
    order = TailoringOrder.query.get_or_404(order_id)
    
    if order.status == 'completed':
        return jsonify({'error': 'Order already completed'}), 400
    
    # Deduct inventory for all items used
    for order_item in order.order_items:
        inventory_item = order_item.inventory_item
        if inventory_item.quantity < order_item.quantity_used:
            return jsonify({
                'error': f'Insufficient quantity for {inventory_item.name}',
                'available': inventory_item.quantity,
                'required': order_item.quantity_used
            }), 400
        inventory_item.quantity -= order_item.quantity_used
    
    order.status = 'completed'
    db.session.commit()
    
    return jsonify(order.to_dict())


# Statistics and reporting
@app.route('/api/stats', methods=['GET'])
def stats():
    """Get system statistics"""
    total_customers = Customer.query.count()
    total_inventory_items = InventoryItem.query.count()
    total_orders = TailoringOrder.query.count()
    pending_orders = TailoringOrder.query.filter_by(status='pending').count()
    in_progress_orders = TailoringOrder.query.filter_by(status='in_progress').count()
    completed_orders = TailoringOrder.query.filter_by(status='completed').count()
    low_stock_items = InventoryItem.query.filter(
        InventoryItem.quantity <= InventoryItem.reorder_level
    ).count()
    
    return jsonify({
        'customers': total_customers,
        'inventory_items': total_inventory_items,
        'total_orders': total_orders,
        'orders': {
            'pending': pending_orders,
            'in_progress': in_progress_orders,
            'completed': completed_orders
        },
        'low_stock_items': low_stock_items
    })


def init_db():
    """Initialize the database"""
    with app.app_context():
        db.create_all()
        print("Database initialized successfully!")


if __name__ == '__main__':
    init_db()
    # Debug mode should only be enabled in development
    # In production, set debug=False and use a production WSGI server
    debug_mode = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    app.run(debug=debug_mode, host='0.0.0.0', port=5000)
