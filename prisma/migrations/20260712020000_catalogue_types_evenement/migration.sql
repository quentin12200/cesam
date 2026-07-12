-- Catalogue des types d'événements sanitaires (recherche tolérante + synonymes)
CREATE TABLE "TypeEvenement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom" TEXT NOT NULL,
    "synonymes" TEXT,
    "categorie" TEXT NOT NULL DEFAULT 'AUTRE',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "TypeEvenement_nom_key" ON "TypeEvenement"("nom");

-- Bibliothèque de questions facultatives associées à un type d'événement
CREATE TABLE "QuestionTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "typeEvenementId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "options" TEXT,
    "unite" TEXT,
    "obligatoire" BOOLEAN NOT NULL DEFAULT false,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "conditionAffichage" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestionTemplate_typeEvenementId_fkey" FOREIGN KEY ("typeEvenementId") REFERENCES "TypeEvenement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Réponses enregistrées (snapshot du libellé pour rester lisible si le modèle change)
CREATE TABLE "QuestionReponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evenementId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "libelleEnregistre" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestionReponse_evenementId_fkey" FOREIGN KEY ("evenementId") REFERENCES "EvenementSanitaire" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionReponse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuestionTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "QuestionReponse_evenementId_questionId_key" ON "QuestionReponse"("evenementId", "questionId");

-- Lien du symptôme/constat vers le catalogue (nullable pour les lignes historiques)
ALTER TABLE "EvenementSymptome" ADD COLUMN "typeEvenementId" TEXT REFERENCES "TypeEvenement"("id");

-- ── Seed du catalogue (repris des catégories existantes + renommage "Diarrhée veau" -> "Diarrhée") ──

INSERT INTO "TypeEvenement" ("id", "nom", "categorie", "synonymes") VALUES
  ('boiterie', 'Boiterie', 'SYMPTOME', 'claudication'),
  ('diarrhee', 'Diarrhée', 'SYMPTOME', 'selles molles,diarhee,diarée'),
  ('toux-essoufflement', 'Toux ou essoufflement', 'SYMPTOME', 'toux,essoufflement,dyspnee'),
  ('amaigrissement', 'Amaigrissement', 'SYMPTOME', 'maigreur,perte de poids'),
  ('fievre', 'Fièvre', 'SYMPTOME', 'temperature,hyperthermie'),
  ('blessure', 'Blessure', 'SYMPTOME', 'plaie,coupure'),
  ('probleme-peau', 'Problème de peau', 'SYMPTOME', 'dermite,gale,teigne'),
  ('troubles-nerveux', 'Troubles nerveux', 'SYMPTOME', NULL),
  ('gros-nombril', 'Gros nombril', 'SYMPTOME', 'omphalite,nombril infecte'),
  ('abattement', 'Abattement', 'SYMPTOME', 'fatigue,apathie,prostration'),
  ('piroplasmose', 'Piroplasmose', 'MALADIE', NULL),
  ('coccidiose', 'Coccidiose', 'MALADIE', NULL),
  ('mammite', 'Mammite', 'MALADIE', 'mamite,infection mamelle,inflammation pis'),
  ('metrite', 'Métrite', 'MALADIE', 'infection uterus,infection matrice'),
  ('bvd', 'BVD', 'MALADIE', NULL),
  ('ibr', 'IBR', 'MALADIE', NULL),
  ('paratuberculose', 'Paratuberculose', 'MALADIE', NULL),
  ('fievre-de-lait', 'Fièvre de lait', 'MALADIE', 'hypocalcemie,fievre vitulaire'),
  ('bronchite-vermineuse', 'Bronchite vermineuse', 'MALADIE', 'vers pulmonaires,strongles pulmonaires'),
  ('vaccination', 'Vaccination', 'PREVENTION', 'vaccin,rappel'),
  ('traitement-antiparasitaire', 'Traitement antiparasitaire', 'PREVENTION', 'vermifuge,antiparasitaire'),
  ('desinsectisation', 'Désinsectisation', 'PREVENTION', NULL),
  ('complement-vitamines', 'Complément en vitamines ou oligo-éléments', 'PREVENTION', 'vitamines,oligo-elements'),
  ('prophylaxie', 'Prophylaxie', 'PREVENTION', NULL),
  ('parage', 'Parage', 'INTERVENTION', NULL),
  ('castration', 'Castration', 'INTERVENTION', NULL),
  ('ecornage', 'Écornage ou ébourgeonnage', 'INTERVENTION', 'ebourgeonnage,decornage'),
  ('pose-aimant', 'Pose d''un aimant', 'INTERVENTION', NULL),
  ('drenchage', 'Drenchage', 'INTERVENTION', NULL),
  ('chirurgie', 'Chirurgie', 'INTERVENTION', 'operation'),
  ('euthanasie', 'Euthanasie', 'INTERVENTION', NULL),
  ('cesarienne', 'Césarienne', 'INTERVENTION', 'cesarienne'),
  ('non-delivrance', 'Non-délivrance', 'INTERVENTION', 'retention placentaire,delivrance retenue'),
  ('retournement-matrice', 'Retournement de matrice', 'INTERVENTION', 'torsion uterus,torsion matrice'),
  ('prolapsus-vaginal', 'Prolapsus vaginal', 'INTERVENTION', NULL),
  ('analyse', 'Analyse', 'ANALYSE', NULL),
  ('prelevement', 'Prélèvement', 'ANALYSE', NULL),
  ('analyse-colostrum', 'Analyse du colostrum', 'ANALYSE', NULL),
  ('controle-apres-traitement', 'Contrôle après traitement', 'ANALYSE', NULL),
  ('observation-surveillance', 'Observation ou surveillance', 'ANALYSE', 'surveillance');

-- ── Questionnaires facultatifs d'exemple ──

INSERT INTO "QuestionTemplate" ("id", "typeEvenementId", "label", "type", "options", "unite", "ordre") VALUES
  ('fievre-q1', 'fievre', 'Autre précision', 'COMMENTAIRE', NULL, NULL, 1),

  ('abattement-q1', 'abattement', 'Signes observés', 'CHOIX_MULTIPLE',
   '["Titube","Oreilles baissées","Reste couché","Mange moins","Ne boit pas","Réagit moins","Autre"]', NULL, 1),

  ('mammite-q1', 'mammite', 'Quartier concerné', 'CHOIX_MULTIPLE',
   '["Avant gauche","Avant droit","Arrière gauche","Arrière droit"]', NULL, 1),
  ('mammite-q2', 'mammite', 'Nombre de quartiers concernés', 'NOMBRE_ENTIER', NULL, NULL, 2),
  ('mammite-q3', 'mammite', 'Signes', 'CHOIX_MULTIPLE',
   '["Lait anormal","Mamelle chaude","Douleur","Gonflement","Autre"]', NULL, 3),

  ('diarrhee-q1', 'diarrhee', 'Consistance', 'CHOIX_UNIQUE', '["Molle","Liquide","Très liquide"]', NULL, 1),
  ('diarrhee-q2', 'diarrhee', 'Couleur', 'CHOIX_UNIQUE', '["Normale","Jaune","Verte","Noire","Autre"]', NULL, 2),
  ('diarrhee-q3', 'diarrhee', 'Présence de sang', 'OUI_NON', NULL, NULL, 3),
  ('diarrhee-q4', 'diarrhee', 'Déshydratation suspectée', 'OUI_NON', NULL, NULL, 4),
  ('diarrhee-q5', 'diarrhee', 'Autre', 'COMMENTAIRE', NULL, NULL, 5),

  ('boiterie-q1', 'boiterie', 'Membre concerné', 'ANATOMIE',
   '["Avant gauche","Avant droit","Arrière gauche","Arrière droit"]', NULL, 1),
  ('boiterie-q2', 'boiterie', 'Intensité', 'CHOIX_UNIQUE', '["Légère","Modérée","Importante"]', NULL, 2),
  ('boiterie-q3', 'boiterie', 'Appui', 'CHOIX_UNIQUE', '["Appui possible","Appui impossible"]', NULL, 3),
  ('boiterie-q4', 'boiterie', 'Lésion visible', 'OUI_NON', NULL, NULL, 4),
  ('boiterie-q5', 'boiterie', 'Autre', 'COMMENTAIRE', NULL, NULL, 5);

-- Relie les EvenementSymptome historiques au catalogue lorsque le libellé correspond exactement
UPDATE "EvenementSymptome"
SET "typeEvenementId" = (SELECT "id" FROM "TypeEvenement" WHERE "TypeEvenement"."nom" = "EvenementSymptome"."libelle")
WHERE EXISTS (SELECT 1 FROM "TypeEvenement" WHERE "TypeEvenement"."nom" = "EvenementSymptome"."libelle");
