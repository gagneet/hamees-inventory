# Authentication & Barcode Scanning Guide

This guide covers the authentication system and barcode scanning functionality implemented in the Hamees Inventory Management System.

---

## Table of Contents

- [Authentication System](#authentication-system)
- [Barcode Scanning](#barcode-scanning)
- [Accessing the Application](#accessing-the-application)
- [Using the Inventory Management](#using-the-inventory-management)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

---

## Authentication System

### Overview

The application uses **NextAuth.js v5** with a credentials-based authentication strategy. User passwords are securely hashed using bcryptjs with 10 salt rounds.

### Features

- ✅ Credentials-based login (email + password)
- ✅ JWT session strategy
- ✅ Route protection via middleware
- ✅ Auto-redirect for authenticated/unauthenticated users
- ✅ Role-based user management

### User Roles

The system supports the following roles:
- **OWNER** - Full system access
- **ADMIN** - Administrative access
- **INVENTORY_MANAGER** - Manage inventory
- **SALES_MANAGER** - Manage orders and sales
- **TAILOR** - View orders and measurements
- **VIEWER** - Read-only access

### Demo Credentials

After running `pnpm db:seed`, you can use these credentials:

**Primary Account:**
- Email: `owner@tailorshop.com`
- Password: `admin123`
- Role: OWNER

**Secondary Account:**
- Email: `inventory@tailorshop.com`
- Password: `admin123`
- Role: INVENTORY_MANAGER

### Protected Routes

The following routes require authentication:
- `/dashboard` - Main dashboard
- `/inventory` - Inventory management
- `/orders` - Order management
- `/customers` - Customer management
- `/suppliers` - Supplier management
- `/alerts` - Alert notifications
- `/settings` - Application settings

Unauthenticated users are automatically redirected to the login page (`/`).

---

## Barcode Scanning

### Overview

The barcode scanning system allows you to quickly add or lookup inventory items using barcodes or SKUs. It uses the **html5-qrcode** library for camera-based scanning.

### Features

- ✅ **Camera Scanner**: Scan barcodes using mobile camera or webcam
- ✅ **Manual Entry**: Type in barcode/SKU manually
- ✅ **Real-time Lookup**: Instant search for existing items
- ✅ **Auto-SKU Generation**: Automatically generates SKUs for new items
- ✅ **Mobile-Friendly**: Optimized for smartphone use

### Scanning Modes

#### 1. Camera Mode
- Uses device camera (mobile/webcam) to scan barcodes
- Supports multiple barcode formats (QR codes, UPC, EAN, Code128, etc.)
- Real-time scanning with visual feedback
- Remember last used camera setting

#### 2. Manual Mode
- Enter barcode/SKU via keyboard
- Useful when camera is unavailable
- Supports any SKU format

### SKU Format

The system auto-generates SKUs when no barcode is scanned:

**Cloth Inventory:**
```
CLT-{TYPE}-{BRAND}-{TIMESTAMP}
Example: CLT-COT-ABC-123456
```

**Accessory Inventory:**
```
ACC-{TYPE}-{TIMESTAMP}
Example: ACC-BUT-123456
```

### Current Limitations

⚠️ **Accessory Inventory**: Barcode scanning for accessories is currently disabled pending a database schema update. You can still manually add accessories without barcodes.

✅ **Cloth Inventory**: Fully functional barcode scanning and lookup.

---

## Accessing the Application

### Production URL
```
https://hamees.gagneet.com
```

### Local Development
```bash
# Start development server
pnpm dev

# Access at
http://localhost:3009
```

### Production Deployment

The application runs on PM2 process manager:

```bash
# Start application
pm2 start ecosystem.config.js

# Restart application
pm2 restart hamees-inventory

# View logs
pm2 logs hamees-inventory

# Check status
pm2 status
```

---

## Using the Inventory Management

### Step-by-Step: Adding Cloth Inventory with Barcode

1. **Login** to the application at https://hamees.gagneet.com
   - Use demo credentials: `owner@tailorshop.com` / `admin123`

2. **Navigate to Inventory**
   - Go to `/inventory` or click "Inventory" in navigation

3. **Scan Barcode**
   - Click the **"Scan Barcode"** button
   - Choose **"Camera"** mode:
     - Grant camera permissions when prompted
     - Position barcode within the scanning frame
     - Scanner will automatically detect and read the barcode
   - Or choose **"Manual"** mode:
     - Type the barcode/SKU in the text field
     - Click "Look Up"

4. **Lookup Results**
   - **If item exists**: View details and option to edit
   - **If item is new**: Form appears to create the item

5. **Fill the Form** (for new items)
   - **Name**: e.g., "Premium Cotton Fabric"
   - **Type**: Cotton, Silk, Wool, etc.
   - **Brand**: Manufacturer name
   - **Color**: Color name
   - **Color Code**: Visual color picker
   - **Pattern**: Plain, Striped, Checkered, etc.
   - **Quality**: Premium, Standard, or Economy
   - **Current Stock**: Amount in meters
   - **Minimum Stock**: Reorder threshold
   - **Price/Meter**: Cost per meter in ₹
   - **Supplier**: Supplier name
   - **Location**: Storage location (optional)

6. **Submit**
   - Click **"Create Cloth Item"**
   - System creates the item and logs stock movement
   - Success message displays

### Adding Accessory Inventory

1. Navigate to `/inventory`
2. Click **"Add Manually"** (barcode not supported yet)
3. Switch to **"Accessories"** tab
4. Fill the form:
   - **Type**: Button, Thread, Zipper, Lining, Elastic, Hook, Other
   - **Name**: Description of the accessory
   - **Color**: Color (optional)
   - **Current Stock**: Quantity
   - **Minimum Stock**: Reorder threshold
   - **Price/Unit**: Cost per piece in ₹
5. Click **"Create Accessory Item"**

---

## API Reference

### Authentication

#### POST `/api/auth/callback/credentials`
Login with email and password.

**Request Body:**
```json
{
  "email": "owner@tailorshop.com",
  "password": "admin123"
}
```

**Response:**
```json
{
  "user": {
    "id": "...",
    "email": "owner@tailorshop.com",
    "name": "Shop Owner",
    "role": "OWNER"
  }
}
```

### Inventory Management

#### POST `/api/inventory/cloth`
Create new cloth inventory item.

**Request Body:**
```json
{
  "sku": "CLT-COT-ABC-123456",
  "name": "Premium Cotton Fabric",
  "type": "Cotton",
  "brand": "ABC Textiles",
  "color": "Navy Blue",
  "colorHex": "#000080",
  "pattern": "Plain",
  "quality": "Premium",
  "pricePerMeter": 250.00,
  "currentStock": 100.0,
  "minimum": 20.0,
  "supplier": "ABC Textiles Ltd",
  "location": "Shelf A1"
}
```

**Response:** Created cloth inventory item with relations

#### POST `/api/inventory/accessories`
Create new accessory inventory item.

**Request Body:**
```json
{
  "type": "Button",
  "name": "Metal Buttons 15mm",
  "color": "Silver",
  "currentStock": 500,
  "minimum": 100,
  "pricePerUnit": 2.50
}
```

**Response:** Created accessory item with relations

#### GET `/api/inventory/barcode?barcode={sku}`
Lookup inventory item by barcode/SKU.

**Query Parameters:**
- `barcode` (required): The SKU or barcode to search for

**Response (Found):**
```json
{
  "found": true,
  "type": "cloth",
  "item": {
    "id": "...",
    "sku": "CLT-COT-ABC-123456",
    "name": "Premium Cotton Fabric",
    "currentStock": 100.0,
    ...
  }
}
```

**Response (Not Found):**
```json
{
  "found": false,
  "barcode": "CLT-COT-XYZ-999999"
}
```

#### GET `/api/inventory/cloth`
List all cloth inventory items.

**Query Parameters:**
- `lowStock` (optional): `true` to filter items below minimum stock

**Response:** Array of cloth inventory items

#### GET `/api/inventory/accessories`
List all accessory inventory items.

**Query Parameters:**
- `lowStock` (optional): `true` to filter items below minimum stock
- `type` (optional): Filter by accessory type

**Response:** Array of accessory items

---

## Troubleshooting

### Cannot Login

**Issue:** Login fails with "Invalid email or password"

**Solutions:**
1. Ensure database is seeded: `pnpm db:seed`
2. Verify you're using correct credentials
3. Check `.env` file has `NEXTAUTH_SECRET` set
4. Clear browser cookies and try again

### Camera Not Working

**Issue:** Barcode scanner cannot access camera

**Solutions:**
1. **Grant Permissions**: Allow camera access when prompted by browser
2. **HTTPS Required**: Camera only works over HTTPS (production) or localhost
3. **Mobile Safari**: May need specific permissions in Settings > Safari > Camera
4. **Use Manual Mode**: Switch to keyboard entry if camera unavailable

### Barcode Not Recognized

**Issue:** Scanner doesn't detect the barcode

**Solutions:**
1. **Lighting**: Ensure good lighting conditions
2. **Distance**: Hold camera 6-12 inches from barcode
3. **Steady Hand**: Keep camera still while scanning
4. **Supported Formats**: Ensure barcode is QR, UPC, EAN, or Code128
5. **Manual Entry**: Type the code manually if scanning fails

### Items Not Saving

**Issue:** Form submission fails

**Solutions:**
1. **Check Authentication**: Ensure you're logged in
2. **Required Fields**: Fill all fields marked with *
3. **Number Format**: Use proper decimals for stock/price
4. **Database Connection**: Check PostgreSQL is running
5. **Check Logs**: View PM2 logs: `pm2 logs hamees-inventory`

### Session Expires

**Issue:** Redirected to login after short time

**Solutions:**
1. JWT tokens are set for reasonable duration
2. Re-login if needed
3. Check `NEXTAUTH_URL` matches your domain in `.env`

### Mobile Camera Not Switching

**Issue:** Cannot switch between front/rear cameras

**Solutions:**
1. The scanner uses the last camera used
2. Refresh the page to reset camera selection
3. Try manual mode if specific camera needed

---

## Security Best Practices

### Production Environment

1. **Change Default Passwords**
   ```bash
   # Never use default passwords in production
   # Create new admin users with strong passwords
   ```

2. **Environment Variables**
   ```bash
   # Generate strong NEXTAUTH_SECRET
   openssl rand -base64 32

   # Use strong DATABASE_URL password
   # Never commit .env to version control
   ```

3. **HTTPS Only**
   ```bash
   # Always use HTTPS in production
   NEXTAUTH_URL="https://hamees.gagneet.com"
   ```

4. **Database Security**
   ```bash
   # Use dedicated database user
   # Restrict database permissions
   # Regular backups
   ```

### Development Environment

1. Use `.env.local` for local overrides
2. Never commit sensitive data to Git
3. Use different database for development
4. Test with realistic but fake data

---

## Additional Resources

- **CLAUDE.md**: Project overview and development guidelines
- **SETUP.md**: Database setup and installation instructions
- **README.md**: Feature documentation and deployment guide
- **prisma/schema.prisma**: Complete database schema

---

## Support

For issues, questions, or feature requests:
1. Check this documentation first
2. Review application logs: `pm2 logs hamees-inventory`
3. Check database connectivity
4. Verify environment variables
5. Create an issue in the project repository

---

**Last Updated:** January 11, 2026
**Version:** 1.0.0 (Phase 2 - Authentication & Barcode Scanning Complete)
