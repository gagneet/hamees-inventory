-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'CLOSED');

-- CreateTable
CREATE TABLE "CustomerEnquiry" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "city" TEXT,
    "garmentType" TEXT NOT NULL,
    "fabricNotes" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "preferredDate" TIMESTAMP(3),
    "notes" TEXT,
    "status" "EnquiryStatus" NOT NULL DEFAULT 'NEW',
    "staffNotes" TEXT,
    "customerId" TEXT,
    "orderId" TEXT,
    "handledById" TEXT,
    "sourceIpHash" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "CustomerEnquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerEnquiry_orderId_key" ON "CustomerEnquiry"("orderId");

-- CreateIndex
CREATE INDEX "CustomerEnquiry_status_createdAt_idx" ON "CustomerEnquiry"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerEnquiry_phone_idx" ON "CustomerEnquiry"("phone");

-- CreateIndex
CREATE INDEX "CustomerEnquiry_createdAt_idx" ON "CustomerEnquiry"("createdAt");

-- AddForeignKey
ALTER TABLE "CustomerEnquiry" ADD CONSTRAINT "CustomerEnquiry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerEnquiry" ADD CONSTRAINT "CustomerEnquiry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerEnquiry" ADD CONSTRAINT "CustomerEnquiry_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

