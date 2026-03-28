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
      targetAudience: {},
    },
    {
      name: 'MODULE_ADVANCED_FILTERS_ENABLED',
      isEnabled: true,
      rolloutPercentage: 100,
      targetAudience: {},
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
  ];

  for (const f of flags) {
    await prisma.featureFlag.upsert({
      where: { name: f.name },
      create: {
        name: f.name,
        isEnabled: f.isEnabled,
        rolloutPercentage: f.rolloutPercentage,
        targetAudience: f.targetAudience as any,
      },
      update: {
        isEnabled: f.isEnabled,
        rolloutPercentage: f.rolloutPercentage,
        targetAudience: f.targetAudience as any,
      },
    });
  }
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

