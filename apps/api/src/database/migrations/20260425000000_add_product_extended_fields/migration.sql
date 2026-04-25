-- AlterTable: add 12 new fields to Product for extended product catalogue
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "partModelNumber"       TEXT,
  ADD COLUMN IF NOT EXISTS "minimumOrderQuantity"  DECIMAL(18,4),
  ADD COLUMN IF NOT EXISTS "taxPercentage"         DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "tags"                  TEXT[]  NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "buyersPreferredFrom"   TEXT[]  NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "manufacturerName"      TEXT,
  ADD COLUMN IF NOT EXISTS "manufacturerCountry"   TEXT,
  ADD COLUMN IF NOT EXISTS "aboutManufacturer"     TEXT,
  ADD COLUMN IF NOT EXISTS "stockedInCountry"      TEXT,
  ADD COLUMN IF NOT EXISTS "stockedInQuantity"     DECIMAL(18,4),
  ADD COLUMN IF NOT EXISTS "stockedInType"         TEXT,
  ADD COLUMN IF NOT EXISTS "estimatedShippingDays" INTEGER;
