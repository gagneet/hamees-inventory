#!/bin/bash

# PostgreSQL Setup Script for Tailor Inventory System
# This script sets up PostgreSQL for local development

set -e  # Exit on any error

echo "🔧 PostgreSQL Setup for Tailor Inventory System"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get current username
CURRENT_USER=$(whoami)
DB_NAME="tailor_inventory"

echo -e "${YELLOW}Current user: ${CURRENT_USER}${NC}"
echo ""

# Step 1: Create PostgreSQL role
echo "Step 1: Creating PostgreSQL role for ${CURRENT_USER}..."
sudo -u postgres psql -c "CREATE ROLE ${CURRENT_USER} WITH LOGIN SUPERUSER CREATEDB CREATEROLE;" 2>/dev/null || {
    echo -e "${YELLOW}Role already exists or failed to create. Continuing...${NC}"
    sudo -u postgres psql -c "ALTER ROLE ${CURRENT_USER} WITH LOGIN SUPERUSER CREATEDB CREATEROLE;"
}

echo -e "${GREEN}✓ PostgreSQL role configured${NC}"
echo ""

# Step 2: Create database
echo "Step 2: Creating database ${DB_NAME}..."
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${CURRENT_USER};" 2>/dev/null || {
    echo -e "${YELLOW}Database already exists. Continuing...${NC}"
}

echo -e "${GREEN}✓ Database created${NC}"
echo ""

# Step 3: Verify connection
echo "Step 3: Verifying connection..."
if psql -d ${DB_NAME} -c "SELECT version();" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Connection successful!${NC}"
else
    echo -e "${RED}✗ Connection failed${NC}"
    exit 1
fi

echo ""
echo "================================================"
echo -e "${GREEN}PostgreSQL setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Update your .env file (already done)"
echo "  2. Run: pnpm db:push"
echo "  3. Run: pnpm db:seed"
echo "  4. Run: pnpm db:studio (to view data)"
echo ""
echo "Your DATABASE_URL should be:"
echo "  DATABASE_URL=\"postgresql://${CURRENT_USER}@localhost:5432/${DB_NAME}?schema=public\""
echo ""
