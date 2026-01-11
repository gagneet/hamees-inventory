import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
  }).format(new Date(date))
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}

export function generateOrderNumber(): string {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 1000)
  return `ORD-${timestamp}-${random}`
}

export function generateSKU(type: string, brand: string): string {
  const typeCode = type.substring(0, 3).toUpperCase()
  const brandCode = brand.substring(0, 3).toUpperCase()
  const random = Math.floor(Math.random() * 10000)
  return `${typeCode}-${brandCode}-${random}`
}

export function calculateStockStatus(available: number, minimum: number): 'healthy' | 'low' | 'critical' {
  if (available >= minimum) return 'healthy'
  if (available >= minimum * 0.5) return 'low'
  return 'critical'
}

export function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    healthy: 'bg-success text-white',
    low: 'bg-warning text-white',
    critical: 'bg-error text-white',
    NEW: 'bg-info text-white',
    MATERIAL_SELECTED: 'bg-primary text-white',
    CUTTING: 'bg-accent text-white',
    STITCHING: 'bg-secondary text-white',
    FINISHING: 'bg-warning text-white',
    READY: 'bg-success text-white',
    DELIVERED: 'bg-neutral-600 text-white',
    CANCELLED: 'bg-error text-white',
  }
  return statusColors[status] || 'bg-neutral-400 text-white'
}
