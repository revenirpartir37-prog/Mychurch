# MYCHURCH

Plateforme moderne de gestion d'église — Progressive Web App (PWA).

## Fonctionnalités

- **Gestion des membres** — Inscription, photos, cartes de membres (PDF)
- **Finances** — Revenus/dépenses, rapports, graphiques
- **Événements & présences** — Planification, suivi des présences
- **Messages & notifications** — Messagerie interne, push notifications (OneSignal)
- **Rapports PDF** — Export avec logo de l'église
- **PWA** — Installation sur Android, iOS et desktop
- **Multi-utilisateurs** — Rôles : admin, trésorier, secrétaire, lecteur

## Stack technique

- **Frontend** : Next.js 16, Tailwind CSS, shadcn/ui, TypeScript
- **Backend** : Prisma ORM, Supabase PostgreSQL, Supabase Auth + Firebase (Google OAuth)
- **Stockage** : Supabase Storage (photos/logos, bucket `Mychurch-bucket`)
- **Realtime** : Supabase Realtime (rafraîchissement temps réel en plus du polling)
- **Notifications** : OneSignal
- **Email** : Resend (OTP)

## Installation

```bash
git clone https://github.com/revenirpartir37-prog/Mychurch.git
cd Mychurch
npm install
```

## Configuration

Copiez `.env.example` en `.env` et remplissez vos clés :

```bash
cp .env.example .env
```

## Base de données

La base de production est hébergée sur **Supabase** (PostgreSQL).

```bash
npx prisma generate
npx prisma db push
```

- `DATABASE_URL` pointe vers le **session pooler** Supabase (port `5432`) — compatible Prisma.
- Les migrations Prisma sont dans `prisma/migrations/` (baseline `20260807000000_init`).
- Script de migration depuis SQLite : `npm run db:migrate:sqlite` (voir `scripts/migrate-sqlite-to-supabase.cjs`).
- Politiques Storage : `db/supabase-storage.sql`.
- Realtime activé sur la publication `supabase_realtime` : `db/supabase-realtime.sql`.

## Authentification & sessions

- **Supabase Auth** est la source des identités (email/mot de passe). Les routes `/api/auth/*` vérifient le mot de passe via Supabase Auth puis émettent le JWT applicatif (`src/lib/auth.ts`).
- Modèles activés dans `useSupabaseRealtime` (`src/hooks/use-supabase-realtime.ts`).

## Démarrage

```bash
npm run dev
```

L'app sera disponible sur `http://localhost:3000`.

## Déploiement Vercel

1. Poussez sur GitHub
2. Connectez le repo sur [vercel.com](https://vercel.com)
3. Ajoutez les variables d'environnement dans le dashboard Vercel
4. Redéployez

## Auteur

Created by Henock Aduma — +243 990 601 417
