/*
  Warnings:

  - You are about to drop the column `set` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `setCode` on the `Product` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "set",
DROP COLUMN "setCode",
ADD COLUMN     "edition" TEXT,
ADD COLUMN     "editionSetCode" TEXT;

-- CreateTable
CREATE TABLE "FilterPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FilterPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeDataSealed" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "cardmarketUrl" TEXT,
    "lowestPrice" DECIMAL(65,30),
    "stockCount" INTEGER,
    "topListings" JSONB,
    "lastScrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapeDataSealed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeDataSealedHistory" (
    "id" TEXT NOT NULL,
    "scrapeDataId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "stockCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapeDataSealedHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScrapeDataSealed_productId_key" ON "ScrapeDataSealed"("productId");

-- CreateIndex
CREATE INDEX "ScrapeDataSealedHistory_date_idx" ON "ScrapeDataSealedHistory"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ScrapeDataSealedHistory_scrapeDataId_date_key" ON "ScrapeDataSealedHistory"("scrapeDataId", "date");

-- AddForeignKey
ALTER TABLE "ScrapeDataSealed" ADD CONSTRAINT "ScrapeDataSealed_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapeDataSealedHistory" ADD CONSTRAINT "ScrapeDataSealedHistory_scrapeDataId_fkey" FOREIGN KEY ("scrapeDataId") REFERENCES "ScrapeDataSealed"("id") ON DELETE CASCADE ON UPDATE CASCADE;
