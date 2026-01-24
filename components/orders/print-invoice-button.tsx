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
    const printWindow = window.open('', '_blank')

    if (printWindow) {
      printWindow.document.write(invoiceHTML)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => {
        printWindow.print()
      }, 250)
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
      font-size: 12px;
      line-height: 1.5;
      color: #333;
      padding: 20px;
    }

    .invoice {
      max-width: 800px;
      margin: 0 auto;
      border: 2px solid #000;
      padding: 20px;
    }

    .header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }

    .company-name {
      font-size: 24px;
      font-weight: bold;
      color: #1E3A8A;
      margin-bottom: 5px;
    }

    .company-tagline {
      font-size: 14px;
      color: #666;
      margin-bottom: 10px;
    }

    .invoice-title {
      font-size: 18px;
      font-weight: bold;
      margin-top: 10px;
    }

    .info-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
    }

    .info-block {
      flex: 1;
    }

    .info-block h3 {
      font-size: 13px;
      font-weight: bold;
      margin-bottom: 8px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 4px;
    }

    .info-block p {
      margin: 3px 0;
      font-size: 12px;
    }

    .info-label {
      font-weight: bold;
      display: inline-block;
      width: 120px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }

    th {
      background-color: #f5f5f5;
      border: 1px solid #000;
      padding: 8px;
      text-align: left;
      font-weight: bold;
      font-size: 11px;
    }

    td {
      border: 1px solid #000;
      padding: 8px;
      font-size: 11px;
    }

    .text-right {
      text-align: right;
    }

    .text-center {
      text-align: center;
    }

    .totals-section {
      float: right;
      width: 350px;
      margin-top: 10px;
    }

    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 10px;
      border-bottom: 1px solid #ddd;
    }

    .totals-row.bold {
      font-weight: bold;
      background-color: #f5f5f5;
      border: 1px solid #000;
      font-size: 13px;
    }

    .totals-label {
      flex: 1;
    }

    .totals-value {
      text-align: right;
      min-width: 100px;
    }

    .notes {
      clear: both;
      margin-top: 30px;
      padding: 10px;
      background-color: #f9f9f9;
      border: 1px solid #ddd;
      border-radius: 4px;
    }

    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #000;
      text-align: center;
      font-size: 11px;
      color: #666;
    }

    .signature-section {
      display: flex;
      justify-content: space-between;
      margin-top: 50px;
      padding: 0 20px;
    }

    .signature-block {
      text-align: center;
    }

    .signature-line {
      width: 200px;
      border-top: 1px solid #000;
      margin-top: 40px;
      padding-top: 5px;
    }

    @media print {
      body {
        padding: 0;
      }

      .invoice {
        border: none;
      }

      @page {
        margin: 1cm;
      }
    }
  </style>
</head>
<body>
  <div class="invoice">
    <!-- Header -->
    <div class="header">
      <div class="company-name">HAMEES ATTIRE</div>
      <div class="company-tagline">Custom Tailoring & Garments</div>
      <div class="invoice-title">TAX INVOICE</div>
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

    <!-- Items Table -->
    <table>
      <thead>
        <tr>
          <th class="text-center">S.No</th>
          <th>Description</th>
          <th>Fabric Details</th>
          <th class="text-center">Qty</th>
          <th class="text-right">Meters</th>
          <th class="text-right">Rate</th>
          <th class="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${order.items.map((item, index) => `
          <tr>
            <td class="text-center">${index + 1}</td>
            <td><strong>${item.garmentPattern.name}</strong></td>
            <td>${item.clothInventory.type} - ${item.clothInventory.name} (${item.clothInventory.color})</td>
            <td class="text-center">${item.quantityOrdered}</td>
            <td class="text-right">${item.estimatedMeters.toFixed(2)}</td>
            <td class="text-right">${formatCurrency(item.pricePerUnit)}</td>
            <td class="text-right"><strong>${formatCurrency(item.totalPrice)}</strong></td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Totals Section -->
    <div class="totals-section">
      <div class="totals-row">
        <div class="totals-label">Subtotal:</div>
        <div class="totals-value">${formatCurrency(order.subTotal)}</div>
      </div>
      <div class="totals-row">
        <div class="totals-label">CGST (${(order.gstRate / 2).toFixed(1)}%):</div>
        <div class="totals-value">${formatCurrency(order.cgst)}</div>
      </div>
      <div class="totals-row">
        <div class="totals-label">SGST (${(order.gstRate / 2).toFixed(1)}%):</div>
        <div class="totals-value">${formatCurrency(order.sgst)}</div>
      </div>
      <div class="totals-row">
        <div class="totals-label">Total GST:</div>
        <div class="totals-value">${formatCurrency(order.gstAmount)}</div>
      </div>
      ${order.discount > 0 ? `
      <div class="totals-row">
        <div class="totals-label">Discount:</div>
        <div class="totals-value">-${formatCurrency(order.discount)}</div>
      </div>
      ` : ''}
      <div class="totals-row bold">
        <div class="totals-label">Grand Total:</div>
        <div class="totals-value">${formatCurrency(order.totalAmount)}</div>
      </div>
      <div class="totals-row">
        <div class="totals-label">Advance Paid:</div>
        <div class="totals-value">${formatCurrency(order.advancePaid)}</div>
      </div>
      <div class="totals-row bold">
        <div class="totals-label">Balance Due:</div>
        <div class="totals-value">${formatCurrency(order.balanceAmount)}</div>
      </div>
    </div>

    <div style="clear: both;"></div>

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

  <script>
    // Auto-close after printing
    window.onafterprint = function() {
      window.close();
    };
  </script>
</body>
</html>
  `
}
