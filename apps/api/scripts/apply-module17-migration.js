/**
 * Applies the Module 17 (Quote Management) migration directly via
 * $executeRawUnsafe. Same pattern as Modules 14–16.
 */

const { PrismaClient } = require('@prisma/client');

const STATEMENTS = [
  `DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NegotiationRole') THEN
       CREATE TYPE "NegotiationRole" AS ENUM ('BUYER', 'SELLER');
     END IF;
   END
   $$;`,

  `ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "buyLeadId" TEXT`,

  `DO $$
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
   $$;`,

  `CREATE INDEX IF NOT EXISTS "Quote_buyLeadId_status_idx"
     ON "Quote"("buyLeadId", "status")`,

  `CREATE TABLE IF NOT EXISTS "NegotiationMessage" (
     "id"           TEXT NOT NULL,
     "quoteId"      TEXT NOT NULL,
     "fromRole"     "NegotiationRole" NOT NULL,
     "counterPrice" DECIMAL(18, 2),
     "message"      TEXT NOT NULL,
     "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "NegotiationMessage_pkey" PRIMARY KEY ("id")
   )`,

  `DO $$
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
   $$;`,

  `CREATE INDEX IF NOT EXISTS "NegotiationMessage_quoteId_createdAt_idx"
     ON "NegotiationMessage"("quoteId", "createdAt" DESC)`,
];

async function main() {
  const prisma = new PrismaClient();
  try {
    for (const sql of STATEMENTS) {
      console.log(`▶ ${sql.split('\n')[0].trim().slice(0, 80)}…`);
      await prisma.$executeRawUnsafe(sql);
    }
    console.log('\n✅ Module 17 migration applied successfully.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
