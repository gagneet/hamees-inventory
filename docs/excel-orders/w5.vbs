Option Explicit

' === Required measurements per item type ===
' Length is always required.
Private Function RequiredMeasurements(itemType As String) As String
    Select Case itemType
        Case "Shirt", "Kurta", "Coat", "Blazer", "Sherwani", "Waistcoat"
            RequiredMeasurements = "Length,Chest,Shoulder,Sleeve,Cuff,Collar"
        Case "Kurta Pajama"
            RequiredMeasurements = "Length,Chest,Shoulder,Sleeve,Cuff,Collar,Waist,Hips,Inseam,Mohri"
        Case "Pajama", "Pant"
            RequiredMeasurements = "Length,Waist,Hips,Inseam,Mohri,Seat,Rise"
        Case Else
            RequiredMeasurements = "Length"
    End Select
End Function

' === Where each measurement lives on the Entry Form ===
Private Function MeasurementCell(label As String) As String
    Select Case label
        ' Row 31 (labels row 30)
        Case "Length":      MeasurementCell = "A31"
        Case "Chest":       MeasurementCell = "B31"
        Case "Gap":         MeasurementCell = "C31"
        Case "Waist":       MeasurementCell = "D31"
        Case "Hips":        MeasurementCell = "E31"
        Case "Shoulder":    MeasurementCell = "F31"
        Case "Sleeve":      MeasurementCell = "G31"
        Case "Bicep":       MeasurementCell = "H31"
        Case "Collar":      MeasurementCell = "I31"
        Case "Elbow":       MeasurementCell = "J31"
        ' Row 33 (labels row 32)
        Case "Cuff":        MeasurementCell = "A33"
        Case "Armhole":     MeasurementCell = "B33"
        Case "CrossChest":  MeasurementCell = "C33"
        Case "FrontLen":    MeasurementCell = "D33"
        Case "BackLen":     MeasurementCell = "E33"
        Case "PantWaist":   MeasurementCell = "F33"
        Case "Inseam":      MeasurementCell = "G33"
        Case "Outseam":     MeasurementCell = "H33"
        Case "Thigh":       MeasurementCell = "I33"
        Case "Knee":        MeasurementCell = "J33"
        ' Row 35 (labels row 34)
        Case "Mohri":       MeasurementCell = "A35"
        Case "Seat":        MeasurementCell = "B35"
        Case "Rise":        MeasurementCell = "C35"
        Case "MeasNotes":   MeasurementCell = "D35"
        Case "Sketch":      MeasurementCell = "H35"
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
    Dim mobile As String: mobile = Trim(CStr(ws.Range("B8").Value))
    Dim itemType As String: itemType = Trim(CStr(ws.Range("B22").Value))
    Dim colour As String: colour = Trim(CStr(ws.Range("B23").Value))
    Dim fabric As String: fabric = Trim(CStr(ws.Range("B24").Value))
    Dim bookDate As Variant: bookDate = ws.Range("E19").Value
    Dim delivDate As Variant: delivDate = ws.Range("E21").Value
    Dim qty As Variant: qty = ws.Range("E22").Value
    Dim rate As Variant: rate = ws.Range("E23").Value
    Dim advance As Variant: advance = ws.Range("E25").Value

    ' --- Validation ---
    If custName = "" Then errs = errs & vbCrLf & "• Customer Name (B7) is required"
    If custID = "" Then errs = errs & vbCrLf & "• Customer ID (B6) is missing"
    If Len(mobile) < 6 Then errs = errs & vbCrLf & "• Mobile (B8) is required"
    If itemType = "" Then errs = errs & vbCrLf & "• Item Type (B22) is required"
    If colour = "" Then errs = errs & vbCrLf & "• Colour (B23) is required"
    If fabric = "" Then errs = errs & vbCrLf & "• Fabric (B24) is required"
    If Not IsDate(bookDate) Then errs = errs & vbCrLf & "• Booking Date (E19) is required"
    If Not IsDate(delivDate) Then errs = errs & vbCrLf & "• Delivery Date (E21) is required"
    If IsDate(bookDate) And IsDate(delivDate) Then
        If CDate(delivDate) < CDate(bookDate) Then errs = errs & vbCrLf & "• Delivery Date cannot be before Booking Date"
    End If
    If Not IsNumeric(qty) Then
        errs = errs & vbCrLf & "• Qty (E22) is required"
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
                errs = errs & vbCrLf & "• Measurement '" & labels(i) & "' (" & addr & ") is required for " & itemType
            End If
        End If
    Next i

    If errs <> "" Then
        MsgBox "Please fix before submitting:" & vbCrLf & errs, vbExclamation, "Validation failed"
        Exit Sub
    End If

    ' --- Save ---
    Application.ScreenUpdating = False
    Dim orderID As String: orderID = ws.Range("B19").Value
    Dim orderNo As Long: orderNo = CLng(ws.Range("B20").Value)
    Dim lineNo As Long: lineNo = CLng(ws.Range("B21").Value)
    Dim nextRowC As Long, nextRowO As Long, nextRowM As Long

    ' 1) New customer append
    If mode = "New" Then
        nextRowC = wsC.Cells(wsC.Rows.Count, "A").End(xlUp).Row + 1
        If nextRowC < 5 Then nextRowC = 5
        wsC.Cells(nextRowC, 1).Value = custID
        wsC.Cells(nextRowC, 2).Value = custName
        wsC.Cells(nextRowC, 3).NumberFormat = "@"
        wsC.Cells(nextRowC, 3).Value = mobile
        wsC.Cells(nextRowC, 4).NumberFormat = "@"
        wsC.Cells(nextRowC, 4).Value = ws.Range("B14").Value     ' Alt Phone
        wsC.Cells(nextRowC, 5).Value = ws.Range("B9").Value      ' WhatsApp
        wsC.Cells(nextRowC, 6).Value = ws.Range("B10").Value     ' Address
        wsC.Cells(nextRowC, 7).Value = ws.Range("B13").Value     ' City
        wsC.Cells(nextRowC, 8).Value = ws.Range("B11").Value     ' Fit
        wsC.Cells(nextRowC, 9).Value = ws.Range("B15").Value     ' Notes
        wsC.Cells(nextRowC, 10).Value = Date
        wsC.Cells(nextRowC, 11).Value = ws.Range("B16").Value    ' Active
    End If

    ' 2) Order append
    nextRowO = wsO.Cells(wsO.Rows.Count, "A").End(xlUp).Row + 1
    If nextRowO < 5 Then nextRowO = 5
    wsO.Cells(nextRowO, 1).Value = orderID
    wsO.Cells(nextRowO, 2).Value = orderNo
    wsO.Cells(nextRowO, 3).Value = lineNo
    wsO.Cells(nextRowO, 4).Value = custID
    wsO.Cells(nextRowO, 5).Value = custName
    wsO.Cells(nextRowO, 6).NumberFormat = "@"
    wsO.Cells(nextRowO, 6).Value = mobile
    wsO.Cells(nextRowO, 7).Value = CDate(bookDate)
    If IsDate(ws.Range("E20").Value) Then wsO.Cells(nextRowO, 8).Value = ws.Range("E20").Value
    wsO.Cells(nextRowO, 9).Value = CDate(delivDate)
    wsO.Cells(nextRowO, 12).Value = itemType
    wsO.Cells(nextRowO, 13).Value = colour
    wsO.Cells(nextRowO, 14).Value = fabric
    wsO.Cells(nextRowO, 15).Value = qty
    wsO.Cells(nextRowO, 16).Value = rate
    wsO.Cells(nextRowO, 18).Value = advance
    wsO.Cells(nextRowO, 21).Value = ws.Range("B25").Value         ' Status

    ' 3) Measurements append — columns A-AF
    nextRowM = wsM.Cells(wsM.Rows.Count, "A").End(xlUp).Row + 1
    If nextRowM < 5 Then nextRowM = 5
    wsM.Cells(nextRowM, 1).Value = "MEAS-" & Format(nextRowM - 4, "0000")
    wsM.Cells(nextRowM, 2).Value = orderID
    wsM.Cells(nextRowM, 3).Value = custID
    wsM.Cells(nextRowM, 4).Value = custName
    wsM.Cells(nextRowM, 5).Value = itemType
    wsM.Cells(nextRowM, 6).Value = ws.Range("B11").Value          ' Fit
    ' Row 31 inputs → cols G..P
    wsM.Cells(nextRowM, 7).Value = ws.Range("A31").Value          ' Length
    wsM.Cells(nextRowM, 8).Value = ws.Range("B31").Value          ' Chest
    wsM.Cells(nextRowM, 9).Value = ws.Range("C31").Value          ' Gap
    wsM.Cells(nextRowM, 10).Value = ws.Range("D31").Value         ' Waist
    wsM.Cells(nextRowM, 11).Value = ws.Range("E31").Value         ' Hips
    wsM.Cells(nextRowM, 12).Value = ws.Range("F31").Value         ' Shoulder
    wsM.Cells(nextRowM, 13).Value = ws.Range("G31").Value         ' Sleeve
    wsM.Cells(nextRowM, 14).Value = ws.Range("H31").Value         ' Bicep
    wsM.Cells(nextRowM, 15).Value = ws.Range("J31").Value         ' Elbow
    wsM.Cells(nextRowM, 16).Value = ws.Range("I31").Value         ' Collar
    ' Row 33 inputs → cols Q..Z
    wsM.Cells(nextRowM, 17).Value = ws.Range("A33").Value         ' Cuff
    wsM.Cells(nextRowM, 18).Value = ws.Range("B33").Value         ' Armhole
    wsM.Cells(nextRowM, 19).Value = ws.Range("C33").Value         ' CrossChest
    wsM.Cells(nextRowM, 20).Value = ws.Range("D33").Value         ' FrontLen
    wsM.Cells(nextRowM, 21).Value = ws.Range("E33").Value         ' BackLen
    wsM.Cells(nextRowM, 22).Value = ws.Range("F33").Value         ' PantWaist
    wsM.Cells(nextRowM, 23).Value = ws.Range("G33").Value         ' Inseam
    wsM.Cells(nextRowM, 24).Value = ws.Range("H33").Value         ' Outseam
    wsM.Cells(nextRowM, 25).Value = ws.Range("I33").Value         ' Thigh
    wsM.Cells(nextRowM, 26).Value = ws.Range("J33").Value         ' Knee
    ' Row 35 inputs → cols AA..AE
    wsM.Cells(nextRowM, 27).Value = ws.Range("A35").Value         ' Mohri
    wsM.Cells(nextRowM, 28).Value = ws.Range("B35").Value         ' Seat
    wsM.Cells(nextRowM, 29).Value = ws.Range("C35").Value         ' Rise
    wsM.Cells(nextRowM, 30).Value = ws.Range("D35").Value         ' Notes (merged D:G)
    wsM.Cells(nextRowM, 31).Value = ws.Range("H35").Value         ' Sketch (merged H:J)
    wsM.Cells(nextRowM, 32).Value = Now                           ' Last Updated

    ws.Range("D38").Value = "Saved: " & orderID
    ws.Range("E38").Value = Now

    Application.ScreenUpdating = True
    MsgBox "Saved " & orderID, vbInformation, "Success"

    Call ClearOrderAndMeasurements
End Sub

Private Sub ClearOrderAndMeasurements()
    Dim ws As Worksheet: Set ws = ThisWorkbook.Worksheets("Entry Form")
    Application.EnableEvents = False
    ws.Range("E20:E21").ClearContents
    ws.Range("B23:B24").ClearContents
    ws.Range("E22").Value = 1
    ws.Range("E23").Value = 0
    ws.Range("E25").Value = 0
    ws.Range("A31:J31").ClearContents
    ws.Range("A33:J33").ClearContents
    ws.Range("A35:J35").ClearContents
    Application.EnableEvents = True
End Sub

Public Sub ResetTailorForm()
    Dim ws As Worksheet: Set ws = ThisWorkbook.Worksheets("Entry Form")
    Application.EnableEvents = False
    ws.Range("B5").Value = "New"
    ws.Range("B12").Value = "Walk-in"
    ws.Range("E5").ClearContents
    ws.Range("B7:B11").ClearContents
    ws.Range("B13:B16").ClearContents
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
    ws.Range("A33:J33").ClearContents
    ws.Range("A35:J35").ClearContents
    ws.Range("D38:E38").ClearContents
    Application.EnableEvents = True
End Sub