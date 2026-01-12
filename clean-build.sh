#!/bin/bash

# Clean Build Script for Hamees Inventory
# - Always deletes .next and rebuilds
# - Deletes node_modules only if package.json has been updated since last install

set -e  # Exit on any error

echo "🧹 Starting clean build process..."

# Remove .next directory
if [ -d ".next" ]; then
  echo "📁 Removing .next directory..."
  rm -rf .next
  echo "✅ .next directory removed"
else
  echo "ℹ️  .next directory not found, skipping..."
fi

# Check if node_modules needs to be reinstalled
REINSTALL_DEPS=false

if [ -d "node_modules" ]; then
  # Check if package.json is newer than node_modules
  if [ "package.json" -nt "node_modules" ]; then
    echo "📦 package.json has been updated since last install"
    echo "📁 Removing node_modules directory..."
    rm -rf node_modules
    echo "✅ node_modules directory removed"
    REINSTALL_DEPS=true
  else
    echo "ℹ️  package.json unchanged, keeping node_modules"
  fi
else
  echo "ℹ️  node_modules not found"
  REINSTALL_DEPS=true
fi

# Install dependencies if needed
if [ "$REINSTALL_DEPS" = true ]; then
  echo "📦 Installing dependencies with pnpm..."
  pnpm install

  echo "🔧 Generating Prisma client..."
  pnpm prisma generate
fi

# Build the application
echo "🔨 Building application..."
pnpm build

echo "✨ Clean build completed successfully!"
echo "🚀 You can now start the application with: pnpm start (production) or pnpm dev (development)"
