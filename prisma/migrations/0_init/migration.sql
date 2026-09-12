-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'INVENTORY_MANAGER', 'SALES_MANAGER', 'TAILOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'MATERIAL_SELECTED', 'CUTTING', 'STITCHING', 'FINISHING', 'READY', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderPriority" AS ENUM ('NORMAL', 'URGENT');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('LOW_STOCK', 'CRITICAL_STOCK', 'ORDER_DELAYED', 'REORDER_REMINDER');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE', 'ORDER_RESERVED', 'ORDER_USED', 'ORDER_CANCELLED', 'ADJUSTMENT', 'RETURN', 'WASTAGE');

-- CreateEnum
CREATE TYPE "BodyType" AS ENUM ('SLIM', 'REGULAR', 'LARGE', 'XL');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('RENT', 'UTILITIES', 'SALARIES', 'TRANSPORT', 'MARKETING', 'MAINTENANCE', 'OFFICE_SUPPLIES', 'PROFESSIONAL_FEES', 'INSURANCE', 'DEPRECIATION', 'BANK_CHARGES', 'MISCELLANEOUS');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'NET_BANKING');

-- CreateEnum
CREATE TYPE "DesignFileCategory" AS ENUM ('SKETCH', 'REFERENCE', 'WORK_IN_PROGRESS', 'FINAL');

-- CreateEnum
CREATE TYPE "StitchingTier" AS ENUM ('BASIC', 'PREMIUM', 'LUXURY');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClothInventory" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "colorHex" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "quality" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "pricePerMeter" DOUBLE PRECISION NOT NULL,
    "currentStock" DOUBLE PRECISION NOT NULL,
    "totalPurchased" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reserved" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minimumStockMeters" DOUBLE PRECISION NOT NULL,
    "supplier" TEXT NOT NULL,
    "supplierId" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fabricComposition" TEXT,
    "gsm" DOUBLE PRECISION,
    "threadCount" INTEGER,
    "weaveType" TEXT,
    "fabricWidth" DOUBLE PRECISION,
    "shrinkagePercent" DOUBLE PRECISION,
    "colorFastness" TEXT,
    "seasonSuitability" TEXT[],
    "occasionType" TEXT[],
    "careInstructions" TEXT,
    "swatchImage" TEXT,
    "textureImage" TEXT,

    CONSTRAINT "ClothInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessoryInventory" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "color" TEXT,
    "currentStock" INTEGER NOT NULL,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "minimumStockUnits" INTEGER NOT NULL,
    "pricePerUnit" DOUBLE PRECISION NOT NULL,
    "supplier" TEXT,
    "supplierId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "colorCode" TEXT,
    "threadWeight" TEXT,
    "buttonSize" TEXT,
    "holePunchSize" INTEGER,
    "material" TEXT,
    "finish" TEXT,
    "recommendedFor" TEXT[],
    "styleCategory" TEXT,
    "productImage" TEXT,
    "closeUpImage" TEXT,

    CONSTRAINT "AccessoryInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "gstin" TEXT,
    "customerType" TEXT NOT NULL DEFAULT 'B2C',

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Measurement" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "userId" TEXT,
    "garmentType" TEXT NOT NULL,
    "bodyType" "BodyType",
    "neck" DOUBLE PRECISION,
    "chest" DOUBLE PRECISION,
    "waist" DOUBLE PRECISION,
    "hip" DOUBLE PRECISION,
    "shoulder" DOUBLE PRECISION,
    "sleeveLength" DOUBLE PRECISION,
    "shirtLength" DOUBLE PRECISION,
    "inseam" DOUBLE PRECISION,
    "outseam" DOUBLE PRECISION,
    "thigh" DOUBLE PRECISION,
    "knee" DOUBLE PRECISION,
    "bottomOpening" DOUBLE PRECISION,
    "jacketLength" DOUBLE PRECISION,
    "lapelWidth" DOUBLE PRECISION,
    "bicep" DOUBLE PRECISION,
    "cuff" DOUBLE PRECISION,
    "armCircumference" DOUBLE PRECISION,
    "crossChest" DOUBLE PRECISION,
    "backLength" DOUBLE PRECISION,
    "seat" DOUBLE PRECISION,
    "rise" DOUBLE PRECISION,
    "elbow" DOUBLE PRECISION,
    "additionalMeasurements" JSONB,
    "replacesId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Measurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GarmentPattern" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseMeters" DOUBLE PRECISION NOT NULL,
    "slimAdjustment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "regularAdjustment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "largeAdjustment" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "xlAdjustment" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "basicStitchingCharge" DOUBLE PRECISION NOT NULL DEFAULT 1500,
    "premiumStitchingCharge" DOUBLE PRECISION NOT NULL DEFAULT 3000,
    "luxuryStitchingCharge" DOUBLE PRECISION NOT NULL DEFAULT 5000,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GarmentPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GarmentAccessory" (
    "id" TEXT NOT NULL,
    "garmentPatternId" TEXT NOT NULL,
    "accessoryId" TEXT NOT NULL,
    "quantityPerGarment" INTEGER NOT NULL,

    CONSTRAINT "GarmentAccessory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "measurementId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'NEW',
    "priority" "OrderPriority" NOT NULL DEFAULT 'NORMAL',
    "deliveryDate" TIMESTAMP(3) NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedDate" TIMESTAMP(3),
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "advancePaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountReason" TEXT,
    "balanceAmount" DOUBLE PRECISION NOT NULL,
    "subTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cgst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sgst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "igst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxableAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "invoiceNumber" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "placeOfSupply" TEXT,
    "fabricCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fabricWastagePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fabricWastageAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "accessoriesCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stitchingCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stitchingTier" "StitchingTier" NOT NULL DEFAULT 'BASIC',
    "workmanshipPremiums" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "designerConsultationFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isHandStitched" BOOLEAN NOT NULL DEFAULT false,
    "handStitchingCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isFullCanvas" BOOLEAN NOT NULL DEFAULT false,
    "fullCanvasCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isRushOrder" BOOLEAN NOT NULL DEFAULT false,
    "rushOrderCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hasComplexDesign" BOOLEAN NOT NULL DEFAULT false,
    "complexDesignCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "additionalFittings" INTEGER NOT NULL DEFAULT 0,
    "additionalFittingsCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hasPremiumLining" BOOLEAN NOT NULL DEFAULT false,
    "premiumLiningCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isFabricCostOverridden" BOOLEAN NOT NULL DEFAULT false,
    "fabricCostOverride" DOUBLE PRECISION,
    "fabricCostOverrideReason" TEXT,
    "isStitchingCostOverridden" BOOLEAN NOT NULL DEFAULT false,
    "stitchingCostOverride" DOUBLE PRECISION,
    "stitchingCostOverrideReason" TEXT,
    "isAccessoriesCostOverridden" BOOLEAN NOT NULL DEFAULT false,
    "accessoriesCostOverride" DOUBLE PRECISION,
    "accessoriesCostOverrideReason" TEXT,
    "pricingNotes" TEXT,
    "notes" TEXT,
    "tailorNotes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "fieldName" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentInstallment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "installmentAmount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidDate" TIMESTAMP(3),
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentMode" "PaymentMode",
    "transactionRef" TEXT,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "garmentPatternId" TEXT NOT NULL,
    "clothInventoryId" TEXT NOT NULL,
    "measurementId" TEXT,
    "assignedTailorId" TEXT,
    "quantityOrdered" INTEGER NOT NULL DEFAULT 1,
    "bodyType" "BodyType" NOT NULL DEFAULT 'REGULAR',
    "estimatedMeters" DOUBLE PRECISION NOT NULL,
    "actualMetersUsed" DOUBLE PRECISION,
    "wastageMeters" DOUBLE PRECISION,
    "pricePerUnit" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "clothInventoryId" TEXT NOT NULL,
    "orderId" TEXT,
    "userId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantityMeters" DOUBLE PRECISION NOT NULL,
    "balanceAfterMeters" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessoryStockMovement" (
    "id" TEXT NOT NULL,
    "accessoryInventoryId" TEXT NOT NULL,
    "orderId" TEXT,
    "userId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantityUnits" INTEGER NOT NULL,
    "balanceAfterUnits" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessoryStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "gstin" TEXT,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPrice" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "clothInventoryId" TEXT NOT NULL,
    "pricePerMeter" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balanceAmount" DOUBLE PRECISION NOT NULL,
    "subTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cgst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sgst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "igst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isInputTaxCredit" BOOLEAN NOT NULL DEFAULT true,
    "itcClaimed" BOOLEAN NOT NULL DEFAULT false,
    "supplierInvoiceNumber" TEXT,
    "supplierInvoiceDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "POItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "orderedQuantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "pricePerUnit" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "receivedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "POItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "relatedId" TEXT,
    "relatedType" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "dismissedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "totalRecords" INTEGER NOT NULL,
    "successCount" INTEGER NOT NULL,
    "failureCount" INTEGER NOT NULL,
    "duplicateCount" INTEGER NOT NULL,
    "skippedCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "successDetails" JSONB,
    "failureDetails" JSONB,
    "duplicateDetails" JSONB,
    "summary" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "gstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vendorName" TEXT,
    "vendorGstin" TEXT,
    "invoiceNumber" TEXT,
    "paymentMode" "PaymentMode" NOT NULL DEFAULT 'CASH',
    "paidBy" TEXT NOT NULL,
    "tdsAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tdsRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringPeriod" TEXT,
    "notes" TEXT,
    "attachments" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessSettings" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "gstin" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "pincode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "fabricGstRate" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "garmentGstRate" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "fyStartMonth" INTEGER NOT NULL DEFAULT 4,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
    "invoiceCounter" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignUpload" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "category" "DesignFileCategory" NOT NULL DEFAULT 'SKETCH',
    "description" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "customerId" TEXT,
    "orderId" TEXT,
    "messageType" TEXT NOT NULL,
    "templateName" TEXT,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "content" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ClothInventory_sku_key" ON "ClothInventory"("sku");

-- CreateIndex
CREATE INDEX "ClothInventory_sku_idx" ON "ClothInventory"("sku");

-- CreateIndex
CREATE INDEX "ClothInventory_active_idx" ON "ClothInventory"("active");

-- CreateIndex
CREATE INDEX "ClothInventory_currentStock_idx" ON "ClothInventory"("currentStock");

-- CreateIndex
CREATE UNIQUE INDEX "AccessoryInventory_sku_key" ON "AccessoryInventory"("sku");

-- CreateIndex
CREATE INDEX "AccessoryInventory_active_idx" ON "AccessoryInventory"("active");

-- CreateIndex
CREATE INDEX "AccessoryInventory_sku_idx" ON "AccessoryInventory"("sku");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_active_idx" ON "Customer"("active");

-- CreateIndex
CREATE INDEX "Measurement_customerId_idx" ON "Measurement"("customerId");

-- CreateIndex
CREATE INDEX "Measurement_garmentType_idx" ON "Measurement"("garmentType");

-- CreateIndex
CREATE INDEX "Measurement_userId_idx" ON "Measurement"("userId");

-- CreateIndex
CREATE INDEX "Measurement_replacesId_idx" ON "Measurement"("replacesId");

-- CreateIndex
CREATE INDEX "Measurement_isActive_idx" ON "Measurement"("isActive");

-- CreateIndex
CREATE INDEX "GarmentPattern_active_idx" ON "GarmentPattern"("active");

-- CreateIndex
CREATE UNIQUE INDEX "GarmentAccessory_garmentPatternId_accessoryId_key" ON "GarmentAccessory"("garmentPatternId", "accessoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Order_invoiceNumber_key" ON "Order"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Order_orderNumber_idx" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_deliveryDate_idx" ON "Order"("deliveryDate");

-- CreateIndex
CREATE INDEX "Order_invoiceDate_idx" ON "Order"("invoiceDate");

-- CreateIndex
CREATE INDEX "OrderHistory_orderId_idx" ON "OrderHistory"("orderId");

-- CreateIndex
CREATE INDEX "OrderHistory_createdAt_idx" ON "OrderHistory"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentInstallment_orderId_idx" ON "PaymentInstallment"("orderId");

-- CreateIndex
CREATE INDEX "PaymentInstallment_dueDate_idx" ON "PaymentInstallment"("dueDate");

-- CreateIndex
CREATE INDEX "PaymentInstallment_status_idx" ON "PaymentInstallment"("status");

-- CreateIndex
CREATE INDEX "PaymentInstallment_paidDate_idx" ON "PaymentInstallment"("paidDate");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_measurementId_idx" ON "OrderItem"("measurementId");

-- CreateIndex
CREATE INDEX "OrderItem_assignedTailorId_idx" ON "OrderItem"("assignedTailorId");

-- CreateIndex
CREATE INDEX "StockMovement_clothInventoryId_idx" ON "StockMovement"("clothInventoryId");

-- CreateIndex
CREATE INDEX "StockMovement_orderId_idx" ON "StockMovement"("orderId");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- CreateIndex
CREATE INDEX "AccessoryStockMovement_accessoryInventoryId_idx" ON "AccessoryStockMovement"("accessoryInventoryId");

-- CreateIndex
CREATE INDEX "AccessoryStockMovement_orderId_idx" ON "AccessoryStockMovement"("orderId");

-- CreateIndex
CREATE INDEX "AccessoryStockMovement_createdAt_idx" ON "AccessoryStockMovement"("createdAt");

-- CreateIndex
CREATE INDEX "Supplier_active_idx" ON "Supplier"("active");

-- CreateIndex
CREATE INDEX "SupplierPrice_supplierId_idx" ON "SupplierPrice"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierPrice_clothInventoryId_idx" ON "SupplierPrice"("clothInventoryId");

-- CreateIndex
CREATE INDEX "SupplierPrice_effectiveFrom_idx" ON "SupplierPrice"("effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrder_poNumber_idx" ON "PurchaseOrder"("poNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- CreateIndex
CREATE INDEX "POItem_purchaseOrderId_idx" ON "POItem"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "Alert_isRead_idx" ON "Alert"("isRead");

-- CreateIndex
CREATE INDEX "Alert_isDismissed_idx" ON "Alert"("isDismissed");

-- CreateIndex
CREATE INDEX "Alert_dismissedUntil_idx" ON "Alert"("dismissedUntil");

-- CreateIndex
CREATE INDEX "Alert_createdAt_idx" ON "Alert"("createdAt");

-- CreateIndex
CREATE INDEX "Alert_severity_idx" ON "Alert"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "Alert_relatedId_relatedType_type_isDismissed_key" ON "Alert"("relatedId", "relatedType", "type", "isDismissed");

-- CreateIndex
CREATE UNIQUE INDEX "Settings_key_key" ON "Settings"("key");

-- CreateIndex
CREATE INDEX "Settings_key_idx" ON "Settings"("key");

-- CreateIndex
CREATE INDEX "UploadHistory_userId_idx" ON "UploadHistory"("userId");

-- CreateIndex
CREATE INDEX "UploadHistory_status_idx" ON "UploadHistory"("status");

-- CreateIndex
CREATE INDEX "UploadHistory_startedAt_idx" ON "UploadHistory"("startedAt");

-- CreateIndex
CREATE INDEX "Expense_category_idx" ON "Expense"("category");

-- CreateIndex
CREATE INDEX "Expense_expenseDate_idx" ON "Expense"("expenseDate");

-- CreateIndex
CREATE INDEX "Expense_paidBy_idx" ON "Expense"("paidBy");

-- CreateIndex
CREATE INDEX "Expense_createdAt_idx" ON "Expense"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessSettings_gstin_key" ON "BusinessSettings"("gstin");

-- CreateIndex
CREATE INDEX "BusinessSettings_gstin_idx" ON "BusinessSettings"("gstin");

-- CreateIndex
CREATE INDEX "DesignUpload_orderItemId_idx" ON "DesignUpload"("orderItemId");

-- CreateIndex
CREATE INDEX "DesignUpload_uploadedBy_idx" ON "DesignUpload"("uploadedBy");

-- CreateIndex
CREATE INDEX "DesignUpload_uploadedAt_idx" ON "DesignUpload"("uploadedAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_customerId_idx" ON "WhatsAppMessage"("customerId");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_orderId_idx" ON "WhatsAppMessage"("orderId");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_status_idx" ON "WhatsAppMessage"("status");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_createdAt_idx" ON "WhatsAppMessage"("createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_recipient_idx" ON "WhatsAppMessage"("recipient");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppTemplate_name_key" ON "WhatsAppTemplate"("name");

-- CreateIndex
CREATE INDEX "WhatsAppTemplate_name_idx" ON "WhatsAppTemplate"("name");

-- CreateIndex
CREATE INDEX "WhatsAppTemplate_active_idx" ON "WhatsAppTemplate"("active");

-- CreateIndex
CREATE INDEX "WhatsAppTemplate_category_idx" ON "WhatsAppTemplate"("category");

-- AddForeignKey
ALTER TABLE "ClothInventory" ADD CONSTRAINT "ClothInventory_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoryInventory" ADD CONSTRAINT "AccessoryInventory_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_replacesId_fkey" FOREIGN KEY ("replacesId") REFERENCES "Measurement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarmentAccessory" ADD CONSTRAINT "GarmentAccessory_garmentPatternId_fkey" FOREIGN KEY ("garmentPatternId") REFERENCES "GarmentPattern"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarmentAccessory" ADD CONSTRAINT "GarmentAccessory_accessoryId_fkey" FOREIGN KEY ("accessoryId") REFERENCES "AccessoryInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_measurementId_fkey" FOREIGN KEY ("measurementId") REFERENCES "Measurement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderHistory" ADD CONSTRAINT "OrderHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderHistory" ADD CONSTRAINT "OrderHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentInstallment" ADD CONSTRAINT "PaymentInstallment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_garmentPatternId_fkey" FOREIGN KEY ("garmentPatternId") REFERENCES "GarmentPattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_clothInventoryId_fkey" FOREIGN KEY ("clothInventoryId") REFERENCES "ClothInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_measurementId_fkey" FOREIGN KEY ("measurementId") REFERENCES "Measurement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_assignedTailorId_fkey" FOREIGN KEY ("assignedTailorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_clothInventoryId_fkey" FOREIGN KEY ("clothInventoryId") REFERENCES "ClothInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoryStockMovement" ADD CONSTRAINT "AccessoryStockMovement_accessoryInventoryId_fkey" FOREIGN KEY ("accessoryInventoryId") REFERENCES "AccessoryInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoryStockMovement" ADD CONSTRAINT "AccessoryStockMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoryStockMovement" ADD CONSTRAINT "AccessoryStockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPrice" ADD CONSTRAINT "SupplierPrice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPrice" ADD CONSTRAINT "SupplierPrice_clothInventoryId_fkey" FOREIGN KEY ("clothInventoryId") REFERENCES "ClothInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POItem" ADD CONSTRAINT "POItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadHistory" ADD CONSTRAINT "UploadHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paidBy_fkey" FOREIGN KEY ("paidBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignUpload" ADD CONSTRAINT "DesignUpload_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignUpload" ADD CONSTRAINT "DesignUpload_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

