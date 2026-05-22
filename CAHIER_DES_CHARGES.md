# Cahier des Charges Fonctionnel - TroupeauPro

**Solution Digitale de Gestion de Troupeau Bovin Allaitant**

Version 3.0 - Affiné avec analyse Excel  
Date : 22 Mai 2026

---

## Table des matières

- [Analyse du système actuel (Excel)](#analyse-du-système-actuel-excel)
  - [Architecture Excel existante](#architecture-excel-existante)
  - [Logique des codes couleurs](#logique-des-codes-couleurs)
  - [Manipulations répétitives identifiées](#manipulations-répétitives-identifiées)
- [Vision stratégique et objectifs](#vision-stratégique-et-objectifs)
- [Architecture des données](#architecture-des-données)
- [Spécifications détaillées](#spécifications-détaillées)
  - [Module Filtrage Dynamique](#module-filtrage-dynamique)
  - [Module Sanitaire](#module-sanitaire)
  - [Module Reproduction](#module-reproduction)
  - [Module Vélage](#module-vélage)
  - [Suivi Zootechnique](#suivi-zootechnique)
  - [Gestion des Sorties](#gestion-des-sorties)
  - [Localisation et Lots](#localisation-et-lots)
  - [Interface UX](#interface-ux)
  - [Alertes et Notifications](#alertes-et-notifications)
- [Priorisation MVP](#priorisation-mvp)

---

## Analyse du système actuel (Excel)

### Architecture Excel existante

Le fichier `Calendrier_des_vaches_a_jour.xlsx` comporte **3 onglets principaux** :

#### ONGLET 1 : Calendrier de suivi (68 vaches actives)

| Colonne Excel | Utilisation / Logique métier |
|---------------|------------------------------|
| **N°** | Numéro de travail à 4 chiffres (555, 568, 580, 586...) |
| **Derniers Vélages : date** | Date format série Excel (45968 = date). Calcule l'âge du veau et l'IVV |
| **Tarir : à prévoir** | Date + 6 mois = sevrage prévu. Case devient VERTE quand veau ≥6 mois |
| **Tarir : sevrage** | Nombre mois depuis vélage (6, 15, 8...) avec camembert visuel |
| **Tarir : ok** | Case cochable TRUE/FALSE. Quand TRUE → case redevient blanche |
| **I.A. et saillies : dates** | Date IA/SN. Symbole ≈ = estimation, O = groupage |
| **I.A. et saillies : E** | Marqueur si estimation (vs date IA certaine) |
| **I.A. et saillies : Père** | Nom taureau : Pepino, Mickey, Zeus, Ulysse, Argus, Spiderman, ONDENC, UMETXO, PATUA... |
| **État : date d'état** | Date dernier diagnostic |
| **État : état** | **COLONNE CLÉ** : Pleine / Vide / Pleine (avec espace) / Vide avec détails |
| **VÉLAGE : prévu le** | Date vélage calculée automatiquement. Devient ROSE quand mois en cours |
| **METRA ou Caps : à donner** | Métraboles/bolus pré-vélage. X = fait, O = prévu |
| **METRA ou Caps : date** | Date administration |
| **NOTES** | Texte libre : "Jumeaux?", "BOLUS 01/04/25", "métrite", "II - césarienne", "groupage loupé", "2 tétines A REFORMER !", "FCO", "Femelle ?", "Matrice 24- veau bloqué25", "pas pu fouiller (corne cassée)", "à réformer", "cyclée + estrumate", "Pas Cyclée", "à revoir - mettre métrabol", "III METRABOL", "faire sexé" |
| **RENOUVELLEMENT** | Colonne années vélages : 22-23, 23-24, 24-25, 25-26, 26-27, 27-28, 28-29 (tracking historique) |

#### ONGLET 2 : Suivi Veaux (66 veaux actifs)

| Colonne Excel | Utilisation / Logique métier |
|---------------|------------------------------|
| **PERES** | Nom taureau (Zeus, Mickey, Pepino, Argus, etc.) |
| **MERES** | Numéro mère (592, 3281, 3235, 568...) |
| **Date de naissance** | Format série Excel |
| **Âge** | Calculé automatiquement : "0 m 13 j", "1 m 1 j", "6 m 1 j", "10 m 26 j"... |
| **SEX** | F / M / G (génisse = femelle gardée pour renouvellement) |
| **ID** | TRUE/FALSE = bouclé ou non |
| **VEAUX** | Numéro veau (7492, 7491, 7490, 9262...) |
| **NASALGEN 1 / 2** | Colonnes avec TRUE/FALSE + date. Suivi primo et rappel +3 mois |
| **NASYM 1 / 2 / 3** | TRUE/FALSE + date. Protocole complexe 9j-2,5mois nasal / >2,5mois IM. Mentions 'annulé', 'RISP27/04' |
| **HIPRABOVIS 1 / 2** | TRUE/FALSE + date. À partir 1 mois SC + rappel 3 semaines |
| **MHE** | Colonne avec commentaire 'prêt MHE' quand âge >2 mois. Obligatoire pour vente |
| **SEVRÉ** | TRUE/FALSE. Compteur : 34 veaux +6 mois, 26 sevrés |
| **à faire par nous** | Colonne notes libres |

#### ONGLET 3 : Vélages (planning prévisionnel)

Liste chronologique des vélages prévus avec colonnes : **prévu le**, **N°**, **Père**, **SEV** (sevrage), **CRYPTO**, **ROTAVEC** (vaccins pré-vélage), **smartvel** (capteur).

**Total prévu 2025 : 62 vélages**

---

### Logique des codes couleurs

Système visuel complexe actuellement géré par formules conditionnelles :

| Couleur | Signification | Application Excel |
|---------|---------------|-------------------|
| **🔘 GRIS** | Saillie récente (J0-J35) : trop tôt pour échographier | Case 'État' automatique |
| **🟡 JAUNE/BLANC** | J+35-40 : bientôt prêt à échographier | Mise en forme conditionnelle rayée |
| **🟡 JAUNE** | J+40+ : à échographier. Céline filtre les cases jaunes pour établir la liste fouille | Peut aussi être forcé manuellement avec 'F' dans case |
| **🟢 VERT** | Pleine confirmée OU Veau ≥6 mois (sevrage) | État='Pleine' OU colonne Tarir |
| **🔴 ROUGE** | Vide OU >2 mois post-vélage sans saillie : ALERTE | État='Vide' OU délai dépassé |
| **🌸 ROSE** | Approche J+50 post-vélage : bientôt surveillance chaleur OU mois vélage en cours | Colonne 'VÉLAGE prévu le' |
| **⚪ BLANC** | Action réalisée (sevrage fait, bolus donné) | Case cochée TRUE |

---

### Manipulations répétitives identifiées

Analyse des tâches chronophages mentionnées dans l'audio :

- **Filtrage manuel des cases jaunes** : _"je filtre à nouveau, je vois ça rassemble toutes les vaches qui sont prêtes à être tari"_
- **Navigation entre onglets** : _"le problème c'est que j'ai pas le numéro des vaaux, faut que j'aille dans un autre onglet"_
- **Calculs manuels dates** : _"je note moi sur un papier après je calcule le nombre de jours à partir on est quel jour aujourd'hui ? Il a dit que c'était 75 jours. Donc je mets la date, je mets ça fait 75 jours estimés"_
- **Impression listes pour terrain** : _"j'ai une liste que j'imprime à chaque fois grâce au tableau dynamique"_
- **Saisie poids et GMQ** : _"du coup je fais tout ça manuellement et ça dure 1000 ans"_
- **Vérification 36 protocoles vaccins** : _"c'est une gestion ultra complexe parce que ça dépend de l'âge, ça dépend les rappels sont différents"_
- **Recherche information éparpillée** : _"j'ai déjà vu que tu avais mis un bouton vélage. Voilà. Euh donc après c'est l'heure euh du vélage"_

---

## Vision stratégique et objectifs

### Contexte et problématique

L'exploitation d'élevage bovin allaitant de Samuel et Céline repose actuellement sur un système Excel complexe avec formules, codes couleurs et multiples onglets. Cette organisation génère une **charge mentale importante** et nécessite une consultation quotidienne fastidieuse de tous les onglets.

**Points de friction identifiés :**

- Manipulation manuelle intensive (saisie, calculs, filtres répétés)
- Navigation entre multiples onglets (vaches, veaux, historiques, finances)
- Doublons d'information entre tableaux
- Absence d'alertes proactives (risque d'oubli critique)
- Temps de mise à jour conséquent
- Difficultés de coordination entre Samuel et Céline (SMS, rappels téléphone séparés)

### Objectifs stratégiques

**Transformation d'un outil passif (base de stockage) en assistant de pilotage proactif.**

**Piliers de l'impact produit :**

- **Libération du temps de cerveau** : l'outil devient le gardien du calendrier et anticipe les besoins
- **Simplicité radicale (UX)** : interface ludique, visuelle, mobile-first, sans surcharge cognitive (pas de 15 000 boutons)
- **Automatisation intelligente** : notifications push et emails pour échéances sanitaires, reproduction, vélages
- **Centralisation des flux** : point de vérité unique (identification, généalogie, sanitaire, performances)
- **Optimisation des actions** : regroupement des interventions (vaccins par lot, parages groupés, etc.)

---

## Architecture des données

### Règle fondamentale : Unicité du numéro de travail

> ⚠️ **CONTRAINTE ABSOLUE** : Le numéro de travail (NUTRAV) à 4 chiffres est la clé unique métier. Aucun doublon n'est tolérable dans le système.

### Entités de base

| Champ | Description | Format |
|-------|-------------|--------|
| **NUNATI** | Numéro national officiel (identifiant unique légal) | String (10 digits) |
| **NUTRAV** | Numéro de travail - **CLÉ UNIQUE MÉTIER** | String (4 digits) |
| **NOBOVI** | Nom de l'animal (optionnel mais utilisé) | String |
| **DANAIS** | Date de naissance (pivot calcul âge, GMQ, IVV) | Date (DD/MM/YYYY) |
| **SEXBOV** | Sexe (détermine algorithmes reproduction) | Enum (F/M) |
| **NUMEIP** | Numéro national de la mère | String (10 digits) |
| **NUPERE** | Numéro national du père | String (10 digits) |

### Intégration Workflow Sinel

**Système de gestion des stocks de boucles :**

- Les boucles d'identification sont fournies par Sinel en boîtes pré-numérotées
- À chaque vélage réussi, attribution automatique du numéro suivant disponible
- Alerte lorsque 5 veaux ne sont pas encore bouclés
- Alerte rouge à 15 veaux non bouclés
- **Exception mort-né** : pas d'attribution de numéro de travail si le veau est mort-né

---

## Spécifications détaillées

### Module Filtrage Dynamique

Remplacer les 8 manipulations de filtres Excel par des vues intelligentes :

#### VUE 1 : À Échographier (case jaune Excel)

**Critères** : J+40 après saillie OU manuellement ajouté

**Fonctionnalités** :
- Badge compteur : "7 vaches à échographier"
- Actions : Imprimer liste, cocher au fur et à mesure, saisir résultat écho

#### VUE 2 : À Sevrer (case verte Excel)

**Critères** : Veaux ≥6 mois non sevrés

**Fonctionnalités** :
- Alerte progressive : 5 veaux → 10 veaux → 15 veaux
- Affichage : Liste avec mère + numéro veau (résout problème navigation onglets)

#### VUE 3 : Vides en Retard (case rouge Excel)

**Critères** : État='Vide' OU >60 jours post-vélage sans saillie

**Fonctionnalités** :
- Affichage prioritaire : en tête dashboard rouge

#### VUE 4 : Vaccination Pré-Vélage

**Critères** : Gestation entre J-90 et J-21

**Fonctionnalités** :
- Liste Crypto/Rotavec non faits (colonnes Excel actuelles)
- Regroupement par fenêtre (éviter 1 par jour)

---

### Module Sanitaire

#### OCR Ordonnances

Bouton Sanitaire → Fonction Scanner avec extraction automatique :

- **Métadonnées** : numéro d'ordonnance, vétérinaire prescripteur, date
- **Médicaments** : nom molécule, voie d'administration
- **Voies disponibles** : Intranasal, Intramusculaire, Sous-cutané, Oral
- **Dosage dynamique** : croisement médicament + poids/âge animal → suggestion dose précise
- **Résilience** : en cas d'échec OCR, proposer Manual Override (saisie assistée)

#### Protocoles Vaccination Veaux

Reproduire **EXACTEMENT** la logique des colonnes Excel avec TRUE/FALSE + dates :

| Vaccin | Règles calcul | Interface proposée |
|--------|---------------|-------------------|
| **NASALGEN** | Dès naissance : TRUE + date primo<br>Rappel : date primo + 90j | Checklist avec dates calculées + alerte 'annulé' si manqué |
| **NASYM** | SI âge 9j-75j : Nasal + TRUE<br>&nbsp;&nbsp;ALORS rappel +56j IM<br>SI âge >75j : IM + TRUE<br>&nbsp;&nbsp;ALORS rappel +28j IM | Calcul automatique voie + délai selon date primo |
| **HIPRABOVIS** | Éligibilité : âge ≥30j<br>Primo SC + TRUE<br>Rappel : +21j SC | Badge 'Prêt Hiprabovis' dès 1 mois. Flacon 10 doses → alerte tous les 10 |
| **MHE** | Éligibilité : âge ≥60j<br>Rappel : +21j | **🔴 BADGE ROUGE si >2 mois et MHE manquant (OBLIGATOIRE vente)** |

> ⚠️ **POINT CRITIQUE** : Gérer les 'annulé' dans Excel
>
> Observation Excel : colonnes NASYM avec mentions 'annulé', 'RISP27/04'. Signifie que le protocole initial n'a pas pu être respecté (veau malade, absence éleveur, etc.). La solution DOIT permettre :
> - De marquer une étape comme 'annulé/reporté'
> - De recalculer automatiquement le protocole adapté
> - De garder trace des modifications (historique)

#### Protocoles Vaccination Vaches

**Crypto & Root** : vaccination entre 3 mois avant vélage et 3 semaines avant vélage (fenêtre d'intervention)

- Flacons de 10 à 50 doses (à préciser)
- **🔴 CRITIQUE** : aucune vache ne doit être manquée (risque diarrhée néonatale mortelle)
- Liste des vaches dans la fenêtre avec rappel

#### Enregistrement Événements Sanitaires

Bouton Sanitaire → Événement médical :

- **Problèmes constatés** : mammite, boiterie, métrite, matrice, etc.
- **Horodatage obligatoire**
- **Photos obligatoires** pour suivi d'évolution
- Historique complet par animal pour détection vaches à problèmes

#### Module Parage

Sélecteur visuel (diagramme bovin cliquable) :

- Sélection multiple pattes : Avant-Gauche, Avant-Droit, Arrière-Gauche, Arrière-Droit
- Système de cases cochables
- Enregistrement numéro animal + date
- Lien avec observation boiterie → proposition parage automatique

---

### Module Reproduction

#### Cycle complet de reproduction

**ÉTAPE 1 : Observation Chaleur**

Bouton Chaleur → Enregistrement :
- Date (par défaut aujourd'hui, modifiable si oubli)
- Numéro vache
- **Rappel automatique 21 jours après** (cycle reproduction) pour surveillance prochaine chaleur
- Utilité : prévoir mise avec taureau ou appel inséminateur sous 12h

**ÉTAPE 2 : Saillie**

Deux options :

**A) Insémination Artificielle (IA)** :
- Sélection taureau IA (base de données avec numéros + noms)
- Date exacte de l'IA (certitude pour calcul gestation)
- Compteur tentatives IA (affichage barres : 2 barres = 2e tentative, etc.)
- **Motif engraissement si ≥4 tentatives infructueuses**

**B) Saillie Naturelle (SN)** :
- Menu déroulant : taureaux présents sur exploitation
- Date estimée de saillie

**ÉTAPE 3 : Groupage (Synchronisation)**

Protocole hormonal pour synchroniser chaleurs :
- **Pose spirale** : date + horaire (matin/soir)
- **Notification enlèvement spirale** : X jours après pose (à définir avec Samuel)
- **Notification IA groupée** : Y jours après enlèvement
- Planning visible pour coordination inséminateur

#### États de gestation (Système visuel)

| État | Description | Code couleur |
|------|-------------|--------------|
| **Saillie récente** | J0 à J+35 : trop tôt pour échographier | 🔘 Gris |
| **Pré-diagnostic** | J+35 à J+40 : bientôt prêt | 🟡 Moitié jaune/blanc |
| **À échographier** | J+40+ : diagnostic gestation possible | 🟡 **Jaune** |
| **Pleine confirmée** | Gestation confirmée par écho | 🟢 **Vert** |
| **Vide** | Gestation négative ou >2 mois post-vélage sans saillie | 🔴 **Rouge** |
| **Surveillance proche** | Approche 2 mois post-vélage | 🌸 Rose |

#### Diagnostic gestation (Écho/Fouille)

Liste dynamique des vaches à échographier :
- Accumulation automatique (cases jaunes)
- Ajout manuel possible (vaches vides >4 mois sans chaleur observée)
- Badge compteur visible sans cliquer (ex: 7 vaches à échographier)
- Liste imprimable et checkable

**Résultats possibles après échographie :**

**1) PLEINE** :
- Si date IA connue → validation automatique
- Si saillie naturelle/non observée → saisie nombre de jours gestation → calcul automatique date vélage prévue
- Option correction date si incohérence
- **Durée gestation configurable** : 9 mois + 10-20 jours (Blondes d'Aquitaine)

**2) VIDE avec sous-options** :
- **Bientôt en chaleur** : vétérinaire détecte chaleur imminente
- **Cyclée / Non cyclée** : système reproductif actif ou en pause
- **Problème ovaire** : kyste, corps jaune persistant, etc.

**3) À REVÉRIFIER** :
- Doute du vétérinaire → nouvel examen prévu

#### Gestion avortements

Interruption de gestation :
- Observation chaleur alors que pleine → avortement détecté
- Annulation automatique gestation + vélage prévu
- Traçabilité événement pour historique vache
- Redémarrage cycle reproduction

---

### Module Vélage

#### Préparation vélage

**Gestion génisses primipares (surveillance renforcée)** :
- **Alerte à 8 mois et demi gestation** : "Attention vélage génisse à prévoir"
- Rapatriement ferme requis (risque assistance nécessaire)
- Liste génisses à rapatrier (filtrage automatique)

**Alerte générale vélages** :
- **À 9 mois gestation** : début surveillance active
- **À 9 mois + 1 semaine** : pose capteur obligatoire
- Liste ordre vélages prévus (vision anticipation)

#### Gestion capteurs vélage

4 capteurs disponibles (numérotés 1-2-3-4) :
- Attribution capteur lors pose (sélection 1/2/3/4)
- Visualisation 'Qui porte quel capteur ?'
- Libération automatique après vélage (info devient caduque)
- Utilité : alerte nuit → identification rapide box

#### Enregistrement vélage

**Points d'accès multiples** :
- Depuis fiche vache → bouton vélage
- Depuis bouton général Vélage → saisie numéro vache

**Données saisies** :
- **Père** : récupération auto si IA/SN enregistrée, sinon sélection manuelle (taureaux présents ou inconnu)
- **Sexe** : Mâle / Femelle
- **Jumeaux** : case optionnelle (rare mais possible)
- **Nom** : optionnel
- **Numéro travail** : attribution automatique numéro suivant (sauf mort-né)

#### Qualificatifs vélage

**Vélage Normal / Difficile avec sous-types** :
- Vélage rapide
- Intervention nécessaire
- Veau trop gros
- Veau mal positionné
- Césarienne
- Matrice (révolution utérine)
- **Mort-né** : PAS d'attribution NUTRAV, événement archivé pour IVV mère

**Traçabilité historique** :
- Information veau : "Naissance difficile - gros veau" visible dans fiche
- Information vache : césariennes, matrices, etc. → aide décision engraissement

#### Post-vélage

**Complications possibles (suivi)** :
- **Métrite** : inflammation matrice (mauvaise délivrance placenta)
- Enregistrement sanitaire avec photos

**Redémarrage cycle reproduction** :
- **Délai avant surveillance chaleur : 2 mois post-vélage**
- Alerte rose à J+50 (approche surveillance)
- Alerte rouge à J+60 si aucune chaleur détectée

---

### Suivi Zootechnique

#### Module Pesée et GMQ

**Enregistrement poids** :
- Date + Numéro animal + Poids (kg)
- **Calcul automatique GMQ** : (Poids actuel - Poids précédent) / Nombre jours
- GMQ 30 jours glissant (moyenne récente)
- **Courbe de croissance** intégrée fiche animal (détection décrochages)
- Historique complet avec graphique

#### Sevrage veaux

**Gestion par lots (optimisation temps)** :
- **Âge sevrage : 6 mois**
- Liste dynamique veaux à sevrer (accumulation)
- Alerte tous les 5 veaux éligibles
- Visualisation âge (camembert 0-6 mois)
- Case cochable 'Sevré' → passage blanc
- Lien avec déplacement lots (veaux sevrés restent intérieur, mères partent extérieur)

#### Compléments alimentaires

**Capsules bolus & Métraboles** :
- Checklist distribution
- Planification prévisionnelle (ex: 3 semaines avant vélage)
- Regroupement interventions (fenêtre 1,5 mois à 3 semaines pré-vélage)
- Historique avec date

#### IVV (Intervalle Vélage-Vélage)

**Indicateur clé de performance reproduction** :
- **Objectif : 365 jours (idéal ≤365)**
- Calcul automatique entre vélages successifs
- Code couleur : vert (bon) → rouge (>365 jours)
- Moyenne par vache (historique complet)
- Classement vaches (meilleure → pire IVV)
- Aide décision engraissement (vaches mauvais IVV récurrent)

---

### Gestion des Sorties

#### Types de sorties

**A) MORT** :
- Date + Cause (si connue)
- Archivage sans donnée commerciale

**B) ÉLEVAGE (Vente vif)** :
- Acheteur (nom du marchand/maquignon)
- **Prix au kilo vif**
- Poids vif (pesée ou estimation)
- **Prix prévu HT** : calcul auto (poids × prix/kg)
- Prix définitif après réception facture (ajustable)

**C) BOUCHERIE (Vente carcasse)** :
- Acheteur
- **Prix au kilo carcasse**
- Poids carcasse (pesée abattoir)
- Calcul prix HT automatique
- Ajustement prix définitif

**D) ENGRAISSEMENT (Statut particulier)** :
- Présélection : case 'Prévu engraissement'
- Démarrage engraissement : validation groupe présélectionné
- **Compteur jours d'engraissement**
- Sortie finale vers Boucherie → durée totale enregistrée
- Statistiques : moyenne durée, nombre vaches engraissées/an

#### Statistiques commerciales

**Par année calendaire** :

**VEAUX** :
- Nombre vendus (mâles / femelles séparés)
- Poids moyen vif payé
- Prix moyen au kilo
- Prix moyen par tête
- Total kilos vendus
- Chiffre d'affaires total veaux
- Répartition par acheteur (% et valeur)

**VACHES** :
- Nombre engraissées
- Durée moyenne engraissement
- Poids moyen carcasse
- Prix moyen au kilo carcasse
- Total kilos vendus
- Chiffre d'affaires total vaches

**GLOBAL** :
- CA total (veaux + vaches)
- Kilos totaux
- Évolution vs année N-1 (€ et kg)
- Intégration aides PAC & PSE
- Chiffre d'affaires prévisionnel total

#### Critères décision engraissement

**Objectif annuel : ~10 vaches** (9 ventes + 1 mort)

**Indicateurs déclencheurs** :
- IVV élevé récurrent
- ≥4 tentatives IA infructueuses
- Césariennes répétées
- Événements sanitaires récurrents
- Mamelle déficiente (<3 trayons fonctionnels)
- Classement IVV moyen (tri automatique)

---

### Localisation et Lots

#### Problématique

Besoin de localisation pour optimisation interventions (vaccins, parages, etc.) : _"Elles sont où les vaches à vacciner ? 3 d'un côté, 2 de l'autre..."_

#### Système de parcelles/zones

**Création libre d'emplacements** :
- **Prés** : Vialette, Tour Ronde, Préonde
- **Bâtiments** : Vieille stabulation, Nouvelle stabulation
- **Box** : Premier box gauche, Premier box droit
- **Externe** : Chez Jacques, etc.

#### Fonctionnement

**Mode Prévision / Effectif** :
- **Prévision (grisé)** : vaches planifiées pour déplacement
- **Effectif (non grisé)** : vaches actuellement à cet emplacement

**Déplacement** :
- Sélection groupe vaches (multi-sélection)
- Glisser-déposer vers nouveau pré/bâtiment
- Validation déplacement → passage effectif
- Retrait automatique ancien emplacement

#### Logique de constitution lots

**Critères fréquents** :
- Vaches avec veaux petits
- Vaches sans veau (taries)
- Vaches vélage lointain → prés éloignés
- Vaches vélage proche → rapatriement ferme
- Statut sevrage (veaux sevrés dedans, mères dehors)

#### Utilité planning pâturage

- Requis pour certains labels (traçabilité parcellaire)
- Optimisation interventions : liste vaches + emplacements → regroupement actions
- Exemple : "5 vaches à vacciner : 3 à Vialette, 2 à Tour Ronde" → planification trajet

---

### Interface UX

#### Principes fondamentaux

- **Mobile-First** : optimisé pour usage extérieur, terrain, intempéries
- **Ludique et Pratique** : jeune couple (30 ans) habitué technologies modernes
- **Simplicité radicale** : PAS de 15 000 boutons
- **Visuel** : codes couleurs, badges, icônes, camemberts d'âge
- **Intuitive** : l'information vient à l'utilisateur (proactive)
- **Pas de répétition** : minimiser saisies manuelles et manipulations

#### Structure Tableau de Bord

**Hiérarchisation Information** :

**1) Focus Journalier "CE QUE JE DOIS FAIRE AUJOURD'HUI"** :
- Traitements du jour
- Alertes vélage imminent
- Interventions sanitaires urgentes

**2) Focus Hebdomadaire (Anticipation J+7)** :
- Vaccins à acheter
- Pesées prévues
- Vélages semaine prochaine

**Codes Couleurs Universels** :
- 🔴 **Rouge** : Retard / Urgent
- 🟠 **Orange** : J-7 / Anticipation
- 🟢 **Vert** : Fait / OK
- 🟡 **Jaune** : À faire (ex: échographier)
- ⚫ **Gris** : Attente (ex: gestation J0-J35)

#### Fiche individuelle 360°

**Centralisation complète par animal** :

- **Identité** : NUTRAV, NUNATI, Nom, Date naissance, Âge calculé, Sexe, Race
- **Généalogie** : Mère (nom + numéro), Père (nom + numéro), Descendants (liste cliquable)
- **Sanitaire** : Timeline complète avec dates, Photos évolution pathologies
- **Performances** : Dernier poids, GMQ 30j, Courbe croissance
- **Reproduction** : Date vélage prévue, IVV moyen, Statut actuel, Historique saillies
- **Parage** : Historique interventions avec dates et pattes
- **Compléments** : Bolus, métraboles distribués
- **Localisation** : Emplacement actuel
- **Notes** : Espace libre (ex: "femelle pressenti par véto", "groupage raté 2x", "2 tétines fonctionnelles")

#### Modalités d'interaction

**Sélecteurs Visuels (minimiser saisie textuelle)** :
- Diagramme bovin cliquable (parage)
- Menus déroulants (taureaux, acheteurs, médicaments)
- Cases cochables (tari, bouclé, sevré)
- Badges compteurs ("5 vaches à échographier")

**Multi-Support** :
- Version mobile (smartphone terrain)
- Version desktop/tablette (gestion administrative)
- Listes imprimables (vaccins, échographies, etc.)

---

### Alertes et Notifications

#### Stratégie multicanal

**A) Notifications Push Mobile** :
- Événements critiques immédiats
- Rappels opérationnels (ex: "Mettre capteur vache 816")
- Alertes vélage détecté (capteur)

**B) Email Hebdomadaire** :
- Récapitulatif stratégique dimanche soir
- Programme semaine à venir
- Anticipation J+7 (achats vaccins, etc.)

#### Moteur de règles temporelles

**Sanitaire** :
- Campagnes annuelles fixes (ex: Crypto janvier-février)
- Rappels vaccination à J-7 (anticipation achat)
- Protocoles veaux âge-dépendants (Nasym, Hiprabovis, MHE)

**Reproduction** :
- Chaleur J+21 après saillie échouée
- Échographie J+40 post-saillie
- Surveillance chaleur J+60 post-vélage
- Groupage multi-étapes (pose spirale → retrait → IA)

**Vélage** :
- J-90 génisse : rapatriement ferme
- J-30 : début surveillance active
- J-23 : pose capteur obligatoire
- Fenêtre bolus pré-vélage (J-45 à J-21)

**Gestion** :
- Sevrage : alerte tous les 5 veaux ≥6 mois
- Bouclage : alerte 5 veaux non bouclés, rouge à 15
- Vaccins lot : quand 5 animaux éligibles pour flacon

#### Paramétrage délais

**Préférences utilisateur configurables** :
- Anticipation vaccins : par défaut J-7 (modifiable)
- Seuils alertes lot (5/10/15 animaux)
- Durée gestation race (9m+10j à 9m+20j Blondes d'Aquitaine)

---

## Priorisation MVP

### Architecture MVP (Minimum Viable Product)

**PRIORITÉ 1 - Fondations Données (Critiques)** :
- Import CSV initial
- Schéma relationnel : NUTRAV unique + liens généalogiques
- Gestion boucles Sinel
- Fiche animal 360°

**PRIORITÉ 2 - Moteur Temporel & Alertes** :
- Calcul IVV automatique
- Alertes vélage (J-90 génisse, J-30 général, J-23 capteur)
- Rappels vaccination J-7
- Notifications push + email hebdo

**PRIORITÉ 3 - Modules Métier Core** :
- Reproduction : chaleur → saillie → écho → vélage
- Sanitaire : protocoles vaccins veaux/vaches
- Pesée & GMQ
- Sevrage automatisé

**PRIORITÉ 4 - Interface Mobile-First** :
- Tableau de bord (focus jour/semaine)
- Codes couleurs (rouge/orange/vert)
- Sélecteurs visuels (diagramme parage)
- Listes checkables/imprimables

**PRIORITÉ 5 - Features Avancées** :
- OCR ordonnances + validation manuelle
- Groupage synchronisation
- Localisation & gestion lots
- Statistiques commerciales annuelles
- Historique photos pathologies

### Critères de succès

**Objectifs Mesurables** :
- **Réduction charge mentale** : zéro consultation Excel quotidienne
- **Gain temps** : division par 10 du temps manipulation données
- **Zéro oubli critique** : 100% alertes vaccination + vélage
- **Coordination Samuel/Céline** : plateforme unique vs SMS éparpillés
- **Optimisation IVV** : tendance ≤365 jours grâce suivi proactif

---

## Calculs automatiques critiques

### Âge précis 'X mois Y jours'

**Format actuel** : "0 m 13 j", "6 m 1 j", "10 m 26 j"

**Calcul** : temps réel : aujourd'hui - date_naissance

**Utilisé pour** : éligibilité vaccins, sevrage, génisses

### Date vélage prévue (9 mois + 10-20 jours)

**Blondes d'Aquitaine** : gestation 275-285 jours

**Calcul** : Date saillie + 275j = date affichée dans colonne Excel

**Règle visuelle** : Case devient ROSE quand mois en cours

> ⚠️ **Problème Excel actuel** : _"je note moi sur un papier après je calcule le nombre de jours... Donc je mets la date, je mets ça fait 75 jours estimés. Donc ça veut dire que 75 jours avant c'est telle date et après je mets la date dans ma case"_

**Solution** : Si vétérinaire dit '75 jours gestation' → système calcule date saillie rétroactive

### Camembert progression âge veau

**Excel actuel** : colonne sevrage avec diagramme circulaire se remplissant de 0 à 6 mois.

Citation audio : _"j'ai un petit croissant, un petit camembert qui avance au fur et à mesure qui me permet de voir à peu près qui c'est qui à quel stade au niveau de l'âge"_

**Graduation** :
- 0-25% rempli : veau <1,5 mois
- 50% rempli : veau ~3 mois
- 75% rempli : veau 4,5-5 mois → _"lui il a peut-être bientôt 6 mois"_
- 100% : ≥6 mois → case verte

---

## Conclusion

Cette version affinée du cahier des charges s'appuie sur l'analyse approfondie du fichier Excel réel de Samuel et Céline. Les spécifications intègrent désormais :

- **La logique exacte des codes couleurs** avec leurs conditions de déclenchement
- **Les noms réels des colonnes Excel** et leur utilisation métier
- **Les cas particuliers observés** (annulé, groupage, estimations, notes libres)
- **Les manipulations répétitives identifiées** à automatiser en priorité
- **Les compteurs et statistiques existants** (34 +6 mois, 40 pleines sur 68)
- **Les formats d'affichage attendus** (dates série Excel, âge 'X m Y j', camembert progression)

Les développeurs disposent maintenant d'une spécification technique précise permettant de reproduire **EXACTEMENT** le comportement Excel tout en éliminant ses points de friction.

---

**Contacts**  
Samuel & Céline - Éleveurs Blondes d'Aquitaine / Charolaises  
Troupeau : 166 animaux (68 vaches, 66 veaux actifs)  
Localisation : France
