/**
 * Consolidated idempotent migration runner — replaces the individual apply-module*.js scripts.
 *
 * Applies all pending DDL in module order. Every statement uses IF NOT EXISTS / DO $$
 * guards so it is safe to re-run against a fully-migrated database.
 *
 * Usage:
 *   node apps/api/scripts/db-migrate-all.js
 *
 * Environment: requires DATABASE_URL or POSTGRES_URL in the environment (reads .env from repo root).
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const { PrismaClient } = require('@prisma/client');

// ── Migration steps in chronological order ────────────────────────────────────

const migrations = [
  // ── Module 15: Buyer registration ──────────────────────────────────────────
  {
    name: 'M15: Buyer companyName + BuyerSavedSeller',
    statements: [
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
      `DO $$
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
       END $$`,
    ],
  },

  // ── Module 18–20: Orders, SavedProducts, Complaints ───────────────────────
  {
    name: 'M18-20: razorpayOrderId, BuyerSavedProduct, complaint fields',
    statements: [
      `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "razorpayOrderId" TEXT`,
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
             FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id")
             ON DELETE CASCADE ON UPDATE CASCADE;
         END IF;
       END $$`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "BuyerSavedProduct_buyerId_productId_key"
         ON "BuyerSavedProduct"("buyerId","productId")`,
    ],
  },

  // ── Module 21: Admin roles ─────────────────────────────────────────────────
  {
    name: 'M21: AdminRole enum + adminRole column',
    statements: [
      `DO $$ BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AdminRole') THEN
           CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN','ADMIN','REVIEWER','FINANCE','SUPPORT');
         END IF;
       END $$`,
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "adminRole" "AdminRole"`,
    ],
  },

  // ── Module 25: BlockList ───────────────────────────────────────────────────
  {
    name: 'M25: BlockList table',
    statements: [
      `CREATE TABLE IF NOT EXISTS "BlockList" (
         "id"          TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
         "email"       TEXT,
         "phoneNumber" TEXT,
         "ipAddress"   TEXT,
         "reason"      TEXT        NOT NULL,
         "blockedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
         "blockedBy"   TEXT,
         "isActive"    BOOLEAN     NOT NULL DEFAULT TRUE,
         "expiresAt"   TIMESTAMPTZ
       )`,
      `CREATE INDEX IF NOT EXISTS "BlockList_email_idx"       ON "BlockList"("email") WHERE "email" IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS "BlockList_phoneNumber_idx"  ON "BlockList"("phoneNumber") WHERE "phoneNumber" IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS "BlockList_ipAddress_idx"    ON "BlockList"("ipAddress") WHERE "ipAddress" IS NOT NULL`,
    ],
  },

  // ── Module 26: Content / banners ──────────────────────────────────────────
  {
    name: 'M26: HomepageBanner + ContentPage',
    statements: [
      `CREATE TABLE IF NOT EXISTS "HomepageBanner" (
         "id"        TEXT    NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
         "title"     TEXT    NOT NULL,
         "imageUrl"  TEXT    NOT NULL,
         "linkUrl"   TEXT,
         "isActive"  BOOLEAN NOT NULL DEFAULT TRUE,
         "sortOrder" INT     NOT NULL DEFAULT 0,
         "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
         "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )`,
      `CREATE TABLE IF NOT EXISTS "ContentPage" (
         "id"          TEXT    NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
         "slug"        TEXT    NOT NULL UNIQUE,
         "title"       TEXT    NOT NULL,
         "body"        TEXT    NOT NULL,
         "isPublished" BOOLEAN NOT NULL DEFAULT FALSE,
         "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
         "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )`,
    ],
  },

  // ── Module 27: DPDP compliance ────────────────────────────────────────────
  {
    name: 'M27: ConsentRecord + DataErasureRequest',
    statements: [
      `CREATE TABLE IF NOT EXISTS "ConsentRecord" (
         "id"          TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
         "userId"      TEXT NOT NULL REFERENCES "User"("id"),
         "consentType" TEXT NOT NULL,
         "version"     TEXT NOT NULL,
         "givenAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
         "ipAddress"   TEXT,
         "userAgent"   TEXT
       )`,
      `CREATE INDEX IF NOT EXISTS "ConsentRecord_userId_idx" ON "ConsentRecord"("userId")`,
      `CREATE TABLE IF NOT EXISTS "DataErasureRequest" (
         "id"          TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
         "userId"      TEXT NOT NULL REFERENCES "User"("id"),
         "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
         "completedAt" TIMESTAMPTZ,
         "status"      TEXT NOT NULL DEFAULT 'PENDING',
         "notes"       TEXT
       )`,
    ],
  },

  // ── Module 28: Complaint escalation ───────────────────────────────────────
  {
    name: 'M28: Complaint escalation + isInternal response flag',
    statements: [
      `ALTER TABLE "ComplaintTicket"
         ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMPTZ,
         ADD COLUMN IF NOT EXISTS "escalatedTo"  TEXT,
         ADD COLUMN IF NOT EXISTS "escalatedBy"  TEXT`,
      `ALTER TABLE "ComplaintTicketResponse"
         ADD COLUMN IF NOT EXISTS "isInternal" BOOLEAN NOT NULL DEFAULT FALSE`,
      `CREATE INDEX IF NOT EXISTS "ComplaintTicket_escalatedAt_idx"
         ON "ComplaintTicket"("escalatedAt")`,
    ],
  },

  // ── Sprint B: IRP fields on LeadCreditTransaction ─────────────────────────
  {
    name: 'Sprint B: IRP fields (irn, ackNo, irpQrCode)',
    statements: [
      `ALTER TABLE "LeadCreditTransaction"
         ADD COLUMN IF NOT EXISTS "irn"       TEXT,
         ADD COLUMN IF NOT EXISTS "ackNo"     TEXT,
         ADD COLUMN IF NOT EXISTS "irpQrCode" TEXT`,
    ],
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────

async function main() {
  const prisma = new PrismaClient();
  let ok = 0;
  let failed = 0;

  console.log(`\n🚀 Applying ${migrations.length} migration batches...\n`);

  for (const migration of migrations) {
    console.log(`── ${migration.name}`);
    try {
      for (const sql of migration.statements) {
        await prisma.$executeRawUnsafe(sql);
      }
      console.log(`   ✅ Done\n`);
      ok++;
    } catch (err) {
      console.error(`   ❌ Failed: ${err.message}\n`);
      failed++;
    }
  }

  await prisma.$disconnect();

  console.log(`\nResult: ${ok} succeeded, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
