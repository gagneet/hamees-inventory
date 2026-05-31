Attribute VB_Name = "HameesAttireOrders"
Option Explicit

' =============================================================
' HAMEES ATTIRE - Excel VBA Automation Module
' Import this .bas file into a macro-enabled copy of the workbook:
' 1. Open Excel workbook and Save As .xlsm
' 2. Press ALT+F11
' 3. File -> Import File -> Hamees_Excel_VBA_Macros.bas
' 4. Add buttons on Entry_Form and assign these macros:
'    - SubmitOrderFromEntryForm
'    - PrefillCustomerByMobile
'    - ClearEntryForm
'    - RefreshDashboard
'    - SearchOrders
' =============================================================

' ===== Card layout constants (Entry_Form) =====
Public Const CARD_FIRST_ROW As Long = 35   ' first row of card area
Public Const CARDS_ACROSS   As Long = 3    ' cards per row
Public Const CARD_COL_PITCH As Long = 8    ' 7 cols wide + 1 gutter
Public Const CARD_FIRST_COL As Long = 1    ' col A
Public Const PAIRS_PER_ROW  As Long = 2    ' label:value pairs per body row
Public Const ITEM_FIRST_ROW As Long = 22
Public Const ITEM_LAST_ROW  As Long = 31
Public Const CARD_LAST_ROW  As Long = 200
Public Const SEARCH_FIRST_RESULT_ROW As Long = 16
Public Const SEARCH_PAGE_SIZE As Long = 10
Public Const SEARCH_LAST_RESULT_ROW As Long = SEARCH_FIRST_RESULT_ROW + SEARCH_PAGE_SIZE - 1
Private Const SEARCH_PAGE_CELL As String = "M2"
Private Const SEARCH_TERM_CELL As String = "M3"
Private Const SEARCH_TOTAL_CELL As String = "M4"

' Per item index (1..10) & field index (1..20) -> value-cell address
Public gMeasMap As Object

Private Const ENTRY_SHEET As String = "Entry_Form"
Private Const CUSTOMERS_SHEET As String = "Customers"
Private Const ORDERS_SHEET As String = "Orders"
Private Const ITEMS_SHEET As String = "Order_Items"
Private Const MEASUREMENTS_SHEET As String = "Measurements"
Private Const CONFIG_SHEET As String = "Item_Measurement_Config"
Private Const DASHBOARD_SHEET As String = "Dashboard"
Private Const SEARCH_SHEET As String = "Search"
Private Const PROTECT_PASSWORD As String = "hamees"


Public Sub SetupEntryFormProtection()
    ApplyEntryFormProtection
    MsgBox "Entry form protection has been applied. Measurement card value cells are unlocked; old row-grid cells are locked.", vbInformation

End Sub

Sub UnlockEntryForm()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("Entry_Form")

    On Error Resume Next
    ws.Unprotect Password:="hamees"
    ws.Unprotect
    On Error GoTo 0

    ws.Cells.Locked = False

    MsgBox "Entry Form has been unlocked. You can now edit all fields.", vbInformation
    
End Sub

Public Sub PrefillCustomerByMobile()
    Dim wsE As Worksheet, wsC As Worksheet
    Dim mobile As String, foundRow As Long
    Set wsE = ThisWorkbook.Worksheets(ENTRY_SHEET)
    Set wsC = ThisWorkbook.Worksheets(CUSTOMERS_SHEET)
    mobile = Trim(CStr(wsE.Range("B9").Value))
    If mobile = "" Then
        MsgBox "Please enter a mobile number first.", vbExclamation
        Exit Sub
    End If
    foundRow = FindRow(wsC, 2, mobile)
    If foundRow > 0 Then
        wsE.Unprotect Password:=PROTECT_PASSWORD
        wsE.Range("B8").Value = wsC.Cells(foundRow, 1).Value
        wsE.Range("B10").Value = wsC.Cells(foundRow, 3).Value
        wsE.Range("B11").Value = wsC.Cells(foundRow, 4).Value
        wsE.Range("B12").Value = wsC.Cells(foundRow, 5).Value
        SetupProtectionSilent
        MsgBox "Existing customer details have been loaded.", vbInformation
    Else
        wsE.Unprotect Password:=PROTECT_PASSWORD
        wsE.Range("B8").Value = NextID("CUST-", ThisWorkbook.Worksheets(CUSTOMERS_SHEET), 1)
        SetupProtectionSilent
        MsgBox "No existing customer found. A new Customer ID has been prepared.", vbInformation
    End If
    
End Sub

Public Sub RefreshMeasurementRows()
    ' Compatibility wrapper for existing buttons.
    ' The workbook now uses the card layout, not the old D36:W45 row grid.
    BuildMeasurementCards True

End Sub

Public Sub SubmitOrderFromEntryForm()
    Dim wsE As Worksheet, wsC As Worksheet, wsO As Worksheet, wsI As Worksheet, wsM As Worksheet
    Dim orderID As String, customerID As String, mobile As String, customerName As String
    Dim customerRow As Long, orderRow As Long, itemDestRow As Long, measDestRow As Long
    Dim itemRow As Long, itemCount As Long, qty As Double, rate As Double, amount As Double, totalAmount As Double
    Dim itemType As String, statusVal As String, fitVal As String, priorityVal As String, itemID As String
    Dim amountPaid As Double, paymentStatus As String, orderStatus As String
    Dim response As VbMsgBoxResult

    Set wsE = ThisWorkbook.Worksheets(ENTRY_SHEET)
    Set wsC = ThisWorkbook.Worksheets(CUSTOMERS_SHEET)
    Set wsO = ThisWorkbook.Worksheets(ORDERS_SHEET)
    Set wsI = ThisWorkbook.Worksheets(ITEMS_SHEET)
    Set wsM = ThisWorkbook.Worksheets(MEASUREMENTS_SHEET)

    mobile = Trim(CStr(wsE.Range("B9").Value))
    customerName = Trim(CStr(wsE.Range("B10").Value))
    If mobile = "" Or customerName = "" Then
        MsgBox "Mobile and Customer Name are required before submitting.", vbExclamation
        Exit Sub
    End If

    For itemRow = 22 To 31
        If Trim(CStr(wsE.Cells(itemRow, 3).Value)) <> "" _
           And IsNumeric(wsE.Cells(itemRow, 4).Value) _
           And IsNumeric(wsE.Cells(itemRow, 10).Value) Then
            itemCount = itemCount + 1
        End If
    Next itemRow
    If itemCount = 0 Then
        MsgBox "Please add at least one complete item (Item Type, Qty and Rate) before submitting.", vbExclamation
        Exit Sub
    End If

    Application.ScreenUpdating = False
    wsE.Unprotect Password:=PROTECT_PASSWORD

    ' Rebuild the in-memory map without clearing visible card values.
    ' This avoids losing measurements after a workbook reopen or VBA reset.
    RebuildMeasurementCardMapOnly

    orderID = NextID("ORD-", wsO, 1)

    customerRow = FindRow(wsC, 2, mobile)
    If customerRow = 0 Then
        customerID = NextID("CUST-", wsC, 1)
        customerRow = NextBlankRow(wsC, 1)
    Else
        customerID = CStr(wsC.Cells(customerRow, 1).Value)
    End If
    wsC.Cells(customerRow, 1).Value = customerID
    wsC.Cells(customerRow, 2).Value = mobile
    wsC.Cells(customerRow, 3).Value = customerName
    wsC.Cells(customerRow, 4).Value = wsE.Range("B11").Value
    wsC.Cells(customerRow, 5).Value = wsE.Range("B12").Value
    wsC.Cells(customerRow, 6).Value = Date
    wsC.Cells(customerRow, 7).Value = wsE.Range("B17").Value

    itemCount = 0
    totalAmount = 0
    For itemRow = 22 To 31
        itemType = Trim(CStr(wsE.Cells(itemRow, 3).Value))
        If itemType <> "" Then
            If Not IsNumeric(wsE.Cells(itemRow, 4).Value) Or Not IsNumeric(wsE.Cells(itemRow, 10).Value) Then
                MsgBox "Qty and Rate are required for every item. Please check row " & itemRow & ".", vbExclamation
                GoTo CleanExit
            End If
            qty = CDbl(wsE.Cells(itemRow, 4).Value)
            rate = CDbl(wsE.Cells(itemRow, 10).Value)
            If qty <= 0 Or rate < 0 Then
                MsgBox "Qty must be greater than zero and Rate must be zero or higher. Please check row " & itemRow & ".", vbExclamation
                GoTo CleanExit
            End If
            itemCount = itemCount + 1
            itemID = orderID & "-" & Format(itemCount, "00")
            amount = qty * rate
            totalAmount = totalAmount + amount
            fitVal = DefaultIfBlank(wsE.Cells(itemRow, 5).Value, "Regular")
            priorityVal = DefaultIfBlank(wsE.Cells(itemRow, 6).Value, "Normal")
            statusVal = DefaultIfBlank(wsE.Cells(itemRow, 7).Value, "Booked")
            itemDestRow = NextBlankRow(wsI, 1)
            wsI.Cells(itemDestRow, 1).Resize(1, 13).Value = Array(orderID, itemID, itemType, qty, fitVal, priorityVal, statusVal, wsE.Cells(itemRow, 8).Value, wsE.Cells(itemRow, 9).Value, rate, amount, wsE.Cells(itemRow, 12).Value, wsE.Cells(itemRow, 13).Value)

            measDestRow = NextBlankRow(wsM, 1)
            WriteCardMeasurements orderID, itemID, itemRow - ITEM_FIRST_ROW + 1, measDestRow
        End If
    Next itemRow

    amountPaid = 0
    If IsNumeric(wsE.Range("B15").Value) Then amountPaid = CDbl(wsE.Range("B15").Value)
    paymentStatus = Trim(CStr(wsE.Range("B13").Value))
    If paymentStatus = "" Then
        If amountPaid <= 0 Then
            paymentStatus = "Unpaid"
        ElseIf amountPaid < totalAmount Then
            paymentStatus = "Part Paid"
        Else
            paymentStatus = "Paid"
        End If
    End If
    orderStatus = "Booked"
    orderRow = NextBlankRow(wsO, 1)
    wsO.Cells(orderRow, 1).Resize(1, 13).Value = Array(orderID, Date, customerID, mobile, customerName, wsE.Range("B6").Value, totalAmount, amountPaid, totalAmount - amountPaid, paymentStatus, orderStatus, wsE.Range("B17").Value, Now)

    wsE.Range("B4").Value = orderID
    wsE.Range("B8").Value = customerID
    wsE.Range("B14").Value = totalAmount
    wsE.Range("B16").Value = totalAmount - amountPaid
    RefreshDashboard
    response = MsgBox("Order " & orderID & " has been saved. Do you want to clear the entry form for the next order?", vbQuestion + vbYesNo)
    If response = vbYes Then ClearEntryForm

CleanExit:
    SetupProtectionSilent
    Application.ScreenUpdating = True
    
End Sub

Public Sub ClearEntryForm()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets(ENTRY_SHEET)
    ws.Unprotect Password:=PROTECT_PASSWORD

    Dim c As Range
    For Each c In ws.Range("B6:E18,C22:O31")
        c.MergeArea.ClearContents
    Next c

    ClearMeasurementCardArea ws

    ws.Range("B4").Formula = "=""ORD-""&TEXT(COUNTIF(Orders!$A:$A,""ORD-*"")+1,""00000"")"
    ws.Range("B5").Formula = "=TODAY()"
    ws.Range("B8").Formula = "=IFERROR(INDEX(Customers!$A:$A,MATCH($B$9,Customers!$B:$B,0)),""CUST-NEW"")"
    ws.Range("B13").Formula = ""
    ws.Range("B14").Formula = "=SUM(K22:K31)"
    ws.Range("B15").Formula = ""
    ws.Range("B16").Formula = "=B14-B15"

    Dim r As Long
    For r = ITEM_FIRST_ROW To ITEM_LAST_ROW
        ws.Cells(r, 1).Formula = "=IF($C" & r & "<>"""",$B$4,"""")"
        ws.Cells(r, 2).Formula = "=IF($C" & r & "<>"""",$B$4&""-""&TEXT(ROWS($C$22:C" & r & "),""00""),"""")"
        ws.Cells(r, 11).Formula = "=IF(OR($D" & r & "="""",$J" & r & "=""""),"""",$D" & r & "*$J" & r & ")"
    Next r

    Set gMeasMap = Nothing
    BuildMeasurementCards False
    ApplyEntryFormProtection
    
End Sub

Public Sub RefreshDashboard()

    Dim wsD As Worksheet, wsI As Worksheet, wsO As Worksheet, wsC As Worksheet
    Dim lastI As Long, outRow As Long, r As Long
    Dim orderID As String, customerID As String
    Dim customerName As String, mobile As String
    Dim statusVal As String, priorityVal As String, orderStatusVal As String
    Dim tryDate As Variant, deliveryDate As Variant
    Dim itemType As String, itemID As String, fitType As String
    Dim staffVal As String, itemNotes As String
    Dim qtyVal As Variant, rateVal As Variant, amountVal As Variant

    Set wsD = ThisWorkbook.Worksheets(DASHBOARD_SHEET)
    Set wsI = ThisWorkbook.Worksheets(ITEMS_SHEET)

    On Error Resume Next
    Set wsO = ThisWorkbook.Worksheets("Orders")
    Set wsC = ThisWorkbook.Worksheets("Customers")
    On Error GoTo 0

    ' IMPORTANT:
    ' Only clear the original visible dashboard list area.
    ' Do NOT clear below row 21, because charts/tables/analytics live there.
    wsD.Range("A11:M21").ClearContents

    ' Header row only, no impact below row 21
    wsD.Range("A10:M10").Value = Array( _
        "Order ID", "Customer Name", "Mobile", "Item ID", "Item Type", _
        "Qty", "Fit Type", "Priority", "Status", "Try Date", "Delivery Date", _
        "Staff", "Item Notes" _
    )

    lastI = lastRow(wsI, 1)
    outRow = 11

    For r = 2 To lastI

        orderID = CStr(GetCellByHeader(wsI, r, "Order ID"))
        itemID = CStr(GetCellByHeader(wsI, r, "Item ID"))
        itemType = CStr(GetCellByHeader(wsI, r, "Item Type"))
        qtyVal = GetCellByHeader(wsI, r, "Qty")
        fitType = CStr(GetCellByHeader(wsI, r, "Fit Type"))
        priorityVal = CStr(GetCellByHeader(wsI, r, "Priority"))
        statusVal = CStr(GetCellByHeader(wsI, r, "Status"))
        orderStatusVal = CStr(LookupValueByKey(wsO, "Order ID", orderID, "Order Status"))
        tryDate = GetCellByHeader(wsI, r, "Try Date")
        deliveryDate = GetCellByHeader(wsI, r, "Delivery Date")
        ' rateVal = GetCellByHeader(wsI, r, "Rate")
        ' amountVal = GetCellByHeader(wsI, r, "Amount")
        staffVal = CStr(GetCellByHeader(wsI, r, "Staff"))
        itemNotes = CStr(GetCellByHeader(wsI, r, "Item Notes"))

        customerID = ""
        customerName = ""
        mobile = ""

        ' Preferred lookup path:
        ' Order_Items -> Orders -> Customers
        If Not wsO Is Nothing Then
            customerID = LookupValueByKey(wsO, "Order ID", orderID, "Customer ID")
            customerName = LookupValueByKey(wsO, "Order ID", orderID, "Customer Name")
            mobile = LookupValueByKey(wsO, "Order ID", orderID, "Mobile")
        End If

        If customerName = "" And Not wsC Is Nothing And customerID <> "" Then
            customerName = LookupValueByKey(wsC, "Customer ID", customerID, "Customer Name")
        End If

        If mobile = "" And Not wsC Is Nothing And customerID <> "" Then
            mobile = LookupValueByKey(wsC, "Customer ID", customerID, "Mobile")
        End If

        ' Show only active production rows. Delivered/Cancelled orders and items are closed work.
        If Not IsClosedStatus(statusVal) And Not IsClosedStatus(orderStatusVal) Then
            If IsToday(tryDate) _
                Or IsToday(deliveryDate) _
                Or StrComp(statusVal, "Ready", vbTextCompare) = 0 _
                Or StrComp(priorityVal, "Urgent", vbTextCompare) = 0 _
                Or StrComp(priorityVal, "Wedding/VIP", vbTextCompare) = 0 Then

            ' Only write up to row 21.
            ' This prevents the dashboard from overwriting lower analytics/charts.
            If outRow <= 21 Then
                wsD.Cells(outRow, 1).Value = orderID
                wsD.Cells(outRow, 2).Value = customerName
                wsD.Cells(outRow, 3).Value = mobile
                wsD.Cells(outRow, 4).Value = itemID
                wsD.Cells(outRow, 5).Value = itemType
                wsD.Cells(outRow, 6).Value = qtyVal
                wsD.Cells(outRow, 7).Value = fitType
                wsD.Cells(outRow, 8).Value = priorityVal
                wsD.Cells(outRow, 9).Value = statusVal
                wsD.Cells(outRow, 10).Value = tryDate
                wsD.Cells(outRow, 11).Value = deliveryDate
                ' wsD.Cells(outRow, 12).Value = rateVal
                ' wsD.Cells(outRow, 13).Value = amountVal
                wsD.Cells(outRow, 12).Value = staffVal
                wsD.Cells(outRow, 13).Value = itemNotes
            End If

            outRow = outRow + 1
            End If
        End If

    Next r

    wsD.Range("A10:M10").Font.Bold = True
    wsD.Range("A10:M10").Interior.Color = RGB(31, 78, 121)
    wsD.Range("A10:M10").Font.Color = RGB(255, 255, 255)

    ' Do not AutoFit the whole dashboard if you want to preserve layout.
    ' Only lightly autofit the top list columns.
    ' wsD.Range("A:O").Columns.AutoFit

    If outRow = 11 Then
        wsD.Range("A11").Value = "No trials, deliveries, ready, urgent or Wedding/VIP items found for today."
    ElseIf outRow > 22 Then
        wsD.Range("A21").Value = "More items exist. Use Search or Orders sheet for full list."
    End If

End Sub

Public Sub SearchOrders()
    SearchOrdersPaged 1, True
End Sub

Public Sub SearchNextPage()
    ChangeSearchPage 1
End Sub

Public Sub SearchPreviousPage()
    ChangeSearchPage -1
End Sub

Private Sub ChangeSearchPage(ByVal delta As Long)
    Dim wsS As Worksheet
    Set wsS = ThisWorkbook.Worksheets(SEARCH_SHEET)

    Dim term As String
    term = LCase$(Trim$(CStr(wsS.Range("B3").Value)))
    If term = "" Then
        MsgBox "Enter a search term first.", vbExclamation
        Exit Sub
    End If

    If term <> LCase$(Trim$(CStr(wsS.Range(SEARCH_TERM_CELL).Value))) Then
        SearchOrdersPaged 1, True
        Exit Sub
    End If

    Dim currentPage As Long, totalMatches As Long, maxPage As Long
    currentPage = CLng(val(wsS.Range(SEARCH_PAGE_CELL).Value))
    totalMatches = CLng(val(wsS.Range(SEARCH_TOTAL_CELL).Value))
    If currentPage < 1 Then currentPage = 1
    maxPage = WorksheetFunction.Max(1, WorksheetFunction.RoundUp(totalMatches / SEARCH_PAGE_SIZE, 0))

    currentPage = currentPage + delta
    If currentPage < 1 Then currentPage = 1
    If currentPage > maxPage Then currentPage = maxPage

    SearchOrdersPaged currentPage, False
End Sub

Private Sub SearchOrdersPaged(ByVal pageNumber As Long, ByVal resetPage As Boolean)

    Dim wsS As Worksheet, wsO As Worksheet, wsI As Worksheet
    Dim term As String
    Dim lastI As Long, r As Long, orderRow As Long
    Dim orderID As String, itemID As String
    Dim customerID As String, mobile As String, customerName As String
    Dim orderDate As Variant
    Dim itemType As String, statusVal As String, orderStatusVal As String
    Dim tryDate As Variant, deliveryDate As Variant
    Dim itemNotes As String
    Dim searchableText As String
    Dim matchCount As Long, firstMatch As Long, lastMatch As Long, outRow As Long
    Dim totalPages As Long

    Set wsS = ThisWorkbook.Worksheets(SEARCH_SHEET)
    Set wsO = ThisWorkbook.Worksheets(ORDERS_SHEET)
    Set wsI = ThisWorkbook.Worksheets(ITEMS_SHEET)

    term = LCase$(Trim$(CStr(wsS.Range("B3").Value)))
    If resetPage Then pageNumber = 1
    If pageNumber < 1 Then pageNumber = 1

    wsS.Range("A" & SEARCH_FIRST_RESULT_ROW & ":L" & SEARCH_LAST_RESULT_ROW).ClearContents
    wsS.Range("A26:L29").ClearContents
    wsS.Range("A32:L200").Clear

    wsS.Range("A15:L15").Value = Array( _
        "Customer ID", _
        "Order ID", _
        "Item ID", _
        "Order Date", _
        "Mobile", _
        "Customer Name", _
        "Item Type", _
        "Order Status", _
        "Item Status", _
        "Try Date", _
        "Delivery Date", _
        "Item Notes" _
    )

    If term = "" Then
        MsgBox "Enter an Order ID, Customer ID, mobile, item ID, customer name, item type, status, try date, delivery date, or notes in B3.", vbExclamation
        Exit Sub
    End If

    firstMatch = ((pageNumber - 1) * SEARCH_PAGE_SIZE) + 1
    lastMatch = pageNumber * SEARCH_PAGE_SIZE
    outRow = SEARCH_FIRST_RESULT_ROW
    lastI = lastRow(wsI, 1)

    For r = 2 To lastI

        orderID = CStr(GetCellByHeader(wsI, r, "Order ID"))
        itemID = CStr(GetCellByHeader(wsI, r, "Item ID"))
        itemType = CStr(GetCellByHeader(wsI, r, "Item Type"))
        statusVal = CStr(GetCellByHeader(wsI, r, "Status"))
        tryDate = GetCellByHeader(wsI, r, "Try Date")
        deliveryDate = GetCellByHeader(wsI, r, "Delivery Date")
        itemNotes = CStr(GetCellByHeader(wsI, r, "Item Notes"))

        orderRow = FindRow(wsO, FindHeaderColumn(wsO, "Order ID"), orderID)

        If orderRow > 0 Then

            customerID = CStr(GetCellByHeader(wsO, orderRow, "Customer ID"))
            orderDate = GetCellByHeader(wsO, orderRow, "Order Date")
            mobile = CStr(GetCellByHeader(wsO, orderRow, "Mobile"))
            customerName = CStr(GetCellByHeader(wsO, orderRow, "Customer Name"))
            orderStatusVal = CStr(GetCellByHeader(wsO, orderRow, "Order Status"))

            searchableText = LCase$( _
                orderID & " " & _
                itemID & " " & _
                customerID & " " & _
                mobile & " " & _
                customerName & " " & _
                itemType & " " & _
                orderStatusVal & " " & _
                statusVal & " " & _
                CStr(tryDate) & " " & _
                CStr(deliveryDate) & " " & _
                itemNotes _
            )

            If InStr(1, searchableText, term) > 0 Then
                matchCount = matchCount + 1

                If matchCount >= firstMatch And matchCount <= lastMatch Then
                    wsS.Cells(outRow, 1).Value = customerID
                    wsS.Cells(outRow, 2).Value = orderID
                    wsS.Cells(outRow, 3).Value = itemID
                    wsS.Cells(outRow, 4).Value = orderDate
                    wsS.Cells(outRow, 5).Value = mobile
                    wsS.Cells(outRow, 6).Value = customerName
                    wsS.Cells(outRow, 7).Value = itemType
                    wsS.Cells(outRow, 8).Value = orderStatusVal
                    wsS.Cells(outRow, 9).Value = statusVal
                    wsS.Cells(outRow, 10).Value = tryDate
                    wsS.Cells(outRow, 11).Value = deliveryDate
                    wsS.Cells(outRow, 12).Value = itemNotes
                    outRow = outRow + 1
                End If
            End If
        End If
    Next r

    If matchCount > 0 Then
        totalPages = WorksheetFunction.RoundUp(matchCount / SEARCH_PAGE_SIZE, 0)
        If pageNumber > totalPages Then
            SearchOrdersPaged totalPages, False
            Exit Sub
        End If
    End If

    If matchCount = 0 Then
        wsS.Range(SEARCH_PAGE_CELL).Value = 1
        wsS.Range(SEARCH_TERM_CELL).Value = term
        wsS.Range(SEARCH_TOTAL_CELL).Value = 0
        MsgBox "No matching orders found.", vbInformation
    Else
        totalPages = WorksheetFunction.RoundUp(matchCount / SEARCH_PAGE_SIZE, 0)
        If pageNumber > totalPages Then pageNumber = totalPages
        wsS.Range(SEARCH_PAGE_CELL).Value = pageNumber
        wsS.Range(SEARCH_TERM_CELL).Value = term
        wsS.Range(SEARCH_TOTAL_CELL).Value = matchCount

        wsS.Range("A27").Value = "Showing " & firstMatch & "-" & WorksheetFunction.Min(lastMatch, matchCount) & _
            " of " & matchCount & " result(s). Page " & pageNumber & " of " & totalPages & _
            ". Use SearchNextPage / SearchPreviousPage buttons for more."
    End If

    wsS.Range("A15:L15").Font.Bold = True
    wsS.Range("A15:L15").Interior.Color = RGB(31, 78, 121)
    wsS.Range("A15:L15").Font.Color = RGB(255, 255, 255)
    wsS.Columns("L").ColumnWidth = 55

    ShowCustomerMeasurements

End Sub

Private Sub RefreshMeasurementRows_NoMessage()
    BuildMeasurementCards False

End Sub

Private Sub SetupProtectionSilent()
    ApplyEntryFormProtection

End Sub

Private Sub ApplyEntryFormProtection()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets(ENTRY_SHEET)

    On Error Resume Next
    ws.Unprotect Password:=PROTECT_PASSWORD
    On Error GoTo 0

    ws.Cells.Locked = True

    ' Static entry fields and item table inputs.
    ws.Range("B5:B6,B9:B13,B15,B17:E18,C22:J31,L22:O31").Locked = False

    ' Rebuild map from the current card geometry if VBA state was reset.
    If gMeasMap Is Nothing Then RebuildMeasurementCardMapOnly

    Dim k As Variant
    If Not gMeasMap Is Nothing Then
        For Each k In gMeasMap.Keys
            ws.Range(gMeasMap(k)).Locked = False
        Next k
    End If

    ws.Protect Password:=PROTECT_PASSWORD, UserInterfaceOnly:=True, AllowFiltering:=True, AllowSorting:=True, AllowFormattingCells:=True

End Sub

Private Sub ClearMeasurementCardArea(ByVal ws As Worksheet)
    With ws.Range(ws.Cells(CARD_FIRST_ROW, 1), ws.Cells(CARD_LAST_ROW, 24))
        On Error Resume Next
        .UnMerge
        On Error GoTo 0
        .Clear
    End With
End Sub

Private Sub RebuildMeasurementCardMapOnly()
    Dim ws As Worksheet, cfg As Worksheet
    Set ws = ThisWorkbook.Worksheets(ENTRY_SHEET)
    Set cfg = ThisWorkbook.Worksheets(CONFIG_SHEET)

    Set gMeasMap = CreateObject("Scripting.Dictionary")

    Dim itemRow As Long, itemIdx As Long, placed As Long
    Dim blockTopRow As Long, maxRowsThisBlock As Long, slot As Long, cardCol As Long
    Dim itType As String, usedRows As Long

    blockTopRow = CARD_FIRST_ROW
    maxRowsThisBlock = 0

    For itemRow = ITEM_FIRST_ROW To ITEM_LAST_ROW
        itemIdx = itemRow - ITEM_FIRST_ROW + 1
        itType = Trim(CStr(ws.Cells(itemRow, 3).Value))
        If Len(itType) > 0 Then
            slot = placed Mod CARDS_ACROSS
            If slot = 0 And placed > 0 Then
                blockTopRow = blockTopRow + maxRowsThisBlock + 1
                maxRowsThisBlock = 0
            End If
            cardCol = CARD_FIRST_COL + slot * CARD_COL_PITCH
            usedRows = MapCardAddressesOnly(ws, cfg, blockTopRow, cardCol, itemIdx, itType)
            If usedRows > maxRowsThisBlock Then maxRowsThisBlock = usedRows
            placed = placed + 1
        End If
    Next itemRow
End Sub

Private Function MapCardAddressesOnly(ws As Worksheet, cfg As Worksheet, ByVal topRow As Long, _
    ByVal leftCol As Long, ByVal itemIdx As Long, ByVal itType As String) As Long

    Dim cfgRow As Long: cfgRow = ConfigRowForType(cfg, itType)
    Dim relCount As Long, f As Long
    If cfgRow > 0 Then
        For f = 1 To 20
            If UCase$(Trim$(CStr(cfg.Cells(cfgRow, f + 1).Value))) = "X" Then relCount = relCount + 1
        Next f
    End If

    Dim rOff As Long, pairInRow As Long, i As Long, r As Long, cValue As Long
    rOff = 0: pairInRow = 0
    If cfgRow > 0 Then
        For f = 1 To 20
            If UCase$(Trim$(CStr(cfg.Cells(cfgRow, f + 1).Value))) = "X" Then
                r = topRow + 1 + rOff
                If pairInRow = 0 Then
                    cValue = leftCol + 1
                Else
                    cValue = leftCol + 4
                End If
                gMeasMap(itemIdx & "|" & f) = ws.Cells(r, cValue).Address
                pairInRow = pairInRow + 1
                If pairInRow = PAIRS_PER_ROW Then pairInRow = 0: rOff = rOff + 1
            End If
        Next f
    End If
    If pairInRow > 0 Then rOff = rOff + 1

    gMeasMap(itemIdx & "|NOTES") = ws.Cells(topRow + 1 + rOff, leftCol + 1).Address
    MapCardAddressesOnly = (topRow + 1 + rOff - topRow) + 1
End Function

' ============================================================
' HAMEES ATTIRE - DELETE / CLEANUP MACROS
' ============================================================
' Macros included:
' 1. DeleteOrderForCustomer
' 2. DeleteItemFromCustomerOrder
' 3. DeleteCompleteCustomer
'
' Recommended:
' - Save a backup before running delete actions.
' - These are HARD DELETE macros: rows are removed from the workbook.
'
' ============================================================
' 1. DELETE COMPLETE ORDER FOR A CUSTOMER
' Deletes:
' - Matching order row from Orders
' - Matching item rows from Order_Items
' - Matching measurement rows from Measurements
' Customer record is NOT deleted.
' ============================================================

Public Sub DeleteOrderForCustomer()

    Dim wsO As Worksheet, wsI As Worksheet, wsM As Worksheet
    Dim orderID As String
    Dim confirmMsg As String
    Dim deletedOrders As Long, deletedItems As Long, deletedMeasurements As Long
    
    Set wsO = ThisWorkbook.Worksheets(ORDERS_SHEET)
    Set wsI = ThisWorkbook.Worksheets(ITEMS_SHEET)
    Set wsM = ThisWorkbook.Worksheets(MEASUREMENTS_SHEET)
    
    orderID = Trim(InputBox("Enter the Order ID to delete:" & vbCrLf & vbCrLf & _
                            "Example: ORD-0001", _
                            "Delete Order"))
    
    If orderID = "" Then Exit Sub
    
    If Not RowExistsByHeaderValue(wsO, "Order ID", orderID) Then
        MsgBox "Order ID '" & orderID & "' was not found in Orders.", vbExclamation
        Exit Sub
    End If
    
    confirmMsg = "This will permanently delete:" & vbCrLf & vbCrLf & _
                 "- Order: " & orderID & vbCrLf & _
                 "- All items linked to this order" & vbCrLf & _
                 "- All measurements linked to this order" & vbCrLf & vbCrLf & _
                 "The Customer record will NOT be deleted." & vbCrLf & vbCrLf & _
                 "Continue?"
    
    If MsgBox(confirmMsg, vbYesNo + vbCritical, "Confirm Delete Order") <> vbYes Then Exit Sub
    
    Application.ScreenUpdating = False
    Application.EnableEvents = False
    
    deletedMeasurements = DeleteRowsByHeaderValue(wsM, "Order ID", orderID)
    deletedItems = DeleteRowsByHeaderValue(wsI, "Order ID", orderID)
    deletedOrders = DeleteRowsByHeaderValue(wsO, "Order ID", orderID)
    
    Application.EnableEvents = True
    Application.ScreenUpdating = True
    
    MsgBox "Order delete complete." & vbCrLf & vbCrLf & _
           "Orders deleted: " & deletedOrders & vbCrLf & _
           "Items deleted: " & deletedItems & vbCrLf & _
           "Measurements deleted: " & deletedMeasurements, _
           vbInformation

End Sub


' ============================================================
' 2. DELETE ONLY ONE ITEM FROM A CUSTOMER ORDER
' Deletes:
' - One item row from Order_Items
' - Matching measurement row(s) for that Item ID from Measurements
' Order and Customer are kept.
' ============================================================
Public Sub DeleteItemFromCustomerOrder()

    Dim wsI As Worksheet, wsM As Worksheet
    Dim orderID As String, itemID As String
    Dim confirmMsg As String
    Dim deletedItems As Long, deletedMeasurements As Long
    
    Set wsI = ThisWorkbook.Worksheets(ITEMS_SHEET)
    Set wsM = ThisWorkbook.Worksheets(MEASUREMENTS_SHEET)
    
    orderID = Trim(InputBox("Enter the Order ID:", _
                            "Delete Item From Order"))
    
    If orderID = "" Then Exit Sub
    
    itemID = Trim(InputBox("Enter the Item ID to delete from Order '" & orderID & "':" & vbCrLf & vbCrLf & _
                           "Example: ITM-0001", _
                           "Delete Item From Order"))
    
    If itemID = "" Then Exit Sub
    
    If Not ItemExistsForOrder(wsI, orderID, itemID) Then
        MsgBox "Item ID '" & itemID & "' was not found for Order ID '" & orderID & "'.", vbExclamation
        Exit Sub
    End If
    
    confirmMsg = "This will permanently delete:" & vbCrLf & vbCrLf & _
                 "- Item: " & itemID & vbCrLf & _
                 "- From Order: " & orderID & vbCrLf & _
                 "- All measurements linked to this item" & vbCrLf & vbCrLf & _
                 "The order and customer will remain." & vbCrLf & vbCrLf & _
                 "Continue?"
    
    If MsgBox(confirmMsg, vbYesNo + vbCritical, "Confirm Delete Item") <> vbYes Then Exit Sub
    
    Application.ScreenUpdating = False
    Application.EnableEvents = False
    
    deletedMeasurements = DeleteRowsByTwoHeaderValues(wsM, "Order ID", orderID, "Item ID", itemID)
    deletedItems = DeleteRowsByTwoHeaderValues(wsI, "Order ID", orderID, "Item ID", itemID)
    
    Application.EnableEvents = True
    Application.ScreenUpdating = True
    
    MsgBox "Item delete complete." & vbCrLf & vbCrLf & _
           "Items deleted: " & deletedItems & vbCrLf & _
           "Measurements deleted: " & deletedMeasurements, _
           vbInformation

End Sub


' ============================================================
' 3. DELETE COMPLETE CUSTOMER
' Deletes:
' - Customer row from Customers
' - All Orders for Customer ID
' - All Order_Items for those orders
' - All Measurements for those orders/items
' ============================================================
Public Sub DeleteCompleteCustomer()

    Dim wsC As Worksheet, wsO As Worksheet, wsI As Worksheet, wsM As Worksheet
    Dim customerSearch As String, customerID As String
    Dim customerName As String, mobile As String
    Dim orderIDs As Collection
    Dim i As Long
    Dim orderID As String
    Dim confirmMsg As String
    Dim deletedCustomers As Long, deletedOrders As Long
    Dim deletedItems As Long, deletedMeasurements As Long
    
    Set wsC = ThisWorkbook.Worksheets(CUSTOMERS_SHEET)
    Set wsO = ThisWorkbook.Worksheets(ORDERS_SHEET)
    Set wsI = ThisWorkbook.Worksheets(ITEMS_SHEET)
    Set wsM = ThisWorkbook.Worksheets(MEASUREMENTS_SHEET)
    
    customerSearch = Trim(InputBox("Enter Customer ID or Mobile to delete customer:" & vbCrLf & vbCrLf & _
                                   "Recommended: use Customer ID or Mobile for accuracy.", _
                                   "Delete Complete Customer"))
    
    If customerSearch = "" Then Exit Sub
    
    customerID = ResolveCustomerID(wsC, customerSearch)
    
    If customerID = "" Then
        MsgBox "No customer found for: " & customerSearch, vbExclamation
        Exit Sub
    End If
    
    customerName = LookupValueByKeyDel(wsC, "Customer ID", customerID, "Customer Name")
    mobile = LookupValueByKeyDel(wsC, "Customer ID", customerID, "Mobile")
    
    Set orderIDs = GetOrderIDsForCustomer(wsO, customerID)
    
    confirmMsg = "This will permanently delete the COMPLETE customer record:" & vbCrLf & vbCrLf & _
                 "Customer ID: " & customerID & vbCrLf & _
                 "Customer Name: " & customerName & vbCrLf & _
                 "Mobile: " & mobile & vbCrLf & vbCrLf & _
                 "Linked orders found: " & orderIDs.Count & vbCrLf & vbCrLf & _
                 "This will also delete:" & vbCrLf & _
                 "- All orders for this customer" & vbCrLf & _
                 "- All order items for those orders" & vbCrLf & _
                 "- All measurements for those orders/items" & vbCrLf & vbCrLf & _
                 "Continue?"
    
    If MsgBox(confirmMsg, vbYesNo + vbCritical, "Confirm Delete Complete Customer") <> vbYes Then Exit Sub
    
    Application.ScreenUpdating = False
    Application.EnableEvents = False
    
    For i = 1 To orderIDs.Count
        orderID = CStr(orderIDs(i))
        deletedMeasurements = deletedMeasurements + DeleteRowsByHeaderValue(wsM, "Order ID", orderID)
        deletedItems = deletedItems + DeleteRowsByHeaderValue(wsI, "Order ID", orderID)
        deletedOrders = deletedOrders + DeleteRowsByHeaderValue(wsO, "Order ID", orderID)
    Next i
    
    deletedCustomers = DeleteRowsByHeaderValue(wsC, "Customer ID", customerID)
    
    Application.EnableEvents = True
    Application.ScreenUpdating = True
    
    MsgBox "Customer delete complete." & vbCrLf & vbCrLf & _
           "Customers deleted: " & deletedCustomers & vbCrLf & _
           "Orders deleted: " & deletedOrders & vbCrLf & _
           "Items deleted: " & deletedItems & vbCrLf & _
           "Measurements deleted: " & deletedMeasurements, _
           vbInformation

End Sub


' Show the Measurements alos, when searching for a Customer or Order ID record.
' This macro appends to your existing SearchOrders (or run as a second step).
' It builds a vertical card per matched item below the results Ã¯Â¿Â½ Item ID + Type + Date as a heading,
' then measurements as label: value pairs. No wide horizontal scrolling.
Public Sub ShowCustomerMeasurements()
    Dim wsS As Worksheet, wsM As Worksheet
    Dim r As Long, lastM As Long
    Dim cardRow As Long, c As Long
    Set wsS = ThisWorkbook.Worksheets(SEARCH_SHEET)
    Set wsM = ThisWorkbook.Worksheets(MEASUREMENTS_SHEET)

    wsS.Range("A32:L200").Clear
    cardRow = 32

    Dim measLabels As Variant
    measLabels = MeasFields()

    Dim resRow As Long
    For resRow = SEARCH_FIRST_RESULT_ROW To SEARCH_LAST_RESULT_ROW
        Dim oID As String, iID As String
        oID = CStr(wsS.Cells(resRow, 2).Value)
        iID = CStr(wsS.Cells(resRow, 3).Value)
        If oID = "" Then GoTo NextRes

        lastM = lastRow(wsM, 1)
        Dim mFound As Long: mFound = 0
        For r = 2 To lastM
            If CStr(wsM.Cells(r, 1).Value) = oID And CStr(wsM.Cells(r, 2).Value) = iID Then
                mFound = r: Exit For
            End If
        Next r
        If mFound = 0 Then GoTo NextRes

        With wsS.Range(wsS.Cells(cardRow, 1), wsS.Cells(cardRow, 4))
            .Merge
            .Value = iID & "  |  " & wsS.Cells(resRow, 7).Value & "  |  " & _
                     Format(wsM.Cells(mFound, 3).Value, "dd-mmm-yyyy")
            .Font.Bold = True
            .Font.Color = RGB(255, 255, 255)
            .Interior.Color = RGB(31, 78, 121)
        End With
        cardRow = cardRow + 1

        Dim pairCol As Long
        pairCol = 1
        For c = 0 To 19
            Dim val As Variant: val = wsM.Cells(mFound, 4 + c).Value
            If val <> "" And IsNumeric(val) Then
                wsS.Cells(cardRow, pairCol).Value = measLabels(c) & ":"
                wsS.Cells(cardRow, pairCol).Font.Bold = True
                wsS.Cells(cardRow, pairCol + 1).Value = val
                pairCol = pairCol + 2
                If pairCol > 8 Then pairCol = 1: cardRow = cardRow + 1
            End If
        Next c
        If pairCol > 1 Then cardRow = cardRow + 1
        cardRow = cardRow + 1
NextRes:
    Next resRow

    If cardRow = 32 Then
        wsS.Range("A32").Value = "No measurements found for the matched items on this page."
    End If

End Sub

Public Function MeasFields() As Variant
    MeasFields = Array("Length", "Chest", "Shoulder", "Sleeve", "Bicep", _
        "Elbow", "Collar", "Waist", "Hips", "Inseam", "Outseam", "Thigh", _
        "Knee", "Bottom", "Back", "Back Round", "Back Down", "RSD", "LSD", "SD")

End Function

Sub RefreshMeasurementRows_MeasurementCards()
    BuildMeasurementCards True

End Sub

Sub RefreshMeasurementRows_NoMessageMC()
    BuildMeasurementCards False

End Sub

Private Sub BuildMeasurementCards(ByVal showMsg As Boolean)
    Dim ws As Worksheet, cfg As Worksheet
    Set ws = ThisWorkbook.Worksheets("Entry_Form")
    Set cfg = ThisWorkbook.Worksheets("Item_Measurement_Config")

    On Error Resume Next
    ws.Unprotect PROTECT_PASSWORD
    On Error GoTo 0

    Application.ScreenUpdating = False
    Application.EnableEvents = False

    ' clear old card area, including stale merges from prior cards or the old grid
    ClearMeasurementCardArea ws

    Set gMeasMap = CreateObject("Scripting.Dictionary")
    Dim fields As Variant: fields = MeasFields()

    Dim itemRow As Long, itemIdx As Long, placed As Long
    Dim blockTopRow As Long, maxRowsThisBlock As Long, slot As Long, cardCol As Long
    itemIdx = 0: placed = 0
    blockTopRow = CARD_FIRST_ROW: maxRowsThisBlock = 0

    For itemRow = ITEM_FIRST_ROW To ITEM_LAST_ROW
        Dim itType As String
        itType = Trim(CStr(ws.Cells(itemRow, 3).Value))   ' col C = item type
        itemIdx = itemIdx + 1
        If Len(itType) > 0 Then
            slot = placed Mod CARDS_ACROSS
            If slot = 0 And placed > 0 Then
                blockTopRow = blockTopRow + maxRowsThisBlock + 1
                maxRowsThisBlock = 0
            End If
            cardCol = CARD_FIRST_COL + slot * CARD_COL_PITCH
            Dim usedRows As Long
            usedRows = DrawCard(ws, cfg, blockTopRow, cardCol, itemRow, itemIdx, itType, fields)
            If usedRows > maxRowsThisBlock Then maxRowsThisBlock = usedRows
            placed = placed + 1
        End If
    Next itemRow

    ApplyEntryFormProtection

    Application.EnableEvents = True
    Application.ScreenUpdating = True
    If showMsg Then MsgBox "Measurement cards refreshed.", vbInformation

End Sub



' Writes one item's card measurements into the Measurements sheet.
Sub WriteCardMeasurements(ByVal orderID As String, ByVal itemID As String, _
    ByVal itemIdx As Long, ByVal destRow As Long)
    Dim wsM As Worksheet, ws As Worksheet
    Set wsM = ThisWorkbook.Worksheets("Measurements")
    Set ws = ThisWorkbook.Worksheets("Entry_Form")
    wsM.Cells(destRow, 1).Value = orderID
    wsM.Cells(destRow, 2).Value = itemID
    wsM.Cells(destRow, 3).Value = Date
    Dim f As Long, key As String
    For f = 1 To 20
        key = itemIdx & "|" & f
        If Not gMeasMap Is Nothing Then
            If gMeasMap.Exists(key) Then wsM.Cells(destRow, 3 + f).Value = ws.Range(gMeasMap(key)).Value
        End If
    Next f
    key = itemIdx & "|NOTES"
    If Not gMeasMap Is Nothing Then
        If gMeasMap.Exists(key) Then wsM.Cells(destRow, 24).Value = ws.Range(gMeasMap(key)).Value
    End If

End Sub


' Copies a customer's previous measurements into the cards (call AFTER cards are built).
Sub PrefillCardMeasurements(ByVal itemIdx As Long, ByVal srcRow As Long)
    Dim wsM As Worksheet, ws As Worksheet
    Set wsM = ThisWorkbook.Worksheets("Measurements")
    Set ws = ThisWorkbook.Worksheets("Entry_Form")
    If gMeasMap Is Nothing Then Exit Sub
    Dim f As Long, key As String
    For f = 1 To 20
        key = itemIdx & "|" & f
        If gMeasMap.Exists(key) Then ws.Range(gMeasMap(key)).Value = wsM.Cells(srcRow, 3 + f).Value
    Next f

End Sub


' Adds a Config row for any item type in Lists that doesn't have one yet.
Sub SyncListsToConfig()
    Dim wsL As Worksheet, cfg As Worksheet
    Set wsL = ThisWorkbook.Worksheets("Lists")
    Set cfg = ThisWorkbook.Worksheets("Item_Measurement_Config")
    Dim lastL As Long, r As Long, cr As Long, added As Long
    lastL = wsL.Cells(wsL.Rows.Count, 1).End(xlUp).Row
    added = 0
    For r = 2 To lastL
        Dim t As String: t = Trim(CStr(wsL.Cells(r, 1).Value))
        If Len(t) > 0 Then
            If ConfigRowForType(cfg, t) = 0 Then
                cr = cfg.Cells(cfg.Rows.Count, 1).End(xlUp).Row + 1
                cfg.Cells(cr, 1).Value = t
                cfg.Cells(cr, 1).Font.Bold = True
                cfg.Cells(cr, 1).Interior.Color = RGB(217, 234, 247)
                cfg.Range(cfg.Cells(cr, 1), cfg.Cells(cr, 22)).Borders.LineStyle = xlContinuous
                cfg.Range(cfg.Cells(cr, 1), cfg.Cells(cr, 22)).Borders.Color = RGB(217, 217, 217)
                added = added + 1
            End If
        End If
    Next r
    MsgBox added & " new item type(s) added to Item_Measurement_Config." & vbCrLf & _
           "Tick 'X' for the fields each new type needs.", vbInformation

End Sub



' ============================================================
' ENHANCEMENTS (v5)
' ============================================================

' Quickly advance/set a garment's production status by Item ID,
' without scrolling the wide Order_Items sheet. Payment is untouched.

' Open the status update prompt for an item. Kept with the old name so existing buttons still work.
Public Sub QuickUpdateStatus()
    QuickUpdateItemStatus
End Sub

Public Sub QuickUpdateItemStatus()
    Dim itemID As String, newStatus As String
    itemID = Trim(InputBox("Enter the Item ID to update:" & vbCrLf & vbCrLf & _
                           "Example: ORD-00001-01", "Quick Item Status Update"))
    If itemID = "" Then Exit Sub

    newStatus = PromptForStatus("Enter the new ITEM status for " & itemID & ":")
    If newStatus = "" Then Exit Sub

    If SetItemStatusByItemID(itemID, newStatus, True) Then
        RefreshAfterStatusUpdate
        MsgBox "Item " & itemID & " has been set to '" & newStatus & "'.", vbInformation
    Else
        MsgBox "Item ID '" & itemID & "' was not found.", vbExclamation
    End If
End Sub

Public Sub QuickUpdateOrderStatus()
    Dim orderID As String, newStatus As String
    orderID = Trim(InputBox("Enter the Order ID to update:" & vbCrLf & vbCrLf & _
                            "Example: ORD-00001", "Quick Order Status Update"))
    If orderID = "" Then Exit Sub

    newStatus = PromptForStatus("Enter the new ORDER status for " & orderID & ":")
    If newStatus = "" Then Exit Sub

    If SetOrderStatusByOrderID(orderID, newStatus, True) Then
        RefreshAfterStatusUpdate
        MsgBox "Order " & orderID & " has been set to '" & newStatus & "'.", vbInformation
    Else
        MsgBox "Order ID '" & orderID & "' was not found.", vbExclamation
    End If
End Sub

Public Sub UpdateSelectedSearchItemStatus()
    Dim wsS As Worksheet, rowNum As Long, itemID As String, newStatus As String
    Set wsS = ThisWorkbook.Worksheets(SEARCH_SHEET)
    rowNum = ActiveCell.Row
    If ActiveSheet.Name <> SEARCH_SHEET Or rowNum < SEARCH_FIRST_RESULT_ROW Or rowNum > SEARCH_LAST_RESULT_ROW Then
        MsgBox "Select a result row on the Search sheet first.", vbExclamation
        Exit Sub
    End If

    itemID = Trim(CStr(wsS.Cells(rowNum, 3).Value))
    If itemID = "" Then
        MsgBox "The selected Search row does not contain an Item ID.", vbExclamation
        Exit Sub
    End If

    newStatus = PromptForStatus("Enter the new ITEM status for " & itemID & ":")
    If newStatus = "" Then Exit Sub

    If SetItemStatusByItemID(itemID, newStatus, True) Then
        RefreshAfterStatusUpdate
        MsgBox "Item " & itemID & " has been set to '" & newStatus & "'.", vbInformation
    End If
End Sub

Public Sub UpdateSelectedSearchOrderStatus()
    Dim wsS As Worksheet, rowNum As Long, orderID As String, newStatus As String
    Set wsS = ThisWorkbook.Worksheets(SEARCH_SHEET)
    rowNum = ActiveCell.Row
    If ActiveSheet.Name <> SEARCH_SHEET Or rowNum < SEARCH_FIRST_RESULT_ROW Or rowNum > SEARCH_LAST_RESULT_ROW Then
        MsgBox "Select a result row on the Search sheet first.", vbExclamation
        Exit Sub
    End If

    orderID = Trim(CStr(wsS.Cells(rowNum, 2).Value))
    If orderID = "" Then
        MsgBox "The selected Search row does not contain an Order ID.", vbExclamation
        Exit Sub
    End If

    newStatus = PromptForStatus("Enter the new ORDER status for " & orderID & ":")
    If newStatus = "" Then Exit Sub

    If SetOrderStatusByOrderID(orderID, newStatus, True) Then
        RefreshAfterStatusUpdate
        MsgBox "Order " & orderID & " has been set to '" & newStatus & "'.", vbInformation
    End If
End Sub

Public Sub UpdateSelectedOrderRowStatus()
    Dim wsO As Worksheet, rowNum As Long, orderID As String, newStatus As String
    Set wsO = ThisWorkbook.Worksheets(ORDERS_SHEET)
    rowNum = ActiveCell.Row
    If ActiveSheet.Name <> ORDERS_SHEET Or rowNum < 2 Then
        MsgBox "Select an order row on the Orders sheet first.", vbExclamation
        Exit Sub
    End If

    orderID = Trim(CStr(wsO.Cells(rowNum, FindHeaderColumn(wsO, "Order ID")).Value))
    If orderID = "" Then
        MsgBox "The selected Orders row does not contain an Order ID.", vbExclamation
        Exit Sub
    End If

    newStatus = PromptForStatus("Enter the new ORDER status for " & orderID & ":")
    If newStatus = "" Then Exit Sub

    If SetOrderStatusByOrderID(orderID, newStatus, True) Then
        RefreshAfterStatusUpdate
        MsgBox "Order " & orderID & " has been set to '" & newStatus & "'.", vbInformation
    End If
End Sub

Public Sub UpdateSelectedOrderItemRowStatus()
    Dim wsI As Worksheet, rowNum As Long, itemID As String, newStatus As String
    Set wsI = ThisWorkbook.Worksheets(ITEMS_SHEET)
    rowNum = ActiveCell.Row
    If ActiveSheet.Name <> ITEMS_SHEET Or rowNum < 2 Then
        MsgBox "Select an item row on the Order_Items sheet first.", vbExclamation
        Exit Sub
    End If

    itemID = Trim(CStr(wsI.Cells(rowNum, FindHeaderColumn(wsI, "Item ID")).Value))
    If itemID = "" Then
        MsgBox "The selected Order_Items row does not contain an Item ID.", vbExclamation
        Exit Sub
    End If

    newStatus = PromptForStatus("Enter the new ITEM status for " & itemID & ":")
    If newStatus = "" Then Exit Sub

    If SetItemStatusByItemID(itemID, newStatus, True) Then
        RefreshAfterStatusUpdate
        MsgBox "Item " & itemID & " has been set to '" & newStatus & "'.", vbInformation
    End If
End Sub

' Allows the Search sheet Status columns to be edited in place, then saved back.
' Search columns in this version: B=Order ID, C=Item ID, H=Order Status, I=Item Status.
Public Sub SaveSearchStatusUpdates()
    Dim wsS As Worksheet, r As Long, updates As Long
    Dim orderID As String, itemID As String, orderStatus As String, itemStatus As String
    Set wsS = ThisWorkbook.Worksheets(SEARCH_SHEET)

    For r = SEARCH_FIRST_RESULT_ROW To SEARCH_LAST_RESULT_ROW
        orderID = Trim(CStr(wsS.Cells(r, 2).Value))
        itemID = Trim(CStr(wsS.Cells(r, 3).Value))
        orderStatus = Trim(CStr(wsS.Cells(r, 8).Value))
        itemStatus = Trim(CStr(wsS.Cells(r, 9).Value))

        If orderID <> "" And orderStatus <> "" Then
            If IsValidStatus(orderStatus) Then
                If SetOrderStatusByOrderID(orderID, orderStatus, False) Then updates = updates + 1
            Else
                MsgBox "Invalid order status '" & orderStatus & "' on Search row " & r & ".", vbExclamation
                Exit Sub
            End If
        End If

        If itemID <> "" And itemStatus <> "" Then
            If IsValidStatus(itemStatus) Then
                If SetItemStatusByItemID(itemID, itemStatus, True) Then updates = updates + 1
            Else
                MsgBox "Invalid item status '" & itemStatus & "' on Search row " & r & ".", vbExclamation
                Exit Sub
            End If
        End If
    Next r

    RefreshAfterStatusUpdate
    MsgBox updates & " status update(s) saved from the Search sheet.", vbInformation
End Sub

Public Sub SetupStatusDropdowns()
    Dim wsO As Worksheet, wsI As Worksheet, wsE As Worksheet, wsS As Worksheet
    Set wsO = ThisWorkbook.Worksheets(ORDERS_SHEET)
    Set wsI = ThisWorkbook.Worksheets(ITEMS_SHEET)
    Set wsE = ThisWorkbook.Worksheets(ENTRY_SHEET)
    Set wsS = ThisWorkbook.Worksheets(SEARCH_SHEET)

    EnsureStatusList

    'Validation fails on protected sheets, so temporarily unprotect the UI/data sheets.
    On Error Resume Next
    wsO.Unprotect Password:=PROTECT_PASSWORD
    wsI.Unprotect Password:=PROTECT_PASSWORD
    wsE.Unprotect Password:=PROTECT_PASSWORD
    wsS.Unprotect Password:=PROTECT_PASSWORD
    On Error GoTo 0

    ApplyStatusValidation wsO.Range("K2:K5000")
    ApplyStatusValidation wsI.Range("G2:G5000")
    ApplyStatusValidation wsE.Range("G22:G31")
    ApplyStatusValidation wsS.Range("H" & SEARCH_FIRST_RESULT_ROW & ":I" & SEARCH_LAST_RESULT_ROW)

    ApplyEntryFormProtection
    On Error Resume Next
    wsS.Protect Password:=PROTECT_PASSWORD, DrawingObjects:=False, Contents:=True, Scenarios:=False, UserInterfaceOnly:=True
    On Error GoTo 0

    MsgBox "Status dropdowns have been applied to Orders, Order_Items, Entry_Form and the visible Search result rows.", vbInformation
End Sub

Private Sub EnsureStatusList()
    Dim wsL As Worksheet

    On Error Resume Next
    Set wsL = ThisWorkbook.Worksheets("Lists")
    On Error GoTo 0

    If wsL Is Nothing Then
        Set wsL = ThisWorkbook.Worksheets.Add(After:=ThisWorkbook.Worksheets(ThisWorkbook.Worksheets.Count))
        wsL.Name = "Lists"
    End If

    wsL.Range("B1").Value = "Order / Item Status"
    wsL.Range("B2").Value = "Booked"
    wsL.Range("B3").Value = "Cutting"
    wsL.Range("B4").Value = "Stitching"
    wsL.Range("B5").Value = "Trial Pending"
    wsL.Range("B6").Value = "Alteration"
    wsL.Range("B7").Value = "Ready"
    wsL.Range("B8").Value = "Delivered"
    wsL.Range("B9").Value = "Cancelled"

    'Excel data validation cannot reliably point to another worksheet directly.
    'Use a workbook-level named range instead: =HameesStatusList
    On Error Resume Next
    ThisWorkbook.Names("HameesStatusList").Delete
    On Error GoTo 0
    ThisWorkbook.Names.Add Name:="HameesStatusList", RefersTo:="='Lists'!$B$2:$B$9"
End Sub

Private Sub ApplyStatusValidation(ByVal targetRange As Range)
    If targetRange Is Nothing Then Exit Sub

    On Error Resume Next
    targetRange.Validation.Delete
    On Error GoTo 0

    On Error GoTo ValidationError
    With targetRange.Validation
        .Add Type:=xlValidateList, AlertStyle:=xlValidAlertStop, Operator:=xlBetween, Formula1:="=HameesStatusList"
        .IgnoreBlank = True
        .InCellDropdown = True
        .InputTitle = "Status"
        .InputMessage = "Choose the current status. Delivered and Cancelled are treated as closed."
        .ErrorTitle = "Invalid status"
        .ErrorMessage = "Use one of: Booked, Cutting, Stitching, Trial Pending, Alteration, Ready, Delivered, Cancelled."
        .ShowInput = True
        .ShowError = True
    End With
    Exit Sub

ValidationError:
    MsgBox "Could not apply the status dropdown to " & targetRange.Worksheet.Name & "!" & targetRange.Address(False, False) & "." & vbCrLf & vbCrLf & _
           "Please check that the sheet/range is not protected, merged, or inside a locked table area." & vbCrLf & _
           "Excel error: " & Err.Description, vbExclamation
End Sub

Private Function PromptForStatus(ByVal promptText As String) As String
    Dim statusText As String
    statusText = Trim(InputBox(promptText & vbCrLf & vbCrLf & _
        "Valid statuses:" & vbCrLf & _
        "Booked, Cutting, Stitching, Trial Pending, Alteration, Ready, Delivered, Cancelled", _
        "Update Status"))

    If statusText = "" Then Exit Function
    statusText = CanonicalStatus(statusText)
    If Not IsValidStatus(statusText) Then
        MsgBox "Invalid status. Use: Booked, Cutting, Stitching, Trial Pending, Alteration, Ready, Delivered, Cancelled.", vbExclamation
        PromptForStatus = ""
    Else
        PromptForStatus = statusText
    End If
End Function

Private Function CanonicalStatus(ByVal statusText As String) As String
    Select Case LCase$(Trim$(statusText))
        Case "booked": CanonicalStatus = "Booked"
        Case "cutting": CanonicalStatus = "Cutting"
        Case "stitching": CanonicalStatus = "Stitching"
        Case "trial", "trial pending": CanonicalStatus = "Trial Pending"
        Case "alteration", "alterations": CanonicalStatus = "Alteration"
        Case "ready": CanonicalStatus = "Ready"
        Case "delivered", "delivery done": CanonicalStatus = "Delivered"
        Case "cancelled", "canceled", "cancel": CanonicalStatus = "Cancelled"
        Case Else: CanonicalStatus = Trim$(statusText)
    End Select
End Function

Private Function IsValidStatus(ByVal statusText As String) As Boolean
    Select Case CanonicalStatus(statusText)
        Case "Booked", "Cutting", "Stitching", "Trial Pending", "Alteration", "Ready", "Delivered", "Cancelled"
            IsValidStatus = True
    End Select
End Function

Private Function IsClosedStatus(ByVal statusText As String) As Boolean
    Select Case CanonicalStatus(statusText)
        Case "Delivered", "Cancelled"
            IsClosedStatus = True
    End Select
End Function

Private Function SetItemStatusByItemID(ByVal itemID As String, ByVal newStatus As String, ByVal recalcParentOrder As Boolean) As Boolean
    Dim wsI As Worksheet, r As Long, lastR As Long, idCol As Long, stCol As Long, orderCol As Long
    Dim orderID As String
    Set wsI = ThisWorkbook.Worksheets(ITEMS_SHEET)

    newStatus = CanonicalStatus(newStatus)
    If Not IsValidStatus(newStatus) Then Exit Function

    idCol = FindHeaderColumn(wsI, "Item ID")
    stCol = FindHeaderColumn(wsI, "Status")
    orderCol = FindHeaderColumn(wsI, "Order ID")
    If idCol = 0 Or stCol = 0 Or orderCol = 0 Then Exit Function

    lastR = lastRow(wsI, idCol)
    For r = 2 To lastR
        If StrComp(Trim(CStr(wsI.Cells(r, idCol).Value)), itemID, vbTextCompare) = 0 Then
            wsI.Cells(r, stCol).Value = newStatus
            orderID = Trim(CStr(wsI.Cells(r, orderCol).Value))
            SetItemStatusByItemID = True
            Exit For
        End If
    Next r

    If SetItemStatusByItemID And recalcParentOrder And orderID <> "" Then
        RecalculateOrderStatusFromItems orderID
    End If
End Function

Private Function SetOrderStatusByOrderID(ByVal orderID As String, ByVal newStatus As String, ByVal cascadeClosedStatus As Boolean) As Boolean
    Dim wsO As Worksheet, wsI As Worksheet
    Dim r As Long, lastR As Long, orderCol As Long, stCol As Long
    Set wsO = ThisWorkbook.Worksheets(ORDERS_SHEET)
    Set wsI = ThisWorkbook.Worksheets(ITEMS_SHEET)

    newStatus = CanonicalStatus(newStatus)
    If Not IsValidStatus(newStatus) Then Exit Function

    orderCol = FindHeaderColumn(wsO, "Order ID")
    stCol = FindHeaderColumn(wsO, "Order Status")
    If orderCol = 0 Or stCol = 0 Then Exit Function

    lastR = lastRow(wsO, orderCol)
    For r = 2 To lastR
        If StrComp(Trim(CStr(wsO.Cells(r, orderCol).Value)), orderID, vbTextCompare) = 0 Then
            wsO.Cells(r, stCol).Value = newStatus
            SetOrderStatusByOrderID = True
            Exit For
        End If
    Next r

    If SetOrderStatusByOrderID And cascadeClosedStatus And IsClosedStatus(newStatus) Then
        orderCol = FindHeaderColumn(wsI, "Order ID")
        stCol = FindHeaderColumn(wsI, "Status")
        If orderCol > 0 And stCol > 0 Then
            lastR = lastRow(wsI, orderCol)
            For r = 2 To lastR
                If StrComp(Trim(CStr(wsI.Cells(r, orderCol).Value)), orderID, vbTextCompare) = 0 Then
                    wsI.Cells(r, stCol).Value = newStatus
                End If
            Next r
        End If
    End If
End Function

Private Sub RecalculateOrderStatusFromItems(ByVal orderID As String)
    Dim wsI As Worksheet, wsO As Worksheet
    Dim orderColI As Long, statusColI As Long, orderColO As Long, statusColO As Long
    Dim r As Long, lastR As Long, itemCount As Long
    Dim activeCount As Long, deliveredCount As Long, cancelledCount As Long
    Dim hasReady As Boolean, hasTrial As Boolean, hasAlteration As Boolean, hasStitching As Boolean, hasCutting As Boolean
    Dim st As String, summaryStatus As String

    Set wsI = ThisWorkbook.Worksheets(ITEMS_SHEET)
    Set wsO = ThisWorkbook.Worksheets(ORDERS_SHEET)

    orderColI = FindHeaderColumn(wsI, "Order ID")
    statusColI = FindHeaderColumn(wsI, "Status")
    orderColO = FindHeaderColumn(wsO, "Order ID")
    statusColO = FindHeaderColumn(wsO, "Order Status")
    If orderColI = 0 Or statusColI = 0 Or orderColO = 0 Or statusColO = 0 Then Exit Sub

    lastR = lastRow(wsI, orderColI)
    For r = 2 To lastR
        If StrComp(Trim(CStr(wsI.Cells(r, orderColI).Value)), orderID, vbTextCompare) = 0 Then
            itemCount = itemCount + 1
            st = CanonicalStatus(CStr(wsI.Cells(r, statusColI).Value))
            Select Case st
                Case "Delivered": deliveredCount = deliveredCount + 1
                Case "Cancelled": cancelledCount = cancelledCount + 1
                Case Else
                    activeCount = activeCount + 1
                    Select Case st
                        Case "Ready": hasReady = True
                        Case "Trial Pending": hasTrial = True
                        Case "Alteration": hasAlteration = True
                        Case "Stitching": hasStitching = True
                        Case "Cutting": hasCutting = True
                    End Select
            End Select
        End If
    Next r

    If itemCount = 0 Then Exit Sub

    If deliveredCount = itemCount Then
        summaryStatus = "Delivered"
    ElseIf cancelledCount = itemCount Then
        summaryStatus = "Cancelled"
    ElseIf hasReady Then
        summaryStatus = "Ready"
    ElseIf hasTrial Then
        summaryStatus = "Trial Pending"
    ElseIf hasAlteration Then
        summaryStatus = "Alteration"
    ElseIf hasStitching Then
        summaryStatus = "Stitching"
    ElseIf hasCutting Then
        summaryStatus = "Cutting"
    Else
        summaryStatus = "Booked"
    End If

    lastR = lastRow(wsO, orderColO)
    For r = 2 To lastR
        If StrComp(Trim(CStr(wsO.Cells(r, orderColO).Value)), orderID, vbTextCompare) = 0 Then
            wsO.Cells(r, statusColO).Value = summaryStatus
            Exit For
        End If
    Next r
End Sub

Private Sub RefreshAfterStatusUpdate()
    On Error Resume Next
    RefreshDashboard
    If ActiveSheet.Name = SEARCH_SHEET Then SearchOrdersPaged CLng(val(ThisWorkbook.Worksheets(SEARCH_SHEET).Range(SEARCH_PAGE_CELL).Value)), False
    On Error GoTo 0
End Sub

' Build a clean, payment-free Work Order card on a temporary sheet and open
' print preview. Shows order/customer, garments and their measurements only -
' suitable for the workshop floor. No amounts, rates or balances are shown.
Public Sub PrintOrderCard()
    Dim wsO As Worksheet, wsI As Worksheet, wsM As Worksheet, wsCard As Worksheet
    Dim orderID As String, custName As String, mobile As String, orderDate As String
    Dim r As Long, lastI As Long, lastM As Long, outRow As Long, c As Long
    Dim measLabels As Variant
    measLabels = Array("Length", "Chest", "Shoulder", "Sleeve", "Bicep", "Elbow", "Collar", _
                       "Waist", "Hips", "Inseam", "Outseam", "Thigh", "Knee", "Bottom", _
                       "Back", "Back Round", "Back Down", "RSD", "LSD", "SD")

    Set wsO = ThisWorkbook.Worksheets(ORDERS_SHEET)
    Set wsI = ThisWorkbook.Worksheets(ITEMS_SHEET)
    Set wsM = ThisWorkbook.Worksheets(MEASUREMENTS_SHEET)

    orderID = Trim(InputBox("Enter the Order ID to print a work card:" & vbCrLf & vbCrLf & _
                            "Example: ORD-00001", "Print Work Order Card"))
    If orderID = "" Then Exit Sub
    If Not RowExistsByHeaderValue(wsO, "Order ID", orderID) Then
        MsgBox "Order ID '" & orderID & "' was not found.", vbExclamation
        Exit Sub
    End If

    custName = LookupValueByKey(wsO, "Order ID", orderID, "Customer Name")
    mobile = LookupValueByKey(wsO, "Order ID", orderID, "Mobile")
    orderDate = LookupValueByKey(wsO, "Order ID", orderID, "Order Date")

    Application.ScreenUpdating = False
    Application.DisplayAlerts = False
    On Error Resume Next
    ThisWorkbook.Worksheets("_WorkCard").Delete
    On Error GoTo 0
    Set wsCard = ThisWorkbook.Worksheets.Add
    wsCard.Name = "_WorkCard"

    wsCard.Range("A1").Value = "HAMEES ATTIRE - WORK ORDER CARD"
    wsCard.Range("A1").Font.Bold = True: wsCard.Range("A1").Font.Size = 16
    wsCard.Range("A3").Value = "Order ID:": wsCard.Range("B3").Value = orderID
    wsCard.Range("A4").Value = "Customer:": wsCard.Range("B4").Value = custName
    wsCard.Range("A5").Value = "Mobile:": wsCard.Range("B5").Value = mobile
    wsCard.Range("A6").Value = "Order Date:": wsCard.Range("B6").Value = orderDate
    wsCard.Range("A3:A6").Font.Bold = True

    outRow = 8
    lastI = lastRow(wsI, FindHeaderColumn(wsI, "Order ID"))
    Dim idCol As Long: idCol = FindHeaderColumn(wsI, "Order ID")
    For r = 2 To lastI
        If StrComp(CStr(wsI.Cells(r, idCol).Value), orderID, vbTextCompare) = 0 Then
            Dim itmID As String, itmType As String, itmFit As String
            Dim itmStatus As String, itmTry As String, itmDel As String, itmStaff As String
            itmID = CStr(GetCellByHeader(wsI, r, "Item ID"))
            itmType = CStr(GetCellByHeader(wsI, r, "Item Type"))
            itmFit = CStr(GetCellByHeader(wsI, r, "Fit Type"))
            itmStatus = CStr(GetCellByHeader(wsI, r, "Status"))
            itmTry = CStr(GetCellByHeader(wsI, r, "Try Date"))
            itmDel = CStr(GetCellByHeader(wsI, r, "Delivery Date"))
            itmStaff = CStr(GetCellByHeader(wsI, r, "Staff"))

            With wsCard.Range(wsCard.Cells(outRow, 1), wsCard.Cells(outRow, 6))
                .Merge
                .Value = itmID & "   |   " & itmType & "   |   Fit: " & itmFit & _
                         "   |   Status: " & itmStatus
                .Font.Bold = True: .Font.Color = RGB(255, 255, 255)
                .Interior.Color = RGB(31, 78, 121)
            End With
            outRow = outRow + 1
            wsCard.Cells(outRow, 1).Value = "Try: " & itmTry
            wsCard.Cells(outRow, 3).Value = "Delivery: " & itmDel
            wsCard.Cells(outRow, 5).Value = "Staff: " & itmStaff
            outRow = outRow + 1

            ' measurements for this item (payment-free)
            lastM = lastRow(wsM, 1)
            Dim mr As Long, mFound As Long: mFound = 0
            For mr = 2 To lastM
                If CStr(wsM.Cells(mr, 1).Value) = orderID _
                   And CStr(wsM.Cells(mr, 2).Value) = itmID Then mFound = mr: Exit For
            Next mr
            If mFound > 0 Then
                Dim pairCol As Long: pairCol = 1
                For c = 0 To 19
                    Dim v As Variant: v = wsM.Cells(mFound, 4 + c).Value
                    If v <> "" And IsNumeric(v) Then
                        wsCard.Cells(outRow, pairCol).Value = measLabels(c) & ":"
                        wsCard.Cells(outRow, pairCol).Font.Bold = True
                        wsCard.Cells(outRow, pairCol + 1).Value = v
                        pairCol = pairCol + 2
                        If pairCol > 6 Then pairCol = 1: outRow = outRow + 1
                    End If
                Next c
                If pairCol > 1 Then outRow = outRow + 1
            End If
            outRow = outRow + 1
        End If
    Next r

    wsCard.Columns("A:F").ColumnWidth = 16
    wsCard.PageSetup.Orientation = xlPortrait
    wsCard.PageSetup.FitToPagesWide = 1
    Application.DisplayAlerts = True
    Application.ScreenUpdating = True
    wsCard.PrintPreview
    ' Leave the sheet in place after preview so the user can print again;
    ' it is rebuilt fresh on each run.

End Sub



' =========================================
' Healper Functions for this Workbook
' =========================================

' For linking the last known order measurements to the Item Type and Customer new Order
Public Sub PrefillMeasurementsFromHistory()
    Dim wsE As Worksheet, wsM As Worksheet, wsI As Worksheet, wsO As Worksheet
    Dim itemRow As Long, measRow As Long, itemIdx As Long
    Dim custID As String, itemType As String
    Dim bestRow As Long, bestDate As Double, c As Long
    Set wsE = ThisWorkbook.Worksheets(ENTRY_SHEET)
    Set wsM = ThisWorkbook.Worksheets(MEASUREMENTS_SHEET)
    Set wsI = ThisWorkbook.Worksheets(ITEMS_SHEET)
    Set wsO = ThisWorkbook.Worksheets(ORDERS_SHEET)

    custID = Trim(CStr(wsE.Range("B8").Value))   ' Customer ID (read-only field)
    If custID = "" Then
        MsgBox "Load or save the customer first (Prefill Customer by Mobile).", vbExclamation
        Exit Sub
    End If

    ' Build the cards FIRST so gMeasMap is populated for the current item types.
    RefreshMeasurementRows_NoMessageMC

    wsE.Unprotect Password:=PROTECT_PASSWORD
    Dim lastM As Long: lastM = lastRow(wsM, 1)
    Dim filled As Long

    For itemRow = 22 To 31
        itemIdx = itemRow - 21
        itemType = Trim(CStr(wsE.Cells(itemRow, 3).Value))   ' col C = Item Type
        If itemType <> "" Then
            ' measRow = itemRow + 14
            bestRow = 0: bestDate = -1
            ' Scan Measurements history for same customer + same item type
            Dim r As Long, mOrderID As String, mItemID As String
            Dim mType As String, mCust As String, mDate As Double
            For r = 2 To lastM
                mOrderID = CStr(wsM.Cells(r, 1).Value)
                mItemID = CStr(wsM.Cells(r, 2).Value)
                ' Item Type comes from Order_Items keyed by Order ID + Item ID
                mType = LookupItemType(wsI, mOrderID, mItemID)
                If StrComp(mType, itemType, vbTextCompare) = 0 Then
                    mCust = LookupValueByKey(wsO, "Order ID", mOrderID, "Customer ID")
                    If StrComp(mCust, custID, vbTextCompare) = 0 Then
                        If IsNumeric(wsM.Cells(r, 3).Value) Then mDate = CDbl(wsM.Cells(r, 3).Value) Else mDate = 0
                        If mDate >= bestDate Then
                            bestDate = mDate: bestRow = r
                        End If
                    End If
                End If
            Next r
            ' Copy the 20 measurement values (Meas D:W = cols 4..23) into Entry grid (D:W = cols 4..23)
            ' Write the historical values into THIS card via the map.
            If bestRow > 0 Then
                ' For c = 0 To 19
                '     wsE.Cells(measRow, 4 + c).Value = wsM.Cells(bestRow, 4 + c).Value  ' FIXED: was 5 + c
                ' Next c
                PrefillCardMeasurements itemIdx, bestRow
                filled = filled + 1
            End If
        End If
    Next itemRow

    SetupProtectionSilent
    If filled > 0 Then
        MsgBox filled & " item(s) pre-filled from this customer's measurement history. You can edit any value.", vbInformation
    Else
        MsgBox "No prior measurements found for this customer and item type(s).", vbInformation
    End If
    
End Sub

' Helper: get Item Type from Order_Items by Order ID + Item ID
Private Function LookupItemType(ByVal wsI As Worksheet, ByVal orderID As String, ByVal itemID As String) As String
    Dim r As Long, lastR As Long
    LookupItemType = ""
    lastR = lastRow(wsI, 1)
    For r = 2 To lastR
        If CStr(wsI.Cells(r, 1).Value) = orderID And CStr(wsI.Cells(r, 2).Value) = itemID Then
            LookupItemType = CStr(wsI.Cells(r, 3).Value)   ' col C = Item Type
            Exit Function
        End If
    Next r
    
End Function


' ============================================================
' HELPER FUNCTIONS - DELETE
' ============================================================

Private Function FindHeaderColumnDel(ByVal ws As Worksheet, ByVal headerName As String) As Long

    Dim lastCol As Long, c As Long
    Dim currentHeader As String
    
    FindHeaderColumnDel = 0
    
    lastCol = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column
    
    For c = 1 To lastCol
        currentHeader = Trim(CStr(ws.Cells(1, c).Value))
        
        If StrComp(currentHeader, headerName, vbTextCompare) = 0 Then
            FindHeaderColumnDel = c
            Exit Function
        End If
    Next c

End Function


Private Function LastUsedRow(ByVal ws As Worksheet, ByVal colNum As Long) As Long

    If colNum <= 0 Then
        LastUsedRow = 1
    Else
        LastUsedRow = ws.Cells(ws.Rows.Count, colNum).End(xlUp).Row
    End If

End Function


Private Function RowExistsByHeaderValue( _
    ByVal ws As Worksheet, _
    ByVal keyHeader As String, _
    ByVal keyValue As String _
) As Boolean

    Dim keyCol As Long, lastR As Long, r As Long
    
    RowExistsByHeaderValue = False
    
    keyCol = FindHeaderColumnDel(ws, keyHeader)
    If keyCol = 0 Then Exit Function
    
    lastR = LastUsedRow(ws, keyCol)
    
    For r = 2 To lastR
        If Trim(CStr(ws.Cells(r, keyCol).Value)) = Trim(CStr(keyValue)) Then
            RowExistsByHeaderValue = True
            Exit Function
        End If
    Next r

End Function


Private Function DeleteRowsByHeaderValue( _
    ByVal ws As Worksheet, _
    ByVal keyHeader As String, _
    ByVal keyValue As String _
) As Long

    Dim keyCol As Long, lastR As Long, r As Long
    Dim deleteCount As Long
    
    deleteCount = 0
    
    keyCol = FindHeaderColumnDel(ws, keyHeader)
    If keyCol = 0 Then
        DeleteRowsByHeaderValue = 0
        Exit Function
    End If
    
    lastR = LastUsedRow(ws, keyCol)
    
    For r = lastR To 2 Step -1
        If Trim(CStr(ws.Cells(r, keyCol).Value)) = Trim(CStr(keyValue)) Then
            ws.Rows(r).Delete
            deleteCount = deleteCount + 1
        End If
    Next r
    
    DeleteRowsByHeaderValue = deleteCount

End Function


Private Function DeleteRowsByTwoHeaderValues( _
    ByVal ws As Worksheet, _
    ByVal keyHeader1 As String, _
    ByVal keyValue1 As String, _
    ByVal keyHeader2 As String, _
    ByVal keyValue2 As String _
) As Long

    Dim keyCol1 As Long, keyCol2 As Long
    Dim lastR As Long, r As Long
    Dim deleteCount As Long
    
    deleteCount = 0
    
    keyCol1 = FindHeaderColumnDel(ws, keyHeader1)
    keyCol2 = FindHeaderColumnDel(ws, keyHeader2)
    
    If keyCol1 = 0 Or keyCol2 = 0 Then
        DeleteRowsByTwoHeaderValues = 0
        Exit Function
    End If
    
    lastR = LastUsedRow(ws, keyCol1)
    
    For r = lastR To 2 Step -1
        If Trim(CStr(ws.Cells(r, keyCol1).Value)) = Trim(CStr(keyValue1)) _
            And Trim(CStr(ws.Cells(r, keyCol2).Value)) = Trim(CStr(keyValue2)) Then
            
            ws.Rows(r).Delete
            deleteCount = deleteCount + 1
        End If
    Next r
    
    DeleteRowsByTwoHeaderValues = deleteCount

End Function


Private Function ItemExistsForOrder( _
    ByVal ws As Worksheet, _
    ByVal orderID As String, _
    ByVal itemID As String _
) As Boolean

    Dim orderCol As Long, itemCol As Long
    Dim lastR As Long, r As Long
    
    ItemExistsForOrder = False
    
    orderCol = FindHeaderColumnDel(ws, "Order ID")
    itemCol = FindHeaderColumnDel(ws, "Item ID")
    
    If orderCol = 0 Or itemCol = 0 Then Exit Function
    
    lastR = LastUsedRow(ws, orderCol)
    
    For r = 2 To lastR
        If Trim(CStr(ws.Cells(r, orderCol).Value)) = Trim(CStr(orderID)) _
            And Trim(CStr(ws.Cells(r, itemCol).Value)) = Trim(CStr(itemID)) Then
            
            ItemExistsForOrder = True
            Exit Function
        End If
    Next r

End Function


Private Function ResolveCustomerID(ByVal wsC As Worksheet, ByVal searchValue As String) As String

    Dim customerIDCol As Long, mobileCol As Long
    Dim lastR As Long, r As Long
    
    ResolveCustomerID = ""
    
    customerIDCol = FindHeaderColumnDel(wsC, "Customer ID")
    mobileCol = FindHeaderColumnDel(wsC, "Mobile")
    
    If customerIDCol = 0 Then Exit Function
    
    lastR = LastUsedRow(wsC, customerIDCol)
    
    ' First try exact Customer ID
    For r = 2 To lastR
        If Trim(CStr(wsC.Cells(r, customerIDCol).Value)) = Trim(CStr(searchValue)) Then
            ResolveCustomerID = CStr(wsC.Cells(r, customerIDCol).Value)
            Exit Function
        End If
    Next r
    
    ' Then try Mobile
    If mobileCol > 0 Then
        For r = 2 To lastR
            If Trim(CStr(wsC.Cells(r, mobileCol).Value)) = Trim(CStr(searchValue)) Then
                ResolveCustomerID = CStr(wsC.Cells(r, customerIDCol).Value)
                Exit Function
            End If
        Next r
    End If

End Function


Private Function GetOrderIDsForCustomer(ByVal wsO As Worksheet, ByVal customerID As String) As Collection

    Dim orderIDs As New Collection
    Dim customerIDCol As Long, orderIDCol As Long
    Dim lastR As Long, r As Long
    Dim orderID As String
    
    customerIDCol = FindHeaderColumnDel(wsO, "Customer ID")
    orderIDCol = FindHeaderColumnDel(wsO, "Order ID")
    
    If customerIDCol = 0 Or orderIDCol = 0 Then
        Set GetOrderIDsForCustomer = orderIDs
        Exit Function
    End If
    
    lastR = LastUsedRow(wsO, customerIDCol)
    
    For r = 2 To lastR
        If Trim(CStr(wsO.Cells(r, customerIDCol).Value)) = Trim(CStr(customerID)) Then
            orderID = Trim(CStr(wsO.Cells(r, orderIDCol).Value))
            If orderID <> "" Then orderIDs.Add orderID
        End If
    Next r
    
    Set GetOrderIDsForCustomer = orderIDs

End Function


Private Function LookupValueByKeyDel( _
    ByVal ws As Worksheet, _
    ByVal keyHeader As String, _
    ByVal keyValue As String, _
    ByVal returnHeader As String _
) As String

    Dim keyCol As Long, returnCol As Long
    Dim lastR As Long, r As Long
    
    LookupValueByKeyDel = ""
    
    keyCol = FindHeaderColumnDel(ws, keyHeader)
    returnCol = FindHeaderColumnDel(ws, returnHeader)
    
    If keyCol = 0 Or returnCol = 0 Then Exit Function
    
    lastR = LastUsedRow(ws, keyCol)
    
    For r = 2 To lastR
        If Trim(CStr(ws.Cells(r, keyCol).Value)) = Trim(CStr(keyValue)) Then
            LookupValueByKeyDel = CStr(ws.Cells(r, returnCol).Value)
            Exit Function
        End If
    Next r

End Function


Private Function lastRow(ws As Worksheet, col As Long) As Long
    lastRow = ws.Cells(ws.Rows.Count, col).End(xlUp).Row
    If lastRow < 1 Then lastRow = 1
    
End Function

Private Function NextBlankRow(ws As Worksheet, col As Long) As Long
    NextBlankRow = lastRow(ws, col) + 1
    If NextBlankRow < 2 Then NextBlankRow = 2
    
End Function

Private Function FindRow(ws As Worksheet, col As Long, valueToFind As String) As Long
    Dim lastR As Long, r As Long
    lastR = lastRow(ws, col)
    For r = 2 To lastR
        If Trim$(LCase$(CStr(ws.Cells(r, col).Value))) = Trim$(LCase$(valueToFind)) Then
            FindRow = r
            Exit Function
        End If
    Next r
    FindRow = 0
    
End Function

Private Function NextID(prefix As String, ws As Worksheet, col As Long) As String
    Dim lastR As Long, r As Long, maxNum As Long, raw As String, n As Long
    lastR = lastRow(ws, col)
    For r = 2 To lastR
        raw = CStr(ws.Cells(r, col).Value)
        If Left$(raw, Len(prefix)) = prefix Then
            n = val(Mid$(raw, Len(prefix) + 1))
            If n > maxNum Then maxNum = n
        End If
    Next r
    NextID = prefix & Format(maxNum + 1, "00000")
    
End Function

' ============================================================
' HELPER FUNCTIONS - MAIN
' ============================================================

Private Function DefaultIfBlank(valueIn As Variant, defaultVal As String) As String
    If Trim$(CStr(valueIn)) = "" Then DefaultIfBlank = defaultVal Else DefaultIfBlank = CStr(valueIn)
    
End Function

Private Function IsToday(valueIn As Variant) As Boolean
    If IsDate(valueIn) Then IsToday = (DateValue(CDate(valueIn)) = Date) Else IsToday = False
    
End Function

Private Function GetCellByHeader(ByVal ws As Worksheet, ByVal rowNum As Long, ByVal headerName As String) As Variant
    Dim colNum As Long
    colNum = FindHeaderColumn(ws, headerName)

    If colNum = 0 Then
        GetCellByHeader = ""
    Else
        GetCellByHeader = ws.Cells(rowNum, colNum).Value
    End If
    
End Function


Private Function FindHeaderColumn(ByVal ws As Worksheet, ByVal headerName As String) As Long
    Dim lastCol As Long, c As Long
    Dim currentHeader As String

    lastCol = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column

    For c = 1 To lastCol
        currentHeader = Trim(CStr(ws.Cells(1, c).Value))

        If StrComp(currentHeader, headerName, vbTextCompare) = 0 Then
            FindHeaderColumn = c
            Exit Function
        End If
    Next c

    FindHeaderColumn = 0
    
End Function


Private Function LookupValueByKey( _
    ByVal ws As Worksheet, _
    ByVal keyHeader As String, _
    ByVal keyValue As String, _
    ByVal returnHeader As String _
) As String

    Dim keyCol As Long, returnCol As Long
    Dim lastR As Long, r As Long

    LookupValueByKey = ""

    If Trim(keyValue) = "" Then Exit Function

    keyCol = FindHeaderColumn(ws, keyHeader)
    returnCol = FindHeaderColumn(ws, returnHeader)

    If keyCol = 0 Or returnCol = 0 Then Exit Function

    lastR = lastRow(ws, keyCol)

    For r = 2 To lastR
        If Trim(CStr(ws.Cells(r, keyCol).Value)) = Trim(CStr(keyValue)) Then
            LookupValueByKey = CStr(ws.Cells(r, returnCol).Value)
            Exit Function
        End If
    Next r

End Function



Private Function DrawCard(ws As Worksheet, cfg As Worksheet, ByVal topRow As Long, _
    ByVal leftCol As Long, ByVal itemRow As Long, ByVal itemIdx As Long, _
    ByVal itType As String, ByVal fields As Variant) As Long

    Dim cfgRow As Long: cfgRow = ConfigRowForType(cfg, itType)

    ' title bar
    Dim titleRng As Range
    Set titleRng = ws.Range(ws.Cells(topRow, leftCol), ws.Cells(topRow, leftCol + 6))
    titleRng.Merge
    titleRng.Value = ws.Cells(itemRow, 2).Value & "  -  " & itType
    titleRng.Font.Bold = True: titleRng.Font.Color = vbWhite
    titleRng.Interior.Color = RGB(31, 78, 120): titleRng.HorizontalAlignment = xlCenter

    ' relevant fields from config (X marks)
    Dim relIdx() As Long, relCount As Long, f As Long
    ReDim relIdx(1 To 20): relCount = 0
    If cfgRow > 0 Then
        For f = 1 To 20
            If UCase(Trim(CStr(cfg.Cells(cfgRow, f + 1).Value))) = "X" Then
                relCount = relCount + 1: relIdx(relCount) = f
            End If
        Next f
    End If

    ' body: 2 label:value pairs per row
    Dim bodyTop As Long: bodyTop = topRow + 1
    Dim i As Long, rOff As Long, pairInRow As Long
    rOff = 0: pairInRow = 0
    For i = 1 To relCount
        Dim r As Long, cLabel As Long, cValue As Long
        r = bodyTop + rOff
        If pairInRow = 0 Then
            cLabel = leftCol: cValue = leftCol + 1
        Else
            cLabel = leftCol + 3: cValue = leftCol + 4
        End If
        Dim fi As Long: fi = relIdx(i)
        With ws.Cells(r, cLabel)
            .Value = fields(fi - 1): .Font.Bold = True: .Font.Size = 9
            .HorizontalAlignment = xlRight
        End With
        With ws.Cells(r, cValue)
            .Interior.Color = RGB(255, 242, 204): .Locked = False
            .NumberFormat = "0.##"
            .Borders.LineStyle = xlContinuous: .Borders.Color = RGB(191, 191, 191)
        End With
        gMeasMap(itemIdx & "|" & fi) = ws.Cells(r, cValue).Address
        pairInRow = pairInRow + 1
        If pairInRow = PAIRS_PER_ROW Then pairInRow = 0: rOff = rOff + 1
    Next i
    If pairInRow > 0 Then rOff = rOff + 1

    ' notes row (full card width)
    Dim notesRow As Long: notesRow = bodyTop + rOff
    With ws.Cells(notesRow, leftCol)
        .Value = "Notes": .Font.Bold = True: .Font.Size = 9
    End With
    Dim noteRng As Range
    Set noteRng = ws.Range(ws.Cells(notesRow, leftCol + 1), ws.Cells(notesRow, leftCol + 6))
    noteRng.Merge: noteRng.Interior.Color = RGB(255, 242, 204): noteRng.Locked = False
    noteRng.Borders.LineStyle = xlContinuous: noteRng.Borders.Color = RGB(191, 191, 191)
    gMeasMap(itemIdx & "|NOTES") = ws.Cells(notesRow, leftCol + 1).Address

    ws.Range(ws.Cells(topRow, leftCol), ws.Cells(notesRow, leftCol + 6)) _
        .BorderAround Weight:=xlThin, Color:=RGB(31, 78, 120)

    DrawCard = (notesRow - topRow) + 1

End Function


Private Function ConfigRowForType(cfg As Worksheet, ByVal itType As String) As Long
    Dim lastRow As Long, r As Long
    lastRow = cfg.Cells(cfg.Rows.Count, 1).End(xlUp).Row
    For r = 2 To lastRow
        If StrComp(Trim(CStr(cfg.Cells(r, 1).Value)), itType, vbTextCompare) = 0 Then
            ConfigRowForType = r: Exit Function
        End If
    Next r
    ConfigRowForType = 0

End Function
