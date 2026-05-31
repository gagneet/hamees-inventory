# Hamees Order Management Workbook — User Guide

## 1. Purpose

This workbook is used to manage a boutique men’s tailoring order workflow:

1. Enter customer details.
2. Add one or more clothing items.
3. Capture measurements using the measurement card layout.
4. Submit the order into the backend sheets.
5. Search customers, orders, and items.
6. Update order and item status.
7. Refresh dropdown lists and dashboard reporting.
8. Keep the dashboard focused on active work by excluding `Delivered` and `Cancelled` items/orders.

The workbook is macro-enabled, so macros must be enabled when opening the file.

---

## 2. Workbook Sheets

| Sheet | Purpose |
|---|---|
| `Entry_Form` | Main order entry screen for customer, order, item, price, and measurement entry. |
| `Customers` | Customer master list. Usually updated automatically when an order is submitted. |
| `Orders` | One row per order. Stores order-level details such as order date, customer, total, balance, and order status. |
| `Order_Items` | One row per garment/item. Stores item type, quantity, delivery date, price, and item status. |
| `Measurements` | Stores detailed measurement values for each order item. |
| `Search` | Search and review customers, orders, and order items. Includes pagination and status update actions. |
| `Dashboard` | Summary of active tailoring work. Delivered and cancelled work should be excluded. |
| `Lists` | Lookup values used by dropdowns, including status values. |

---

## 3. First-Time Setup

After importing or updating the VBA module, run these macros once:

```vb
RefreshLists
SetupStatusDropdowns
RefreshDashboard
```

`RefreshLists` refreshes lookup lists.

`SetupStatusDropdowns` creates or refreshes the order/item status dropdowns.

`RefreshDashboard` rebuilds the dashboard view.

---

## 4. Recommended Buttons and Macros

### Entry_Form

| Button | Macro |
|---|---|
| New / Clear Form | `ClearEntryForm` |
| Submit Order | `SubmitOrderFromEntryForm` |
| Refresh Measurements | `RefreshMeasurementRows` |
| Refresh Lists | `RefreshLists` |

### Search

| Button | Macro |
|---|---|
| Search | `SearchOrders` |
| Next Page | `SearchNextPage` |
| Previous Page | `SearchPreviousPage` |
| Update Selected Item Status | `UpdateSelectedSearchItemStatus` |
| Update Selected Order Status | `UpdateSelectedSearchOrderStatus` |
| Save Search Status Updates | `SaveSearchStatusUpdates` |

### Orders

| Button | Macro |
|---|---|
| Update Selected Order Status | `UpdateSelectedOrderRowStatus` |

### Order_Items

| Button | Macro |
|---|---|
| Update Selected Item Status | `UpdateSelectedOrderItemRowStatus` |

### Dashboard

| Button | Macro |
|---|---|
| Refresh Dashboard | `RefreshDashboard` |

---

## 5. Entering a New Order

### Step 1 — Clear the form

Go to `Entry_Form` and click the button linked to:

```vb
ClearEntryForm
```

This clears old values, resets the measurement card area, prepares the next order number, and reapplies form protection.

### Step 2 — Enter customer details

Enter the customer details in the customer section.

Typical details include:

- Customer name
- Mobile number
- Address
- Email, if available
- Notes or preferences

If the customer already exists, select the existing customer where the workbook supports dropdown/prefill behaviour.

### Step 3 — Review order header fields

The form prepares or calculates fields such as:

- Order ID
- Order date
- Customer ID
- Order total
- Advance/payment
- Balance

Review these before submitting.

### Step 4 — Add order items

In the item section, add one row per garment.

Examples:

- Shirt
- Trouser
- Suit
- Jacket
- Waistcoat
- Kurta

Complete fields such as item type, quantity, fabric, delivery date, price, and notes.

### Step 5 — Enter measurements

Use the newer measurement card layout on `Entry_Form`.

Do not use or type into any old measurement grid area if visible.

If the cards look stale, overlapped, or incorrect, run:

```vb
RefreshMeasurementRows
```

If the issue continues, run:

```vb
ClearEntryForm
```

and re-enter the order.

### Step 6 — Submit the order

Click the button linked to:

```vb
SubmitOrderFromEntryForm
```

This writes data into:

| Data | Destination |
|---|---|
| Customer details | `Customers` |
| Order header | `Orders` |
| Individual garments/items | `Order_Items` |
| Measurements | `Measurements` |

---

## 6. Order Status vs Item Status

The workbook tracks status at two levels.

### Order Status

Stored in `Orders`.

This is the overall order status.

### Item Status

Stored in `Order_Items`.

This is the status of each garment in the order.

Example:

| Item | Status |
|---|---|
| Shirt | Delivered |
| Trouser | Stitching |
| Waistcoat | Trial Pending |

In this example, the full order is still active because not all items are delivered.

---

## 7. Supported Status Values

| Status | Meaning |
|---|---|
| `Booked` | Order/item has been entered. |
| `Cutting` | Fabric cutting is in progress. |
| `Stitching` | Tailoring is in progress. |
| `Trial Pending` | Waiting for customer fitting/trial. |
| `Alteration` | Alteration is in progress. |
| `Ready` | Ready for pickup or delivery. |
| `Delivered` | Completed and delivered. |
| `Cancelled` | Cancelled. |

`Delivered` and `Cancelled` are treated as closed statuses.

---

## 8. Status Synchronisation Rules

### Updating an item can update the parent order

If all items in an order are `Delivered`, the order becomes `Delivered`.

If all items in an order are `Cancelled`, the order becomes `Cancelled`.

If any item is still active, the order remains active.

### Updating an order can update its items

If an order is set to `Delivered`, all related items are also set to `Delivered`.

If an order is set to `Cancelled`, all related items are also set to `Cancelled`.

### Dashboard exclusion rule

The dashboard should exclude:

- Orders with status `Delivered`
- Orders with status `Cancelled`
- Items with status `Delivered`
- Items with status `Cancelled`

---

## 9. Searching Orders and Items

Go to `Search`.

Enter a search term such as:

- Order ID
- Customer ID
- Customer name
- Mobile number
- Item ID
- Garment type

Then run:

```vb
SearchOrders
```

The Search sheet displays matching orders/items with customer and status information.

---

## 10. Search Pagination

Search results are paginated to stop large result sets from spilling into other sections of the sheet.

Use:

```vb
SearchNextPage
```

to go forward.

Use:

```vb
SearchPreviousPage
```

to go back.

This is important when a customer has more than 10 orders or order items.

---

## 11. Updating Status from Search

### Update item status

1. Search for the customer/order/item.
2. Select the relevant item row.
3. Run:

```vb
UpdateSelectedSearchItemStatus
```

4. Choose or enter the new item status.
5. Refresh the dashboard.

### Update order status

1. Search for the order.
2. Select any row for that order.
3. Run:

```vb
UpdateSelectedSearchOrderStatus
```

4. Choose or enter the new order status.
5. If the order is set to `Delivered` or `Cancelled`, related items are also updated.
6. Refresh the dashboard.

### Save manual status edits from Search

If status fields were edited directly in the Search results area, run:

```vb
SaveSearchStatusUpdates
```

Using the dedicated update macros is safer than manual edits.

---

## 12. Updating Status from Orders

Go to `Orders`.

Select the order row or a cell in the row.

Run:

```vb
UpdateSelectedOrderRowStatus
```

Choose the new status.

If the status is `Delivered` or `Cancelled`, related order items are also updated.

---

## 13. Updating Status from Order_Items

Go to `Order_Items`.

Select the item row or a cell in the row.

Run:

```vb
UpdateSelectedOrderItemRowStatus
```

Choose the new status.

The parent order status may be recalculated after the item update.

---

## 14. Refreshing the Dashboard

Go to `Dashboard`.

Run:

```vb
RefreshDashboard
```

Use this after:

- Submitting a new order
- Updating item status
- Updating order status
- Delivering an item/order
- Cancelling an item/order
- Editing backend data manually

The dashboard should show active work only.

---

## 15. Refreshing Lists and Dropdowns

Run:

```vb
RefreshLists
SetupStatusDropdowns
```

Use these when:

- Dropdowns are missing
- Status validation fails
- The `Lists` sheet has been changed
- A new VBA module has been imported
- Status values do not appear correctly

---

## 16. Recommended Daily Workflow

### New order

1. Go to `Entry_Form`.
2. Run `ClearEntryForm`.
3. Enter customer details.
4. Add order items.
5. Enter measurements in the card layout.
6. Run `SubmitOrderFromEntryForm`.
7. Go to `Dashboard`.
8. Run `RefreshDashboard`.

### Update progress

1. Go to `Search`.
2. Search by customer, mobile, order, or item.
3. Select the relevant row.
4. Update item or order status.
5. Run `RefreshDashboard`.

### Deliver an order

1. Search for the order.
2. Mark the item or full order as `Delivered`.
3. Run `RefreshDashboard`.
4. Confirm the delivered work no longer appears as active.

---

## 17. Common Issues and Fixes

### Measurement cards overlap

Run:

```vb
RefreshMeasurementRows
```

If still incorrect, run:

```vb
ClearEntryForm
```

### Status dropdown error

Run:

```vb
SetupStatusDropdowns
```

Check that the `Lists` sheet exists and includes the status list.

### Dashboard still shows delivered work

Check both:

- `Orders` status
- `Order_Items` status

Then run:

```vb
RefreshDashboard
```

### Search results overflow

Use:

```vb
SearchNextPage
SearchPreviousPage
```

Do not manually expand the search output area.

### Search status edit did not save

Run:

```vb
SaveSearchStatusUpdates
```

Then refresh the dashboard.

### Total or balance looks wrong

Check item quantity and price fields in `Entry_Form`.

The order total is based on item row totals.

---

## 18. Safe Usage Rules

1. Use buttons/macros instead of manually editing backend sheets where possible.
2. Do not delete columns from `Customers`, `Orders`, `Order_Items`, or `Measurements`.
3. Do not type into protected or formula cells.
4. Run `RefreshLists` after editing lookup values.
5. Run `RefreshDashboard` after any order or status change.
6. Keep a backup before importing a new VBA module.
7. Use search pagination instead of manually expanding the Search results area.

---

## 19. Suggested Tailoring Lifecycle

Typical item flow:

```text
Booked
→ Cutting
→ Stitching
→ Trial Pending
→ Alteration
→ Ready
→ Delivered
```

Simple items may use a shorter flow:

```text
Booked
→ Stitching
→ Ready
→ Delivered
```

Cancelled work should be marked:

```text
Cancelled
```

---

## 20. Quick Reference

| Action | Sheet | Macro |
|---|---|---|
| Clear form | `Entry_Form` | `ClearEntryForm` |
| Submit order | `Entry_Form` | `SubmitOrderFromEntryForm` |
| Refresh measurement cards | `Entry_Form` | `RefreshMeasurementRows` |
| Search | `Search` | `SearchOrders` |
| Next search page | `Search` | `SearchNextPage` |
| Previous search page | `Search` | `SearchPreviousPage` |
| Update search item status | `Search` | `UpdateSelectedSearchItemStatus` |
| Update search order status | `Search` | `UpdateSelectedSearchOrderStatus` |
| Save search status edits | `Search` | `SaveSearchStatusUpdates` |
| Update selected order | `Orders` | `UpdateSelectedOrderRowStatus` |
| Update selected item | `Order_Items` | `UpdateSelectedOrderItemRowStatus` |
| Refresh dashboard | `Dashboard` | `RefreshDashboard` |
| Refresh lists | Any/admin | `RefreshLists` |
| Setup status dropdowns | Any/admin | `SetupStatusDropdowns` |

---

## 21. Admin Maintenance Checklist

Run periodically:

```vb
RefreshLists
SetupStatusDropdowns
RefreshDashboard
```

Before importing a new VBA module:

1. Save a backup copy of the workbook.
2. Import the updated module.
3. Run `SetupStatusDropdowns`.
4. Test one sample order.
5. Test search and pagination.
6. Test status update from Search.
7. Refresh Dashboard.
8. Confirm delivered/cancelled work is excluded.

---

## 22. Future Enhancements

Possible future improvements:

- Status history/audit log
- User name and timestamp for status updates
- Invoice or receipt generation
- Delivery due alerts
- Overdue order highlighting
- Fabric inventory linkage
- Print-friendly order ticket
- SMS or WhatsApp-ready customer notification text
