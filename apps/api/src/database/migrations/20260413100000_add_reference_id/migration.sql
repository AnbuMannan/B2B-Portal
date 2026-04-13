-- Add referenceId column to LeadCreditTransaction (used for idempotency on spend operations)
ALTER TABLE "LeadCreditTransaction"
  ADD COLUMN IF NOT EXISTS "referenceId" TEXT;

-- Unique index (partial — only enforced when referenceId is set)
CREATE UNIQUE INDEX IF NOT EXISTS "LeadCreditTransaction_referenceId_key"
  ON "LeadCreditTransaction"("referenceId")
  WHERE "referenceId" IS NOT NULL;
