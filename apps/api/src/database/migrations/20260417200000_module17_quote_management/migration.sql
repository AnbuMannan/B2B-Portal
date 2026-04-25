-- Module 17: Quote Management (buyer side)
-- Adds Quote.buyLeadId + NegotiationMessage table

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NegotiationRole') THEN
    CREATE TYPE "NegotiationRole" AS ENUM ('BUYER', 'SELLER');
  END IF;
END
$$;

ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "buyLeadId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Quote_buyLeadId_fkey'
      AND table_name = 'Quote'
  ) THEN
    ALTER TABLE "Quote"
      ADD CONSTRAINT "Quote_buyLeadId_fkey"
      FOREIGN KEY ("buyLeadId") REFERENCES "BuyLead"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "Quote_buyLeadId_status_idx"
  ON "Quote"("buyLeadId", "status");

CREATE TABLE IF NOT EXISTS "NegotiationMessage" (
  "id"           TEXT NOT NULL,
  "quoteId"      TEXT NOT NULL,
  "fromRole"     "NegotiationRole" NOT NULL,
  "counterPrice" DECIMAL(18, 2),
  "message"      TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NegotiationMessage_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'NegotiationMessage_quoteId_fkey'
      AND table_name = 'NegotiationMessage'
  ) THEN
    ALTER TABLE "NegotiationMessage"
      ADD CONSTRAINT "NegotiationMessage_quoteId_fkey"
      FOREIGN KEY ("quoteId") REFERENCES "Quote"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "NegotiationMessage_quoteId_createdAt_idx"
  ON "NegotiationMessage"("quoteId", "createdAt" DESC);
