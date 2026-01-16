-- Insert demo users for all roles
-- Password for all users: admin123
-- Hashed with bcrypt (10 salt rounds): $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy

-- Check if users already exist and insert only missing ones

-- OWNER (already exists)
INSERT INTO "User" (id, email, password, name, role, phone, active, "createdAt", "updatedAt")
SELECT
  'clmk_admin_user_000001',
  'admin@hameesattire.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'Administrator',
  'ADMIN',
  '+91-9876543211',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "User" WHERE email = 'admin@hameesattire.com'
);

-- SALES_MANAGER
INSERT INTO "User" (id, email, password, name, role, phone, active, "createdAt", "updatedAt")
SELECT
  'clmk_sales_user_000001',
  'sales@hameesattire.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'Sales Manager',
  'SALES_MANAGER',
  '+91-9876543213',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "User" WHERE email = 'sales@hameesattire.com'
);

-- TAILOR
INSERT INTO "User" (id, email, password, name, role, phone, active, "createdAt", "updatedAt")
SELECT
  'clmk_tailor_user_000001',
  'tailor@hameesattire.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'Master Tailor',
  'TAILOR',
  '+91-9876543214',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "User" WHERE email = 'tailor@hameesattire.com'
);

-- VIEWER
INSERT INTO "User" (id, email, password, name, role, phone, active, "createdAt", "updatedAt")
SELECT
  'clmk_viewer_user_000001',
  'viewer@hameesattire.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'View Only User',
  'VIEWER',
  '+91-9876543215',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "User" WHERE email = 'viewer@hameesattire.com'
);

-- Display all users
SELECT email, name, role, active FROM "User" ORDER BY
  CASE role
    WHEN 'OWNER' THEN 1
    WHEN 'ADMIN' THEN 2
    WHEN 'INVENTORY_MANAGER' THEN 3
    WHEN 'SALES_MANAGER' THEN 4
    WHEN 'TAILOR' THEN 5
    WHEN 'VIEWER' THEN 6
  END;
