'use client'

/**
 * @featuretrace Print Invoice
 * Generates a printable per-item tax invoice in a new window.
 * Seller identity, tax labels, currency and dates come from BusinessSettings (useAppSettings).
 * Every interpolated value is HTML-escaped — customer names, notes and addresses are user input
 * and are written into a same-origin document.
 */

import { Printer } from 'lucide-react'
import { useFieldVisibility } from '@/hooks/use-field-visibility'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { taxLines } from '@/lib/tax'
import { escapeHtml } from '@/lib/html-escape'
import { indicativeTotalNote, normalizeLocaleConfig } from '@/lib/locale'
import { useAppSettings } from '@/components/providers/settings-provider'
import type { AppSettings } from '@/lib/app-settings'

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
  igst?: number | null
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
  const { canView } = useFieldVisibility()
  const settings = useAppSettings()

  const handlePrint = () => {
    const invoiceHTML = generateInvoiceHTML(order, settings)
    const printWindow = window.open('', '_blank', 'width=800,height=600')

    if (printWindow) {
      printWindow.document.open()
      printWindow.document.write(invoiceHTML)
      printWindow.document.close()

      // Ensure content is fully rendered before printing
      const triggerPrint = () => {
        try {
          if (printWindow.document.body && printWindow.document.body.children.length > 0) {
            printWindow.focus()
            printWindow.print()
          } else {
            setTimeout(triggerPrint, 500)
          }
        } catch (error) {
          console.error('Print error:', error)
          alert('Please use the browser print button (Ctrl+P or Cmd+P) to print the invoice.')
        }
      }

      // Wait for complete document load and rendering
      if (printWindow.document.readyState === 'complete') {
        setTimeout(triggerPrint, 1000)
      } else {
        printWindow.addEventListener('load', () => {
          setTimeout(triggerPrint, 1500)
        }, { once: true })

        // Safety fallback if load event doesn't fire
        setTimeout(() => {
          if (printWindow.document.readyState === 'complete') {
            triggerPrint()
          }
        }, 3000)
      }
    } else {
      alert('Pop-up blocked! Please allow pop-ups for this site to print invoices.')
    }
  }

  return canView('order', 'totalAmount') ? (
    <Button
      onClick={handlePrint}
      className="w-full"
      variant="outline"
      size="sm"
    >
      <Printer className="mr-2 h-4 w-4" />
      Print Invoice
    </Button>
  ) : null
}

function sellerBlock(settings: AppSettings): string {
  const addressLine = [settings.address, settings.city, settings.region, settings.postalCode].filter(Boolean).join(', ')
  const contactLine = [
    settings.phone ? `Phone: ${escapeHtml(settings.phone)}` : '',
    settings.email ? `Email: ${escapeHtml(settings.email)}` : '',
    settings.website ? escapeHtml(settings.website) : '',
  ].filter(Boolean).join(' &nbsp;|&nbsp; ')

  return `
          <div class="company-name">${escapeHtml(settings.businessName)}</div>
          ${settings.tagline ? `<div class="company-tagline">${escapeHtml(settings.tagline)}</div>` : ''}
          ${addressLine ? `<div class="company-details">${escapeHtml(addressLine)}</div>` : ''}
          ${contactLine ? `<div class="company-details">${contactLine}</div>` : ''}
          ${settings.taxId ? `<div class="company-details"><strong>${escapeHtml(settings.taxIdLabel)}:</strong> ${escapeHtml(settings.taxId)}</div>` : ''}`
}

export function generateInvoiceHTML(order: InvoiceOrder, settings: AppSettings): string {
  const esc = escapeHtml
  const money = (n: number) => esc(formatCurrency(n))
  // Optional indicative total in the secondary currency (display only; the invoice is payable in
  // the main currency). Built from the settings passed in, not the process-wide locale.
  const indicativeNote = settings.showSecondaryOnInvoice
    ? indicativeTotalNote(
        order.totalAmount,
        normalizeLocaleConfig({
          currency: settings.currency,
          locale: settings.locale,
          timeZone: settings.timeZone,
          secondaryCurrency: settings.secondaryCurrency,
          exchangeRate: settings.exchangeRate,
          exchangeRateUpdatedAt: settings.exchangeRateUpdatedAt,
        }),
        order.items.length > 1 ? 'Indicative order total' : 'Indicative total'
      )
    : null
  const orderDate = formatDate(order.orderDate, 'medium')
  const deliveryDate = formatDate(order.deliveryDate, 'medium')
  const taxCfg = { mode: settings.taxMode, name: settings.taxName }
  // Title follows what was actually charged on this order, not the current tax mode
  const isTaxInvoice = order.gstAmount > 0

  // Calculate per-item costs using proportional distribution (same as Split Order logic)
  const itemCount = order.items.length

  // Step 1: Calculate total of all items' fabric + accessories costs
  const totalItemPrices = order.items.reduce((sum, item) => sum + item.totalPrice, 0)

  // Step 2: Calculate order-level costs (stitching + premiums + fees + wastage)
  const orderLevelCosts = order.subTotal - totalItemPrices

  // Generate one page per order item with proportional distribution
  const itemPages = order.items.map((item, index) => {
    // Step 3: Calculate this item's proportion (equal split if items carry no price)
    const itemProportion = totalItemPrices > 0 ? item.totalPrice / totalItemPrices : 1 / itemCount

    // Step 4: Distribute order-level costs proportionally
    const perItemOrderCosts = orderLevelCosts * itemProportion

    // Step 5: Calculate item's subtotal (fabric + accessories + proportional order costs)
    const perItemSubtotal = item.totalPrice + perItemOrderCosts

    // Step 6: Tax proportionally, keeping the split (CGST/SGST vs IGST vs single) charged on the order
    const perItemGST = perItemSubtotal * (order.gstRate / 100)
    const share = order.gstAmount > 0 ? perItemGST / order.gstAmount : 0
    const lines = taxLines(
      {
        gstRate: order.gstRate,
        cgst: (order.cgst || 0) * share,
        sgst: (order.sgst || 0) * share,
        igst: (order.igst || 0) * share,
        gstAmount: perItemGST,
      },
      taxCfg
    )

    // Step 7: Calculate total with tax
    const perItemTotal = perItemSubtotal + perItemGST

    // Calculate per-item payments (proportional distribution)
    const perItemDiscount = order.discount * itemProportion
    const perItemAdvance = order.advancePaid * itemProportion
    const perItemBalance = order.balanceAmount * itemProportion

    // Additional Payments = Total - Discount - Advance - Balance
    const perItemAdditionalPayments = perItemTotal - perItemDiscount - perItemAdvance - perItemBalance

    const taxRows = lines
      .map(
        (line) => `
          <div class="totals-row">
            <div class="totals-label">${esc(line.label)}:</div>
            <div class="totals-value">${money(line.amount)}</div>
          </div>`
      )
      .join('')

    return `
    <div class="invoice-page" ${index > 0 ? 'style="page-break-before: always;"' : ''}>
      <div class="invoice">
        <!-- Header -->
        <div class="header">
          ${sellerBlock(settings)}
          <div class="invoice-title">${isTaxInvoice ? 'TAX INVOICE' : 'INVOICE'}</div>
          ${itemCount > 1 ? `<div class="page-indicator">Item ${index + 1} of ${itemCount}</div>` : ''}
        </div>

        <!-- Info Section -->
        <div class="info-section">
          <div class="info-block">
            <h3>Bill To:</h3>
            <p><strong>${esc(order.customer.name)}</strong></p>
            <p>Phone: ${esc(order.customer.phone)}</p>
            ${order.customer.email ? `<p>Email: ${esc(order.customer.email)}</p>` : ''}
            ${order.customer.address ? `<p>Address: ${esc(order.customer.address)}</p>` : ''}
            ${order.customer.city ? `<p>City: ${esc(order.customer.city)}</p>` : ''}
          </div>

          <div class="info-block">
            <h3>Invoice Details:</h3>
            <p><span class="info-label">Invoice No:</span> ${esc(order.orderNumber)}</p>
            <p><span class="info-label">Order Date:</span> ${esc(orderDate)}</p>
            <p><span class="info-label">Delivery Date:</span> ${esc(deliveryDate)}</p>
            <p><span class="info-label">Status:</span> <strong>${esc(order.status)}</strong></p>
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
              <td><strong>${esc(item.garmentPattern.name)}</strong></td>
              <td>${esc(item.clothInventory.type)} - ${esc(item.clothInventory.name)} (${esc(item.clothInventory.color)})</td>
              <td class="text-center">${esc(item.quantityOrdered)}</td>
              <td class="text-right">${esc(item.estimatedMeters.toFixed(2))}</td>
              <td class="text-right">${money(item.pricePerUnit)}</td>
              <td class="text-right"><strong>${money(perItemSubtotal)}</strong></td>
            </tr>
          </tbody>
        </table>

        <!-- Totals Section -->
        <div class="totals-section">
          <div class="totals-row">
            <div class="totals-label">Item Subtotal:</div>
            <div class="totals-value">${money(perItemSubtotal)}</div>
          </div>
          ${taxRows}
          ${lines.length > 1 ? `
          <div class="totals-row">
            <div class="totals-label">Total ${esc(settings.taxName)}:</div>
            <div class="totals-value">${money(perItemGST)}</div>
          </div>` : ''}
          <div class="totals-row bold">
            <div class="totals-label">Item Total:</div>
            <div class="totals-value">${money(perItemTotal)}</div>
          </div>
          ${perItemDiscount > 0 ? `
          <div class="totals-row">
            <div class="totals-label">Less: Discount</div>
            <div class="totals-value">-${money(perItemDiscount)}</div>
          </div>
          ` : ''}
          ${perItemAdvance > 0 ? `
          <div class="totals-row">
            <div class="totals-label">Less: Advance Paid</div>
            <div class="totals-value">-${money(perItemAdvance)}</div>
          </div>
          ` : ''}
          ${perItemAdditionalPayments > 0.005 ? `
          <div class="totals-row">
            <div class="totals-label">Less: Additional Payments</div>
            <div class="totals-value">-${money(perItemAdditionalPayments)}</div>
          </div>
          ` : ''}
          <div class="totals-row bold" style="background-color: ${perItemBalance > 0 ? '#fef3c7' : '#d1fae5'}; border: 2px solid ${perItemBalance > 0 ? '#f59e0b' : '#10b981'};">
            <div class="totals-label" style="color: ${perItemBalance > 0 ? '#92400e' : '#065f46'};">Balance Due:</div>
            <div class="totals-value" style="color: ${perItemBalance > 0 ? '#92400e' : '#065f46'};">${money(perItemBalance)}</div>
          </div>
        </div>

        <div style="clear: both;"></div>
        ${indicativeNote ? `
        <div style="text-align: right; font-size: 9px; font-style: italic; color: #555; margin-top: 4px;">${esc(indicativeNote)}</div>
        ` : ''}

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
                const perItemPayment = inst.paidAmount * itemProportion
                return `
                <tr>
                  <td style="border: 1px solid #ddd; padding: 4px; font-size: 9px;">${esc(inst.installmentNumber)}</td>
                  <td style="border: 1px solid #ddd; padding: 4px; font-size: 9px;">${inst.paidDate ? esc(formatDate(inst.paidDate, 'medium')) : 'N/A'}</td>
                  <td style="border: 1px solid #ddd; padding: 4px; font-size: 9px;">${esc(inst.paymentMode || 'N/A')}</td>
                  <td style="border: 1px solid #ddd; padding: 4px; text-align: right; font-size: 9px;">${money(inst.paidAmount)}</td>
                  <td style="border: 1px solid #ddd; padding: 4px; text-align: right; font-size: 9px; font-weight: bold;">${money(perItemPayment)}</td>
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
          <strong>Note:</strong> This is item ${index + 1} of ${itemCount} in order ${esc(order.orderNumber)}.
          Total order amount: ${money(order.totalAmount)} |
          Total balance due: ${money(order.balanceAmount)}
        </div>
        ` : ''}

        <!-- Notes -->
        ${order.notes ? `
        <div class="notes">
          <strong>Notes:</strong><br>
          ${esc(order.notes).replace(/\n/g, '<br>')}
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
          ${settings.invoiceFooter
            ? `<p>${esc(settings.invoiceFooter).replace(/\n/g, '<br>')}</p>`
            : '<p>This is a computer-generated invoice and does not require a signature.</p>'}
          <p style="margin-top: 10px;">For any queries, please contact us at the above details.</p>
        </div>
      </div>
    </div>
  `
  }).join('')

  return `
<!DOCTYPE html>
<html lang="${esc(settings.locale)}">
<head>
  <meta charset="UTF-8">
  <title>Invoice - ${esc(order.orderNumber)}</title>
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
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .company-tagline {
      font-size: 12px;
      color: #666;
      margin-bottom: 4px;
    }

    .company-details {
      font-size: 10px;
      color: #444;
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
    window.addEventListener('load', function() {
      document.body.setAttribute('data-ready', 'true');
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
