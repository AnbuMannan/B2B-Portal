-- AlterTable
ALTER TABLE "Seller" ADD COLUMN     "businessOfficeAddress" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'India',
ADD COLUMN     "pincode" TEXT,
ADD COLUMN     "registeredOfficeAddress" TEXT,
ADD COLUMN     "state" TEXT;

-- CreateTable
CREATE TABLE "ProductViewTracking" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 1,
    "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductViewTracking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductViewTracking_productId_idx" ON "ProductViewTracking"("productId");

-- CreateIndex
CREATE INDEX "ProductViewTracking_lastViewedAt_idx" ON "ProductViewTracking"("lastViewedAt" DESC);

-- CreateIndex
CREATE INDEX "Seller_state_idx" ON "Seller"("state");

-- AddForeignKey
ALTER TABLE "ProductViewTracking" ADD CONSTRAINT "ProductViewTracking_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
