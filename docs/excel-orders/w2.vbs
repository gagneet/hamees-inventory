Option Explicit

' === Required field config ===
' Length is required for ALL items. For specific items, more measurements required.
Private Function RequiredMeasurements(itemType As String) As String
    Dim s As String
    s = "Length"  ' baseline
    Select Case itemType
        Case "Shirt", "Kurta", "Kurta Pajama", "Coat", "Blazer", "Sherwani", "Waistcoat"
            s = "Length,Chest,Shoulder,Sleeve"
        Case "Pajama", "Pant"
            s = "Length,Waist,Hips"
        Case "Alteration", "Other"
            s = "Length"
    End Select
    RequiredMeasurements = s

End Function

Private Function MeasurementCell(label As String) As String
    Select Case label
        Case "Length":   MeasurementCell = "A27"
        Case "Chest":    MeasurementCell = "B27"
        Case "Gap":      MeasurementCell = "C27"
        Case "Waist":    MeasurementCell = "D27"
        Case "Hips":     MeasurementCell = "E27"
        Case "Shoulder": MeasurementCell = "F27"
        Case "Sleeve":   MeasurementCell = "G27"
        Case "Bicep":    MeasurementCell = "H27"
        Case "Collar":   MeasurementCell = "I27"
    End Select

End Function

Public Sub SubmitTailorOrder()
    Dim ws As Worksheet: Set ws = ThisWorkbook.Worksheets("Entry Form")
    Dim wsC As Worksheet: Set wsC = ThisWorkbook.Worksheets("Customers")
    Dim wsO As Worksheet: Set wsO = ThisWorkbook.Worksheets("Orders")
    Dim wsM As Worksheet: Set wsM = ThisWorkbook.Worksheets("Measurements")

    Dim errs As String: errs = ""
    Dim mode As String: mode = Trim(CStr(ws.Range("B5").Value))
    Dim custID As String: custID = Trim(CStr(ws.Range("E6").Value))
    Dim custName As String: custName = Trim(CStr(ws.Range("B6").Value))
    Dim mobile As Variant: mobile = ws.Range("B8").Value
    Dim source As String: source = Trim(CStr(ws.Range("B12").Value))
    Dim itemType As String: itemType = Trim(CStr(ws.Range("B21").Value))
    Dim colour As String: colour = Trim(CStr(ws.Range("B22").Value))
    Dim fabric As String: fabric = Trim(CStr(ws.Range("B23").Value))
    Dim bookDate As Variant: bookDate = ws.Range("B18").Value
    Dim delivDate As Variant: delivDate = ws.Range("B20").Value
    Dim qty As Variant: qty = ws.Range("E15").Value
    Dim rate As Variant: rate = ws.Range("E16").Value
    Dim advance As Variant: advance = ws.Range("E18").Value

    ' ===== Validation =====
    ' Customer
    If custName = "" Then errs = errs & vbCrLf & "• Customer Name (B6) is required"
    If custID = "" Then errs = errs & vbCrLf & "• Customer ID (E6) is missing — check Customer Mode"
    If Len(CStr(mobile)) < 6 Then errs = errs & vbCrLf & "• Mobile (B8) is required (min 6 digits)"
    If mode = "New" Then
        Dim validSources As Variant
        validSources = Array("Walk-in", "WhatsApp", "Phone", "Referral", "Other")
        Dim ok As Boolean: ok = False
        Dim v As Variant
        For Each v In validSources
            If source = v Then ok = True: Exit For
        Next v
        If Not ok Then errs = errs & vbCrLf & "• Source (B12) must be one of: Walk-in / WhatsApp / Phone / Referral / Other"
    End If

    ' Order
    If itemType = "" Then errs = errs & vbCrLf & "• Item Type (B21) is required"
    If colour = "" Then errs = errs & vbCrLf & "• Colour (B22) is required"
    If fabric = "" Then errs = errs & vbCrLf & "• Fabric/Material (B23) is required"
    If Not IsDate(bookDate) Then errs = errs & vbCrLf & "• Booking Date (B18) is required"
    If Not IsDate(delivDate) Then errs = errs & vbCrLf & "• Delivery Date (B20) is required"
    If IsDate(bookDate) And IsDate(delivDate) Then
        If CDate(delivDate) < CDate(bookDate) Then errs = errs & vbCrLf & "• Delivery Date (B20) cannot be before Booking Date"
    End If
    If Not IsNumeric(qty) Then
        errs = errs & vbCrLf & "• Qty (E15) is required"
    ElseIf qty <= 0 Then
        errs = errs & vbCrLf & "• Qty (E15) must be greater than 0"
    End If
    If Not IsNumeric(advance) Then ws.Range("E18").Value = 0  ' default
    If IsNumeric(rate) Then
        If rate < 0 Then errs = errs & vbCrLf & "• Rate (E16) cannot be negative"
    End If

    ' Measurements (driven by item type)
    Dim req As String: req = RequiredMeasurements(itemType)
    Dim labels() As String: labels = Split(req, ",")
    Dim i As Long
    For i = LBound(labels) To UBound(labels)
        Dim cellAddr As String: cellAddr = MeasurementCell(labels(i))
        If cellAddr <> "" Then
            If Trim(CStr(ws.Range(cellAddr).Value)) = "" Then
                errs = errs & vbCrLf & "• Measurement '" & labels(i) & "' (" & cellAddr & ") is required for " & itemType
            End If
        End If
    Next i

    If errs <> "" Then
        MsgBox "Please fix the following before submitting:" & vbCrLf & errs, vbExclamation, "Validation failed"
        Exit Sub
    End If

    ' ===== Save =====
    Application.ScreenUpdating = False

    Dim nextRowC As Long, nextRowO As Long, nextRowM As Long
    Dim orderID As String: orderID = ws.Range("B15").Value
    Dim orderNo As Long: orderNo = CLng(ws.Range("B16").Value)
    Dim lineNo As Long: lineNo = CLng(ws.Range("B17").Value)

    ' 1) Customer (new only — existing edits are already in the lookup)
    If mode = "New" Then
        nextRowC = wsC.Cells(wsC.Rows.Count, "A").End(xlUp).Row + 1
        If nextRowC < 5 Then nextRowC = 5
        wsC.Cells(nextRowC, 1).Value = custID
        wsC.Cells(nextRowC, 2).Value = custName
        wsC.Cells(nextRowC, 3).Value = mobile
        wsC.Cells(nextRowC, 4).Value = ws.Range("E9").Value     ' Alt Phone
        wsC.Cells(nextRowC, 5).Value = ws.Range("B9").Value     ' WhatsApp
        wsC.Cells(nextRowC, 6).Value = ws.Range("B10").Value    ' Address
        wsC.Cells(nextRowC, 7).Value = ws.Range("E8").Value     ' City
        wsC.Cells(nextRowC, 8).Value = ws.Range("B11").Value    ' Fit
        wsC.Cells(nextRowC, 9).Value = ws.Range("E10").Value    ' Notes
        wsC.Cells(nextRowC, 10).Value = Date                    ' Created Date = TODAY
        wsC.Cells(nextRowC, 11).Value = ws.Range("E12").Value   ' Active
    End If

    ' 2) Order
    nextRowO = wsO.Cells(wsO.Rows.Count, "A").End(xlUp).Row + 1
    If nextRowO < 5 Then nextRowO = 5
    wsO.Cells(nextRowO, 1).Value = orderID
    wsO.Cells(nextRowO, 2).Value = orderNo
    wsO.Cells(nextRowO, 3).Value = lineNo
    wsO.Cells(nextRowO, 4).Value = custID
    wsO.Cells(nextRowO, 5).Value = custName
    wsO.Cells(nextRowO, 6).Value = mobile
    wsO.Cells(nextRowO, 7).Value = CDate(bookDate)
    wsO.Cells(nextRowO, 8).Value = IIf(IsDate(ws.Range("B19").Value), ws.Range("B19").Value, "")
    wsO.Cells(nextRowO, 9).Value = CDate(delivDate)
    wsO.Cells(nextRowO, 12).Value = itemType
    wsO.Cells(nextRowO, 13).Value = colour
    wsO.Cells(nextRowO, 14).Value = fabric
    wsO.Cells(nextRowO, 15).Value = qty
    wsO.Cells(nextRowO, 16).Value = rate
    wsO.Cells(nextRowO, 17).Value = ws.Range("E17").Value      ' Amount
    wsO.Cells(nextRowO, 18).Value = advance
    wsO.Cells(nextRowO, 19).Value = ws.Range("E19").Value      ' Balance = Amount - Advance
    wsO.Cells(nextRowO, 20).Value = ws.Range("E20").Value      ' Payment Status
    wsO.Cells(nextRowO, 21).Value = ws.Range("E21").Value      ' Status

    ' 3) Measurements
    nextRowM = wsM.Cells(wsM.Rows.Count, "A").End(xlUp).Row + 1
    If nextRowM < 5 Then nextRowM = 5
    wsM.Cells(nextRowM, 1).Value = "MEAS-" & Format(nextRowM - 4, "0000")
    wsM.Cells(nextRowM, 2).Value = orderID
    wsM.Cells(nextRowM, 3).Value = custID
    wsM.Cells(nextRowM, 4).Value = custName
    wsM.Cells(nextRowM, 5).Value = itemType
    wsM.Cells(nextRowM, 6).Value = ws.Range("B11").Value       ' Fit
    wsM.Cells(nextRowM, 7).Value = ws.Range("A27").Value       ' Length
    wsM.Cells(nextRowM, 8).Value = ws.Range("B27").Value       ' Chest
    wsM.Cells(nextRowM, 9).Value = ws.Range("C27").Value       ' Gap
    wsM.Cells(nextRowM, 10).Value = ws.Range("D27").Value      ' Waist
    wsM.Cells(nextRowM, 11).Value = ws.Range("E27").Value      ' Hips
    wsM.Cells(nextRowM, 12).Value = ws.Range("F27").Value      ' Shoulder
    wsM.Cells(nextRowM, 13).Value = ws.Range("G27").Value      ' Sleeve
    wsM.Cells(nextRowM, 14).Value = ws.Range("H27").Value      ' Bicep
    wsM.Cells(nextRowM, 16).Value = ws.Range("I27").Value      ' Collar/Neck
    wsM.Cells(nextRowM, 30).Value = ws.Range("J27").Value      ' Notes
    wsM.Cells(nextRowM, 32).Value = Now                        ' Last Updated

    ' 4) Feedback
    ws.Range("H5").Value = "Saved: " & orderID
    ws.Range("H6").Value = Now

    Application.ScreenUpdating = True

    MsgBox "Saved " & orderID & vbCrLf & _
           "Order No " & orderNo & ", Line " & lineNo, vbInformation, "Success"

    ' Auto-clear order & measurement fields for next entry (keeps customer loaded)
    Call ClearOrderAndMeasurements

End Sub

Private Sub ClearOrderAndMeasurements()
    Dim ws As Worksheet: Set ws = ThisWorkbook.Worksheets("Entry Form")
    Application.EnableEvents = False
    ws.Range("B19").ClearContents       ' Trial Date
    ws.Range("B20").ClearContents       ' Delivery Date
    ws.Range("B22").ClearContents       ' Colour
    ws.Range("B23").ClearContents       ' Fabric
    ws.Range("E15").Value = 1           ' Qty
    ws.Range("E16").Value = 0           ' Rate
    ws.Range("E18").Value = 0           ' Advance
    ws.Range("A27:J27").ClearContents   ' Measurements
    Application.EnableEvents = True

End Sub

Public Sub ResetTailorForm()
    Dim ws As Worksheet: Set ws = ThisWorkbook.Worksheets("Entry Form")
    Application.EnableEvents = False
    Application.ScreenUpdating = False

    ' Customer reset
    ws.Range("B5").Value = "New"
    ws.Range("B12").Value = "Walk-in"
    ws.Range("E7").ClearContents

    ' Restore lookup formulas (in case user typed over them)
    ws.Range("B6").Formula = "=IF($B$5=""Existing"",IFERROR(XLOOKUP($B$7,Customers!$A:$A,Customers!$B:$B,""""),""""),"""")"
    ws.Range("B8").Formula = "=IF($B$5=""Existing"",IFERROR(XLOOKUP($B$7,Customers!$A:$A,Customers!$C:$C,""""),""""),"""")"
    ws.Range("B9").Formula = "=IF($B$5=""Existing"",IFERROR(XLOOKUP($B$7,Customers!$A:$A,Customers!$E:$E,""Yes""),""Yes""),""Yes"")"
    ws.Range("B10").Formula = "=IF($B$5=""Existing"",IFERROR(XLOOKUP($B$7,Customers!$A:$A,Customers!$F:$F,""""),""""),"""")"
    ws.Range("B11").Formula = "=IF($B$5=""Existing"",IFERROR(XLOOKUP($B$7,Customers!$A:$A,Customers!$H:$H,""Regular""),""Regular""),""Regular"")"
    ws.Range("E8").Formula = "=IF($B$5=""Existing"",IFERROR(XLOOKUP($B$7,Customers!$A:$A,Customers!$G:$G,""""),""""),"""")"
    ws.Range("E9").Formula = "=IF($B$5=""Existing"",IFERROR(XLOOKUP($B$7,Customers!$A:$A,Customers!$D:$D,""""),""""),"""")"
    ws.Range("E10").Formula = "=IF($B$5=""Existing"",IFERROR(XLOOKUP($B$7,Customers!$A:$A,Customers!$I:$I,""""),""""),"""")"
    ws.Range("E11").Formula = "=IF($B$5=""Existing"",IFERROR(XLOOKUP($B$7,Customers!$A:$A,Customers!$J:$J,TODAY()),TODAY()),TODAY())"
    ws.Range("E12").Formula = "=IF($B$5=""Existing"",IFERROR(XLOOKUP($B$7,Customers!$A:$A,Customers!$K:$K,""Yes""),""Yes""),""Yes"")"

    ' Order reset
    ws.Range("B18").Formula = "=TODAY()"
    ws.Range("B19").ClearContents
    ws.Range("B20").ClearContents
    ws.Range("B21").Value = "Kurta Pajama"
    ws.Range("B22").ClearContents
    ws.Range("B23").ClearContents
    ws.Range("E15").Value = 1
    ws.Range("E16").Value = 0
    ws.Range("E18").Value = 0
    ws.Range("E21").Value = "Booked"
    ws.Range("E22").Value = "Normal"
    ws.Range("E23").Value = "Master Tailor"

    ' Measurements reset
    ws.Range("A27:J27").ClearContents

    ' Status reset
    ws.Range("H5").ClearContents
    ws.Range("H6").ClearContents

    Application.EnableEvents = True
    Application.ScreenUpdating = True
    
End Sub