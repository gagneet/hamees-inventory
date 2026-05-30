import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { filterApiResponse } from '@/lib/api-filter-response'
import type { UserRole } from '@prisma/client'

/**
 * Integration tests for field-level ACL filtering
 * Tests that API responses properly strip unauthorized fields
 */

describe('ACL - API Response Filtering Integration', () => {
  describe('Order response filtering', () => {
    const mockOrder = {
      id: 'order-123',
      orderNumber: 'ORD-2024-001',
      status: 'NEW',
      customerId: 'cust-1',
      deliveryDate: new Date('2024-12-31'),
      priority: 'NORMAL',
      // Financial fields
      totalAmount: 50000,
      advancePaid: 20000,
      discount: 5000,
      balanceAmount: 25000,
      gstAmount: 5000,
      cgst: 2500,
      sgst: 2500,
      igst: 0,
      stitchingTier: 'PREMIUM',
      workmanshipCost: 5000,
      designerFee: 1000,
      fabricWastage: 500,
      // Relations
      customer: {
        id: 'cust-1',
        name: 'John Doe',
        phone: '9876543210',
      },
      items: [
        {
          id: 'item-1',
          garmentPatternId: 'pattern-1',
          totalPrice: 30000,
          quantityOrdered: 1,
        },
      ],
    }

    it('OWNER sees all order fields including financial data', () => {
      const filtered = filterApiResponse(mockOrder, 'OWNER', 'order')

      expect(filtered.id).toBe('order-123')
      expect(filtered.totalAmount).toBe(50000)
      expect(filtered.advancePaid).toBe(20000)
      expect(filtered.gstAmount).toBe(5000)
      expect(filtered.customer).toBeDefined()
      expect(filtered.items).toBeDefined()
    })

    it('ADMIN sees all order fields including financial data', () => {
      const filtered = filterApiResponse(mockOrder, 'ADMIN', 'order')

      expect(filtered.totalAmount).toBe(50000)
      expect(filtered.advancePaid).toBe(20000)
      expect(filtered.gstAmount).toBe(5000)
    })

    it('TAILOR does NOT see order financial fields', () => {
      const filtered = filterApiResponse(mockOrder, 'TAILOR', 'order')

      // Non-financial fields should be present
      expect(filtered.id).toBe('order-123')
      expect(filtered.orderNumber).toBe('ORD-2024-001')
      expect(filtered.status).toBe('NEW')
      expect(filtered.customerId).toBe('cust-1')
      expect(filtered.priority).toBe('NORMAL')
      expect(filtered.customer).toBeDefined()
      expect(filtered.items).toBeDefined()

      // Financial fields should be absent
      expect(filtered.totalAmount).toBeUndefined()
      expect(filtered.advancePaid).toBeUndefined()
      expect(filtered.discount).toBeUndefined()
      expect(filtered.balanceAmount).toBeUndefined()
      expect(filtered.gstAmount).toBeUndefined()
      expect(filtered.stitchingTier).toBeUndefined()
      expect(filtered.workmanshipCost).toBeUndefined()
      expect(filtered.designerFee).toBeUndefined()
    })

    it('INVENTORY_MANAGER does NOT see order financial fields', () => {
      const filtered = filterApiResponse(mockOrder, 'INVENTORY_MANAGER', 'order')

      expect(filtered.totalAmount).toBeUndefined()
      expect(filtered.advancePaid).toBeUndefined()
      expect(filtered.id).toBe('order-123')
    })

    it('SALES_MANAGER does NOT see order financial fields', () => {
      const filtered = filterApiResponse(mockOrder, 'SALES_MANAGER', 'order')

      expect(filtered.totalAmount).toBeUndefined()
      expect(filtered.advancePaid).toBeUndefined()
      expect(filtered.id).toBe('order-123')
    })

    it('VIEWER does NOT see order financial fields', () => {
      const filtered = filterApiResponse(mockOrder, 'VIEWER', 'order')

      expect(filtered.totalAmount).toBeUndefined()
      expect(filtered.advancePaid).toBeUndefined()
      expect(filtered.id).toBe('order-123')
    })
  })

  describe('Purchase Order response filtering', () => {
    const mockPO = {
      id: 'po-123',
      poNumber: 'PO-2024-001',
      status: 'PENDING',
      supplierId: 'sup-1',
      totalAmount: 100000,
      balanceAmount: 50000,
      paidAmount: 50000,
      paymentMode: 'BANK_TRANSFER',
      dueDate: new Date('2024-12-31'),
      items: [
        {
          id: 'po-item-1',
          clothInventoryId: 'fabric-1',
          quantityOrdered: 10,
        },
      ],
    }

    it('INVENTORY_MANAGER can see PO financial fields', () => {
      const filtered = filterApiResponse(mockPO, 'INVENTORY_MANAGER', 'purchase_order')

      expect(filtered.totalAmount).toBe(100000)
      expect(filtered.balanceAmount).toBe(50000)
      expect(filtered.paidAmount).toBe(50000)
      expect(filtered.poNumber).toBe('PO-2024-001')
    })

    it('TAILOR CANNOT see PO financial fields', () => {
      const filtered = filterApiResponse(mockPO, 'TAILOR', 'purchase_order')

      expect(filtered.totalAmount).toBeUndefined()
      expect(filtered.balanceAmount).toBeUndefined()
      expect(filtered.paidAmount).toBeUndefined()
      expect(filtered.id).toBe('po-123')
    })

    it('SALES_MANAGER CANNOT see PO financial fields', () => {
      const filtered = filterApiResponse(mockPO, 'SALES_MANAGER', 'purchase_order')

      expect(filtered.totalAmount).toBeUndefined()
      expect(filtered.balanceAmount).toBeUndefined()
      expect(filtered.poNumber).toBe('PO-2024-001')
    })

    it('VIEWER CANNOT see PO financial fields', () => {
      const filtered = filterApiResponse(mockPO, 'VIEWER', 'purchase_order')

      expect(filtered.totalAmount).toBeUndefined()
      expect(filtered.balanceAmount).toBeUndefined()
    })
  })

  describe('Array filtering', () => {
    const mockOrders = [
      {
        id: 'order-1',
        totalAmount: 5000,
        status: 'NEW',
      },
      {
        id: 'order-2',
        totalAmount: 3000,
        status: 'STITCHING',
      },
    ]

    it('filters all items in array consistently', () => {
      const filtered = filterApiResponse(mockOrders, 'TAILOR', 'order')

      expect(filtered).toHaveLength(2)
      expect(filtered[0].id).toBe('order-1')
      expect(filtered[0].status).toBe('NEW')
      expect(filtered[0].totalAmount).toBeUndefined()
      expect(filtered[1].id).toBe('order-2')
      expect(filtered[1].totalAmount).toBeUndefined()
    })

    it('OWNER sees financial data in all items', () => {
      const filtered = filterApiResponse(mockOrders, 'OWNER', 'order')

      expect(filtered).toHaveLength(2)
      expect(filtered[0].totalAmount).toBe(5000)
      expect(filtered[1].totalAmount).toBe(3000)
    })
  })

  describe('Inventory response filtering', () => {
    const mockInventory = {
      id: 'fabric-123',
      name: 'Premium Cotton',
      color: 'Navy',
      currentStock: 50,
      costPerUnit: 500,
      totalCost: 25000,
      unitPrice: 750,
      minimumStock: 10,
    }

    it('INVENTORY_MANAGER sees inventory costs', () => {
      const filtered = filterApiResponse(mockInventory, 'INVENTORY_MANAGER', 'inventory')

      expect(filtered.costPerUnit).toBe(500)
      expect(filtered.totalCost).toBe(25000)
      expect(filtered.name).toBe('Premium Cotton')
    })

    it('SALES_MANAGER does NOT see inventory costs', () => {
      const filtered = filterApiResponse(mockInventory, 'SALES_MANAGER', 'inventory')

      expect(filtered.costPerUnit).toBeUndefined()
      expect(filtered.totalCost).toBeUndefined()
      expect(filtered.name).toBe('Premium Cotton')
    })

    it('OWNER sees inventory costs', () => {
      const filtered = filterApiResponse(mockInventory, 'OWNER', 'inventory')

      expect(filtered.costPerUnit).toBe(500)
      expect(filtered.totalCost).toBe(25000)
    })
  })

  describe('Expense response filtering', () => {
    const mockExpense = {
      id: 'exp-123',
      description: 'Monthly rent',
      totalAmount: 50000,
      category: 'RENT',
      paymentMode: 'BANK_TRANSFER',
      date: new Date('2024-05-01'),
    }

    it('OWNER sees expense financial data', () => {
      const filtered = filterApiResponse(mockExpense, 'OWNER', 'expense')

      expect(filtered.totalAmount).toBe(50000)
      expect(filtered.category).toBe('RENT')
      expect(filtered.description).toBe('Monthly rent')
    })

    it('ADMIN sees expense financial data', () => {
      const filtered = filterApiResponse(mockExpense, 'ADMIN', 'expense')

      expect(filtered.totalAmount).toBe(50000)
    })

    it('Any other role CANNOT see expense data', () => {
      const rolesWithoutAccess = ['INVENTORY_MANAGER', 'SALES_MANAGER', 'TAILOR', 'VIEWER'] as UserRole[]

      rolesWithoutAccess.forEach((role) => {
        const filtered = filterApiResponse(mockExpense, role, 'expense')
        expect(filtered.totalAmount).toBeUndefined()
        expect(filtered.category).toBeUndefined()
      })
    })
  })

  describe('Financial Report response filtering', () => {
    const mockReport = {
      summary: {
        thisMonthRevenue: 500000,
      },
      financialData: [{ month: 'May 2026', revenue: 500000 }],
      yearToDate: { revenue: 2200000, expenses: 950000, profit: 1250000 },
    }

    it('OWNER sees all financial report data', () => {
      const filtered = filterApiResponse(mockReport, 'OWNER', 'report_financial')

      expect(filtered.summary).toEqual({ thisMonthRevenue: 500000 })
      expect(filtered.financialData).toHaveLength(1)
      expect(filtered.yearToDate?.revenue).toBe(2200000)
    })

    it('Non-owner roles do NOT see report financial data', () => {
      const rolesWithoutAccess = ['INVENTORY_MANAGER', 'SALES_MANAGER', 'TAILOR', 'VIEWER'] as UserRole[]

      rolesWithoutAccess.forEach((role) => {
        const filtered = filterApiResponse(mockReport, role, 'report_financial')
        expect(filtered.summary).toBeUndefined()
        expect(filtered.financialData).toBeUndefined()
        expect(filtered.yearToDate).toBeUndefined()
      })
    })
  })

  describe('Customer response filtering', () => {
    const mockCustomer = {
      id: 'cust-1',
      name: 'Ahmed Ali',
      phone: '9876543210',
      email: 'ahmed@example.com',
      totalRevenue: 250000,
      outstandingAmount: 50000,
      totalOrders: 5,
      averageOrderValue: 50000,
    }

    it('OWNER sees customer financial summary', () => {
      const filtered = filterApiResponse(mockCustomer, 'OWNER', 'customer')

      expect(filtered.totalRevenue).toBe(250000)
      expect(filtered.outstandingAmount).toBe(50000)
      expect(filtered.name).toBe('Ahmed Ali')
    })

    it('SALES_MANAGER does NOT see customer financial summary', () => {
      const filtered = filterApiResponse(mockCustomer, 'SALES_MANAGER', 'customer')

      expect(filtered.totalRevenue).toBeUndefined()
      expect(filtered.outstandingAmount).toBeUndefined()
      expect(filtered.name).toBe('Ahmed Ali')
    })

    it('TAILOR does NOT see customer financial summary', () => {
      const filtered = filterApiResponse(mockCustomer, 'TAILOR', 'customer')

      expect(filtered.totalRevenue).toBeUndefined()
      expect(filtered.outstandingAmount).toBeUndefined()
      expect(filtered.name).toBe('Ahmed Ali')
    })
  })

  describe('Edge cases', () => {
    it('handles null data gracefully', () => {
      const result = filterApiResponse(null, 'OWNER', 'order')
      expect(result).toBe(null)
    })

    it('handles undefined data gracefully', () => {
      const result = filterApiResponse(undefined, 'OWNER', 'order')
      expect(result).toBe(undefined)
    })

    it('handles empty array', () => {
      const result = filterApiResponse([], 'OWNER', 'order')
      expect(result).toEqual([])
    })

    it('preserves order of array items', () => {
      const items = [
        { id: '1', totalAmount: 100 },
        { id: '2', totalAmount: 200 },
        { id: '3', totalAmount: 300 },
      ]

      const filtered = filterApiResponse(items, 'TAILOR', 'order')
      expect(filtered.map((item) => item.id)).toEqual(['1', '2', '3'])
    })

    it('removes only financial fields, preserves others', () => {
      const data = {
        id: 'test',
        name: 'Test Item',
        status: 'ACTIVE',
        totalAmount: 5000,
        advancePaid: 1000,
        metadata: { key: 'value' },
      }

      const filtered = filterApiResponse(data, 'TAILOR', 'order')
      expect(filtered.id).toBe('test')
      expect(filtered.name).toBe('Test Item')
      expect(filtered.status).toBe('ACTIVE')
      expect(filtered.metadata).toEqual({ key: 'value' })
      expect(filtered.totalAmount).toBeUndefined()
      expect(filtered.advancePaid).toBeUndefined()
    })
  })
})
