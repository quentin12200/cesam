# 🐄 TroupeauPro - Gestion Digitale de Troupeau Bovin

> Application mobile-first de gestion d'élevage bovin allaitant, conçue pour remplacer les tableaux Excel complexes par une solution intelligente et proactive.

[![Version](https://img.shields.io/badge/version-3.0-blue.svg)](https://github.com/votre-repo/troupeaupro)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Deployed on Vercel](https://img.shields.io/badge/deployed%20on-Vercel-black.svg)](https://vercel.com)

---

## 📋 Table des matières

- [À propos](#à-propos)
- [Contexte](#contexte)
- [Fonctionnalités principales](#fonctionnalités-principales)
- [Technologies utilisées](#technologies-utilisées)
- [Architecture](#architecture)
- [Installation](#installation)
- [Déploiement](#déploiement)
- [Documentation](#documentation)
- [Roadmap](#roadmap)
- [Contribution](#contribution)
- [Licence](#licence)

---

## 🎯 À propos

**TroupeauPro** est une solution SaaS moderne de gestion de troupeau bovin développée pour Samuel et Céline, éleveurs de races Blondes d'Aquitaine et Charolaises. L'application transforme un système Excel chronophage en un assistant de pilotage proactif avec alertes intelligentes, suivi sanitaire complet et optimisation des interventions.

### Problématique résolue

- ❌ **Avant** : 68 vaches + 66 veaux gérés sur Excel avec formules complexes, filtres manuels, navigation multi-onglets
- ✅ **Après** : Application mobile-first avec alertes automatiques, vues intelligentes, calculs temps réel

---

## 🌾 Contexte

### Le défi

Gestion actuelle via `Calendrier_des_vaches_a_jour.xlsx` :
- 3 onglets (Calendrier suivi, Suivi veaux, Vélages)
- Codes couleurs complexes (GRIS/JAUNE/VERT/ROUGE/ROSE)
- Filtrage manuel quotidien des cases jaunes pour échographies
- Navigation répétitive entre onglets pour croiser infos mère/veau
- Calculs manuels dates gestation, GMQ, IVV
- Protocoles vaccins âge-dépendants (Nasalgen, Nasym, Hiprabovis, MHE)
- Citation utilisateur : _"du coup je fais tout ça manuellement et ça dure 1000 ans"_

### La solution

Application web progressive (PWA) optimisée mobile avec :
- 🚨 Alertes proactives (vélage J-30, vaccins J-7, sevrage tous les 5 veaux)
- 📊 Tableaux de bord intelligents (focus jour/semaine)
- 🎨 Codes couleurs automatiques (reproduction des règles Excel)
- 📱 Utilisation terrain (offline-first, listes imprimables)
- 🔗 Centralisation données (NUTRAV unique, généalogie, historique)

---

## ✨ Fonctionnalités principales

### 🔴 Prio 1 - MVP (Développement actuel)

#### Module Reproduction
- 📅 Gestion cycle complet : chaleur → saillie (IA/SN) → échographie → vélage
- 🎯 Liste dynamique "À échographier" (J+40) avec badge compteur
- 🟢 États gestation visuels (GRIS/JAUNE/VERT/ROUGE/ROSE)
- 🔄 Calcul automatique date vélage (275-285j Blondes d'Aquitaine)
- 📈 IVV automatique avec classement vaches

#### Module Sanitaire
- 💉 Protocoles vaccins veaux (Nasalgen, Nasym, Hiprabovis, MHE)
- 🐄 Vaccins vaches pré-vélage (Crypto/Rotavec fenêtre J-90 à J-21)
- ⚡ Alertes J-7 anticipation achats flacons
- 📋 Listes checkables par lot (5/10 doses)
- 📸 Événements sanitaires horodatés + photos (mammite, boiterie, métrite)

#### Module Vélage
- 🔔 Alertes échelonnées : J-90 génisse, J-30 général, J-23 capteur
- 📡 Gestion 4 capteurs numérotés (attribution/libération)
- 📝 Enregistrement complet (père auto, sexe, jumeaux, qualificatifs)
- 🚨 Traçabilité complications (césarienne, matrice, mort-né)

#### Suivi Zootechnique
- ⚖️ Pesée + GMQ automatique (30j glissant)
- 📉 Courbes croissance individuelles
- 🥛 Sevrage automatisé (alerte 5 veaux ≥6 mois)
- 🍼 Compléments bolus/métraboles (fenêtre pré-vélage)

#### Gestion Données
- 🔢 NUTRAV unique (4 chiffres) - clé métier
- 👨‍👩‍👧 Généalogie bidirectionnelle (mère→veaux, père→descendants)
- 🏷️ Gestion boucles Sinel (attribution auto, alertes 5/15)
- 📁 Fiche animal 360° (identité, généalogie, sanitaire, performances)

### 🟠 Prio 2 - Fonctionnalités avancées

- 📷 OCR ordonnances vétérinaires
- 🔄 Groupage synchronisation chaleurs (spirale, notifications multi-étapes)
- 📍 Localisation lots (Prés Vialette/Tour Ronde, stabulations, chez Jacques)
- 💰 Statistiques commerciales (ventes veaux/vaches, CA, évolution N-1)
- 🏆 Critères engraissement (IVV élevé, ≥4 IA échecs, césariennes)

---

## 🛠️ Technologies utilisées

### Frontend
- **Framework** : [Next.js 14](https://nextjs.org/) (App Router)
- **UI Library** : [React 18](https://react.dev/) avec TypeScript
- **Styling** : [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **State Management** : [Zustand](https://zustand-demo.pmnd.rs/) + React Query
- **Formulaires** : [React Hook Form](https://react-hook-form.com/) + Zod
- **Charts** : [Recharts](https://recharts.org/)
- **PWA** : [next-pwa](https://github.com/shadowwalker/next-pwa)

### Backend
- **Database** : [PostgreSQL](https://www.postgresql.org/) (Vercel Postgres)
- **ORM** : [Prisma](https://www.prisma.io/)
- **API** : Next.js API Routes + [tRPC](https://trpc.io/) (optionnel)
- **Auth** : [NextAuth.js](https://next-auth.js.org/) (Samuel & Céline)
- **Storage** : [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) (photos événements sanitaires)

### DevOps & Déploiement
- **Hosting** : [Vercel](https://vercel.com/) 🚀
- **CI/CD** : GitHub Actions + Vercel Git Integration
- **Monitoring** : Vercel Analytics + [Sentry](https://sentry.io/)
- **Environnements** : Dev / Staging / Production

### Outils de développement
- **Package Manager** : pnpm
- **Linting** : ESLint + Prettier
- **Testing** : Vitest + React Testing Library
- **Type Checking** : TypeScript strict mode
- **Code Assistant** : Claude Code (développement guidé par CDC)

---

## 🏗️ Architecture

### Structure du projet

```
troupeaupro/
├── app/                      # Next.js App Router
│   ├── (dashboard)/         # Routes authentifiées
│   │   ├── page.tsx         # Dashboard principal
│   │   ├── troupeau/        # Liste animaux + filtres
│   │   ├── reproduction/    # Module reproduction
│   │   ├── sanitaire/       # Module sanitaire
│   │   ├── velage/          # Module vélage
│   │   └── stats/           # Statistiques commerciales
│   ├── api/                 # API Routes
│   └── layout.tsx
├── components/
│   ├── ui/                  # shadcn/ui components
│   ├── dashboard/           # Dashboard widgets
│   ├── forms/               # Formulaires métier
│   └── charts/              # Courbes GMQ, camemberts
├── lib/
│   ├── db/                  # Prisma client + queries
│   ├── utils/               # Calculs (IVV, GMQ, âge)
│   ├── constants/           # Protocoles vaccins, taureaux
│   └── validations/         # Schémas Zod
├── prisma/
│   ├── schema.prisma        # Modèle données
│   └── seed.ts              # Import CSV initial (166 animaux)
├── public/
│   ├── manifest.json        # PWA config
│   └── icons/
├── CAHIER_DES_CHARGES.md    # Spécifications complètes
├── docs/
│   ├── EXCEL_ANALYSIS.md    # Analyse tableau actuel
│   ├── API.md               # Documentation API
│   └── DEPLOYMENT.md        # Guide déploiement
└── README.md
```

### Schéma base de données (simplifié)

```prisma
model Animal {
  id            String   @id @default(cuid())
  nutrav        String   @unique // 4 chiffres - CLÉ MÉTIER
  nunati        String   @unique // 10 chiffres national
  nom           String?
  dateNaissance DateTime
  sexe          Sexe     @default(F)
  
  mereId        String?
  mere          Animal?  @relation("Genealogie", fields: [mereId])
  veaux         Animal[] @relation("Genealogie")
  
  pereId        String?
  pere          Taureau? @relation(fields: [pereId])
  
  velages       Velage[]
  saillies      Saillie[]
  pesees        Pesee[]
  vaccinations  Vaccination[]
  evenements    EvenementSanitaire[]
}

model Velage {
  id              String   @id @default(cuid())
  animalId        String
  animal          Animal   @relation(...)
  date            DateTime
  qualificatif    QualificatifVelage
  capteur         Int?     // 1-4
  complications   String?
}

model Saillie {
  id              String   @id @default(cuid())
  animalId        String
  animal          Animal   @relation(...)
  date            DateTime
  type            TypeSaillie // IA / SN
  taureauId       String?
  tentative       Int      @default(1)
  gestation       Gestation?
}

model Gestation {
  id              String   @id @default(cuid())
  saillieId       String   @unique
  saillie         Saillie  @relation(...)
  etat            EtatGestation // GRIS/JAUNE/VERT/ROUGE
  dateEcho        DateTime?
  joursGestation  Int?
  dateVelagePrevue DateTime?
}
```

---

## 🚀 Installation

### Prérequis

- Node.js 18+ ([télécharger](https://nodejs.org/))
- pnpm 8+ (`npm install -g pnpm`)
- PostgreSQL 15+ (ou compte Vercel pour Vercel Postgres)

### Cloner le repository

```bash
git clone https://github.com/votre-username/troupeaupro.git
cd troupeaupro
```

### Installation des dépendances

```bash
pnpm install
```

### Configuration environnement

Créer `.env.local` à la racine :

```env
# Database (Vercel Postgres en production)
DATABASE_URL="postgresql://user:password@localhost:5432/troupeaupro"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# Vercel Blob (photos)
BLOB_READ_WRITE_TOKEN="vercel_blob_token"

# Optional: OCR API
OCR_API_KEY="your-ocr-api-key"
```

### Initialisation base de données

```bash
# Générer Prisma client
pnpm prisma generate

# Créer tables
pnpm prisma db push

# Importer données initiales (166 animaux CSV)
pnpm prisma db seed
```

### Lancement développement

```bash
pnpm dev
```

Ouvrir [http://localhost:3000](http://localhost:3000) 🎉

---

## 📦 Déploiement

### Déploiement sur Vercel (recommandé)

TroupeauPro est optimisé pour **Vercel** avec configuration automatique.

#### 1. Préparer le projet

```bash
# S'assurer que tout est committé
git add .
git commit -m "feat: initial commit"
git push origin main
```

#### 2. Importer sur Vercel

1. Aller sur [vercel.com/new](https://vercel.com/new)
2. Importer le repository GitHub
3. Vercel détecte automatiquement Next.js ✅

#### 3. Configurer les variables d'environnement

Dans Vercel Dashboard → Settings → Environment Variables :

```env
# Database
DATABASE_URL=
POSTGRES_PRISMA_URL=
POSTGRES_URL_NON_POOLING=

# Auth
NEXTAUTH_URL=https://troupeaupro.vercel.app
NEXTAUTH_SECRET=

# Storage
BLOB_READ_WRITE_TOKEN=
```

#### 4. Configurer Vercel Postgres

```bash
# Créer base de données depuis dashboard ou CLI
vercel postgres create

# Lier au projet
vercel link

# Exécuter migrations
vercel env pull .env.production
pnpm prisma migrate deploy
pnpm prisma db seed
```

#### 5. Déployer

```bash
# Via Git (automatique)
git push origin main

# Ou via CLI
vercel --prod
```

L'app sera disponible sur `https://troupeaupro.vercel.app` 🚀

### Déploiement continu

Chaque push sur `main` déclenche automatiquement :
1. ✅ Build Next.js
2. ✅ Tests TypeScript
3. ✅ Linting
4. ✅ Déploiement production

Branches feature → Preview deployments automatiques

### Variables d'environnement par environnement

| Variable | Development | Preview | Production |
|----------|-------------|---------|------------|
| DATABASE_URL | Local PostgreSQL | Vercel Postgres (staging) | Vercel Postgres (prod) |
| NEXTAUTH_URL | localhost:3000 | preview-xxx.vercel.app | troupeaupro.vercel.app |

---

## 📚 Documentation

### Cahier des charges

📄 **[CAHIER_DES_CHARGES.md](./CAHIER_DES_CHARGES.md)** - Spécifications fonctionnelles complètes

Sections principales :
- Analyse système Excel actuel (3 onglets, codes couleurs)
- Architecture données (NUTRAV, généalogie, Sinel)
- Spécifications modules (Reproduction, Sanitaire, Vélage, etc.)
- Calculs automatiques (IVV, GMQ, âge "X m Y j", camembert)
- Interface UX mobile-first
- Priorisation MVP

### Guides développement

- 📘 [EXCEL_ANALYSIS.md](./docs/EXCEL_ANALYSIS.md) - Analyse détaillée colonnes Excel
- 🔌 [API.md](./docs/API.md) - Documentation API endpoints
- 🚢 [DEPLOYMENT.md](./docs/DEPLOYMENT.md) - Guide déploiement Vercel
- 🧪 [TESTING.md](./docs/TESTING.md) - Stratégie tests

### Resources externes

- [Documentation Next.js](https://nextjs.org/docs)
- [Documentation Vercel](https://vercel.com/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)

---

## 🗓️ Roadmap

### ✅ Phase 1 - Fondations (Complété)
- [x] Analyse Excel et cahier des charges
- [x] Maquette HTML/CSS mobile-first
- [x] Modélisation base de données
- [x] Setup projet Next.js + Vercel

### 🚧 Phase 2 - MVP (En cours)
- [ ] Module Reproduction complet
- [ ] Module Sanitaire (protocoles vaccins)
- [ ] Module Vélage (alertes + capteurs)
- [ ] Dashboard principal (focus jour/semaine)
- [ ] Système alertes (push + email)
- [ ] Import CSV initial 166 animaux

**Cible : Juin 2026**

### 🔮 Phase 3 - Features avancées
- [ ] OCR ordonnances vétérinaires
- [ ] Groupage synchronisation chaleurs
- [ ] Localisation lots (drag & drop)
- [ ] Statistiques commerciales
- [ ] Offline-first (PWA complète)
- [ ] Export données (Excel, PDF)

**Cible : Septembre 2026**

### 💡 Phase 4 - Optimisations
- [ ] Application mobile native (React Native)
- [ ] API publique pour intégrations
- [ ] Multi-exploitation (SaaS)
- [ ] Intelligence artificielle (prédiction vélages)

**Cible : 2027**

---

## 🤝 Contribution

### Développement guidé par Claude Code

Ce projet utilise **Claude Code** avec le cahier des charges comme référence :

```bash
# Lancer Claude Code sur une feature
claude-code --file CAHIER_DES_CHARGES.md

# Exemple de prompt
"Implémente le module reproduction selon CAHIER_DES_CHARGES.md section 4.2"
```

### Guidelines contribution

1. Lire [CAHIER_DES_CHARGES.md](./CAHIER_DES_CHARGES.md)
2. Créer une branche feature : `git checkout -b feat/module-reproduction`
3. Commiter selon [Conventional Commits](https://www.conventionalcommits.org/) : `feat:`, `fix:`, `docs:`
4. Tester localement
5. Ouvrir une Pull Request vers `main`

### Standards code

- TypeScript strict mode
- ESLint + Prettier configurés
- Tests obligatoires pour logique métier (calculs IVV, GMQ, protocoles vaccins)
- Documentation JSDoc pour fonctions complexes

---

## 📊 Métriques projet

### Données actuelles
- **Troupeau** : 166 animaux (68 vaches, 66 veaux actifs)
- **Vélages prévus 2025** : 62
- **Vaches pleines** : 40/68 (59%)
- **Veaux sevrés** : 26/66 (39%)
- **Veaux +6 mois** : 34/66 (52%)

### Objectifs utilisateur
- ⚡ Temps de saisie : -90% (vs Excel)
- 📉 Charge mentale : -80%
- 🎯 Zéro oubli vaccination/vélage
- 📈 IVV moyen : ≤365 jours (actuellement variable)
- 🐄 Vaches engraissées : ~10/an ciblées

---

## 📄 Licence

MIT License - voir [LICENSE](./LICENSE) pour détails

---

## 👥 Auteurs

**Commanditaires** : Samuel & Céline - Éleveurs Blondes d'Aquitaine / Charolaises

**Développement** : [Votre nom/équipe]

**Documentation** : Analyse terrain + compilation audio → Cahier des charges

---

## 🙏 Remerciements

- Samuel & Céline pour le partage détaillé de leur workflow Excel
- Communauté Next.js & Vercel
- Claude AI (Anthropic) pour l'assistance développement

---

## 📞 Support

- 📧 Email : support@troupeaupro.com
- 🐛 Issues : [GitHub Issues](https://github.com/votre-username/troupeaupro/issues)
- 💬 Discussions : [GitHub Discussions](https://github.com/votre-username/troupeaupro/discussions)

---

<div align="center">

**🐄 Fait avec ❤️ pour simplifier la vie des éleveurs**

[Documentation](./CAHIER_DES_CHARGES.md) • [Déployer sur Vercel](https://vercel.com/new/clone?repository-url=https://github.com/votre-username/troupeaupro)

</div>
