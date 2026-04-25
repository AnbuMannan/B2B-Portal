// Module 28: Admin Complaint Resolution — migration script
// Run from apps/api: node scripts/apply-module28-migration.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Applying Module 28 migration: complaint escalation fields...');

  // Add escalation columns to ComplaintTicket
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "ComplaintTicket"
      ADD COLUMN IF NOT EXISTS "escalatedAt"  TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS "escalatedTo"  TEXT,
      ADD COLUMN IF NOT EXISTS "escalatedBy"  TEXT;
  `);
  console.log('✓ Escalation columns added to ComplaintTicket');

  // Add isInternal flag to ComplaintTicketResponse
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "ComplaintTicketResponse"
      ADD COLUMN IF NOT EXISTS "isInternal" BOOLEAN NOT NULL DEFAULT false;
  `);
  console.log('✓ isInternal column added to ComplaintTicketResponse');

  // Index for escalated tickets
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ComplaintTicket_escalatedAt_idx" ON "ComplaintTicket"("escalatedAt");
  `);

  console.log('\nModule 28 migration completed successfully.');
}

main()
  .catch((err) => { console.error('Migration failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
