-- Fix referenceId column to be nullable (DROP NOT NULL if previously added as NOT NULL)
ALTER TABLE "LeadCreditTransaction"
  ALTER COLUMN "referenceId" DROP NOT NULL;

-- Ensure the unique index exists (partial — only enforced when referenceId is set)
DROP INDEX IF EXISTS "LeadCreditTransaction_referenceId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "LeadCreditTransaction_referenceId_key"
  ON "LeadCreditTransaction"("referenceId")
  WHERE "referenceId" IS NOT NULL;
