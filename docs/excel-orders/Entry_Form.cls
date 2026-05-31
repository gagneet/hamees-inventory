VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "Sheet3"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = True

Option Explicit

Private Sub Worksheet_Change(ByVal Target As Range)
    On Error GoTo SafeExit

    ' Watch Total Amount B14, Amount Paid B15, Balance B16
    If Intersect(Target, Me.Range("B14:B16")) Is Nothing Then Exit Sub

    Application.EnableEvents = False
    UpdatePaymentStatus

SafeExit:
    Application.EnableEvents = True
    
End Sub

Public Sub UpdatePaymentStatus()
    Dim totalAmount As Double
    Dim balanceAmount As Double
    Dim paymentStatus As String

    totalAmount = GetNumericValue(Me.Range("B14").Value)
    balanceAmount = GetNumericValue(Me.Range("B16").Value)

    If totalAmount <= 0 Then
        paymentStatus = ""
    ElseIf balanceAmount < 0 Then
        paymentStatus = "Refunded"
    ElseIf balanceAmount = 0 Then
        paymentStatus = "Paid"
    ElseIf balanceAmount = totalAmount Then
        paymentStatus = "Unpaid"
    ElseIf balanceAmount > 0 And balanceAmount < totalAmount Then
        paymentStatus = "Part Paid"
    ElseIf balanceAmount > totalAmount Then
        ' This should not normally happen, but avoids wrong classification
        paymentStatus = "Unpaid"
    Else
        paymentStatus = ""
    End If

    Me.Range("B13").Value = paymentStatus
    
End Sub

Private Function GetNumericValue(ByVal v As Variant) As Double
    If IsError(v) Or IsEmpty(v) Or Trim(CStr(v)) = "" Then
        GetNumericValue = 0
        Exit Function
    End If

    If IsNumeric(v) Then
        GetNumericValue = CDbl(v)
        Exit Function
    End If

    ' Handles values like ₹1,500, Rs 1,500, $1,500 or 1,500.00.
    Dim txt As String
    txt = CStr(v)
    txt = Replace(txt, "₹", "")
    txt = Replace(txt, "Rs.", "", , , vbTextCompare)
    txt = Replace(txt, "Rs", "", , , vbTextCompare)
    txt = Replace(txt, "$", "")
    txt = Replace(txt, ",", "")
    txt = Replace(txt, " ", "")

    If IsNumeric(txt) Then
        GetNumericValue = CDbl(txt)
    Else
        GetNumericValue = 0
    End If

End Function
