import { AwardRuleId, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});


const prisma = new PrismaClient({adapter});

async function main() {
  console.log('Seeding award rules...');

  const awards = [
    {
      id: AwardRuleId.FIRST_LOGIN,
      title: 'First login',
      encAmount: '10',
      maxCount: 1,
    },
    {
      id: AwardRuleId.TEST_EVENT,
      title: 'Test event',
      encAmount: '1',
      maxCount: 0, 
    },
  ];

  for (const award of awards) {
    await prisma.awardRule.upsert({
      where: { id: award.id },
      update: {
        title: award.title,
        encAmount: award.encAmount,
        maxCount: award.maxCount,
      },
      create: award,
    });
  }

  console.log('Award rules seeded ✅');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });