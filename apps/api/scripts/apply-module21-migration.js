// Migration: Module 21 — Admin Role Management
// Run: node apps/api/scripts/apply-module21-migration.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Applying Module 21 migration: AdminRole enum + adminRole column...');

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AdminRole') THEN
        CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'REVIEWER', 'FINANCE', 'SUPPORT');
      END IF;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "adminRole" "AdminRole";
  `);

  console.log('Module 21 migration applied successfully.');
  console.log('To create a SUPER_ADMIN, run:');
  console.log('  UPDATE "User" SET role = \'ADMIN\', "adminRole" = \'SUPER_ADMIN\' WHERE email = \'your@email.com\';');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
