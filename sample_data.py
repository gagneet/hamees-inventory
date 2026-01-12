"""
Sample Data Generator for Hamees Attire Inventory System
Run this script to populate the database with sample data for testing
"""
from app import app, db
from models import Customer, InventoryItem, TailoringOrder, OrderItem
from datetime import datetime, timedelta


def clear_database():
    """Clear all existing data"""
    with app.app_context():
        db.drop_all()
        db.create_all()
        print("Database cleared and recreated.")


def add_sample_data():
    """Add sample data to the database"""
    with app.app_context():
        # Add sample customers
        customers = [
            Customer(
                name="Ahmed Khan",
                phone="+92-300-1234567",
                email="ahmed.khan@example.com",
                address="123 Main Street, Karachi"
            ),
            Customer(
                name="Fatima Ali",
                phone="+92-301-9876543",
                email="fatima.ali@example.com",
                address="456 Garden Road, Lahore"
            ),
            Customer(
                name="Hassan Malik",
                phone="+92-333-5555555",
                email="hassan.malik@example.com",
                address="789 Park Avenue, Islamabad"
            ),
            Customer(
                name="Ayesha Siddiqui",
                phone="+92-321-4444444",
                email="ayesha.s@example.com",
                address="321 Sunset Blvd, Multan"
            )
        ]
        
        for customer in customers:
            db.session.add(customer)
        db.session.commit()
        print(f"Added {len(customers)} sample customers.")
        
        # Add sample inventory items
        inventory_items = [
            # Fabrics
            InventoryItem(
                name="Premium Cotton Fabric - White",
                category="fabric",
                description="High quality 100% cotton fabric ideal for shirts",
                quantity=100.0,
                unit="meters",
                price_per_unit=25.50,
                reorder_level=15.0,
                supplier_name="ABC Textiles Ltd",
                supplier_contact="+92-21-11111111"
            ),
            InventoryItem(
                name="Premium Cotton Fabric - Blue",
                category="fabric",
                description="Premium cotton fabric in navy blue",
                quantity=75.0,
                unit="meters",
                price_per_unit=28.00,
                reorder_level=15.0,
                supplier_name="ABC Textiles Ltd",
                supplier_contact="+92-21-11111111"
            ),
            InventoryItem(
                name="Wool Blend Suiting - Charcoal",
                category="fabric",
                description="Wool blend fabric for formal suits",
                quantity=50.0,
                unit="meters",
                price_per_unit=85.00,
                reorder_level=10.0,
                supplier_name="Premium Fabrics Inc",
                supplier_contact="+92-21-22222222"
            ),
            InventoryItem(
                name="Silk Fabric - Beige",
                category="fabric",
                description="Pure silk fabric for premium garments",
                quantity=30.0,
                unit="meters",
                price_per_unit=120.00,
                reorder_level=8.0,
                supplier_name="Silk House",
                supplier_contact="+92-21-33333333"
            ),
            InventoryItem(
                name="Denim Fabric - Dark Blue",
                category="fabric",
                description="Heavy weight denim for jeans",
                quantity=8.0,  # Low stock
                unit="meters",
                price_per_unit=35.00,
                reorder_level=10.0,
                supplier_name="Denim World",
                supplier_contact="+92-21-44444444"
            ),
            # Threads
            InventoryItem(
                name="Polyester Thread - White",
                category="thread",
                description="Strong polyester thread for general stitching",
                quantity=200.0,
                unit="spools",
                price_per_unit=2.50,
                reorder_level=20.0,
                supplier_name="Sewing Supplies Co",
                supplier_contact="+92-21-55555555"
            ),
            InventoryItem(
                name="Polyester Thread - Black",
                category="thread",
                description="Strong polyester thread for dark fabrics",
                quantity=180.0,
                unit="spools",
                price_per_unit=2.50,
                reorder_level=20.0,
                supplier_name="Sewing Supplies Co",
                supplier_contact="+92-21-55555555"
            ),
            # Buttons
            InventoryItem(
                name="Shirt Buttons - White (Pack of 100)",
                category="button",
                description="Standard white buttons for shirts",
                quantity=15.0,
                unit="packs",
                price_per_unit=8.00,
                reorder_level=5.0,
                supplier_name="Button Bazaar",
                supplier_contact="+92-21-66666666"
            ),
            InventoryItem(
                name="Suit Buttons - Black (Pack of 50)",
                category="button",
                description="Premium black buttons for suits",
                quantity=3.0,  # Low stock
                unit="packs",
                price_per_unit=15.00,
                reorder_level=5.0,
                supplier_name="Button Bazaar",
                supplier_contact="+92-21-66666666"
            ),
            # Accessories
            InventoryItem(
                name="Metal Zippers - 7 inch",
                category="accessory",
                description="Metal zippers for trousers",
                quantity=100.0,
                unit="pieces",
                price_per_unit=5.00,
                reorder_level=20.0,
                supplier_name="Zipper World",
                supplier_contact="+92-21-77777777"
            ),
            InventoryItem(
                name="Shoulder Pads - Medium",
                category="accessory",
                description="Shoulder pads for suits and jackets",
                quantity=50.0,
                unit="pairs",
                price_per_unit=12.00,
                reorder_level=10.0,
                supplier_name="Tailoring Essentials",
                supplier_contact="+92-21-88888888"
            ),
            InventoryItem(
                name="Interfacing Fabric - Fusible",
                category="accessory",
                description="Iron-on interfacing for collars and cuffs",
                quantity=40.0,
                unit="meters",
                price_per_unit=8.50,
                reorder_level=10.0,
                supplier_name="Tailoring Essentials",
                supplier_contact="+92-21-88888888"
            )
        ]
        
        for item in inventory_items:
            db.session.add(item)
        db.session.commit()
        print(f"Added {len(inventory_items)} sample inventory items.")
        
        # Add sample orders
        # Order 1 - Completed shirt order
        order1 = TailoringOrder(
            customer_id=1,
            order_date=datetime.now() - timedelta(days=10),
            delivery_date=datetime.now() + timedelta(days=2),
            status='completed',
            garment_type='shirt',
            chest=40.0,
            waist=34.0,
            shoulder=18.0,
            sleeve_length=24.0,
            shirt_length=30.0,
            neck=15.5,
            special_instructions='Blue color with white collar',
            total_price=1500.00,
            advance_payment=500.00
        )
        db.session.add(order1)
        db.session.flush()
        
        # Items used in order 1
        order1_items = [
            OrderItem(order_id=order1.id, inventory_item_id=2, quantity_used=2.5),  # Blue fabric
            OrderItem(order_id=order1.id, inventory_item_id=6, quantity_used=1),    # White thread
            OrderItem(order_id=order1.id, inventory_item_id=8, quantity_used=0.1)   # Buttons
        ]
        for item in order1_items:
            db.session.add(item)
        
        # Order 2 - In progress suit order
        order2 = TailoringOrder(
            customer_id=2,
            order_date=datetime.now() - timedelta(days=5),
            delivery_date=datetime.now() + timedelta(days=10),
            status='in_progress',
            garment_type='suit',
            chest=38.0,
            waist=32.0,
            shoulder=17.5,
            sleeve_length=23.5,
            shirt_length=29.0,
            neck=15.0,
            hip=38.0,
            inseam=32.0,
            special_instructions='Two piece suit with vest',
            total_price=8500.00,
            advance_payment=3000.00
        )
        db.session.add(order2)
        db.session.flush()
        
        # Items used in order 2
        order2_items = [
            OrderItem(order_id=order2.id, inventory_item_id=3, quantity_used=3.5),  # Wool fabric
            OrderItem(order_id=order2.id, inventory_item_id=7, quantity_used=2),    # Black thread
            OrderItem(order_id=order2.id, inventory_item_id=9, quantity_used=0.1),  # Suit buttons
            OrderItem(order_id=order2.id, inventory_item_id=11, quantity_used=1)    # Shoulder pads
        ]
        for item in order2_items:
            db.session.add(item)
        
        # Order 3 - Pending trouser order
        order3 = TailoringOrder(
            customer_id=3,
            order_date=datetime.now() - timedelta(days=2),
            delivery_date=datetime.now() + timedelta(days=7),
            status='pending',
            garment_type='trouser',
            waist=36.0,
            hip=40.0,
            inseam=34.0,
            special_instructions='Pleated front with side pockets',
            total_price=2000.00,
            advance_payment=800.00
        )
        db.session.add(order3)
        db.session.flush()
        
        # Items used in order 3
        order3_items = [
            OrderItem(order_id=order3.id, inventory_item_id=3, quantity_used=1.8),  # Wool fabric
            OrderItem(order_id=order3.id, inventory_item_id=10, quantity_used=1)    # Zipper
        ]
        for item in order3_items:
            db.session.add(item)
        
        # Order 4 - Recent pending shirt order
        order4 = TailoringOrder(
            customer_id=4,
            order_date=datetime.now() - timedelta(days=1),
            delivery_date=datetime.now() + timedelta(days=5),
            status='pending',
            garment_type='shirt',
            chest=42.0,
            waist=36.0,
            shoulder=19.0,
            sleeve_length=25.0,
            shirt_length=31.0,
            neck=16.0,
            special_instructions='French cuffs, monogram on pocket',
            total_price=1800.00,
            advance_payment=600.00
        )
        db.session.add(order4)
        db.session.flush()
        
        # Items used in order 4
        order4_items = [
            OrderItem(order_id=order4.id, inventory_item_id=1, quantity_used=2.8),  # White fabric
            OrderItem(order_id=order4.id, inventory_item_id=6, quantity_used=1),    # White thread
            OrderItem(order_id=order4.id, inventory_item_id=8, quantity_used=0.1)   # Buttons
        ]
        for item in order4_items:
            db.session.add(item)
        
        db.session.commit()
        print("Added 4 sample orders with order items.")
        
        print("\n" + "="*50)
        print("Sample data added successfully!")
        print("="*50)
        print("\nQuick Stats:")
        print(f"  Customers: {Customer.query.count()}")
        print(f"  Inventory Items: {InventoryItem.query.count()}")
        print(f"  Orders: {TailoringOrder.query.count()}")
        print(f"  Low Stock Items: {InventoryItem.query.filter(InventoryItem.quantity <= InventoryItem.reorder_level).count()}")
        print("\nLow Stock Items:")
        low_stock = InventoryItem.query.filter(InventoryItem.quantity <= InventoryItem.reorder_level).all()
        for item in low_stock:
            print(f"  - {item.name}: {item.quantity} {item.unit} (Reorder at: {item.reorder_level})")


if __name__ == '__main__':
    print("Initializing Hamees Attire Inventory System with sample data...")
    print("WARNING: This will clear all existing data!")
    response = input("Continue? (yes/no): ")
    
    if response.lower().strip() in ['yes', 'y']:
        clear_database()
        add_sample_data()
        print("\nYou can now start the application with: python app.py")
    else:
        print("Operation cancelled.")
