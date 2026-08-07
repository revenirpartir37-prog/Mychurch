/* Migration SQLite -> Supabase (Postgres) via Prisma.
 * Lit db/custom.db (node:sqlite) et insère dans la BDD cible (DATABASE_URL).
 * Préserve les IDs pour que les relations restent cohérentes.
 */
const { DatabaseSync } = require('node:sqlite');
const { PrismaClient } = require('@prisma/client');

const DB_PATH = process.env.SRC_SQLITE || 'db/custom.db';
const src = new DatabaseSync(DB_PATH);
const db = new PrismaClient();

// Champs DateTime par table (SQLite les stocke en ms epoch)
const datetimeFields = {
  Church: ['createdAt', 'updatedAt'],
  User: ['lastLogin', 'createdAt', 'updatedAt'],
  Member: ['joinDate', 'createdAt', 'updatedAt'],
  Transaction: ['date', 'createdAt', 'updatedAt'],
  Event: ['startDate', 'endDate', 'createdAt', 'updatedAt'],
  Attendance: ['date', 'createdAt'],
  Message: ['createdAt', 'updatedAt'],
  Notification: ['createdAt'],
  MemberCard: ['createdAt'],
  Subscription: ['startDate', 'endDate', 'createdAt', 'updatedAt'],
  Otp: ['expiresAt', 'createdAt'],
  ChurchSetting: ['updatedAt'],
  AuditLog: ['createdAt'],
};

// Champs Boolean par table
const booleanFields = {
  Church: ['isActive'],
  User: ['isActive', 'verified'],
  Member: [],
  Transaction: [],
  Event: [],
  Attendance: [],
  Message: ['isRead', 'isArchived'],
  Notification: ['isRead'],
  MemberCard: ['isPaid'],
  Subscription: ['autoRenew'],
  Otp: ['verified'],
  ChurchSetting: [],
  AuditLog: [],
};

function convert(table, row) {
  const out = { ...row };
  for (const f of datetimeFields[table] || []) {
    if (out[f] != null && typeof out[f] === 'number') out[f] = new Date(out[f]);
  }
  for (const f of booleanFields[table] || []) {
    if (typeof out[f] === 'number') out[f] = out[f] === 1;
  }
  return out;
}

function rows(table) {
  return src.prepare(`SELECT * FROM "${table}"`).all().map((r) => convert(table, r));
}

(async () => {
  const report = {};
  for (const table of Object.keys(datetimeFields)) {
    const data = rows(table);
    const model = db[table[0].toLowerCase() + table.slice(1)];
    if (data.length === 0) {
      report[table] = '0';
      continue;
    }
    await model.createMany({ data, skipDuplicates: true });
    report[table] = String(data.length);
  }
  console.log('MIGRATION RESULT (lignes insérées par table):');
  console.table(report);
})().catch((e) => {
  console.error('MIGRATION FAILED:', e.message);
  process.exit(1);
}).finally(() => {
  src.close();
  db.$disconnect();
});