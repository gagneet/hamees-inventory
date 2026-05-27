Option Explicit

Public Sub ResetTailorForm()
    Dim ws As Worksheet: Set ws = ThisWorkbook.Worksheets("Entry Form")
    Application.EnableEvents = False
    Application.ScreenUpdating = False

    ' Customer inputs (only the typeable cells — formulas stay put)
    ws.Range("B5").Value = "New"        ' Customer Mode
    ws.Range("B12").Value = "Walk-in"   ' Source
    ws.Range("E7").ClearContents        ' Customer picker

    ' Override cells (in case user typed over pre-fills — restore formulas)
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

    ' Order inputs
    ws.Range("B17").Value = 1           ' Line No
    ws.Range("B18").Formula = "=TODAY()"
    ws.Range("B19").ClearContents       ' Trial Date
    ws.Range("B20").ClearContents       ' Delivery Date
    ws.Range("B21").Value = "Kurta Pajama"
    ws.Range("B22").ClearContents       ' Colour
    ws.Range("B23").ClearContents       ' Fabric
    ws.Range("E15").Value = 1           ' Qty
    ws.Range("E16").Value = 0           ' Rate
    ws.Range("E18").Value = 0           ' Advance
    ws.Range("E21").Value = "Booked"
    ws.Range("E22").Value = "Normal"
    ws.Range("E23").Value = "Master Tailor"

    Application.EnableEvents = True
    Application.ScreenUpdating = True
    
End Sub

Public Sub SubmitTailorOrder()
    Dim ws As Worksheet: Set ws = ThisWorkbook.Worksheets("Entry Form")
    Dim wsC As Worksheet: Set wsC = ThisWorkbook.Worksheets("Customers")
    Dim wsO As Worksheet: Set wsO = ThisWorkbook.Worksheets("Orders")
    Dim custID As String, mode As String
    Dim nextRowC As Long, nextRowO As Long
    Dim wsM As Worksheet: Set wsM = ThisWorkbook.Worksheets("Measurements")
    Dim nextRowM As Long

    mode = ws.Range("B5").Value
    custID = ws.Range("E6").Value      ' Auto-ID (new or existing)

    ' --- 1. Append/update customer ---
    If mode = "New" Then
        nextRowC = wsC.Cells(wsC.Rows.Count, "A").End(xlUp).Row + 1
        If nextRowC < 5 Then nextRowC = 5
        wsC.Cells(nextRowC, 1).Value = custID
        wsC.Cells(nextRowC, 2).Value = ws.Range("B6").Value      ' Name
        wsC.Cells(nextRowC, 3).Value = ws.Range("B8").Value      ' Mobile
        wsC.Cells(nextRowC, 4).Value = ws.Range("E9").Value      ' Alt Phone
        wsC.Cells(nextRowC, 5).Value = ws.Range("B9").Value      ' WhatsApp
        wsC.Cells(nextRowC, 6).Value = ws.Range("B10").Value     ' Address
        wsC.Cells(nextRowC, 7).Value = ws.Range("E8").Value      ' City
        wsC.Cells(nextRowC, 8).Value = ws.Range("B11").Value     ' Fit
        wsC.Cells(nextRowC, 9).Value = ws.Range("E10").Value     ' Notes
        wsC.Cells(nextRowC, 10).Value = ws.Range("E11").Value    ' Created Date
        wsC.Cells(nextRowC, 11).Value = ws.Range("E12").Value    ' Active
    End If
    ' (For Existing mode, optionally update the customer row here if you want edits to persist)

    ' --- 2. Append order ---
    nextRowO = wsO.Cells(wsO.Rows.Count, "A").End(xlUp).Row + 1
    If nextRowO < 5 Then nextRowO = 5
    wsO.Cells(nextRowO, 1).Value = ws.Range("B15").Value         ' Order ID
    wsO.Cells(nextRowO, 2).Value = ws.Range("B16").Value         ' Order No
    wsO.Cells(nextRowO, 3).Value = ws.Range("B17").Value         ' Line No
    wsO.Cells(nextRowO, 4).Value = custID                        ' Customer ID
    wsO.Cells(nextRowO, 5).Value = ws.Range("B6").Value          ' Customer Name
    wsO.Cells(nextRowO, 6).Value = ws.Range("B8").Value          ' Mobile
    wsO.Cells(nextRowO, 7).Value = ws.Range("B18").Value         ' Booking Date
    wsO.Cells(nextRowO, 8).Value = ws.Range("B19").Value         ' Trial
    wsO.Cells(nextRowO, 9).Value = ws.Range("B20").Value         ' Delivery
    wsO.Cells(nextRowO, 12).Value = ws.Range("B21").Value        ' Item Type
    wsO.Cells(nextRowO, 13).Value = ws.Range("B22").Value        ' Colour
    wsO.Cells(nextRowO, 14).Value = ws.Range("B23").Value        ' Fabric
    wsO.Cells(nextRowO, 15).Value = ws.Range("E15").Value        ' Qty
    wsO.Cells(nextRowO, 16).Value = ws.Range("E16").Value        ' Rate
    wsO.Cells(nextRowO, 17).Value = ws.Range("E17").Value        ' Amount
    wsO.Cells(nextRowO, 18).Value = ws.Range("E18").Value        ' Advance
    wsO.Cells(nextRowO, 19).Value = ws.Range("E19").Value        ' Balance
    wsO.Cells(nextRowO, 20).Value = ws.Range("E20").Value        ' Payment Status
    wsO.Cells(nextRowO, 21).Value = ws.Range("E21").Value        ' Status

    ' --- 3. Append measurements ---
    nextRowM = wsM.Cells(wsM.Rows.Count, "A").End(xlUp).Row + 1
    If nextRowM < 5 Then nextRowM = 5
    wsM.Cells(nextRowM, 1).Value = "MEAS-" & Format(nextRowM - 4, "0000")  ' Measurement ID
    wsM.Cells(nextRowM, 2).Value = ws.Range("B15").Value     ' Order ID
    wsM.Cells(nextRowM, 3).Value = custID                    ' Customer ID
    wsM.Cells(nextRowM, 4).Value = ws.Range("B6").Value      ' Customer Name
    wsM.Cells(nextRowM, 5).Value = ws.Range("B21").Value     ' Item Type
    wsM.Cells(nextRowM, 6).Value = ws.Range("B11").Value     ' Fit
    wsM.Cells(nextRowM, 7).Value = ws.Range("A26").Value     ' Length
    wsM.Cells(nextRowM, 8).Value = ws.Range("B26").Value     ' Chest
    wsM.Cells(nextRowM, 9).Value = ws.Range("C26").Value     ' Gap
    wsM.Cells(nextRowM, 10).Value = ws.Range("D26").Value    ' Waist
    wsM.Cells(nextRowM, 11).Value = ws.Range("E26").Value    ' Hips
    wsM.Cells(nextRowM, 12).Value = ws.Range("F26").Value    ' Shoulder
    wsM.Cells(nextRowM, 13).Value = ws.Range("G26").Value    ' Sleeve
    wsM.Cells(nextRowM, 14).Value = ws.Range("H26").Value    ' Bicep
    wsM.Cells(nextRowM, 16).Value = ws.Range("I26").Value    ' Collar/Neck (col 16 per template)
    wsM.Cells(nextRowM, 30).Value = ws.Range("J26").Value    ' Notes (col 30 per template)
    wsM.Cells(nextRowM, 32).Value = Now                      ' Last Updated

    ' --- 4. Status feedback ---
    ws.Range("H5").Value = "Saved: " & ws.Range("B15").Value
    ws.Range("H6").Value = Now

    ' --- 5. Bump line/order number for next entry ---
    ws.Range("B17").Value = ws.Range("B17").Value + 1

    MsgBox "Saved " & ws.Range("B15").Value, vbInformation

End Sub