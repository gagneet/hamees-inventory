'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'

interface InvoiceOrder {
  orderNumber: string
  orderDate: Date | string
  deliveryDate: Date | string
  status: string
  customer: {
    name: string
    phone: string
    email?: string | null
    address?: string | null
    city?: string | null
  }
  items: Array<{
    garmentPattern: {
      name: string
    }
    clothInventory: {
      name: string
      color: string
      type: string
    }
    quantityOrdered: number
    estimatedMeters: number
    pricePerUnit: number
    totalPrice: number
  }>
  paymentInstallments?: Array<{
    installmentNumber: number
    paidDate: Date | string | null
    paidAmount: number
    paymentMode: string | null
    status: string
  }>
  subTotal: number
  gstRate: number
  cgst: number
  sgst: number
  gstAmount: number
  totalAmount: number
  advancePaid: number
  discount: number
  balanceAmount: number
  notes?: string | null
}

interface PrintInvoiceButtonProps {
  order: InvoiceOrder
}

export function PrintInvoiceButton({ order }: PrintInvoiceButtonProps) {
  const handlePrint = () => {
    const invoiceHTML = generateInvoiceHTML(order)
    const printWindow = window.open('', '_blank', 'width=800,height=600')

    if (printWindow) {
      printWindow.document.open()
      printWindow.document.write(invoiceHTML)
      printWindow.document.close()

      // Multi-layered approach to ensure content is ready before printing
      const triggerPrint = () => {
        try {
          printWindow.focus()
          printWindow.print()
        } catch (error) {
          console.error('Print error:', error)
          // Fallback: show alert to user
          alert('Please use the browser print button (Ctrl+P or Cmd+P) to print the invoice.')
        }
      }

      // Strategy 1: Wait for window load event (most reliable)
      printWindow.addEventListener('load', () => {
        // Additional delay to ensure CSS is applied and layout is complete
        setTimeout(triggerPrint, 500)
      }, { once: true })

      // Strategy 2: Fallback timeout in case load event doesn't fire
      setTimeout(() => {
        if (printWindow.document.readyState === 'complete') {
          triggerPrint()
        }
      }, 1000)
    } else {
      alert('Pop-up blocked! Please allow pop-ups for this site to print invoices.')
    }
  }

  return (
    <Button
      onClick={handlePrint}
      className="w-full"
      variant="outline"
      size="sm"
    >
      <Printer className="mr-2 h-4 w-4" />
      Print Invoice
    </Button>
  )
}

function generateInvoiceHTML(order: InvoiceOrder): string {
  const orderDate = format(new Date(order.orderDate), 'dd MMM yyyy')
  const deliveryDate = format(new Date(order.deliveryDate), 'dd MMM yyyy')

  // Calculate per-item costs for multi-item orders
  const itemCount = order.items.length
  const perItemSubtotal = order.subTotal / itemCount
  const perItemGST = order.gstAmount / itemCount
  const perItemCGST = order.cgst / itemCount
  const perItemSGST = order.sgst / itemCount
  const perItemDiscount = order.discount / itemCount
  const perItemTotal = order.totalAmount / itemCount

  // Calculate per-item payments
  const perItemAdvance = order.advancePaid / itemCount
  const perItemBalance = order.balanceAmount / itemCount

  // Calculate additional payments (installments) based on the balance
  // This avoids double-counting in cases where advance is recorded in installments
  // Formula: Additional Payments = Total - Discount - Advance - Balance
  const perItemAdditionalPayments = perItemTotal - perItemDiscount - perItemAdvance - perItemBalance

  // Generate one page per order item
  const itemPages = order.items.map((item, index) => `
    <div class="invoice-page" ${index > 0 ? 'style="page-break-before: always;"' : ''}>
      <div class="invoice">
        <!-- Header -->
        <div class="header">
          <div class="company-name">HAMEES ATTIRE</div>
          <div class="company-tagline">Custom Tailoring & Garments</div>
          <div class="invoice-title">TAX INVOICE</div>
          ${itemCount > 1 ? `<div class="page-indicator">Item ${index + 1} of ${itemCount}</div>` : ''}
        </div>

        <!-- Info Section -->
        <div class="info-section">
          <div class="info-block">
            <h3>Bill To:</h3>
            <p><strong>${order.customer.name}</strong></p>
            <p>Phone: ${order.customer.phone}</p>
            ${order.customer.email ? `<p>Email: ${order.customer.email}</p>` : ''}
            ${order.customer.address ? `<p>Address: ${order.customer.address}</p>` : ''}
            ${order.customer.city ? `<p>City: ${order.customer.city}</p>` : ''}
          </div>

          <div class="info-block">
            <h3>Invoice Details:</h3>
            <p><span class="info-label">Invoice No:</span> ${order.orderNumber}</p>
            <p><span class="info-label">Order Date:</span> ${orderDate}</p>
            <p><span class="info-label">Delivery Date:</span> ${deliveryDate}</p>
            <p><span class="info-label">Status:</span> <strong>${order.status}</strong></p>
          </div>
        </div>

        <!-- Single Item Table -->
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Fabric Details</th>
              <th class="text-center">Qty</th>
              <th class="text-right">Meters</th>
              <th class="text-right">Rate</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>${item.garmentPattern.name}</strong></td>
              <td>${item.clothInventory.type} - ${item.clothInventory.name} (${item.clothInventory.color})</td>
              <td class="text-center">${item.quantityOrdered}</td>
              <td class="text-right">${item.estimatedMeters.toFixed(2)}</td>
              <td class="text-right">${formatCurrency(item.pricePerUnit)}</td>
              <td class="text-right"><strong>${formatCurrency(item.totalPrice)}</strong></td>
            </tr>
          </tbody>
        </table>

        <!-- Totals Section -->
        <div class="totals-section">
          <div class="totals-row">
            <div class="totals-label">Item Subtotal:</div>
            <div class="totals-value">${formatCurrency(item.totalPrice)}</div>
          </div>
          <div class="totals-row">
            <div class="totals-label">CGST (${(order.gstRate / 2).toFixed(1)}%):</div>
            <div class="totals-value">${formatCurrency(perItemCGST)}</div>
          </div>
          <div class="totals-row">
            <div class="totals-label">SGST (${(order.gstRate / 2).toFixed(1)}%):</div>
            <div class="totals-value">${formatCurrency(perItemSGST)}</div>
          </div>
          <div class="totals-row">
            <div class="totals-label">Total GST:</div>
            <div class="totals-value">${formatCurrency(perItemGST)}</div>
          </div>
          <div class="totals-row bold">
            <div class="totals-label">Item Total:</div>
            <div class="totals-value">${formatCurrency(perItemTotal)}</div>
          </div>
          ${perItemDiscount > 0 ? `
          <div class="totals-row">
            <div class="totals-label">Less: Discount</div>
            <div class="totals-value">-${formatCurrency(perItemDiscount)}</div>
          </div>
          ` : ''}
          ${perItemAdvance > 0 ? `
          <div class="totals-row">
            <div class="totals-label">Less: Advance Paid</div>
            <div class="totals-value">-${formatCurrency(perItemAdvance)}</div>
          </div>
          ` : ''}
          ${perItemAdditionalPayments > 0 ? `
          <div class="totals-row">
            <div class="totals-label">Less: Additional Payments</div>
            <div class="totals-value">-${formatCurrency(perItemAdditionalPayments)}</div>
          </div>
          ` : ''}
          <div class="totals-row bold" style="background-color: ${perItemBalance > 0 ? '#fef3c7' : '#d1fae5'}; border: 2px solid ${perItemBalance > 0 ? '#f59e0b' : '#10b981'};">
            <div class="totals-label" style="color: ${perItemBalance > 0 ? '#92400e' : '#065f46'};">Balance Due:</div>
            <div class="totals-value" style="color: ${perItemBalance > 0 ? '#92400e' : '#065f46'};">${formatCurrency(perItemBalance)}</div>
          </div>
        </div>

        <div style="clear: both;"></div>

        <!-- Payments Received Section -->
        ${order.paymentInstallments && order.paymentInstallments.length > 0 ? `
        <div class="payments-section">
          <h3 style="font-size: 12px; font-weight: bold; margin: 15px 0 8px 0; border-bottom: 1px solid #ddd; padding-bottom: 4px;">Payments Received:</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th style="border: 1px solid #ddd; padding: 4px; text-align: left; font-size: 9px;">#</th>
                <th style="border: 1px solid #ddd; padding: 4px; text-align: left; font-size: 9px;">Date</th>
                <th style="border: 1px solid #ddd; padding: 4px; text-align: left; font-size: 9px;">Mode</th>
                <th style="border: 1px solid #ddd; padding: 4px; text-align: right; font-size: 9px;">Full Amount</th>
                <th style="border: 1px solid #ddd; padding: 4px; text-align: right; font-size: 9px;">This Item (${itemCount > 1 ? 'Proportional' : 'Full'})</th>
              </tr>
            </thead>
            <tbody>
              ${order.paymentInstallments.map(inst => {
                const perItemPayment = inst.paidAmount / itemCount
                return `
                <tr>
                  <td style="border: 1px solid #ddd; padding: 4px; font-size: 9px;">${inst.installmentNumber}</td>
                  <td style="border: 1px solid #ddd; padding: 4px; font-size: 9px;">${inst.paidDate ? format(new Date(inst.paidDate), 'dd MMM yyyy') : 'N/A'}</td>
                  <td style="border: 1px solid #ddd; padding: 4px; font-size: 9px;">${inst.paymentMode || 'N/A'}</td>
                  <td style="border: 1px solid #ddd; padding: 4px; text-align: right; font-size: 9px;">${formatCurrency(inst.paidAmount)}</td>
                  <td style="border: 1px solid #ddd; padding: 4px; text-align: right; font-size: 9px; font-weight: bold;">${formatCurrency(perItemPayment)}</td>
                </tr>
                `
              }).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        <div style="clear: both; margin-bottom: 15px;"></div>

        ${itemCount > 1 ? `
        <div class="multi-item-notice">
          <strong>Note:</strong> This is item ${index + 1} of ${itemCount} in order ${order.orderNumber}.
          Total order amount: ${formatCurrency(order.totalAmount)} |
          Total balance due: ${formatCurrency(order.balanceAmount)}
        </div>
        ` : ''}

        <!-- Notes -->
        ${order.notes ? `
        <div class="notes">
          <strong>Notes:</strong><br>
          ${order.notes}
        </div>
        ` : ''}

        <!-- Signature Section -->
        <div class="signature-section">
          <div class="signature-block">
            <div class="signature-line">Customer Signature</div>
          </div>
          <div class="signature-block">
            <div class="signature-line">Authorized Signatory</div>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <p><strong>Thank you for your business!</strong></p>
          <p>This is a computer-generated invoice and does not require a signature.</p>
          <p style="margin-top: 10px;">For any queries, please contact us at the above details.</p>
        </div>
      </div>
    </div>
  `).join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice - ${order.orderNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Arial', sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #333;
    }

    .invoice-page {
      width: 210mm;
      min-height: 297mm;
      max-height: 297mm;
      padding: 15mm;
      margin: 0 auto;
      background: white;
    }

    .invoice {
      height: 100%;
      border: 2px solid #000;
      padding: 15px;
      display: flex;
      flex-direction: column;
    }

    .header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 12px;
      margin-bottom: 15px;
    }

    .company-name {
      font-size: 22px;
      font-weight: bold;
      color: #1E3A8A;
      margin-bottom: 4px;
    }

    .company-tagline {
      font-size: 12px;
      color: #666;
      margin-bottom: 8px;
    }

    .invoice-title {
      font-size: 16px;
      font-weight: bold;
      margin-top: 8px;
    }

    .page-indicator {
      font-size: 11px;
      color: #666;
      margin-top: 5px;
      font-style: italic;
    }

    .info-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 15px;
    }

    .info-block {
      flex: 1;
    }

    .info-block h3 {
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 6px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 3px;
    }

    .info-block p {
      margin: 2px 0;
      font-size: 11px;
    }

    .info-label {
      font-weight: bold;
      display: inline-block;
      width: 110px;
    }

    .multi-item-notice {
      margin-top: 12px;
      padding: 8px;
      background-color: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 4px;
      font-size: 10px;
      text-align: center;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }

    th {
      background-color: #f5f5f5;
      border: 1px solid #000;
      padding: 6px;
      text-align: left;
      font-weight: bold;
      font-size: 10px;
    }

    td {
      border: 1px solid #000;
      padding: 6px;
      font-size: 10px;
    }

    .text-right {
      text-align: right;
    }

    .text-center {
      text-align: center;
    }

    .totals-section {
      float: right;
      width: 320px;
      margin-top: 8px;
    }

    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 8px;
      border-bottom: 1px solid #ddd;
      font-size: 10px;
    }

    .totals-row.bold {
      font-weight: bold;
      background-color: #f5f5f5;
      border: 1px solid #000;
      font-size: 11px;
    }

    .totals-label {
      flex: 1;
    }

    .totals-value {
      text-align: right;
      min-width: 90px;
    }

    .notes {
      clear: both;
      margin-top: 20px;
      padding: 8px;
      background-color: #f9f9f9;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 10px;
    }

    .footer {
      margin-top: 25px;
      padding-top: 15px;
      border-top: 2px solid #000;
      text-align: center;
      font-size: 10px;
      color: #666;
    }

    .signature-section {
      display: flex;
      justify-content: space-between;
      margin-top: 35px;
      padding: 0 15px;
    }

    .signature-block {
      text-align: center;
    }

    .signature-line {
      width: 180px;
      border-top: 1px solid #000;
      margin-top: 30px;
      padding-top: 4px;
      font-size: 10px;
    }

    @media print {
      body {
        padding: 0;
        margin: 0;
      }

      .invoice-page {
        page-break-after: always;
        page-break-inside: avoid;
        margin: 0;
        padding: 15mm;
      }

      .invoice-page:last-child {
        page-break-after: auto;
      }

      .invoice {
        border: 2px solid #000;
      }

      .multi-item-notice {
        page-break-inside: avoid;
      }

      .signature-section {
        page-break-inside: avoid;
      }

      .footer {
        page-break-inside: avoid;
      }

      /* Hide manual print button when actually printing */
      button, .print-button-container {
        display: none !important;
      }

      @page {
        size: A4;
        margin: 0;
      }
    }

    @media screen {
      .invoice-page {
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        margin-bottom: 20px;
      }
    }
  </style>
</head>
<body>
  ${itemPages}

  <script>
    // Ensure document is fully loaded and rendered
    document.addEventListener('DOMContentLoaded', function() {
      console.log('Invoice document loaded');
    });

    // Auto-close after printing
    window.onafterprint = function() {
      window.close();
    };

    // Manual print function for fallback button
    function manualPrint() {
      window.print();
    }
  </script>

  <!-- Fallback manual print button (only visible if auto-print fails) -->
  <div class="print-button-container" style="text-align: center; margin-top: 20px; padding: 20px;">
    <button
      onclick="manualPrint()"
      style="
        background-color: #1E3A8A;
        color: white;
        padding: 12px 24px;
        font-size: 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      "
    >
      🖨️ Click here to Print
    </button>
    <p style="margin-top: 10px; color: #666; font-size: 12px;">
      If the print dialog didn't open automatically, click the button above or press Ctrl+P (Windows) / Cmd+P (Mac)
    </p>
  </div>
</body>
</html>
  `
}
