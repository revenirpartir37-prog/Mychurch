import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const [churchCount, userCount, memberCount, cardCount] = await Promise.all([
    prisma.church.count(),
    prisma.user.count(),
    prisma.member.count(),
    prisma.memberCard.count(),
  ]);
  console.log({ churchCount, userCount, memberCount, cardCount });
}

main().finally(() => prisma.$disconnect());
