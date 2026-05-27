Option Explicit

Public Sub SubmitTailorOrder()
    Dim wsE As Worksheet, wsC As Worksheet, wsO As Worksheet, wsM As Worksheet
    Dim customerId As String, orderId As String
    Dim custRow As Long, orderRow As Long, measRow As Long
    Dim found As Range

    Set wsE = ThisWorkbook.Worksheets("Entry Form")
    Set wsC = ThisWorkbook.Worksheets("Customers")
    Set wsO = ThisWorkbook.Worksheets("Orders")
    Set wsM = ThisWorkbook.Worksheets("Measurements")

    customerId = Trim(wsE.Range("E6").Value)
    orderId = Trim(wsE.Range("B15").Value)

    If customerId = "" Or wsE.Range("B7").Value = "" Or wsE.Range("B8").Value = "" Then
        MsgBox "Please enter Customer ID, Customer Name and Mobile before submitting.", vbExclamation
        Exit Sub
    End If

    If orderId = "" Or wsE.Range("B21").Value = "" Or wsE.Range("E17").Value = "" Then
        MsgBox "Please enter Order ID, Item Type and Amount/Rate before submitting.", vbExclamation
        Exit Sub
    End If

    'Upsert customer by Customer ID
    Set found = wsC.Range("A:A").Find(What:=customerId, LookIn:=xlValues, LookAt:=xlWhole)
    If found Is Nothing Then
        custRow = wsC.Cells(wsC.Rows.Count, "A").End(xlUp).Row + 1
    Else
        custRow = found.Row
    End If

    wsC.Cells(custRow, 1).Value = customerId
    wsC.Cells(custRow, 2).Value = wsE.Range("B7").Value
    wsC.Cells(custRow, 3).Value = wsE.Range("B8").Value
    wsC.Cells(custRow, 4).Value = wsE.Range("E8").Value
    wsC.Cells(custRow, 5).Value = wsE.Range("B9").Value
    wsC.Cells(custRow, 6).Value = wsE.Range("B10").Value
    wsC.Cells(custRow, 7).Value = wsE.Range("E7").Value
    wsC.Cells(custRow, 8).Value = wsE.Range("B11").Value
    wsC.Cells(custRow, 9).Value = wsE.Range("E9").Value
    wsC.Cells(custRow, 10).Value = wsE.Range("E10").Value
    wsC.Cells(custRow, 11).Value = wsE.Range("E11").Value

    'Prevent duplicate order
    Set found = wsO.Range("A:A").Find(What:=orderId, LookIn:=xlValues, LookAt:=xlWhole)
    If Not found Is Nothing Then
        MsgBox "Order ID already exists. Please check generated Order No / Line No.", vbCritical
        Exit Sub
    End If

    orderRow = wsO.Cells(wsO.Rows.Count, "A").End(xlUp).Row + 1
    wsO.Cells(orderRow, 1).Value = orderId
    wsO.Cells(orderRow, 2).Value = wsE.Range("B16").Value
    wsO.Cells(orderRow, 3).Value = wsE.Range("B17").Value
    wsO.Cells(orderRow, 4).Value = customerId
    wsO.Cells(orderRow, 5).Value = wsE.Range("B7").Value
    wsO.Cells(orderRow, 6).Value = wsE.Range("B8").Value
    wsO.Cells(orderRow, 7).Value = wsE.Range("B18").Value
    wsO.Cells(orderRow, 8).Value = wsE.Range("B19").Value
    wsO.Cells(orderRow, 9).Value = wsE.Range("B20").Value
    wsO.Cells(orderRow, 10).Formula = "=I" & orderRow & "-TODAY()"
    wsO.Cells(orderRow, 11).Formula = "=IF(AND(U" & orderRow & "<>""Delivered"",I" & orderRow & "<TODAY()),""Yes"",""No"")"
    wsO.Cells(orderRow, 12).Value = wsE.Range("B21").Value
    wsO.Cells(orderRow, 13).Value = wsE.Range("B22").Value
    wsO.Cells(orderRow, 14).Value = wsE.Range("B23").Value
    wsO.Cells(orderRow, 15).Value = wsE.Range("E15").Value
    wsO.Cells(orderRow, 16).Value = wsE.Range("E16").Value
    wsO.Cells(orderRow, 17).Value = wsE.Range("E17").Value
    wsO.Cells(orderRow, 18).Value = wsE.Range("E18").Value
    wsO.Cells(orderRow, 19).Value = wsE.Range("E19").Value
    wsO.Cells(orderRow, 20).Value = wsE.Range("E20").Value
    wsO.Cells(orderRow, 21).Value = wsE.Range("E21").Value

    measRow = wsM.Cells(wsM.Rows.Count, "A").End(xlUp).Row + 1
    wsM.Cells(measRow, 1).Value = "M-" & Format(measRow - 4, "0000")
    wsM.Cells(measRow, 2).Value = orderId
    wsM.Cells(measRow, 3).Value = customerId
    wsM.Cells(measRow, 4).Value = wsE.Range("B7").Value
    wsM.Cells(measRow, 5).Value = wsE.Range("B21").Value
    wsM.Cells(measRow, 6).Value = wsE.Range("B11").Value
    wsM.Cells(measRow, 7).Value = wsE.Range("A27").Value
    wsM.Cells(measRow, 8).Value = wsE.Range("B27").Value
    wsM.Cells(measRow, 9).Value = wsE.Range("C27").Value
    wsM.Cells(measRow, 10).Value = wsE.Range("D27").Value
    wsM.Cells(measRow, 11).Value = wsE.Range("E27").Value
    wsM.Cells(measRow, 12).Value = wsE.Range("F27").Value
    wsM.Cells(measRow, 13).Value = wsE.Range("G27").Value
    wsM.Cells(measRow, 14).Value = wsE.Range("H27").Value
    wsM.Cells(measRow, 16).Value = wsE.Range("I27").Value
    wsM.Cells(measRow, 30).Value = wsE.Range("J27").Value
    wsM.Cells(measRow, 32).Value = Date

    wsE.Range("H5").Value = "Saved: " & orderId
    wsE.Range("H6").Value = Now

    'Clear only order-specific fields; keep customer details ready for next garment.
    wsE.Range("B19:B20,B22:B23,E16,E18,E21:E23,A27:J27").ClearContents
    wsE.Range("B17").Value = wsE.Range("B17").Value + 1

    MsgBox "Saved customer, order and measurements for " & orderId, vbInformation

End Sub
