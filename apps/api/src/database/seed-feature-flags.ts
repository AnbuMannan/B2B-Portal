import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
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
      name: 'MODULE_SELLER_DASHBOARD_ENABLED',
      isEnabled: false,
      rolloutPercentage: 0,
      targetAudience: {},
    },
    {
      name: 'MODULE_BUYER_DASHBOARD_ENABLED',
      isEnabled: false,
      rolloutPercentage: 0,
      targetAudience: {},
    },
  ]

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
    })
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error('Error seeding feature flags', error)
    await prisma.$disconnect()
    process.exit(1)
  })

