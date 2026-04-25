/**
 * Applies Modules 18–20 schema changes:
 *   Module 18: razorpayOrderId on Order
 *   Module 19: BuyerSavedProduct table
 *   Module 20: ComplaintCategory enum, updated ComplaintTicket,
 *              ComplaintTicketResponse, GrievanceContact
 */

const { PrismaClient } = require('@prisma/client');

const STATEMENTS = [
  // ── Module 18: Order payment order ID ─────────────────────────────────────
  `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "razorpayOrderId" TEXT`,

  // ── Module 19: BuyerSavedProduct ──────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "BuyerSavedProduct" (
     "id"        TEXT      NOT NULL,
     "buyerId"   TEXT      NOT NULL,
     "productId" TEXT      NOT NULL,
     "savedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "BuyerSavedProduct_pkey" PRIMARY KEY ("id")
   )`,

  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE constraint_name = 'BuyerSavedProduct_buyerId_fkey'
     ) THEN
       ALTER TABLE "BuyerSavedProduct"
         ADD CONSTRAINT "BuyerSavedProduct_buyerId_fkey"
         FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE CASCADE;
     END IF;
   END $$;`,

  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE constraint_name = 'BuyerSavedProduct_productId_fkey'
     ) THEN
       ALTER TABLE "BuyerSavedProduct"
         ADD CONSTRAINT "BuyerSavedProduct_productId_fkey"
         FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE;
     END IF;
   END $$;`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "BuyerSavedProduct_buyerId_productId_key"
     ON "BuyerSavedProduct"("buyerId", "productId")`,

  `CREATE INDEX IF NOT EXISTS "BuyerSavedProduct_buyerId_savedAt_idx"
     ON "BuyerSavedProduct"("buyerId", "savedAt" DESC)`,

  // ── Module 20: ComplaintCategory enum ─────────────────────────────────────
  `DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ComplaintCategory') THEN
       CREATE TYPE "ComplaintCategory" AS ENUM (
         'FRAUD', 'PRODUCT_QUALITY', 'PAYMENT', 'DELIVERY', 'OTHER'
       );
     END IF;
   END $$;`,

  // Add new columns to ComplaintTicket
  `ALTER TABLE "ComplaintTicket"
     ADD COLUMN IF NOT EXISTS "category"    "ComplaintCategory" NOT NULL DEFAULT 'OTHER',
     ADD COLUMN IF NOT EXISTS "slaDeadline" TIMESTAMP(3),
     ADD COLUMN IF NOT EXISTS "slaBreach"   BOOLEAN NOT NULL DEFAULT FALSE,
     ADD COLUMN IF NOT EXISTS "adminNotes"  TEXT,
     ADD COLUMN IF NOT EXISTS "orderId"     TEXT`,

  `CREATE INDEX IF NOT EXISTS "ComplaintTicket_slaBreach_status_idx"
     ON "ComplaintTicket"("slaBreach", "status")`,

  // ── ComplaintTicketResponse ────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "ComplaintTicketResponse" (
     "id"          TEXT      NOT NULL,
     "ticketId"    TEXT      NOT NULL,
     "responderId" TEXT      NOT NULL,
     "message"     TEXT      NOT NULL,
     "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "ComplaintTicketResponse_pkey" PRIMARY KEY ("id")
   )`,

  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE constraint_name = 'ComplaintTicketResponse_ticketId_fkey'
     ) THEN
       ALTER TABLE "ComplaintTicketResponse"
         ADD CONSTRAINT "ComplaintTicketResponse_ticketId_fkey"
         FOREIGN KEY ("ticketId") REFERENCES "ComplaintTicket"("id") ON DELETE CASCADE;
     END IF;
   END $$;`,

  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE constraint_name = 'ComplaintTicketResponse_responderId_fkey'
     ) THEN
       ALTER TABLE "ComplaintTicketResponse"
         ADD CONSTRAINT "ComplaintTicketResponse_responderId_fkey"
         FOREIGN KEY ("responderId") REFERENCES "User"("id");
     END IF;
   END $$;`,

  `CREATE INDEX IF NOT EXISTS "ComplaintTicketResponse_ticketId_createdAt_idx"
     ON "ComplaintTicketResponse"("ticketId", "createdAt" DESC)`,

  // ── GrievanceContact ───────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "GrievanceContact" (
     "id"          TEXT      NOT NULL,
     "name"        TEXT      NOT NULL,
     "email"       TEXT      NOT NULL,
     "phone"       TEXT,
     "subject"     TEXT      NOT NULL,
     "description" TEXT      NOT NULL,
     "category"    TEXT      NOT NULL DEFAULT 'OTHER',
     "status"      TEXT      NOT NULL DEFAULT 'PENDING',
     "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "resolvedAt"  TIMESTAMP(3),
     CONSTRAINT "GrievanceContact_pkey" PRIMARY KEY ("id")
   )`,

  `CREATE INDEX IF NOT EXISTS "GrievanceContact_status_createdAt_idx"
     ON "GrievanceContact"("status", "createdAt" DESC)`,
];

async function main() {
  const prisma = new PrismaClient();
  try {
    for (const sql of STATEMENTS) {
      const preview = sql.replace(/\s+/g, ' ').trim().slice(0, 80);
      console.log(`▶ ${preview}…`);
      await prisma.$executeRawUnsafe(sql);
    }
    console.log('\n✅ Modules 18–20 migration applied successfully.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
