/**
 * Applies the Module 16 (Post Buy Requirement) migration directly via
 * $executeRawUnsafe. Needed because `prisma db push` is blocked by a
 * pre-existing unique-index conflict on the shared database.
 *
 * Idempotent: every statement guards with IF NOT EXISTS or a DO block.
 */

const { PrismaClient } = require('@prisma/client');

const ENUM_STATEMENTS = [
  `DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RequirementType') THEN
       CREATE TYPE "RequirementType" AS ENUM ('RETAIL', 'WHOLESALE');
     END IF;
   END
   $$;`,
  `DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Currency') THEN
       CREATE TYPE "Currency" AS ENUM ('INR', 'USD');
     END IF;
   END
   $$;`,
];

const COLUMN_STATEMENTS = [
  `ALTER TABLE "BuyLead" ADD COLUMN IF NOT EXISTS "requirementType" "RequirementType"`,
  `ALTER TABLE "BuyLead" ADD COLUMN IF NOT EXISTS "currency" "Currency" NOT NULL DEFAULT 'INR'`,
  `ALTER TABLE "BuyLead" ADD COLUMN IF NOT EXISTS "deliveryState" TEXT`,
  `ALTER TABLE "BuyLead" ADD COLUMN IF NOT EXISTS "additionalNotes" TEXT`,
];

async function main() {
  const prisma = new PrismaClient();
  try {
    for (const sql of ENUM_STATEMENTS) {
      console.log('▶ Ensuring enum…');
      await prisma.$executeRawUnsafe(sql);
    }
    for (const sql of COLUMN_STATEMENTS) {
      console.log(`▶ ${sql.slice(0, 80)}…`);
      await prisma.$executeRawUnsafe(sql);
    }
    console.log('\n✅ Module 16 migration applied successfully.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
