-- Add GSTN IRP e-invoice fields to LeadCreditTransaction
ALTER TABLE "LeadCreditTransaction"
  ADD COLUMN IF NOT EXISTS "irn"       TEXT,
  ADD COLUMN IF NOT EXISTS "ackNo"     TEXT,
  ADD COLUMN IF NOT EXISTS "irpQrCode" TEXT;
