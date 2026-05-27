Option Explicit

' =====================================================================
'  HELPER: Indian phone number normalizer
' =====================================================================
Public Function NormalizeIndianPhone(ByVal v As String) As String
    Dim s As String: s = Trim(v)
    If s = "" Then NormalizeIndianPhone = "": Exit Function
    s = Replace(Replace(Replace(Replace(s, " ", ""), "-", ""), "(", ""), ")", "")
    If Left(s, 1) = "+" Then NormalizeIndianPhone = s: Exit Function
    If Len(s) = 10 And IsAllDigits(s) Then NormalizeIndianPhone = "+91" & s: Exit Function
    If Len(s) = 12 And Left(s, 2) = "91" And IsAllDigits(s) Then NormalizeIndianPhone = "+" & s: Exit Function
    If Len(s) = 11 And Left(s, 1) = "0" And IsAllDigits(s) Then NormalizeIndianPhone = "+91" & Mid(s, 2): Exit Function
    NormalizeIndianPhone = s
    
End Function

Private Function IsAllDigits(s As String) As Boolean
    Dim i As Long
    For i = 1 To Len(s)
        If Not (Mid(s, i, 1) Like "[0-9]") Then IsAllDigits = False: Exit Function
    Next i
    IsAllDigits = True

End Function

' =====================================================================
'  HELPER: Which measurements are required per item type
' =====================================================================
Public Function RequiredMeasurements(itemType As String) As String
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

Public Function MeasurementCell(label As String) As String
    Select Case label
        Case "Length":     MeasurementCell = "A31"
        Case "Chest":      MeasurementCell = "B31"
        Case "Gap":        MeasurementCell = "C31"
        Case "Waist":      MeasurementCell = "D31"
        Case "Hips":       MeasurementCell = "E31"
        Case "Shoulder":   MeasurementCell = "F31"
        Case "Sleeve":     MeasurementCell = "G31"
        Case "Bicep":      MeasurementCell = "H31"
        Case "Collar":     MeasurementCell = "I31"
        Case "Elbow":      MeasurementCell = "J31"
        Case "Cuff":       MeasurementCell = "A33"
        Case "Armhole":    MeasurementCell = "B33"
        Case "CrossChest": MeasurementCell = "C33"
        Case "FrontLen":   MeasurementCell = "D33"
        Case "BackLen":    MeasurementCell = "E33"
        Case "PantWaist":  MeasurementCell = "F33"
        Case "Inseam":     MeasurementCell = "G33"
        Case "Outseam":    MeasurementCell = "H33"
        Case "Thigh":      MeasurementCell = "I33"
        Case "Knee":       MeasurementCell = "J33"
        Case "Mohri":      MeasurementCell = "A35"
        Case "Seat":       MeasurementCell = "B35"
        Case "Rise":       MeasurementCell = "C35"
    End Select

End Function

' =====================================================================
'  LOAD existing customer's data from Customers sheet into Entry Form B7:B16
'  Called from the Entry Form Worksheet_Change handler when E5 changes.
' =====================================================================
Public Sub LoadExistingCustomer()
    Dim ws As Worksheet: Set ws = ThisWorkbook.Worksheets("Entry Form")
    Dim wsC As Worksheet: Set wsC = ThisWorkbook.Worksheets("Customers")

    Application.EnableEvents = False
    Application.ScreenUpdating = False

    Dim custID As String: custID = Trim(CStr(ws.Range("B6").Value))
    If custID = "" Then GoTo CleanExit

    Dim r As Range: Set r = wsC.Range("A:A").Find(What:=custID, LookAt:=xlWhole)
    If r Is Nothing Then GoTo CleanExit

    Dim row As Long: row = r.row
    ws.Range("B7").Value = wsC.Cells(row, 2).Value            ' Name
    ws.Range("B8").NumberFormat = "@"
    ws.Range("B8").Value = CStr(wsC.Cells(row, 3).Value)      ' Mobile
    ws.Range("B9").Value = wsC.Cells(row, 5).Value            ' WhatsApp
    ws.Range("B10").Value = wsC.Cells(row, 6).Value           ' Address
    ws.Range("B11").Value = wsC.Cells(row, 8).Value           ' Fit
    ws.Range("B12").Value = ""                                ' Source (blank for existing)
    ws.Range("B13").Value = wsC.Cells(row, 7).Value           ' City
    ws.Range("B14").NumberFormat = "@"
    ws.Range("B14").Value = CStr(wsC.Cells(row, 4).Value)     ' Alt Phone
    ws.Range("B15").Value = wsC.Cells(row, 9).Value           ' Notes
    ws.Range("B16").Value = wsC.Cells(row, 11).Value          ' Active

CleanExit:
    Application.EnableEvents = True
    Application.ScreenUpdating = True

End Sub

' =====================================================================
'  Clear customer fields (used when Mode switches to New)
' =====================================================================
Public Sub ClearCustomerFields()
    Dim ws As Worksheet: Set ws = ThisWorkbook.Worksheets("Entry Form")
    Application.EnableEvents = False
    ws.Range("B7").Value = ""
    ws.Range("B8").Value = ""
    ws.Range("B9").Value = "Yes"
    ws.Range("B10").Value = ""
    ws.Range("B11").Value = "Regular"
    ws.Range("B12").Value = "Walk-in"
    ws.Range("B13").Value = ""
    ws.Range("B14").Value = ""
    ws.Range("B15").Value = ""
    ws.Range("B16").Value = "Yes"
    ws.Range("E5").ClearContents
    Application.EnableEvents = True

End Sub

' =====================================================================
'  SUBMIT — validates and saves to Customers, Orders, Measurements
' =====================================================================
Public Sub SubmitTailorOrder()
    Dim ws As Worksheet: Set ws = ThisWorkbook.Worksheets("Entry Form")
    Dim wsC As Worksheet: Set wsC = ThisWorkbook.Worksheets("Customers")
    Dim wsO As Worksheet: Set wsO = ThisWorkbook.Worksheets("Orders")
    Dim wsM As Worksheet: Set wsM = ThisWorkbook.Worksheets("Measurements")

    Dim errs As String: errs = ""
    Dim mode As String: mode = Trim(CStr(ws.Range("B5").Value))
    Dim custID As String: custID = Trim(CStr(ws.Range("B6").Value))
    Dim custName As String: custName = Trim(CStr(ws.Range("B7").Value))
    Dim mobile As String: mobile = NormalizeIndianPhone(CStr(ws.Range("B8").Value))
    Dim altPhone As String: altPhone = NormalizeIndianPhone(CStr(ws.Range("B14").Value))
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
        errs = errs & vbCrLf & "• Qty must be > 0"
    End If

    Dim req As String: req = RequiredMeasurements(itemType)
    Dim labels() As String: labels = Split(req, ",")
    Dim i As Long, addr As String
    For i = LBound(labels) To UBound(labels)
        addr = MeasurementCell(labels(i))
        If addr <> "" Then
            If Trim(CStr(ws.Range(addr).Value)) = "" Then
                errs = errs & vbCrLf & "• Measurement '" & labels(i) & "' (" & addr & ") required for " & itemType
            End If
        End If
    Next i

    If errs <> "" Then
        MsgBox "Please fix before submitting:" & vbCrLf & errs, vbExclamation, "Validation failed"
        Exit Sub
    End If

    Application.ScreenUpdating = False
    Application.EnableEvents = False

    Dim orderID As String: orderID = ws.Range("B19").Value
    Dim orderNo As Long: orderNo = CLng(ws.Range("B20").Value)
    Dim lineNo As Long: lineNo = CLng(ws.Range("B21").Value)
    Dim nextRowC As Long, nextRowO As Long, nextRowM As Long

    ' 1) New customer
    If mode = "New" Then
        nextRowC = wsC.Cells(wsC.Rows.Count, "A").End(xlUp).row + 1
        If nextRowC < 5 Then nextRowC = 5
        wsC.Cells(nextRowC, 1).Value = custID
        wsC.Cells(nextRowC, 2).Value = custName
        wsC.Cells(nextRowC, 3).NumberFormat = "@"
        wsC.Cells(nextRowC, 3).Value = mobile
        wsC.Cells(nextRowC, 4).NumberFormat = "@"
        wsC.Cells(nextRowC, 4).Value = altPhone
        wsC.Cells(nextRowC, 5).Value = ws.Range("B9").Value
        wsC.Cells(nextRowC, 6).Value = ws.Range("B10").Value
        wsC.Cells(nextRowC, 7).Value = ws.Range("B13").Value
        wsC.Cells(nextRowC, 8).Value = ws.Range("B11").Value
        wsC.Cells(nextRowC, 9).Value = ws.Range("B15").Value
        wsC.Cells(nextRowC, 10).Value = Date
        wsC.Cells(nextRowC, 11).Value = ws.Range("B16").Value
    End If

    ' 2) Order
    nextRowO = wsO.Cells(wsO.Rows.Count, "A").End(xlUp).row + 1
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
    wsO.Cells(nextRowO, 21).Value = ws.Range("B25").Value

    ' 3) Measurements
    nextRowM = wsM.Cells(wsM.Rows.Count, "A").End(xlUp).row + 1
    If nextRowM < 5 Then nextRowM = 5
    wsM.Cells(nextRowM, 1).Value = "MEAS-" & Format(nextRowM - 4, "0000")
    wsM.Cells(nextRowM, 2).Value = orderID
    wsM.Cells(nextRowM, 3).Value = custID
    wsM.Cells(nextRowM, 4).Value = custName
    wsM.Cells(nextRowM, 5).Value = itemType
    wsM.Cells(nextRowM, 6).Value = ws.Range("B11").Value
    wsM.Cells(nextRowM, 7).Value = ws.Range("A31").Value
    wsM.Cells(nextRowM, 8).Value = ws.Range("B31").Value
    wsM.Cells(nextRowM, 9).Value = ws.Range("C31").Value
    wsM.Cells(nextRowM, 10).Value = ws.Range("D31").Value
    wsM.Cells(nextRowM, 11).Value = ws.Range("E31").Value
    wsM.Cells(nextRowM, 12).Value = ws.Range("F31").Value
    wsM.Cells(nextRowM, 13).Value = ws.Range("G31").Value
    wsM.Cells(nextRowM, 14).Value = ws.Range("H31").Value
    wsM.Cells(nextRowM, 15).Value = ws.Range("J31").Value
    wsM.Cells(nextRowM, 16).Value = ws.Range("I31").Value
    wsM.Cells(nextRowM, 17).Value = ws.Range("A33").Value
    wsM.Cells(nextRowM, 18).Value = ws.Range("B33").Value
    wsM.Cells(nextRowM, 19).Value = ws.Range("C33").Value
    wsM.Cells(nextRowM, 20).Value = ws.Range("D33").Value
    wsM.Cells(nextRowM, 21).Value = ws.Range("E33").Value
    wsM.Cells(nextRowM, 22).Value = ws.Range("F33").Value
    wsM.Cells(nextRowM, 23).Value = ws.Range("G33").Value
    wsM.Cells(nextRowM, 24).Value = ws.Range("H33").Value
    wsM.Cells(nextRowM, 25).Value = ws.Range("I33").Value
    wsM.Cells(nextRowM, 26).Value = ws.Range("J33").Value
    wsM.Cells(nextRowM, 27).Value = ws.Range("A35").Value
    wsM.Cells(nextRowM, 28).Value = ws.Range("B35").Value
    wsM.Cells(nextRowM, 29).Value = ws.Range("C35").Value
    wsM.Cells(nextRowM, 30).Value = ws.Range("D35").Value
    wsM.Cells(nextRowM, 31).Value = ws.Range("H35").Value
    wsM.Cells(nextRowM, 32).Value = Now

    ws.Range("D38").Value = "Saved: " & orderID
    ws.Range("E38").Value = Now

    Application.EnableEvents = True
    Application.ScreenUpdating = True
    MsgBox "Saved " & orderID, vbInformation, "Success"

    ' Clear order + measurement fields, keep customer loaded
    ws.Range("E20:E21").ClearContents
    ws.Range("B23:B24").ClearContents
    ws.Range("E22").Value = 1
    ws.Range("E23").Value = 0
    ws.Range("E25").Value = 0
    ws.Range("A31:J31").ClearContents
    ws.Range("A33:J33").ClearContents
    ws.Range("A35:J35").ClearContents

End Sub

' =====================================================================
'  RESET — full form clear
' =====================================================================
Public Sub ResetTailorForm()
    Dim ws As Worksheet: Set ws = ThisWorkbook.Worksheets("Entry Form")
    Application.EnableEvents = False
    ws.Range("B5").Value = "New"
    Call ClearCustomerFields
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