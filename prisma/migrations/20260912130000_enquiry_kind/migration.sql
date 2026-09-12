-- A fitting request is the same conversation as an order enquiry with no garment decided yet,
-- so it shares CustomerEnquiry rather than duplicating the contact fields and abuse controls.

-- CreateEnum
CREATE TYPE "EnquiryKind" AS ENUM ('ORDER_ENQUIRY', 'FITTING');

-- AlterTable: existing rows are all order enquiries, which is the default
ALTER TABLE "CustomerEnquiry"
  ADD COLUMN "kind" "EnquiryKind" NOT NULL DEFAULT 'ORDER_ENQUIRY';

-- CreateIndex
CREATE INDEX "CustomerEnquiry_kind_status_createdAt_idx"
  ON "CustomerEnquiry"("kind", "status", "createdAt");
