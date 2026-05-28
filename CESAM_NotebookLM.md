# CESAM — Application de gestion d'élevage bovin
## Document de présentation — Source NotebookLM

---

## 1. QU'EST-CE QUE CESAM ?

CESAM est une application web progressive (PWA) conçue spécifiquement pour la gestion quotidienne d'un élevage bovin. Elle a été développée sur mesure pour le **GAEC Samuel & Céline**, un élevage familial de bovins.

L'application fonctionne sur **téléphone mobile, tablette et ordinateur**, sans installation. Elle est pensée pour être utilisée **sur le terrain**, les mains dans la paille, avec des gestes simples et des interfaces adaptées au tactile.

---

## 2. LE PROBLÈME QU'ELLE RÉSOUT

Un éleveur bovin gère en permanence :
- Des dizaines à centaines d'animaux, chacun avec un historique individuel
- Des calendriers de vaccination stricts (veaux, vaches gestantes)
- Des traitements médicaux avec délais d'attente réglementaires (viande, lait)
- Des cycles de reproduction (saillies, gestations, vêlages)
- Des tâches urgentes quotidiennes (boucler, sevrer, tarir, vacciner)
- Une pharmacie à gérer (stocks, ordonnances, prescriptions)
- Une traçabilité obligatoire pour les contrôles sanitaires

**Le problème :** Ces informations étaient dispersées entre carnets papier, tableurs Excel et la mémoire de l'éleveur. Pas de vue d'ensemble, risque d'oubli, perte de temps.

**La solution CESAM :** Tout centralisé, accessible en un geste, avec des alertes automatiques et une interface pensée pour les conditions réelles de la ferme.

---

## 3. LES UTILISATEURS

- **Samuel** : éleveur principal, utilise l'app sur le terrain (smartphone, mains souvent occupées)
- **Céline** : co-gérante du GAEC, suivi administratif et sanitaire
- **Le vétérinaire** : les données de l'app alimentent les ordonnances et le carnet sanitaire imprimable

---

## 4. LES MODULES PRINCIPAUX

### 4.1 — Tableau de bord (accueil)
La page d'accueil synthétise toutes les urgences du jour :
- Veaux à boucler (tâche urgente après la naissance)
- Veaux à sevrer (+ option "Sevrer quand même" pour les presque sevrables)
- Veaux à vacciner selon les protocoles définis
- Vaches gestantes à surveiller (vêlages cette semaine, en retard)
- Interventions sanitaires urgentes
- Vaccins pré-vélage à administrer (Crypto, Rotavec, Bolus)
- **Notes terrain dictées** : notes vocales enregistrées sur le terrain, à traiter le soir

Chaque alerte est interactive : un glissement ou un bouton permet de la valider directement.

### 4.2 — Troupeau
Liste complète de tous les animaux actifs avec :
- Filtres avancés : sexe, catégorie (vache, génisse, veau, taureau), état tarie/non tarie, statut reproduction, santé, groupe/lot
- Tri par numéro de travail, plus jeune d'abord, plus âgé d'abord
- Fiche individuelle par animal : âge, historique des vaccinations, traitements, événements sanitaires, gestations, vêlages, pesées, notes
- Catégories automatiques selon l'âge et le sexe : Velle (femelle < 1 an), Présélection génisse, Petite / Moyenne / Grande génisse, Vache, Veau (mâle < 15 mois), Taureau

### 4.3 — Sanitaire & Vaccination
Module central pour la santé du troupeau :
- **Vaccins veaux** : protocoles personnalisables par l'éleveur, suivi Primo/Rappel avec dates, badges visuels (urgent en rouge clignotant)
- **Vaccins vaches gestantes** : Crypto, Rotavec, Bolus pré-vélage avec boutons d'enregistrement rapide
- **Mode session de vaccination** : sélectionner plusieurs animaux d'un coup et enregistrer tout en une validation
- **Pharmacie intégrée** : stocks de médicaments, seuils d'alerte, prescriptions récentes
- **Ordonnances** : scan et archivage des prescriptions vétérinaires

### 4.4 — Reproduction
Suivi complet du cycle reproductif :
- Statut de chaque vache : pleine / vide / à échographier / en retard
- Dates de saillies et gestations
- Dates de vêlage prévues avec alertes J-7, J-21
- Génisses primipares à rapatrier à la ferme avant vêlage
- Capteurs de vêlage connectés

### 4.5 — Vêlage
Module dédié à l'enregistrement des naissances :
- Saisie rapide : mère, veau, date, qualificatif (normal, difficile, mort-né…)
- Lien automatique entre le veau et sa mère
- À la naissance : la mère repasse automatiquement en statut "Non tarie"

### 4.6 — Pharmacie
- Catalogue des médicaments avec délais d'attente viande et lait
- Stocks avec niveaux d'alerte
- Dernières prescriptions par médicament
- Impression du registre d'utilisation des médicaments

### 4.7 — Ordonnances
- Numérisation (scan) des prescriptions vétérinaires
- Saisie manuelle
- Archive consultable

### 4.8 — Plan de l'exploitation
- Import d'un plan de la ferme (photo ou image)
- Consultation avec zoom et déplacement tactile
- Accès rapide depuis le menu

---

## 5. FONCTIONNALITÉS INNOVANTES

### 5.1 — Commande vocale
Un bouton microphone flottant permet de naviguer dans l'app les mains libres :
- "Troupeau", "Sanitaire", "Reproduction" → navigation directe
- "38 78" (prononcé en deux groupes) → accès direct à la fiche de la vache n°3878
- La reconnaissance est optimisée pour les numéros d'animaux parlés à voix haute sur le terrain

### 5.2 — Dictée de notes terrain
Mode spécial du microphone (icône amber) :
- L'éleveur dicte une note librement : *"J'ai administré 20ml d'Enroflox à la 38 78, fièvre à 40°C, à surveiller"*
- La note est sauvegardée automatiquement en base de données
- Une **notification push instantanée** est envoyée sur tous les appareils abonnés (partenaire à la maison, tablette de bureau)
- Les notes apparaissent en haut du tableau de bord et peuvent être marquées "traitées" une fois l'information saisie proprement

### 5.3 — Automatisations métier
- Sevrage d'un veau → la mère passe automatiquement en statut "Tarie"
- Vêlage enregistré → la mère repasse automatiquement en "Non tarie"
- Catégorie de l'animal calculée automatiquement selon l'âge et le sexe

### 5.4 — Notifications push
- Récapitulatif quotidien le matin (alertes sanitaires, vêlages, vaccins)
- Notification immédiate à chaque note terrain dictée
- Fonctionne même si l'app est fermée (PWA + Web Push)

### 5.5 — Carnet sanitaire imprimable
- Tableau de tous les jeunes animaux avec leur statut vaccinal
- Sélection des animaux à inclure, filtre par protocole
- Cases à cocher manuelles pour validation papier
- En-tête avec les informations de l'exploitation et du vétérinaire
- Section traitements des 90 derniers jours avec délais d'attente

### 5.6 — Swipe to validate (glissement)
- Sur les listes de tâches (boucler, sevrer…), glisser vers la gauche valide l'action
- Adapté aux conditions terrain : gants, doigts mouillés, mains occupées

---

## 6. AVANTAGES CLÉS

| Problème terrain | Solution CESAM |
|---|---|
| "J'oublie de boucler le veau né cette nuit" | Alerte automatique dès la naissance enregistrée |
| "Je ne sais plus si j'ai donné le Crypto à cette vache" | Historique complet par animal, badge vert/rouge |
| "Je veux noter quelque chose mais j'ai les mains pleines de fumier" | Dictée vocale, note enregistrée en 5 secondes |
| "Mon associé n'est pas au courant de ce que j'ai fait" | Notification push instantanée sur tous les appareils |
| "Je dois imprimer le carnet sanitaire pour le véto" | Impression en un clic, format A4 paysage |
| "Le tri des animaux par âge est à l'envers" | Corrigé, configurable, mémorisé |
| "Je cherche une vache par son numéro vocal" | "38 78" à la voix → fiche ouverte en 2 secondes |

---

## 7. ASPECTS TECHNIQUES

- **Type** : Progressive Web App (PWA) — installable sur téléphone comme une app native
- **Technologie** : Next.js 15, React, TypeScript, Tailwind CSS
- **Base de données** : SQLite via Turso (hébergé, sans serveur dédié)
- **ORM** : Prisma
- **Notifications** : Web Push API (notifications même app fermée)
- **Reconnaissance vocale** : Web Speech API (native navigateur, fr-FR)
- **Hébergement** : Cloud (déploiement continu via GitHub)
- **Hors ligne** : Service Worker pour les fonctions de base sans réseau

---

## 8. CHIFFRES CLÉS DE L'APPLICATION

- **~15 modules** fonctionnels interconnectés
- **Zéro installation** requise (fonctionne dans le navigateur)
- **< 2 secondes** pour accéder à la fiche d'un animal via la voix
- **1 geste** pour valider une vaccination ou un sevrage (swipe ou bouton)
- **Notifications en temps réel** sur tous les appareils de l'exploitation

---

## 9. VISION ET PHILOSOPHIE

CESAM n'est pas un logiciel agricole générique. C'est un outil façonné par et pour une exploitation réelle, qui évolue en fonction des retours du terrain.

**Principes fondateurs :**
- **Terrain d'abord** : l'interface doit fonctionner avec des doigts sales, des gants, à la lumière du soleil
- **Zéro friction** : chaque action doit prendre le moins de gestes possible
- **Anticipation** : les alertes arrivent avant le problème, pas après
- **Traçabilité sans bureaucratie** : enregistrer prend 3 secondes, consulter aussi

L'application grandit avec l'élevage. Chaque retour utilisateur devient une amélioration concrète, déployée en quelques heures.

---

## 10. GLOSSAIRE MÉTIER

| Terme | Définition |
|---|---|
| **Nutrav** | Numéro de travail de l'animal (numéro court, ex: 3878) |
| **Nunati** | Numéro national d'identification (boucle officielle) |
| **Nobovi** | Nom de l'animal |
| **Velle** | Femelle bovine de moins d'un an destinée à la vente |
| **Génisse** | Femelle bovine n'ayant pas encore vêlé, conservée pour le troupeau |
| **Primo / Rappel** | Première injection et rappel d'un vaccin |
| **Tariée** | Vache dont la lactation est arrêtée (entre sevrage du veau et prochain vêlage) |
| **GAEC** | Groupement Agricole d'Exploitation en Commun (forme juridique) |
| **Délai d'attente** | Période après un traitement pendant laquelle le lait ou la viande ne peut pas être commercialisé |
| **Bolus** | Complément minéral en gélule administré oralement avant le vêlage |
| **IPG** | Identifiant de l'exploitation agricole |

---

*Document généré pour import dans NotebookLM — GAEC CESAM / Application de gestion bovine*
