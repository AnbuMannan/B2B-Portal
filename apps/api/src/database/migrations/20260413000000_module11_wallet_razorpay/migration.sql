-- Module 11: Lead Credit Wallet & Razorpay Integration
-- Adds payment, GST, and invoice fields to LeadCreditTransaction

ALTER TABLE "LeadCreditTransaction"
  ADD COLUMN IF NOT EXISTS "credits"            INTEGER          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "baseAmount"         DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "gstAmount"          DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "totalAmount"        DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "packId"             TEXT,
  ADD COLUMN IF NOT EXISTS "razorpayOrderId"    TEXT,
  ADD COLUMN IF NOT EXISTS "razorpayPaymentId"  TEXT,
  ADD COLUMN IF NOT EXISTS "status"             TEXT             NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN IF NOT EXISTS "invoicePath"        TEXT,
  ADD COLUMN IF NOT EXISTS "invoiceNumber"      TEXT;

-- Idempotency: razorpayPaymentId must be unique when present
CREATE UNIQUE INDEX IF NOT EXISTS "LeadCreditTransaction_razorpayPaymentId_key"
  ON "LeadCreditTransaction"("razorpayPaymentId")
  WHERE "razorpayPaymentId" IS NOT NULL;

-- Performance indexes
CREATE INDEX IF NOT EXISTS "LeadCreditTransaction_razorpayOrderId_idx"
  ON "LeadCreditTransaction"("razorpayOrderId");

CREATE INDEX IF NOT EXISTS "LeadCreditTransaction_status_idx"
  ON "LeadCreditTransaction"("status");
