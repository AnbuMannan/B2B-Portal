-- Module 14: Seller Profile & Settings
-- Adds logoUrl to Seller and eventPreferences (JSON) to NotificationPreferences

ALTER TABLE "Seller"
  ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;

ALTER TABLE "NotificationPreferences"
  ADD COLUMN IF NOT EXISTS "eventPreferences" JSONB;
