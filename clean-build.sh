#!/bin/bash

# Clean Build Script for Hamees Inventory
# Deletes .next, node_modules, and rebuilds the application

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

# Remove node_modules directory
if [ -d "node_modules" ]; then
  echo "📁 Removing node_modules directory..."
  rm -rf node_modules
  echo "✅ node_modules directory removed"
else
  echo "ℹ️  node_modules directory not found, skipping..."
fi

# Remove pnpm lock file (optional - uncomment if you want a completely fresh install)
# if [ -f "pnpm-lock.yaml" ]; then
#   echo "📁 Removing pnpm-lock.yaml..."
#   rm pnpm-lock.yaml
#   echo "✅ pnpm-lock.yaml removed"
# fi

# Install dependencies
echo "📦 Installing dependencies with pnpm..."
pnpm install

# Generate Prisma client
echo "🔧 Generating Prisma client..."
pnpm prisma generate

# Build the application
echo "🔨 Building application..."
pnpm build

echo "✨ Clean build completed successfully!"
echo "🚀 You can now start the application with: pnpm start (production) or pnpm dev (development)"
