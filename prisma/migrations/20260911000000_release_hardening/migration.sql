-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'MASTER_TAILOR';

-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'India',
ADD COLUMN     "currencyCode" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN     "invoiceFooter" TEXT,
ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'en-IN',
ADD COLUMN     "maxActiveItemsPerTailor" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "phoneCountryCode" TEXT NOT NULL DEFAULT '91',
ADD COLUMN     "postalCodeLabel" TEXT NOT NULL DEFAULT 'Pincode',
ADD COLUMN     "tagline" TEXT,
ADD COLUMN     "tailorDailyTarget" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "taxIdLabel" TEXT NOT NULL DEFAULT 'GSTIN',
ADD COLUMN     "taxMode" TEXT NOT NULL DEFAULT 'SPLIT',
ADD COLUMN     "taxName" TEXT NOT NULL DEFAULT 'GST',
ADD COLUMN     "timeZone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
ADD COLUMN     "website" TEXT,
ALTER COLUMN "businessName" SET DEFAULT 'My Tailor Shop',
ALTER COLUMN "gstin" DROP NOT NULL,
ALTER COLUMN "state" DROP NOT NULL;

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Seed the singleton BusinessSettings row from the legacy key/value Settings table (idempotent).
-- The shop region ("state") is intentionally left NULL so tax stays intra-region until an admin sets it.
INSERT INTO "BusinessSettings" ("id", "businessName", "phone", "email", "address", "currencyCode", "updatedAt")
SELECT
  'default',
  COALESCE((SELECT "value" FROM "Settings" WHERE "key" = 'shop_name'), 'My Tailor Shop'),
  (SELECT "value" FROM "Settings" WHERE "key" = 'shop_phone'),
  (SELECT "value" FROM "Settings" WHERE "key" = 'shop_email'),
  (SELECT "value" FROM "Settings" WHERE "key" = 'shop_address'),
  COALESCE((SELECT "value" FROM "Settings" WHERE "key" = 'currency'), 'INR'),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM "BusinessSettings");

-- Reconcile drift on databases that were created with `prisma db push` before migrations existed.
CREATE INDEX IF NOT EXISTS "Order_stitchingTier_idx" ON "Order"("stitchingTier");
UPDATE "AccessoryInventory" SET "reserved" = 0 WHERE "reserved" IS NULL;
ALTER TABLE "AccessoryInventory" ALTER COLUMN "reserved" SET NOT NULL;
