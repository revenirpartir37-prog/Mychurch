import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('================================================================');
  console.log('ANALYSE DE PERFORMANCE SQL (EXPLAIN ANALYZE) - ÉCHELLE 1 000 000');
  console.log('================================================================');

  const church = await prisma.church.findFirst({
    where: { email: 'benchmark@eglise-simulation.com' },
  });

  if (!church) {
    console.log('Église non trouvée.');
    return;
  }

  // 1. Test de la requête Membres avec pagination et tri
  console.log('\n1. Test Plan d\'exécution: Recherche Membres (Pagination + Tri chronologique)');
  const memberPlan = await prisma.$queryRawUnsafe(`
    EXPLAIN ANALYZE
    SELECT id, "firstName", "lastName", photo, department, status, "createdAt"
    FROM "Member"
    WHERE "churchId" = '${church.id}'
    ORDER BY "createdAt" DESC
    LIMIT 20 OFFSET 0;
  `);
  console.log(memberPlan.map((r) => r['QUERY PLAN']).join('\n'));

  // 2. Test de la requête Cartes de Membre avec statut et tri
  console.log('\n2. Test Plan d\'exécution: Affichage Cartes de Membre (Index churchId + createdAt)');
  const cardPlan = await prisma.$queryRawUnsafe(`
    EXPLAIN ANALYZE
    SELECT id, "cardNumber", "qrCode", "isPaid", "createdAt"
    FROM "MemberCard"
    WHERE "churchId" = '${church.id}'
    ORDER BY "createdAt" DESC
    LIMIT 20 OFFSET 0;
  `);
  console.log(cardPlan.map((r) => r['QUERY PLAN']).join('\n'));

  // 3. Test de la recherche d'utilisateur par rôle et église
  console.log('\n3. Test Plan d\'exécution: Utilisateurs par Rôle (Admin, Trésorier, etc.)');
  const userPlan = await prisma.$queryRawUnsafe(`
    EXPLAIN ANALYZE
    SELECT id, email, role, "firstName", "lastName"
    FROM "User"
    WHERE "churchId" = '${church.id}' AND role = 'admin';
  `);
  console.log(userPlan.map((r) => r['QUERY PLAN']).join('\n'));
}

main().catch(console.error).finally(() => prisma.$disconnect());
