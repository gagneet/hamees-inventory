function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Tailor ERP')
    .addItem('Submit Booking', 'submitTailorOrder')
    .addToUi();
}

function submitTailorOrder() {
  const ss = SpreadsheetApp.getActive();
  const entry = ss.getSheetByName('Entry Form');
  const customers = ss.getSheetByName('Customers');
  const orders = ss.getSheetByName('Orders');
  const measurements = ss.getSheetByName('Measurements');

  const customerId = String(entry.getRange('E6').getValue()).trim();
  const customerName = entry.getRange('B7').getValue();
  const mobile = entry.getRange('B8').getValue();
  const orderId = String(entry.getRange('B15').getValue()).trim();

  if (!customerId || !customerName || !mobile) {
    SpreadsheetApp.getUi().alert('Please enter Customer ID, Customer Name and Mobile.');
    return;
  }
  if (!orderId || !entry.getRange('B21').getValue() || !entry.getRange('E17').getValue()) {
    SpreadsheetApp.getUi().alert('Please enter Order ID, Item Type and Amount/Rate.');
    return;
  }

  const cValues = customers.getRange(5,1,Math.max(customers.getLastRow()-4,1),1).getValues().flat();
  let cIndex = cValues.indexOf(customerId);
  let cRow = cIndex >= 0 ? cIndex + 5 : customers.getLastRow() + 1;
  customers.getRange(cRow,1,1,11).setValues([[
    customerId, customerName, mobile, entry.getRange('E8').getValue(), entry.getRange('B9').getValue(),
    entry.getRange('B10').getValue(), entry.getRange('E7').getValue(), entry.getRange('B11').getValue(),
    entry.getRange('E9').getValue(), entry.getRange('E10').getValue(), entry.getRange('E11').getValue()
  ]]);

  const oValues = orders.getRange(5,1,Math.max(orders.getLastRow()-4,1),1).getValues().flat();
  if (oValues.indexOf(orderId) >= 0) {
    SpreadsheetApp.getUi().alert('Order ID already exists. Check generated Order No / Line No.');
    return;
  }

  const oRow = orders.getLastRow() + 1;
  orders.getRange(oRow,1,1,21).setValues([[
    orderId, entry.getRange('B16').getValue(), entry.getRange('B17').getValue(), customerId,
    customerName, mobile, entry.getRange('B18').getValue(), entry.getRange('B19').getValue(),
    entry.getRange('B20').getValue(), '', '', entry.getRange('B21').getValue(), entry.getRange('B22').getValue(),
    entry.getRange('B23').getValue(), entry.getRange('E15').getValue(), entry.getRange('E16').getValue(),
    entry.getRange('E17').getValue(), entry.getRange('E18').getValue(), entry.getRange('E19').getValue(),
    entry.getRange('E20').getValue(), entry.getRange('E21').getValue()
  ]]);
  orders.getRange(oRow,10).setFormula(`=I${oRow}-TODAY()`);
  orders.getRange(oRow,11).setFormula(`=IF(AND(U${oRow}<>"Delivered",I${oRow}<TODAY()),"Yes","No")`);

  const mRow = measurements.getLastRow() + 1;
  const mId = 'M-' + String(mRow - 4).padStart(4,'0');
  const m = entry.getRange('A27:J27').getValues()[0];
  measurements.getRange(mRow,1,1,32).setValues([[
    mId, orderId, customerId, customerName, entry.getRange('B21').getValue(), entry.getRange('B11').getValue(),
    m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], '', m[8], '', '', '', '', '', '', '', '', '', '', '', '', '',
    m[9], '', new Date()
  ]]);

  entry.getRange('H5').setValue('Saved: ' + orderId);
  entry.getRange('H6').setValue(new Date());
  entry.getRangeList(['B19:B20','B22:B23','E16','E18','E21:E23','A27:J27']).clearContent();
  entry.getRange('B17').setValue(Number(entry.getRange('B17').getValue()) + 1);
  SpreadsheetApp.getUi().alert('Saved customer, order and measurements for ' + orderId);
}