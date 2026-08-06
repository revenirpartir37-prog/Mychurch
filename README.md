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
- **Backend** : Prisma ORM, SQLite (dev), Firebase Auth
- **Stockage** : Supabase Storage (photos/logos)
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

```bash
npx prisma generate
npx prisma db push
```

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
