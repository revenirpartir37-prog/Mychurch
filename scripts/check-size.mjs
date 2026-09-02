import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const res = await prisma.$queryRawUnsafe('SELECT pg_size_pretty(pg_database_size(current_database())) as size, pg_database_size(current_database()) as bytes;');
  console.log('Database size:', res);
}

main().catch(console.error).finally(() => prisma.$disconnect());
