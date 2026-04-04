-- DropIndex (replace index with unique constraint)
DROP INDEX IF EXISTS "ProductViewTracking_productId_idx";

-- CreateIndex (unique constraint)
CREATE UNIQUE INDEX "ProductViewTracking_productId_key" ON "ProductViewTracking"("productId");
