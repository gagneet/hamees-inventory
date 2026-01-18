"""
Hamees Attire Inventory Management System
Database Models
"""
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Customer(db.Model):
    """Customer information for tailoring orders"""
    __tablename__ = 'customers'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    email = db.Column(db.String(100))
    address = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    orders = db.relationship('TailoringOrder', back_populates='customer', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'phone': self.phone,
            'email': self.email,
            'address': self.address,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class InventoryItem(db.Model):
    """Inventory items including fabrics, accessories, and garments"""
    __tablename__ = 'inventory_items'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50), nullable=False)  # fabric, accessory, garment, thread, button, etc.
    description = db.Column(db.Text)
    quantity = db.Column(db.Float, nullable=False, default=0)
    unit = db.Column(db.String(20), nullable=False)  # meters, pieces, yards, etc.
    price_per_unit = db.Column(db.Float, nullable=False)
    reorder_level = db.Column(db.Float, default=10)  # Low stock alert threshold
    supplier_name = db.Column(db.String(100))
    supplier_contact = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    order_items = db.relationship('OrderItem', back_populates='inventory_item')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'category': self.category,
            'description': self.description,
            'quantity': self.quantity,
            'unit': self.unit,
            'price_per_unit': self.price_per_unit,
            'reorder_level': self.reorder_level,
            'supplier_name': self.supplier_name,
            'supplier_contact': self.supplier_contact,
            'is_low_stock': self.quantity <= self.reorder_level,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class TailoringOrder(db.Model):
    """Tailoring orders with customer measurements and requirements"""
    __tablename__ = 'tailoring_orders'
    
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    order_date = db.Column(db.DateTime, default=datetime.utcnow)
    delivery_date = db.Column(db.DateTime)
    status = db.Column(db.String(20), default='pending')  # pending, in_progress, completed, delivered
    garment_type = db.Column(db.String(50), nullable=False)  # shirt, pant, suit, dress, etc.
    
    # Measurements (in inches or cm)
    chest = db.Column(db.Float)
    waist = db.Column(db.Float)
    shoulder = db.Column(db.Float)
    sleeve_length = db.Column(db.Float)
    shirt_length = db.Column(db.Float)
    neck = db.Column(db.Float)
    hip = db.Column(db.Float)
    inseam = db.Column(db.Float)
    
    # Additional requirements
    special_instructions = db.Column(db.Text)
    total_price = db.Column(db.Float, nullable=False, default=0)
    advance_payment = db.Column(db.Float, default=0)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    customer = db.relationship('Customer', back_populates='orders')
    order_items = db.relationship('OrderItem', back_populates='order', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'customer_id': self.customer_id,
            'customer_name': self.customer.name if self.customer else None,
            'order_date': self.order_date.isoformat() if self.order_date else None,
            'delivery_date': self.delivery_date.isoformat() if self.delivery_date else None,
            'status': self.status,
            'garment_type': self.garment_type,
            'measurements': {
                'chest': self.chest,
                'waist': self.waist,
                'shoulder': self.shoulder,
                'sleeve_length': self.sleeve_length,
                'shirt_length': self.shirt_length,
                'neck': self.neck,
                'hip': self.hip,
                'inseam': self.inseam
            },
            'special_instructions': self.special_instructions,
            'total_price': self.total_price,
            'advance_payment': self.advance_payment,
            'balance_due': self.total_price - self.advance_payment,
            'items_used': [item.to_dict() for item in self.order_items],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class OrderItem(db.Model):
    """Items used in a tailoring order (links orders to inventory)"""
    __tablename__ = 'order_items'
    
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('tailoring_orders.id'), nullable=False)
    inventory_item_id = db.Column(db.Integer, db.ForeignKey('inventory_items.id'), nullable=False)
    quantity_used = db.Column(db.Float, nullable=False)
    
    # Relationships
    order = db.relationship('TailoringOrder', back_populates='order_items')
    inventory_item = db.relationship('InventoryItem', back_populates='order_items')
    
    def to_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'inventory_item_id': self.inventory_item_id,
            'inventory_item_name': self.inventory_item.name if self.inventory_item else None,
            'quantity_used': self.quantity_used,
            'unit': self.inventory_item.unit if self.inventory_item else None
        }
