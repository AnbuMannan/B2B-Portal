-- Module 15: Buyer Registration & Dashboard
-- Adds companyName to Buyer and introduces BuyerSavedSeller watchlist table.

ALTER TABLE "Buyer" ADD COLUMN IF NOT EXISTS "companyName" TEXT;

CREATE TABLE IF NOT EXISTS "BuyerSavedSeller" (
  "id"       TEXT NOT NULL,
  "buyerId"  TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "savedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BuyerSavedSeller_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BuyerSavedSeller_buyerId_sellerId_key"
  ON "BuyerSavedSeller"("buyerId", "sellerId");

CREATE INDEX IF NOT EXISTS "BuyerSavedSeller_buyerId_savedAt_idx"
  ON "BuyerSavedSeller"("buyerId", "savedAt" DESC);

ALTER TABLE "BuyerSavedSeller"
  ADD CONSTRAINT "BuyerSavedSeller_buyerId_fkey"
  FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
