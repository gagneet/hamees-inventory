' ============================================================
' Hamees Inventory — Excel VBA Module
' ============================================================
' Paste this code into the Excel VBA editor (Alt+F11 → Insert → Module)
' OR import it directly: File → Import File → excel-vba-module.bas
'
' SETUP:
'   1. Set HAMEES_API_URL to your server URL (e.g. https://hamees.gagneet.com)
'   2. Set HAMEES_API_KEY to the value of EXCEL_API_KEY in your server .env
'   3. Run TestConnection() first to verify the API is reachable
'
' USAGE:
'   - Fill in the "Entry Form" sheet
'   - Click "Submit Booking" (runs SubmitOrder macro)
'   - A message box confirms success with the order number
' ============================================================
Option Explicit

' ── Configuration ─────────────────────────────────────────────────────────────
Private Const HAMEES_API_URL  As String = "https://hamees.gagneet.com"  ' Change for local dev
Private Const HAMEES_API_KEY  As String = "PASTE_YOUR_EXCEL_API_KEY_HERE"

' ── Sheet and cell references ─────────────────────────────────────────────────
' Adjust these to match your sheet layout if cells are ever moved.
Private Const SHEET_FORM       As String = "Entry Form"
Private Const SHEET_CUSTOMERS  As String = "Customers"
Private Const SHEET_ORDERS     As String = "Orders"

' Customer section (column B, starting row 5)
Private Const ROW_CUST_MODE    As Integer = 5   ' B5: "New" or "Existing"
Private Const ROW_CUST_ID      As Integer = 6   ' B6: Existing Customer ID
Private Const ROW_CUST_NAME    As Integer = 7   ' B7: Customer Name
Private Const ROW_CUST_PHONE   As Integer = 8   ' B8: Mobile
Private Const ROW_CUST_WA      As Integer = 9   ' B9: WhatsApp
Private Const ROW_CUST_ADDR    As Integer = 10  ' B10: Address
Private Const ROW_CUST_FIT     As Integer = 11  ' B11: Preferred Fit
Private Const ROW_CUST_CITY    As Integer = 12  ' B12: City

' Order section (column E, starting row 5)
Private Const ROW_GARMENT      As Integer = 5   ' E5: Garment Type
Private Const ROW_FABRIC_NAME  As Integer = 6   ' E6: Fabric Name
Private Const ROW_FABRIC_COLOR As Integer = 7   ' E7: Fabric Colour
Private Const ROW_QTY          As Integer = 8   ' E8: Quantity
Private Const ROW_DELIVERY     As Integer = 9   ' E9: Delivery Date
Private Const ROW_TRIAL        As Integer = 10  ' E10: Trial Date
Private Const ROW_ADVANCE      As Integer = 11  ' E11: Advance Paid
Private Const ROW_PRIORITY     As Integer = 12  ' E12: Priority (Normal/Urgent)
Private Const ROW_NOTES        As Integer = 13  ' E13: Notes

' Measurement section (column H, starting row 5)
Private Const ROW_BODY_TYPE    As Integer = 5   ' H5: Body Type
Private Const ROW_CHEST        As Integer = 6
Private Const ROW_WAIST        As Integer = 7
Private Const ROW_HIP          As Integer = 8
Private Const ROW_SHOULDER     As Integer = 9
Private Const ROW_SLEEVE       As Integer = 10
Private Const ROW_NECK         As Integer = 11
Private Const ROW_SHIRT_LEN    As Integer = 12
Private Const ROW_BACK_LEN     As Integer = 13
Private Const ROW_JACKET_LEN   As Integer = 14
Private Const ROW_LAPEL        As Integer = 15
Private Const ROW_BICEP        As Integer = 16
Private Const ROW_ELBOW        As Integer = 17
Private Const ROW_ARM_CIRC     As Integer = 18
Private Const ROW_CUFF         As Integer = 19
Private Const ROW_CROSS_CHEST  As Integer = 20
Private Const ROW_INSEAM       As Integer = 21
Private Const ROW_OUTSEAM      As Integer = 22
Private Const ROW_RISE         As Integer = 23
Private Const ROW_SEAT         As Integer = 24
Private Const ROW_THIGH        As Integer = 25
Private Const ROW_KNEE         As Integer = 26
Private Const ROW_BOTTOM       As Integer = 27
Private Const ROW_M_NOTES      As Integer = 28  ' H28: Measurement notes

' Status output cell
Private Const ROW_STATUS       As Integer = 30  ' B30: Submit status message

' ── Helpers ───────────────────────────────────────────────────────────────────

Private Function SheetVal(sheet As String, row As Integer, col As String) As String
    On Error Resume Next
    SheetVal = Trim(CStr(ThisWorkbook.Sheets(sheet).Range(col & row).Value))
    On Error GoTo 0
End Function

Private Function NumVal(sheet As String, row As Integer, col As String) As String
    Dim v As Variant
    On Error Resume Next
    v = ThisWorkbook.Sheets(sheet).Range(col & row).Value
    On Error GoTo 0
    If IsEmpty(v) Or IsNull(v) Or v = "" Then
        NumVal = "null"
    Else
        NumVal = CStr(CDbl(v))
    End If
End Function

Private Function StrField(key As String, value As String) As String
    If value = "" Then
        StrField = """" & key & """: null"
    Else
        ' Escape backslashes and double-quotes
        Dim escaped As String
        escaped = Replace(value, "\", "\\")
        escaped = Replace(escaped, """", "\""")
        StrField = """" & key & """: """ & escaped & """"
    End If
End Function

Private Function NumField(key As String, value As String) As String
    NumField = """" & key & """: " & value
End Function

Private Sub SetStatus(msg As String)
    ThisWorkbook.Sheets(SHEET_FORM).Range("B" & ROW_STATUS).Value = msg
End Sub

' ── Main: Submit Order ────────────────────────────────────────────────────────

Public Sub SubmitOrder()
    ' Validate required fields
    Dim garment As String : garment = SheetVal(SHEET_FORM, ROW_GARMENT, "E")
    Dim custName As String : custName = SheetVal(SHEET_FORM, ROW_CUST_NAME, "B")
    Dim custPhone As String : custPhone = SheetVal(SHEET_FORM, ROW_CUST_PHONE, "B")
    Dim deliveryDate As String : deliveryDate = SheetVal(SHEET_FORM, ROW_DELIVERY, "E")

    If custName = "" Then MsgBox "Customer Name is required", vbExclamation : Exit Sub
    If custPhone = "" Then MsgBox "Customer Phone is required", vbExclamation : Exit Sub
    If garment = "" Then MsgBox "Garment Type is required", vbExclamation : Exit Sub
    If deliveryDate = "" Then MsgBox "Delivery Date is required", vbExclamation : Exit Sub

    SetStatus "Submitting..."

    ' ── Build JSON payload ────────────────────────────────────────
    Dim custMode As String : custMode = LCase(SheetVal(SHEET_FORM, ROW_CUST_MODE, "B"))
    If custMode <> "existing" Then custMode = "new"

    Dim custId As String : custId = SheetVal(SHEET_FORM, ROW_CUST_ID, "B")
    Dim advance As Double
    On Error Resume Next
    advance = CDbl(SheetVal(SHEET_FORM, ROW_ADVANCE, "E"))
    On Error GoTo 0

    Dim qty As Integer : qty = 1
    On Error Resume Next
    qty = CInt(SheetVal(SHEET_FORM, ROW_QTY, "E"))
    If qty < 1 Then qty = 1
    On Error GoTo 0

    Dim priority As String : priority = UCase(SheetVal(SHEET_FORM, ROW_PRIORITY, "E"))
    If priority <> "URGENT" Then priority = "NORMAL"

    ' Format delivery date as ISO string (YYYY-MM-DD)
    Dim delivDate As Date
    On Error GoTo BadDate
    delivDate = CDate(deliveryDate)
    deliveryDate = Format(delivDate, "YYYY-MM-DD") & "T00:00:00.000Z"
    On Error GoTo 0
    GoTo BuildJSON
BadDate:
    MsgBox "Invalid Delivery Date format. Use DD/MM/YYYY.", vbExclamation
    SetStatus "Error: Bad delivery date format"
    Exit Sub
BuildJSON:

    Dim json As String
    json = "{" & vbCrLf
    json = json & "  " & StrField("customerMode", custMode) & "," & vbCrLf
    If custId <> "" Then json = json & "  " & StrField("customerId", custId) & "," & vbCrLf
    json = json & "  " & StrField("customerName", custName) & "," & vbCrLf
    json = json & "  " & StrField("customerPhone", custPhone) & "," & vbCrLf
    json = json & "  " & StrField("customerWhatsApp", SheetVal(SHEET_FORM, ROW_CUST_WA, "B")) & "," & vbCrLf
    json = json & "  " & StrField("customerCity", SheetVal(SHEET_FORM, ROW_CUST_CITY, "B")) & "," & vbCrLf
    json = json & "  " & StrField("customerAddress", SheetVal(SHEET_FORM, ROW_CUST_ADDR, "B")) & "," & vbCrLf
    json = json & "  " & StrField("preferredFit", SheetVal(SHEET_FORM, ROW_CUST_FIT, "B")) & "," & vbCrLf
    json = json & "  " & StrField("garmentType", garment) & "," & vbCrLf
    json = json & "  " & StrField("fabricName", SheetVal(SHEET_FORM, ROW_FABRIC_NAME, "E")) & "," & vbCrLf
    json = json & "  " & StrField("fabricColor", SheetVal(SHEET_FORM, ROW_FABRIC_COLOR, "E")) & "," & vbCrLf
    json = json & "  " & NumField("quantity", CStr(qty)) & "," & vbCrLf
    json = json & "  " & StrField("deliveryDate", deliveryDate) & "," & vbCrLf
    json = json & "  " & NumField("advancePaid", CStr(advance)) & "," & vbCrLf
    json = json & "  " & StrField("priority", priority) & "," & vbCrLf
    json = json & "  " & StrField("notes", SheetVal(SHEET_FORM, ROW_NOTES, "E")) & "," & vbCrLf
    ' Measurements
    json = json & "  " & StrField("bodyType", SheetVal(SHEET_FORM, ROW_BODY_TYPE, "H")) & "," & vbCrLf
    json = json & "  " & NumField("chest", NumVal(SHEET_FORM, ROW_CHEST, "H")) & "," & vbCrLf
    json = json & "  " & NumField("waist", NumVal(SHEET_FORM, ROW_WAIST, "H")) & "," & vbCrLf
    json = json & "  " & NumField("hip", NumVal(SHEET_FORM, ROW_HIP, "H")) & "," & vbCrLf
    json = json & "  " & NumField("shoulder", NumVal(SHEET_FORM, ROW_SHOULDER, "H")) & "," & vbCrLf
    json = json & "  " & NumField("sleeveLength", NumVal(SHEET_FORM, ROW_SLEEVE, "H")) & "," & vbCrLf
    json = json & "  " & NumField("neck", NumVal(SHEET_FORM, ROW_NECK, "H")) & "," & vbCrLf
    json = json & "  " & NumField("shirtLength", NumVal(SHEET_FORM, ROW_SHIRT_LEN, "H")) & "," & vbCrLf
    json = json & "  " & NumField("backLength", NumVal(SHEET_FORM, ROW_BACK_LEN, "H")) & "," & vbCrLf
    json = json & "  " & NumField("jacketLength", NumVal(SHEET_FORM, ROW_JACKET_LEN, "H")) & "," & vbCrLf
    json = json & "  " & NumField("lapelWidth", NumVal(SHEET_FORM, ROW_LAPEL, "H")) & "," & vbCrLf
    json = json & "  " & NumField("bicep", NumVal(SHEET_FORM, ROW_BICEP, "H")) & "," & vbCrLf
    json = json & "  " & NumField("elbow", NumVal(SHEET_FORM, ROW_ELBOW, "H")) & "," & vbCrLf
    json = json & "  " & NumField("armCircumference", NumVal(SHEET_FORM, ROW_ARM_CIRC, "H")) & "," & vbCrLf
    json = json & "  " & NumField("cuff", NumVal(SHEET_FORM, ROW_CUFF, "H")) & "," & vbCrLf
    json = json & "  " & NumField("crossChest", NumVal(SHEET_FORM, ROW_CROSS_CHEST, "H")) & "," & vbCrLf
    json = json & "  " & NumField("inseam", NumVal(SHEET_FORM, ROW_INSEAM, "H")) & "," & vbCrLf
    json = json & "  " & NumField("outseam", NumVal(SHEET_FORM, ROW_OUTSEAM, "H")) & "," & vbCrLf
    json = json & "  " & NumField("rise", NumVal(SHEET_FORM, ROW_RISE, "H")) & "," & vbCrLf
    json = json & "  " & NumField("seat", NumVal(SHEET_FORM, ROW_SEAT, "H")) & "," & vbCrLf
    json = json & "  " & NumField("thigh", NumVal(SHEET_FORM, ROW_THIGH, "H")) & "," & vbCrLf
    json = json & "  " & NumField("knee", NumVal(SHEET_FORM, ROW_KNEE, "H")) & "," & vbCrLf
    json = json & "  " & NumField("bottomOpening", NumVal(SHEET_FORM, ROW_BOTTOM, "H")) & "," & vbCrLf
    json = json & "  " & StrField("measurementNotes", SheetVal(SHEET_FORM, ROW_M_NOTES, "H")) & vbCrLf
    json = json & "}"

    ' ── Send HTTP POST ────────────────────────────────────────────
    Dim http As Object
    Set http = CreateObject("MSXML2.XMLHTTP")
    http.Open "POST", HAMEES_API_URL & "/api/excel/submit-order", False
    http.setRequestHeader "Content-Type", "application/json"
    http.setRequestHeader "x-excel-api-key", HAMEES_API_KEY
    http.send json

    ' ── Handle response ───────────────────────────────────────────
    If http.Status = 201 Then
        ' Parse order number from response (simple string search)
        Dim resp As String : resp = http.responseText
        Dim orderNum As String
        Dim pos1 As Long : pos1 = InStr(resp, """orderNumber"":""")
        If pos1 > 0 Then
            Dim pos2 As Long : pos2 = InStr(pos1 + 16, resp, """")
            orderNum = Mid(resp, pos1 + 16, pos2 - pos1 - 16)
        Else
            orderNum = "—"
        End If

        SetStatus "✓ Order " & orderNum & " created — " & Now()
        MsgBox "✓ Order created successfully!" & vbCrLf & vbCrLf & _
               "Order Number: " & orderNum & vbCrLf & _
               "View it at: " & HAMEES_API_URL & "/orders", _
               vbInformation, "Hamees — Order Submitted"

        ' Optional: reset the form for next entry
        ' Call ResetForm

    ElseIf http.Status = 401 Then
        SetStatus "✗ Auth error — check HAMEES_API_KEY"
        MsgBox "Authentication failed. Update HAMEES_API_KEY in the VBA module.", vbCritical, "Hamees — Auth Error"

    ElseIf http.Status = 422 Then
        Dim errMsg As String
        errMsg = ExtractJsonField(http.responseText, "error")
        SetStatus "✗ Validation error: " & errMsg
        MsgBox "Could not create order:" & vbCrLf & errMsg, vbExclamation, "Hamees — Validation Error"

    Else
        SetStatus "✗ Server error " & http.Status & " — " & Now()
        MsgBox "Server returned HTTP " & http.Status & vbCrLf & _
               Left(http.responseText, 300), vbCritical, "Hamees — Server Error"
    End If

    Set http = Nothing
End Sub

' ── Reset form ────────────────────────────────────────────────────────────────

Public Sub ResetForm()
    Dim ws As Worksheet : Set ws = ThisWorkbook.Sheets(SHEET_FORM)
    ' Customer fields
    ws.Range("B5:B12").ClearContents
    ws.Range("B5").Value = "new"   ' default mode
    ' Order fields
    ws.Range("E5:E13").ClearContents
    ws.Range("E8").Value = 1       ' default qty
    ws.Range("E12").Value = "Normal"
    ' Measurement fields
    ws.Range("H5:H28").ClearContents
    ws.Range("H5").Value = "REGULAR"  ' default body type
    ' Status
    ws.Range("B" & ROW_STATUS).ClearContents
    ws.Range("B5").Select
End Sub

' ── Test connection ───────────────────────────────────────────────────────────

Public Sub TestConnection()
    Dim http As Object
    Set http = CreateObject("MSXML2.XMLHTTP")
    http.Open "GET", HAMEES_API_URL & "/api/excel/submit-order", False
    http.setRequestHeader "x-excel-api-key", HAMEES_API_KEY
    http.send

    If http.Status = 200 Then
        Dim resp As String : resp = http.responseText
        Dim patterns As String
        patterns = ExtractJsonField(resp, "garmentPatterns")
        MsgBox "✓ Connected to Hamees!" & vbCrLf & vbCrLf & _
               "Server: " & HAMEES_API_URL & vbCrLf & _
               "API Key: Valid", vbInformation, "Hamees — Connection OK"
    ElseIf http.Status = 401 Then
        MsgBox "✗ API Key is invalid." & vbCrLf & _
               "Update HAMEES_API_KEY in the VBA module (Alt+F11).", _
               vbCritical, "Hamees — Auth Error"
    Else
        MsgBox "✗ Could not connect." & vbCrLf & _
               "Status: " & http.Status & vbCrLf & _
               "URL: " & HAMEES_API_URL, vbCritical, "Hamees — Connection Failed"
    End If
    Set http = Nothing
End Sub

' ── Utility: extract a string value from a simple JSON response ───────────────

Private Function ExtractJsonField(json As String, field As String) As String
    Dim search As String : search = """" & field & """:"""
    Dim pos1 As Long : pos1 = InStr(json, search)
    If pos1 = 0 Then
        ExtractJsonField = ""
        Exit Function
    End If
    pos1 = pos1 + Len(search)
    Dim pos2 As Long : pos2 = InStr(pos1, json, """")
    ExtractJsonField = Mid(json, pos1, pos2 - pos1)
End Function
