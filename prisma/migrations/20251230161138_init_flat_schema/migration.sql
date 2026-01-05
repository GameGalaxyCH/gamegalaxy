/*
  Warnings:

  - You are about to drop the column `totalInventory` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the `ProductVariant` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `price` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productId` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ProductVariant" DROP CONSTRAINT "ProductVariant_productId_fkey";

-- DropIndex
DROP INDEX "Product_productType_idx";

-- AlterTable
ALTER TABLE "BulkOperation" ADD COLUMN     "rootObjectCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "totalInventory",
ADD COLUMN     "artist" TEXT,
ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "binderClosure" TEXT,
ADD COLUMN     "capacityDoubleSleeved" INTEGER,
ADD COLUMN     "capacitySingleSleeved" INTEGER,
ADD COLUMN     "cardColor" TEXT,
ADD COLUMN     "cardFrame" TEXT,
ADD COLUMN     "cardNumber" TEXT,
ADD COLUMN     "cardmarketId" TEXT,
ADD COLUMN     "colorIdentity" TEXT,
ADD COLUMN     "compareAtPrice" DECIMAL(65,30),
ADD COLUMN     "compartmentsPerPage" INTEGER,
ADD COLUMN     "complementaryProducts" JSONB,
ADD COLUMN     "condition" TEXT,
ADD COLUMN     "convertedManaCost" TEXT,
ADD COLUMN     "cost" DECIMAL(65,30),
ADD COLUMN     "discountQty10" TEXT,
ADD COLUMN     "discountQty2" TEXT,
ADD COLUMN     "discountQty3" TEXT,
ADD COLUMN     "discountQty4" TEXT,
ADD COLUMN     "discountQty5" TEXT,
ADD COLUMN     "discountQty6" TEXT,
ADD COLUMN     "discountQty7" TEXT,
ADD COLUMN     "discountQty8" TEXT,
ADD COLUMN     "discountQty9" TEXT,
ADD COLUMN     "eurFoilPrice" DECIMAL(65,30),
ADD COLUMN     "eurPrice" DECIMAL(65,30),
ADD COLUMN     "finish" TEXT,
ADD COLUMN     "innerMaterial" TEXT,
ADD COLUMN     "inventoryQuantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "keywords" TEXT,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "mkmid" TEXT,
ADD COLUMN     "outerMaterial" TEXT,
ADD COLUMN     "power" TEXT,
ADD COLUMN     "price" DECIMAL(65,30) NOT NULL,
ADD COLUMN     "producedMana" TEXT,
ADD COLUMN     "productColor" TEXT,
ADD COLUMN     "productId" TEXT NOT NULL,
ADD COLUMN     "productSize" TEXT,
ADD COLUMN     "productSizeDimensions" TEXT,
ADD COLUMN     "rarity" TEXT,
ADD COLUMN     "relatedProducts" JSONB,
ADD COLUMN     "scryfallId" TEXT,
ADD COLUMN     "scryfallOracleId" TEXT,
ADD COLUMN     "set" TEXT,
ADD COLUMN     "setCode" TEXT,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "sleeveCount" INTEGER,
ADD COLUMN     "sleeveFinish" TEXT,
ADD COLUMN     "sleeveSize" TEXT,
ADD COLUMN     "subtype" TEXT,
ADD COLUMN     "tcgid" TEXT,
ADD COLUMN     "toughness" TEXT,
ADD COLUMN     "usdEtchedPrice" DECIMAL(65,30),
ADD COLUMN     "usdFoilPrice" DECIMAL(65,30),
ADD COLUMN     "usdPrice" DECIMAL(65,30),
ADD COLUMN     "variantTitle" TEXT;

-- DropTable
DROP TABLE "ProductVariant";

-- CreateIndex
CREATE INDEX "Product_productId_idx" ON "Product"("productId");

-- CreateIndex
CREATE INDEX "Product_sku_idx" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_scryfallId_idx" ON "Product"("scryfallId");

-- CreateIndex
CREATE INDEX "Product_mkmid_idx" ON "Product"("mkmid");
