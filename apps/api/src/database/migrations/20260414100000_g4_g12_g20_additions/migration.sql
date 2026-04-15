-- Migration: G12 (2FA TOTP fields on User) + G5 (SearchLog CTR fields)
-- Generated: 2026-04-14

-- ── G12: Two-factor authentication fields ────────────────────────────────────
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "twoFaSecret"  TEXT,
  ADD COLUMN IF NOT EXISTS "twoFaEnabled" BOOLEAN NOT NULL DEFAULT false;

-- ── G5: Search CTR tracking fields on SearchLog ───────────────────────────────
ALTER TABLE "SearchLog"
  ADD COLUMN IF NOT EXISTS "clickedProductId" TEXT,
  ADD COLUMN IF NOT EXISTS "resultPosition"   INTEGER;
