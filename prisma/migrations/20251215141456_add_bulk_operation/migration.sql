/*
  Warnings:

  - You are about to drop the `Post` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_authorId_fkey";

-- DropTable
DROP TABLE "Post";

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "BulkOperation" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "objectCount" INTEGER NOT NULL DEFAULT 0,
    "fileSize" TEXT,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BulkOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "currencyCode" TEXT NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "subtotalPrice" DOUBLE PRECISION NOT NULL,
    "totalTax" DOUBLE PRECISION NOT NULL,
    "financialStatus" TEXT,
    "fulfillmentStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "LineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "vendor" TEXT,
    "productType" TEXT,
    "status" TEXT NOT NULL,
    "totalInventory" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "images" JSONB,
    "briefeinheit" TEXT,
    "mainCategory" TEXT,
    "mainType" TEXT,
    "supplierSku" TEXT,
    "releasedAt" TEXT,
    "englishCardName" TEXT,
    "frenchCardName" TEXT,
    "germanCardName" TEXT,
    "lastSync" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "price" DECIMAL(65,30) NOT NULL,
    "compareAtPrice" DECIMAL(65,30),
    "inventoryQuantity" INTEGER NOT NULL DEFAULT 0,
    "cost" DECIMAL(65,30),
    "condition" TEXT,
    "finish" TEXT,
    "eurPrice" DECIMAL(65,30),
    "usdPrice" DECIMAL(65,30),
    "eurFoilPrice" DECIMAL(65,30),
    "usdFoilPrice" DECIMAL(65,30),
    "usdEtchedPrice" DECIMAL(65,30),
    "discountQty2" TEXT,
    "discountQty3" TEXT,
    "discountQty4" TEXT,
    "discountQty5" TEXT,
    "discountQty6" TEXT,
    "discountQty7" TEXT,
    "discountQty8" TEXT,
    "discountQty9" TEXT,
    "discountQty10" TEXT,
    "innerMaterial" TEXT,
    "outerMaterial" TEXT,
    "binderClosure" TEXT,
    "sleeveCount" INTEGER,
    "sleeveFinish" TEXT,
    "sleeveSize" TEXT,
    "productColor" TEXT,
    "productSize" TEXT,
    "productSizeDimensions" TEXT,
    "compartmentsPerPage" INTEGER,
    "capacityDoubleSleeved" INTEGER,
    "capacitySingleSleeved" INTEGER,
    "scryfallId" TEXT,
    "scryfallOracleId" TEXT,
    "mkmid" TEXT,
    "tcgid" TEXT,
    "cardmarketId" TEXT,
    "set" TEXT,
    "setCode" TEXT,
    "cardNumber" TEXT,
    "rarity" TEXT,
    "artist" TEXT,
    "language" TEXT,
    "cardColor" TEXT,
    "colorIdentity" TEXT,
    "producedMana" TEXT,
    "keywords" TEXT,
    "toughness" TEXT,
    "power" TEXT,
    "convertedManaCost" TEXT,
    "mainTypeVariant" TEXT,
    "subType" TEXT,
    "cardFrame" TEXT,
    "relatedProducts" JSONB,
    "complementaryProducts" JSONB,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_updatedAt_idx" ON "Product"("updatedAt");

-- CreateIndex
CREATE INDEX "Product_productType_idx" ON "Product"("productType");

-- CreateIndex
CREATE INDEX "ProductVariant_sku_idx" ON "ProductVariant"("sku");

-- CreateIndex
CREATE INDEX "ProductVariant_scryfallId_idx" ON "ProductVariant"("scryfallId");

-- CreateIndex
CREATE INDEX "ProductVariant_mkmid_idx" ON "ProductVariant"("mkmid");

-- AddForeignKey
ALTER TABLE "LineItem" ADD CONSTRAINT "LineItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
