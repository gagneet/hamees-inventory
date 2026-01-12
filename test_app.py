"""
Basic tests for Hamees Attire Inventory Management System
"""
import unittest
import json
from app import app, db
from models import Customer, InventoryItem, TailoringOrder, OrderItem
from datetime import datetime


class InventorySystemTestCase(unittest.TestCase):
    """Test cases for the inventory management system"""
    
    def setUp(self):
        """Set up test database before each test"""
        app.config['TESTING'] = True
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///test_hamees_inventory.db'
        self.app = app.test_client()
        
        with app.app_context():
            db.create_all()
    
    def tearDown(self):
        """Clean up test database after each test"""
        with app.app_context():
            db.session.remove()
            db.drop_all()
    
    def test_index(self):
        """Test the index endpoint"""
        response = self.app.get('/')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('message', data)
        self.assertIn('endpoints', data)
    
    def test_create_customer(self):
        """Test creating a new customer"""
        customer_data = {
            'name': 'Test Customer',
            'phone': '+1234567890',
            'email': 'test@example.com',
            'address': '123 Test St'
        }
        response = self.app.post('/api/customers',
                                data=json.dumps(customer_data),
                                content_type='application/json')
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertEqual(data['name'], 'Test Customer')
        self.assertEqual(data['phone'], '+1234567890')
    
    def test_get_customers(self):
        """Test retrieving customers"""
        # Create a customer first
        with app.app_context():
            customer = Customer(name='Test User', phone='1234567890')
            db.session.add(customer)
            db.session.commit()
        
        response = self.app.get('/api/customers')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 1)
    
    def test_create_inventory_item(self):
        """Test creating a new inventory item"""
        item_data = {
            'name': 'Test Fabric',
            'category': 'fabric',
            'description': 'Test fabric description',
            'quantity': 50.0,
            'unit': 'meters',
            'price_per_unit': 25.50,
            'reorder_level': 10.0
        }
        response = self.app.post('/api/inventory',
                                data=json.dumps(item_data),
                                content_type='application/json')
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertEqual(data['name'], 'Test Fabric')
        self.assertEqual(data['quantity'], 50.0)
    
    def test_get_inventory(self):
        """Test retrieving inventory items"""
        # Create an item first
        with app.app_context():
            item = InventoryItem(
                name='Test Item',
                category='fabric',
                quantity=100,
                unit='meters',
                price_per_unit=20.0
            )
            db.session.add(item)
            db.session.commit()
        
        response = self.app.get('/api/inventory')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 1)
    
    def test_low_stock_items(self):
        """Test low stock detection"""
        with app.app_context():
            # Create item with quantity below reorder level
            low_stock_item = InventoryItem(
                name='Low Stock Item',
                category='fabric',
                quantity=5,
                unit='meters',
                price_per_unit=20.0,
                reorder_level=10
            )
            # Create item with sufficient stock
            normal_item = InventoryItem(
                name='Normal Item',
                category='fabric',
                quantity=50,
                unit='meters',
                price_per_unit=20.0,
                reorder_level=10
            )
            db.session.add(low_stock_item)
            db.session.add(normal_item)
            db.session.commit()
        
        response = self.app.get('/api/inventory/low-stock')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['name'], 'Low Stock Item')
        self.assertTrue(data[0]['is_low_stock'])
    
    def test_create_order(self):
        """Test creating a tailoring order"""
        # First create a customer and inventory item
        with app.app_context():
            customer = Customer(name='Test Customer', phone='1234567890')
            db.session.add(customer)
            item = InventoryItem(
                name='Test Fabric',
                category='fabric',
                quantity=100,
                unit='meters',
                price_per_unit=20.0
            )
            db.session.add(item)
            db.session.commit()
            customer_id = customer.id
            item_id = item.id
        
        order_data = {
            'customer_id': customer_id,
            'garment_type': 'shirt',
            'chest': 40.0,
            'waist': 34.0,
            'total_price': 1500.00,
            'advance_payment': 500.00,
            'items_used': [
                {
                    'inventory_item_id': item_id,
                    'quantity_used': 2.5
                }
            ]
        }
        response = self.app.post('/api/orders',
                                data=json.dumps(order_data),
                                content_type='application/json')
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertEqual(data['garment_type'], 'shirt')
        self.assertEqual(data['status'], 'pending')
        self.assertEqual(data['balance_due'], 1000.00)
    
    def test_get_stats(self):
        """Test statistics endpoint"""
        response = self.app.get('/api/stats')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('customers', data)
        self.assertIn('inventory_items', data)
        self.assertIn('total_orders', data)
        self.assertIn('orders', data)


if __name__ == '__main__':
    unittest.main()
