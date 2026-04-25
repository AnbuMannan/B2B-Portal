// Migration: Module 25 — Buyer Fraud Management (BlockList table)
// Run: node apps/api/scripts/apply-module25-migration.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Applying Module 25 migration: BlockList table...');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "BlockList" (
      "id"          TEXT        NOT NULL,
      "email"       TEXT,
      "phoneNumber" TEXT,
      "ipAddress"   TEXT,
      "userId"      TEXT,
      "reason"      TEXT        NOT NULL,
      "blockedBy"   TEXT        NOT NULL,
      "blockedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "unblockedAt" TIMESTAMP(3),
      "isActive"    BOOLEAN     NOT NULL DEFAULT true,
      "notes"       TEXT,
      CONSTRAINT "BlockList_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "BlockList_email_idx" ON "BlockList"("email");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "BlockList_phoneNumber_idx" ON "BlockList"("phoneNumber");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "BlockList_userId_idx" ON "BlockList"("userId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "BlockList_isActive_blockedAt_idx" ON "BlockList"("isActive", "blockedAt" DESC);`);

  console.log('✓ BlockList table created');
  console.log('Migration complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
