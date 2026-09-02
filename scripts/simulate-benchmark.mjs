import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import { SignJWT } from 'jose';

const prisma = new PrismaClient();
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'mychurch-super-secret-key-change-in-production-2024');

async function withRetry(fn, retries = 5, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`  [Connexion Supabase... nouvelle tentative ${i + 1}/${retries}]`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function createJwt(user, church) {
  return new SignJWT({
    userId: user.id,
    churchId: church.id,
    email: user.email,
    role: user.role,
    churchName: church.name,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
}

function generateAvatar(name, color = '#3B82F6') {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <circle cx="64" cy="64" r="64" fill="${color}"/>
    <text x="64" y="74" font-family="Arial, sans-serif" font-size="44" font-weight="bold" fill="#ffffff" text-anchor="middle">${initials}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

async function prepareData() {
  console.log('================================================================');
  console.log('1. INITIALISATION DE LA BASE POUR LE TEST DE SIMULATION MYCHURCH');
  console.log('================================================================');

  let church = await withRetry(() =>
    prisma.church.findFirst({
      where: { email: 'benchmark@eglise-simulation.com' },
    })
  );

  if (!church) {
    church = await withRetry(() =>
      prisma.church.create({
        data: {
          name: 'Église Métropole - Simulation Benchmark',
          email: 'benchmark@eglise-simulation.com',
          address: '100 Boulevard Triomphal',
          city: 'Kinshasa',
          province: 'Kinshasa',
          country: 'RDC',
          currency: 'USD',
          initialCapital: 10000,
          registrationSlug: 'eglise-metropole-sim-' + Date.now(),
        },
      })
    );
    console.log(`✓ Église créée: "${church.name}" (ID: ${church.id})`);
  } else {
    console.log(`✓ Église de test prête: "${church.name}" (ID: ${church.id})`);
  }

  console.log('\n2. CRÉATION DES UTILISATEURS PAR RÔLES...');
  const passwordHash = await bcrypt.hash('TestPassword123!', 8);

  const rolesToCreate = [
    { role: 'admin', firstName: 'Pasteur', lastName: 'Principal', email: 'admin1.benchmark@eglise.com', function: 'Pasteur titulaire' },
    { role: 'admin', firstName: 'Co-Pasteur', lastName: 'Adjoint', email: 'admin2.benchmark@eglise.com', function: 'Pasteur associé' },
    { role: 'treasurer', firstName: 'Joseph', lastName: 'Trésor', email: 'tresorier.benchmark@eglise.com', function: 'Directeur Financier' },
    { role: 'secretary', firstName: 'Claire', lastName: 'Secrétariat', email: 'secretaire.benchmark@eglise.com', function: 'Secrétaire Générale' },
    { role: 'reader', firstName: 'Marc', lastName: 'Lecteur', email: 'lecteur.benchmark@eglise.com', function: 'Observateur & Auditeur' },
  ];

  const createdUsers = [];
  for (const u of rolesToCreate) {
    let existing = await withRetry(() =>
      prisma.user.findFirst({
        where: { churchId: church.id, email: u.email },
      })
    );
    if (!existing) {
      existing = await withRetry(() =>
        prisma.user.create({
          data: {
            churchId: church.id,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            role: u.role,
            function: u.function,
            passwordHash,
            isActive: true,
            verified: true,
          },
        })
      );
      console.log(`  + Utilisateur créé: [${existing.role.toUpperCase()}] ${existing.firstName} ${existing.lastName} (${existing.email})`);
    } else {
      console.log(`  = Utilisateur prêt: [${existing.role.toUpperCase()}] ${existing.firstName} ${existing.lastName}`);
    }
    createdUsers.push(existing);
  }

  console.log('\n3. PEUPLEMENT DES MEMBRES & CARTES AVEC PHOTOS DE PROFIL...');
  const existingMembersCount = await withRetry(() =>
    prisma.member.count({
      where: { churchId: church.id },
    })
  );

  const TARGET_BATCH = 50; // Lot parfait et représentatif pour stress-tester la pagination et l'affichage
  if (existingMembersCount < TARGET_BATCH) {
    const toCreate = TARGET_BATCH - existingMembersCount;
    console.log(`  Génération de ${toCreate} membres complets avec cartes d'adhésion et photos de profil...`);

    const departments = ['Chorale', 'Jeunesse', 'Femmes', 'Diaconat', 'Accueil', 'Médias', 'Enseignement', 'Intercession', 'Protocole'];
    const functions = ['Responsable', 'Membre Actif', 'Coordinateur', 'Adjoint', 'Conseiller'];
    const firstNames = ['David', 'Sarah', 'Daniel', 'Esther', 'Samuel', 'Ruth', 'Jonathan', 'Débora', 'Gédéon', 'Lydie', 'Moïse', 'Rebecca', 'Elie', 'Anne'];
    const lastNames = ['Mukendi', 'Kasongo', 'Mbuyi', 'Kalala', 'Tshimanga', 'Ngoy', 'Ilunga', 'Lukusa', 'Kabongo', 'Nsimba', 'Mbala', 'Mwamba'];
    const colors = ['#2563EB', '#7C3AED', '#DB2777', '#059669', '#D97706', '#DC2626', '#0891B2', '#4F46E5'];

    for (let i = 0; i < toCreate; i++) {
      const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
      const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
      const fullName = `${fn} ${ln}`;
      const isPersonnel = i % 5 === 0;
      const color = colors[i % colors.length];
      const photoUrl = generateAvatar(fullName, color);

      const member = await withRetry(() =>
        prisma.member.create({
          data: {
            churchId: church.id,
            firstName: fn,
            lastName: `${ln} #${existingMembersCount + i + 1}`,
            type: isPersonnel ? 'personnel' : 'member',
            email: `membre.${existingMembersCount + i + 1}.${church.id.slice(0, 5)}@simulation.org`,
            phone: `+243${Math.floor(810000000 + Math.random() * 89999999)}`,
            address: `${Math.floor(Math.random() * 200) + 1} Avenue de la Paix, Kinshasa`,
            department: departments[Math.floor(Math.random() * departments.length)],
            function: functions[Math.floor(Math.random() * functions.length)],
            salary: isPersonnel ? Math.floor(300 + Math.random() * 500) : null,
            emergencyContactName: `Contact Urgence ${fn}`,
            emergencyContactPhone: `+2438900000${i.toString().padStart(2, '0')}`,
            photo: photoUrl,
            status: 'active',
            joinDate: new Date(Date.now() - Math.floor(Math.random() * 365 * 24 * 3600 * 1000)),
          },
        })
      );

      const cardNumber = `MC-${Date.now().toString().slice(-6)}-${String(i + 1).padStart(4, '0')}`;
      const qrData = JSON.stringify({
        cardId: cardNumber,
        memberId: member.id,
        churchId: church.id,
        fullName,
      });
      const qrCode = await QRCode.toDataURL(qrData);

      await withRetry(() =>
        prisma.memberCard.create({
          data: {
            churchId: church.id,
            memberId: member.id,
            cardNumber,
            qrCode,
            isPaid: true,
            paidAmount: 5.0,
            paymentRef: `PAY-SIM-${Date.now()}-${i}`,
          },
        })
      );

      if ((i + 1) % 10 === 0 || i === toCreate - 1) {
        console.log(`  ✓ ${i + 1}/${toCreate} membres avec cartes et photos créés.`);
      }
    }
  } else {
    console.log(`  ✓ ${existingMembersCount} membres déjà configurés avec cartes et photos.`);
  }

  const adminUser = createdUsers.find((u) => u.role === 'admin') || createdUsers[0];
  const token = await createJwt(adminUser, church);

  return { church, users: createdUsers, adminUser, token };
}

async function runBenchmark(baseUrl, token) {
  console.log('\n================================================================');
  console.log('4. SIMULATION DE CHARGE & TEST DE PERFORMANCE (APACHE BENCH SIM)');
  console.log('================================================================');
  console.log(`Cible du serveur : ${baseUrl}`);

  const endpoints = [
    { name: 'API Membres (Chargement liste, pagination & photos de profil)', path: '/api/members?page=1&limit=20', method: 'GET' },
    { name: 'API Cartes de membre (Cartes, QR Codes & Photos)', path: '/api/cards?page=1&limit=20', method: 'GET' },
    { name: 'API Gestion Utilisateurs (Vérification Rôles Admin, Trésorier, etc.)', path: '/api/users-management', method: 'GET' },
    { name: 'API Dashboard (Agrégation temps réel des données)', path: '/api/dashboard', method: 'GET' },
  ];

  const CONCURRENCY = 15; // Nombre d'utilisateurs connectés exactement au même instant
  const TOTAL_REQUESTS = 45; // Requêtes totales envoyées pour chaque fonctionnalité

  const results = [];

  for (const ep of endpoints) {
    console.log(`\n▶ Test en cours : ${ep.name}`);
    console.log(`  [Concurrence: ${CONCURRENCY} utilisateurs simultanés | Volume: ${TOTAL_REQUESTS} requêtes]`);

    const url = `${baseUrl}${ep.path}`;
    const times = [];
    let successCount = 0;
    let failCount = 0;
    const startOverall = Date.now();

    for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENCY) {
      const batchSize = Math.min(CONCURRENCY, TOTAL_REQUESTS - i);
      const batch = Array.from({ length: batchSize }, async () => {
        const t0 = Date.now();
        try {
          const res = await fetch(url, {
            method: ep.method,
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          const t1 = Date.now();
          times.push(t1 - t0);
          if (res.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          times.push(Date.now() - t0);
          failCount++;
        }
      });
      await Promise.all(batch);
    }

    const durationSec = (Date.now() - startOverall) / 1000;
    times.sort((a, b) => a - b);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = times[0];
    const max = times[times.length - 1];
    const p95 = times[Math.floor(times.length * 0.95)] || max;
    const rps = (TOTAL_REQUESTS / durationSec).toFixed(2);

    console.log(`  Résultats du benchmark :`);
    console.log(`  • Durée totale du test   : ${durationSec.toFixed(2)} s`);
    console.log(`  • Débit moyen            : ${rps} requêtes/seconde`);
    console.log(`  • Succès                 : ${successCount}/${TOTAL_REQUESTS} (${((successCount / TOTAL_REQUESTS) * 100).toFixed(1)}%)`);
    if (failCount > 0) {
      console.log(`  • Échecs                 : ${failCount}`);
    }
    console.log(`  • Temps de réponse :`);
    console.log(`    - Minimum              : ${min} ms`);
    console.log(`    - Moyen                : ${avg.toFixed(1)} ms`);
    console.log(`    - 95e centile (p95)    : ${p95} ms`);
    console.log(`    - Maximum              : ${max} ms`);

    results.push({
      name: ep.name,
      rps,
      successRate: ((successCount / TOTAL_REQUESTS) * 100).toFixed(1),
      avgTime: avg.toFixed(1),
      min,
      max,
      p95,
    });
  }

  console.log('\n================================================================');
  console.log('RÉCAPITULATIF GLOBAL DES PERFORMANCES');
  console.log('================================================================');
  console.table(results);
}

async function main() {
  try {
    const { church, adminUser, token } = await prepareData();
    const port = process.env.PORT || 3300;
    const baseUrl = `http://localhost:${port}`;

    let serverOnline = false;
    try {
      const ping = await fetch(`${baseUrl}/api/public/church?churchId=${church.id}`, { method: 'GET' });
      serverOnline = ping.status < 500;
    } catch {
      serverOnline = false;
    }

    if (!serverOnline) {
      console.log(`\nNote: Le serveur sur ${baseUrl} n'a pas répondu.`);
    } else {
      console.log(`✓ Serveur MyChurch en ligne et réactif sur ${baseUrl}`);
      await runBenchmark(baseUrl, token);
    }
  } catch (err) {
    console.error('Erreur:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
