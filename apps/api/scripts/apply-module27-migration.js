// Module 27: DPDP Act Compliance & Privacy Controls — migration script
// Run from apps/api: node scripts/apply-module27-migration.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Applying Module 27 migration: DPDP Act compliance tables...');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ConsentRecord" (
      "id"          TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId"      TEXT NOT NULL REFERENCES "User"("id"),
      "consentType" TEXT NOT NULL,
      "version"     TEXT NOT NULL,
      "givenAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "ipAddress"   TEXT,
      "userAgent"   TEXT,
      "withdrawnAt" TIMESTAMPTZ
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ConsentRecord_userId_type_idx" ON "ConsentRecord"("userId","consentType");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ConsentRecord_userId_givenAt_idx" ON "ConsentRecord"("userId","givenAt" DESC);`);
  console.log('✓ ConsentRecord table');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DataExportRequest" (
      "id"          TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId"      TEXT NOT NULL REFERENCES "User"("id"),
      "status"      TEXT NOT NULL DEFAULT 'QUEUED',
      "fileUrl"     TEXT,
      "expiresAt"   TIMESTAMPTZ,
      "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "completedAt" TIMESTAMPTZ,
      "errorMsg"    TEXT
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DataExportRequest_userId_idx" ON "DataExportRequest"("userId","requestedAt" DESC);`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DataExportRequest_status_idx" ON "DataExportRequest"("status");`);
  console.log('✓ DataExportRequest table');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "GrievanceTicket" (
      "id"            TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      "name"          TEXT NOT NULL,
      "email"         TEXT NOT NULL,
      "phone"         TEXT,
      "subject"       TEXT NOT NULL,
      "description"   TEXT NOT NULL,
      "category"      TEXT NOT NULL DEFAULT 'OTHER',
      "userId"        TEXT,
      "status"        TEXT NOT NULL DEFAULT 'OPEN',
      "slaDeadline"   TIMESTAMPTZ NOT NULL,
      "slaBreach"     BOOLEAN NOT NULL DEFAULT false,
      "responseNotes" TEXT,
      "respondedAt"   TIMESTAMPTZ,
      "respondedBy"   TEXT,
      "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "GrievanceTicket_status_sla_idx" ON "GrievanceTicket"("status","slaDeadline");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "GrievanceTicket_email_idx" ON "GrievanceTicket"("email");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "GrievanceTicket_createdAt_idx" ON "GrievanceTicket"("createdAt" DESC);`);
  console.log('✓ GrievanceTicket table');

  console.log('\nModule 27 migration completed successfully.');
}

main()
  .catch((err) => { console.error('Migration failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
