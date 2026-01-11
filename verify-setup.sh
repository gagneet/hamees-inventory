#!/bin/bash

# Verification Script for Tailor Inventory System
# Checks if everything is set up correctly after moving files

set -e

echo "🔍 Tailor Inventory System - Setup Verification"
echo "================================================"
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check 1: Essential files
echo "📁 Checking essential files..."
files=(
    "package.json"
    "tsconfig.json"
    ".env"
    ".env.example"
    ".gitignore"
    "prisma/schema.prisma"
    "prisma/seed.ts"
    "lib/db.ts"
    "lib/utils.ts"
    "app/globals.css"
)

missing_files=0
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file (MISSING)"
        missing_files=$((missing_files + 1))
    fi
done

if [ $missing_files -gt 0 ]; then
    echo -e "${RED}Error: $missing_files files are missing!${NC}"
    exit 1
fi

echo ""

# Check 2: Node modules
echo "📦 Checking node_modules..."
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} node_modules exists"
else
    echo -e "${YELLOW}⚠${NC} node_modules missing - run: pnpm install"
fi

echo ""

# Check 3: Prisma Client
echo "🔧 Checking Prisma Client..."
if npx prisma validate > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Prisma schema is valid"
else
    echo -e "${RED}✗${NC} Prisma schema has errors"
    exit 1
fi

echo ""

# Check 4: TypeScript
echo "📘 Checking TypeScript configuration..."
if [ -f "tsconfig.json" ]; then
    echo -e "${GREEN}✓${NC} TypeScript configured"
else
    echo -e "${RED}✗${NC} tsconfig.json missing"
    exit 1
fi

echo ""

# Check 5: Environment variables
echo "🔐 Checking environment variables..."
if [ -f ".env" ]; then
    if grep -q "DATABASE_URL" .env; then
        echo -e "${GREEN}✓${NC} DATABASE_URL configured"
    else
        echo -e "${YELLOW}⚠${NC} DATABASE_URL not found in .env"
    fi
    if grep -q "NEXTAUTH_SECRET" .env; then
        echo -e "${GREEN}✓${NC} NEXTAUTH_SECRET configured"
    else
        echo -e "${YELLOW}⚠${NC} NEXTAUTH_SECRET not found in .env"
    fi
else
    echo -e "${RED}✗${NC} .env file missing"
    exit 1
fi

echo ""

# Check 6: Documentation
echo "📚 Checking documentation..."
docs=(
    "README.md"
    "SETUP.md"
    "START-HERE.md"
    "PROGRESS.md"
)

for doc in "${docs[@]}"; do
    if [ -f "$doc" ]; then
        echo -e "${GREEN}✓${NC} $doc"
    else
        echo -e "${YELLOW}⚠${NC} $doc (missing)"
    fi
done

echo ""
echo "================================================"
echo -e "${GREEN}✅ Setup verification complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Ensure PostgreSQL is running"
echo "  2. Run: pnpm db:push"
echo "  3. Run: pnpm db:seed"
echo "  4. Run: pnpm dev"
echo ""
