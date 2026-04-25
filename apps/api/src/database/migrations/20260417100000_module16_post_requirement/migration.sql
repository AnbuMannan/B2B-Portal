-- Module 16: Post Buy Requirement
-- Adds RequirementType + Currency enums and new optional fields on BuyLead

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RequirementType') THEN
    CREATE TYPE "RequirementType" AS ENUM ('RETAIL', 'WHOLESALE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Currency') THEN
    CREATE TYPE "Currency" AS ENUM ('INR', 'USD');
  END IF;
END
$$;

ALTER TABLE "BuyLead" ADD COLUMN IF NOT EXISTS "requirementType" "RequirementType";
ALTER TABLE "BuyLead" ADD COLUMN IF NOT EXISTS "currency" "Currency" NOT NULL DEFAULT 'INR';
ALTER TABLE "BuyLead" ADD COLUMN IF NOT EXISTS "deliveryState" TEXT;
ALTER TABLE "BuyLead" ADD COLUMN IF NOT EXISTS "additionalNotes" TEXT;
