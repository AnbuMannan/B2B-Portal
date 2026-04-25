// Module 26: Content & Configuration Management — migration script
// Run: node apps/api/scripts/apply-module26-migration.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Applying Module 26 migration...');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "HomepageBanner" (
      "id"        TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      "title"     TEXT NOT NULL,
      "imageUrl"  TEXT NOT NULL,
      "linkUrl"   TEXT,
      "isActive"  BOOLEAN NOT NULL DEFAULT true,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "startDate" TIMESTAMPTZ,
      "endDate"   TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "HomepageBanner_isActive_sortOrder_idx" ON "HomepageBanner"("isActive", "sortOrder");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "HomepageBanner_startDate_endDate_idx" ON "HomepageBanner"("startDate", "endDate");`);
  console.log('✓ HomepageBanner table');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CreditPackConfig" (
      "id"        TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      "name"      TEXT NOT NULL,
      "credits"   INTEGER NOT NULL,
      "priceInr"  INTEGER NOT NULL,
      "isActive"  BOOLEAN NOT NULL DEFAULT true,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CreditPackConfig_isActive_sortOrder_idx" ON "CreditPackConfig"("isActive", "sortOrder");`);
  console.log('✓ CreditPackConfig table');

  // Seed default credit packs
  await prisma.$executeRawUnsafe(`
    INSERT INTO "CreditPackConfig" ("id", "name", "credits", "priceInr", "sortOrder")
    VALUES
      (gen_random_uuid(), 'Starter',       10,   299, 1),
      (gen_random_uuid(), 'Basic',          25,   599, 2),
      (gen_random_uuid(), 'Standard',       60,  1199, 3),
      (gen_random_uuid(), 'Professional',  150,  2499, 4),
      (gen_random_uuid(), 'Enterprise',    500,  6999, 5)
    ON CONFLICT DO NOTHING;
  `);
  console.log('✓ Default credit packs seeded');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProhibitedKeyword" (
      "id"      TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      "keyword" TEXT NOT NULL UNIQUE,
      "addedBy" TEXT NOT NULL,
      "addedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ProhibitedKeyword_keyword_idx" ON "ProhibitedKeyword"("keyword");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ProhibitedKeyword_addedAt_idx" ON "ProhibitedKeyword"("addedAt" DESC);`);
  console.log('✓ ProhibitedKeyword table');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "NotificationTemplate" (
      "id"        TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      "key"       TEXT NOT NULL UNIQUE,
      "titleEn"   TEXT NOT NULL,
      "bodyEn"    TEXT NOT NULL,
      "titleHi"   TEXT NOT NULL,
      "bodyHi"    TEXT NOT NULL,
      "variables" TEXT[] NOT NULL DEFAULT '{}',
      "isActive"  BOOLEAN NOT NULL DEFAULT true,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedBy" TEXT
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "NotificationTemplate_key_idx" ON "NotificationTemplate"("key");`);
  console.log('✓ NotificationTemplate table');

  const templates = [
    {
      key: 'KYC_APPROVED',
      titleEn: 'KYC Approved',
      bodyEn: 'Congratulations {{sellerName}}! Your KYC verification has been approved. You can now list products.',
      titleHi: 'KYC स्वीकृत',
      bodyHi: 'बधाई हो {{sellerName}}! आपका KYC सत्यापन स्वीकृत हो गया है। अब आप उत्पाद सूचीबद्ध कर सकते हैं।',
      variables: ['sellerName'],
    },
    {
      key: 'KYC_REJECTED',
      titleEn: 'KYC Rejected',
      bodyEn: 'Your KYC has been rejected. Reason: {{reason}}. Please re-upload corrected documents.',
      titleHi: 'KYC अस्वीकृत',
      bodyHi: 'आपका KYC अस्वीकृत कर दिया गया है। कारण: {{reason}}। कृपया सही दस्तावेज़ पुनः अपलोड करें।',
      variables: ['reason'],
    },
    {
      key: 'PRODUCT_APPROVED',
      titleEn: 'Product Approved',
      bodyEn: 'Your product "{{productName}}" has been approved and is now live on the marketplace.',
      titleHi: 'उत्पाद स्वीकृत',
      bodyHi: 'आपका उत्पाद "{{productName}}" स्वीकृत कर दिया गया है और अब बाज़ार में उपलब्ध है।',
      variables: ['productName'],
    },
    {
      key: 'PRODUCT_REJECTED',
      titleEn: 'Product Rejected',
      bodyEn: 'Your product "{{productName}}" was not approved. Reason: {{reason}}.',
      titleHi: 'उत्पाद अस्वीकृत',
      bodyHi: 'आपका उत्पाद "{{productName}}" स्वीकृत नहीं किया गया। कारण: {{reason}}।',
      variables: ['productName', 'reason'],
    },
    {
      key: 'NEW_ORDER',
      titleEn: 'New Order Received',
      bodyEn: 'You have received a new order from {{buyerName}} for "{{productName}}".',
      titleHi: 'नया ऑर्डर प्राप्त',
      bodyHi: 'आपको {{buyerName}} से "{{productName}}" के लिए नया ऑर्डर मिला है।',
      variables: ['buyerName', 'productName'],
    },
    {
      key: 'LOW_BALANCE',
      titleEn: 'Low Lead Credits',
      bodyEn: 'Your lead credit balance is low ({{balance}} credits remaining). Top up now to keep contacting buyers.',
      titleHi: 'लीड क्रेडिट कम',
      bodyHi: 'आपका लीड क्रेडिट बैलेंस कम है ({{balance}} क्रेडिट शेष)। खरीदारों से संपर्क जारी रखने के लिए अभी टॉप अप करें।',
      variables: ['balance'],
    },
    {
      key: 'QUOTE_RECEIVED',
      titleEn: 'Quote Received',
      bodyEn: 'You have received a quote from {{sellerName}} for your requirement "{{requirementTitle}}".',
      titleHi: 'कोटेशन प्राप्त',
      bodyHi: 'आपको {{sellerName}} से आपकी आवश्यकता "{{requirementTitle}}" के लिए एक कोटेशन मिला है।',
      variables: ['sellerName', 'requirementTitle'],
    },
    {
      key: 'COMPLAINT_RESOLVED',
      titleEn: 'Complaint Resolved',
      bodyEn: 'Your complaint #{{ticketId}} has been resolved. Please review and close the ticket if satisfied.',
      titleHi: 'शिकायत हल',
      bodyHi: 'आपकी शिकायत #{{ticketId}} हल कर दी गई है। संतुष्ट होने पर कृपया टिकट बंद करें।',
      variables: ['ticketId'],
    },
  ];

  for (const t of templates) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "NotificationTemplate" ("id","key","titleEn","bodyEn","titleHi","bodyHi","variables")
       VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6) ON CONFLICT ("key") DO NOTHING`,
      t.key, t.titleEn, t.bodyEn, t.titleHi, t.bodyHi, t.variables,
    );
  }
  console.log('✓ Default notification templates seeded');

  console.log('\nModule 26 migration completed successfully.');
}

main()
  .catch((err) => { console.error('Migration failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
