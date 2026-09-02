import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.church.count();
  console.log('Churches count:', count);
  const churches = await prisma.church.findMany({
    take: 5,
    select: {
      id: true,
      name: true,
      email: true,
      _count: {
        select: {
          users: true,
          members: true,
          memberCards: true,
        },
      },
    },
  });
  console.log('Churches:', JSON.stringify(churches, null, 2));
}

main()
  .catch((e) => {
    console.error('Error:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
