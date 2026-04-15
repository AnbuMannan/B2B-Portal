/**
 * purge-contact-reveals.ts
 *
 * Deletes ALL LeadContactReveal records from the database.
 *
 * Why: Records created before the ENCRYPTION_KEY was corrected were encrypted
 * with a placeholder key and cannot be decrypted. Sellers will re-reveal contacts
 * using the correct key after this cleanup.
 *
 * Run: npm run db:purge-reveals   (from apps/api/)
 */

import { PrismaClient } from '@prisma/client';

async function main() {
  // Use direct URL (no pgbouncer connection limit)
  const url =
    process.env.DATABASE_URL ||
    process.env.DIRECT_URL ||
    process.env.POSTGRES_URL;

  if (!url) {
    console.error('ERROR: No database URL found in environment.');
    process.exit(1);
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    await prisma.$connect();

    const count = await prisma.leadContactReveal.count();

    if (count === 0) {
      console.log('No LeadContactReveal records found — nothing to delete.');
      return;
    }

    console.log(`Found ${count} LeadContactReveal record(s).`);
    console.log('Deleting...');

    const result = await prisma.leadContactReveal.deleteMany({});

    console.log(`Done. Deleted ${result.count} record(s).`);
    console.log('Sellers can now re-reveal contacts; new records will be encrypted with the correct key.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Script failed:', err.message);
  process.exit(1);
});
