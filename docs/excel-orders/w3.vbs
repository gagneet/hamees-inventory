Option Explicit

Private Function RequiredMeasurements(itemType As String) As String
    Select Case itemType
        Case "Shirt", "Kurta", "Kurta Pajama", "Coat", "Blazer", "Sherwani", "Waistcoat"
            RequiredMeasurements = "Length,Chest,Shoulder,Sleeve"
        Case "Pajama", "Pant"
            RequiredMeasurements = "Length,Waist,Hips"
        Case Else
            RequiredMeasurements = "Length"
    End Select
    
End Function

Private Function MeasurementCell(label As String) As String
    Select Case label
        Case "Length":   MeasurementCell = "A31"
        Case "Chest":    MeasurementCell = "B31"
        Case "Gap":      MeasurementCell = "C31"
        Case "Waist":    MeasurementCell = "D31"
        Case "Hips":     MeasurementCell = "E31"
        Case "Shoulder": MeasurementCell = "F31"
        Case "Sleeve":   MeasurementCell = "G31"
        Case "Bicep":    MeasurementCell = "H31"
        Case "Collar":   MeasurementCell = "I31"
    End Select

End Function

Public Sub SubmitTailorOrder()
    Dim ws As Worksheet: Set ws = ThisWorkbook.Worksheets("Entry Form")
    Dim wsC As Worksheet: Set wsC = ThisWorkbook.Worksheets("Customers")
    Dim wsO As Worksheet: Set wsO = ThisWorkbook.Worksheets("Orders")
    Dim wsM As Worksheet: Set wsM = ThisWorkbook.Worksheets("Measurements")

    Dim errs As String: errs = ""
    Dim mode As String: mode = Trim(CStr(ws.Range("B5").Value))
    Dim custID As String: custID = Trim(CStr(ws.Range("B6").Value))
    Dim custName As String: custName = Trim(CStr(ws.Range("B7").Value))
    Dim mobile As Variant: mobile = ws.Range("B8").Value
    Dim source As String: source = Trim(CStr(ws.Range("B12").Value))
    Dim itemType As String: itemType = Trim(CStr(ws.Range("B22").Value))
    Dim colour As String: colour = Trim(CStr(ws.Range("B23").Value))
    Dim fabric As String: fabric = Trim(CStr(ws.Range("B24").Value))
    Dim bookDate As Variant: bookDate = ws.Range("E19").Value
    Dim delivDate As Variant: delivDate = ws.Range("E21").Value
    Dim qty As Variant: qty = ws.Range("E22").Value
    Dim rate As Variant: rate = ws.Range("E23").Value
    Dim advance As Variant: advance = ws.Range("E25").Value

    ' Validation
    If custName = "" Then errs = errs & vbCrLf & "• Customer Name is required"
    If custID = "" Then errs = errs & vbCrLf & "• Customer ID is missing"
    If Len(CStr(mobile)) < 6 Then errs = errs & vbCrLf & "• Mobile is required (min 6 digits)"
    If itemType = "" Then errs = errs & vbCrLf & "• Item Type is required"
    If colour = "" Then errs = errs & vbCrLf & "• Colour is required"
    If fabric = "" Then errs = errs & vbCrLf & "• Fabric is required"
    If Not IsDate(bookDate) Then errs = errs & vbCrLf & "• Booking Date is required"
    If Not IsDate(delivDate) Then errs = errs & vbCrLf & "• Delivery Date is required"
    If IsDate(bookDate) And IsDate(delivDate) Then
        If CDate(delivDate) < CDate(bookDate) Then errs = errs & vbCrLf & "• Delivery Date cannot be before Booking Date"
    End If
    If Not IsNumeric(qty) Then
        errs = errs & vbCrLf & "• Qty is required"
    ElseIf qty <= 0 Then
        errs = errs & vbCrLf & "• Qty must be greater than 0"
    End If

    Dim req As String: req = RequiredMeasurements(itemType)
    Dim labels() As String: labels = Split(req, ",")
    Dim i As Long, addr As String
    For i = LBound(labels) To UBound(labels)
        addr = MeasurementCell(labels(i))
        If addr <> "" Then
            If Trim(CStr(ws.Range(addr).Value)) = "" Then
                errs = errs & vbCrLf & "• Measurement '" & labels(i) & "' is required for " & itemType
            End If
        End If
    Next i

    If errs <> "" Then
        MsgBox "Please fix before submitting:" & vbCrLf & errs, vbExclamation, "Validation failed"
        Exit Sub
    End If

    Application.ScreenUpdating = False
    Dim orderID As String: orderID = ws.Range("B19").Value
    Dim orderNo As Long: orderNo = CLng(ws.Range("B20").Value)
    Dim lineNo As Long: lineNo = CLng(ws.Range("B21").Value)
    Dim nextRowC As Long, nextRowO As Long, nextRowM As Long

    ' 1) Append new customer
    If mode = "New" Then
        nextRowC = wsC.Cells(wsC.Rows.Count, "A").End(xlUp).Row + 1
        If nextRowC < 5 Then nextRowC = 5
        wsC.Cells(nextRowC, 1).Value = custID
        wsC.Cells(nextRowC, 2).Value = custName
        wsC.Cells(nextRowC, 3).Value = mobile
        wsC.Cells(nextRowC, 4).Value = ws.Range("B14").Value     ' Alt Phone
        wsC.Cells(nextRowC, 5).Value = ws.Range("B9").Value      ' WhatsApp
        wsC.Cells(nextRowC, 6).Value = ws.Range("B10").Value     ' Address
        wsC.Cells(nextRowC, 7).Value = ws.Range("B13").Value     ' City
        wsC.Cells(nextRowC, 8).Value = ws.Range("B11").Value     ' Fit
        wsC.Cells(nextRowC, 9).Value = ws.Range("B15").Value     ' Notes
        wsC.Cells(nextRowC, 10).Value = Date
        wsC.Cells(nextRowC, 11).Value = ws.Range("B16").Value    ' Active
    End If

    ' 2) Append order
    nextRowO = wsO.Cells(wsO.Rows.Count, "A").End(xlUp).Row + 1
    If nextRowO < 5 Then nextRowO = 5
    wsO.Cells(nextRowO, 1).Value = orderID
    wsO.Cells(nextRowO, 2).Value = orderNo
    wsO.Cells(nextRowO, 3).Value = lineNo
    wsO.Cells(nextRowO, 4).Value = custID
    wsO.Cells(nextRowO, 5).Value = custName
    wsO.Cells(nextRowO, 6).Value = mobile
    wsO.Cells(nextRowO, 7).Value = CDate(bookDate)
    If IsDate(ws.Range("E20").Value) Then wsO.Cells(nextRowO, 8).Value = ws.Range("E20").Value
    wsO.Cells(nextRowO, 9).Value = CDate(delivDate)
    wsO.Cells(nextRowO, 12).Value = itemType
    wsO.Cells(nextRowO, 13).Value = colour
    wsO.Cells(nextRowO, 14).Value = fabric
    wsO.Cells(nextRowO, 15).Value = qty
    wsO.Cells(nextRowO, 16).Value = rate
    ' Amount/Balance/Payment Status auto-fill via table calc columns
    wsO.Cells(nextRowO, 18).Value = advance
    wsO.Cells(nextRowO, 21).Value = ws.Range("B25").Value       ' Status

    ' 3) Append measurements
    nextRowM = wsM.Cells(wsM.Rows.Count, "A").End(xlUp).Row + 1
    If nextRowM < 5 Then nextRowM = 5
    wsM.Cells(nextRowM, 1).Value = "MEAS-" & Format(nextRowM - 4, "0000")
    wsM.Cells(nextRowM, 2).Value = orderID
    wsM.Cells(nextRowM, 3).Value = custID
    wsM.Cells(nextRowM, 4).Value = custName
    wsM.Cells(nextRowM, 5).Value = itemType
    wsM.Cells(nextRowM, 6).Value = ws.Range("B11").Value
    wsM.Cells(nextRowM, 7).Value = ws.Range("A31").Value        ' Length
    wsM.Cells(nextRowM, 8).Value = ws.Range("B31").Value        ' Chest
    wsM.Cells(nextRowM, 9).Value = ws.Range("C31").Value        ' Gap
    wsM.Cells(nextRowM, 10).Value = ws.Range("D31").Value       ' Waist
    wsM.Cells(nextRowM, 11).Value = ws.Range("E31").Value       ' Hips
    wsM.Cells(nextRowM, 12).Value = ws.Range("F31").Value       ' Shoulder
    wsM.Cells(nextRowM, 13).Value = ws.Range("G31").Value       ' Sleeve
    wsM.Cells(nextRowM, 14).Value = ws.Range("H31").Value       ' Bicep
    wsM.Cells(nextRowM, 16).Value = ws.Range("I31").Value       ' Collar
    wsM.Cells(nextRowM, 30).Value = ws.Range("J31").Value       ' Notes
    wsM.Cells(nextRowM, 32).Value = Now

    ws.Range("D34").Value = "Saved: " & orderID
    ws.Range("E34").Value = Now

    Application.ScreenUpdating = True
    MsgBox "Saved " & orderID, vbInformation, "Success"

    Call ClearOrderAndMeasurements

End Sub

Private Sub ClearOrderAndMeasurements()
    Dim ws As Worksheet: Set ws = ThisWorkbook.Worksheets("Entry Form")
    Application.EnableEvents = False
    ws.Range("E20").ClearContents
    ws.Range("E21").ClearContents
    ws.Range("B23").ClearContents
    ws.Range("B24").ClearContents
    ws.Range("E22").Value = 1
    ws.Range("E23").Value = 0
    ws.Range("E25").Value = 0
    ws.Range("A31:J31").ClearContents
    Application.EnableEvents = True

End Sub

Public Sub ResetTailorForm()
    Dim ws As Worksheet: Set ws = ThisWorkbook.Worksheets("Entry Form")
    Application.EnableEvents = False
    ws.Range("B5").Value = "New"
    ws.Range("B12").Value = "Walk-in"
    ws.Range("E5").ClearContents       ' Customer picker
    ws.Range("B7:B16").ClearContents   ' Customer typeable fields
    ws.Range("B22").Value = "Kurta Pajama"
    ws.Range("B23:B24").ClearContents
    ws.Range("B25").Value = "Booked"
    ws.Range("B26").Value = "Normal"
    ws.Range("B27").Value = "Master Tailor"
    ws.Range("E20:E21").ClearContents
    ws.Range("E22").Value = 1
    ws.Range("E23").Value = 0
    ws.Range("E25").Value = 0
    ws.Range("A31:J31").ClearContents
    ws.Range("D34:E34").ClearContents
    Application.EnableEvents = True

End Sub