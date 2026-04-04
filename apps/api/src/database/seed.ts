/**
 * Seed script for initial data:
 * - Categories (top-level)
 * - Feature flags (examples)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedCategories() {
  const categories = [
    { name: 'Textiles', industryType: ['Manufacturing', 'Apparel'] },
    { name: 'Chemicals', industryType: ['Industrial', 'Bulk'] },
    { name: 'Metals & Alloys', industryType: ['Industrial', 'Raw Materials'] },
    { name: 'Agriculture', industryType: ['Primary', 'Commodities'] },
    { name: 'Electronics', industryType: ['Components', 'Devices'] },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      create: {
        name: cat.name,
        industryType: cat.industryType,
      },
      update: {
        industryType: cat.industryType,
      },
    });
  }
}

async function seedFeatureFlags() {
  const flags = [
    {
      name: 'MODULE_HOMEPAGE_ENABLED',
      isEnabled: true,
      rolloutPercentage: 100,
      targetAudience: { roles: ['ADMIN', 'SELLER', 'BUYER'], userIds: [] },
    },
    {
      name: 'MODULE_ADVANCED_FILTERS_ENABLED',
      isEnabled: true,
      rolloutPercentage: 100,
      targetAudience: { roles: ['ADMIN', 'SELLER', 'BUYER'], userIds: [] },
    },
    {
      name: 'MODULE_SELLER_DASHBOARD_ENABLED',
      isEnabled: false,
      rolloutPercentage: 0,
      targetAudience: { roles: ['SELLER'], userIds: [] },
    },
    {
      name: 'MODULE_BUYER_DASHBOARD_ENABLED',
      isEnabled: false,
      rolloutPercentage: 0,
      targetAudience: { roles: ['BUYER'], userIds: [] },
    },
    {
      name: 'new_nav',
      isEnabled: true,
      rolloutPercentage: 100,
      targetAudience: { roles: ['ADMIN', 'SELLER', 'BUYER'], userIds: [] },
    },
    {
      name: 'experimental_quote_ui',
      isEnabled: false,
      rolloutPercentage: 10,
      targetAudience: { roles: ['SELLER'], userIds: [] },
    },
    {
      name: 'MODULE_SEARCH_ENABLED',
      isEnabled: true,
      rolloutPercentage: 100,
      targetAudience: { roles: ['ADMIN', 'SELLER', 'BUYER'], userIds: [] },
    },
    {
      name: 'MODULE_BUY_LEADS_ENABLED',
      isEnabled: true,
      rolloutPercentage: 100,
      targetAudience: { roles: ['SELLER'], userIds: [] },
    },
  ];

  for (const flag of flags) {
    await prisma.featureFlag.upsert({
      where: { name: flag.name },
      update: {
        isEnabled: flag.isEnabled,
        rolloutPercentage: flag.rolloutPercentage,
        targetAudience: flag.targetAudience as any,
      },
      create: {
        name: flag.name,
        isEnabled: flag.isEnabled,
        rolloutPercentage: flag.rolloutPercentage,
        targetAudience: flag.targetAudience as any,
      },
    });
  }
  console.log('Feature flags seeded:', flags.length);
}

async function main() {
  await seedCategories();
  await seedFeatureFlags();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

