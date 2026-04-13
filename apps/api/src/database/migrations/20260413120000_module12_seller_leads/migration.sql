-- Module 12: Seller Buy Lead Access & Contact Reveal Analytics
-- Adds: categoryId on BuyLead, convertedToOrder on LeadContactReveal, SellerSavedLead

-- ─── 1. BuyLead: add category FK for smart matching ─────────────────────────
ALTER TABLE "BuyLead" ADD COLUMN "categoryId" TEXT;

CREATE INDEX "BuyLead_categoryId_isOpen_expiryDate_idx"
  ON "BuyLead"("categoryId", "isOpen", "expiryDate");

ALTER TABLE "BuyLead"
  ADD CONSTRAINT "BuyLead_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── 2. LeadContactReveal: add conversion tracking ──────────────────────────
ALTER TABLE "LeadContactReveal"
  ADD COLUMN "convertedToOrder" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "convertedAt"      TIMESTAMP(3);

CREATE INDEX "LeadContactReveal_sellerId_convertedToOrder_idx"
  ON "LeadContactReveal"("sellerId", "convertedToOrder");

-- ─── 3. SellerSavedLead: seller watchlist (no credit cost) ──────────────────
CREATE TABLE "SellerSavedLead" (
    "id"       TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "leadId"   TEXT NOT NULL,
    "savedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerSavedLead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SellerSavedLead_sellerId_leadId_key"
  ON "SellerSavedLead"("sellerId", "leadId");

CREATE INDEX "SellerSavedLead_sellerId_savedAt_idx"
  ON "SellerSavedLead"("sellerId", "savedAt" DESC);

ALTER TABLE "SellerSavedLead"
  ADD CONSTRAINT "SellerSavedLead_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "Seller"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SellerSavedLead"
  ADD CONSTRAINT "SellerSavedLead_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "BuyLead"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
