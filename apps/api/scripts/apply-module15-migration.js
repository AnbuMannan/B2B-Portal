/**
 * Applies the Module 15 (Buyer Registration) migration directly via
 * $executeRawUnsafe. Needed because `prisma db push` is currently blocked
 * by a pre-existing unique-index conflict on the shared database.
 *
 * Idempotent: every statement uses IF NOT EXISTS / safe guards.
 */

const { PrismaClient } = require('@prisma/client');

const STATEMENTS = [
  `ALTER TABLE "Buyer" ADD COLUMN IF NOT EXISTS "companyName" TEXT`,
  `CREATE TABLE IF NOT EXISTS "BuyerSavedSeller" (
     "id"       TEXT NOT NULL,
     "buyerId"  TEXT NOT NULL,
     "sellerId" TEXT NOT NULL,
     "savedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "BuyerSavedSeller_pkey" PRIMARY KEY ("id")
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "BuyerSavedSeller_buyerId_sellerId_key"
     ON "BuyerSavedSeller"("buyerId", "sellerId")`,
  `CREATE INDEX IF NOT EXISTS "BuyerSavedSeller_buyerId_savedAt_idx"
     ON "BuyerSavedSeller"("buyerId", "savedAt" DESC)`,
];

// The foreign-key is added separately — CREATE TABLE IF NOT EXISTS can't
// re-check constraints when the table already exists.
const FK_STATEMENT = `
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'BuyerSavedSeller_buyerId_fkey'
        AND table_name = 'BuyerSavedSeller'
    ) THEN
      ALTER TABLE "BuyerSavedSeller"
        ADD CONSTRAINT "BuyerSavedSeller_buyerId_fkey"
        FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END
  $$;
`;

async function main() {
  const prisma = new PrismaClient();
  try {
    for (const sql of STATEMENTS) {
      console.log(`▶ ${sql.split('\n')[0].trim().slice(0, 80)}…`);
      await prisma.$executeRawUnsafe(sql);
    }
    console.log('▶ Ensuring BuyerSavedSeller → Buyer FK…');
    await prisma.$executeRawUnsafe(FK_STATEMENT);
    console.log('\n✅ Module 15 migration applied successfully.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
