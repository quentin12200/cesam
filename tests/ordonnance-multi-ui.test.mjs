import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const [verification, medicationCard, route, detail, schema, scanRoute, verificationPage, validationService, candidatesSource] = await Promise.all([
  readFile(new URL("../app/ordonnances/a-verifier/[id]/VerificationOrdonnanceClient.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/ordonnances/a-verifier/[id]/MedicamentVerificationCard.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/extractions-ordonnance/[id]/valider/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/ordonnances/[id]/OrdonnanceDetailClient.tsx", import.meta.url), "utf8"),
  readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
  readFile(new URL("../app/api/scan-ordonnance/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/ordonnances/a-verifier/[id]/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/ordonnance-validation.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/ordonnance-medication-candidates.ts", import.meta.url), "utf8"),
]);
const packagingEditor = await readFile(new URL("../components/ordonnances/StructuredPackagingEditor.tsx", import.meta.url), "utf8");

test("scan verification et validation partagent les memes candidats pharmacie", () => {
  assert.match(scanRoute, /chargerCandidatsOrdonnance/);
  assert.match(verificationPage, /chargerCandidatsOrdonnance/);
  assert.match(validationService, /chargerCandidatsOrdonnance/);
  assert.match(candidatesSource, /actif:\s*true/);
  const requeteMedicaments = candidatesSource.slice(0, candidatesSource.indexOf("conditionnements:"));
  assert.doesNotMatch(requeteMedicaments, /where:\s*\{\s*actif:\s*true\s*\}/);
  assert.match(verificationPage, /reevaluerCorrespondancesOrdonnance/);
});

test("la carte signale explicitement une fiche pharmacie inactive", () => {
  assert.match(medicationCard, /Pharmacie · inactive/);
  assert.match(medicationCard, /Fiche inactive — conservée pour éviter un doublon/);
  assert.match(medicationCard, /option\.actif === false/);
});

test("l'ecran annonce le nombre de medicaments sans multiplier les ordonnances", () => {
  assert.match(verification, /médicament\{medicaments\.length > 1 \? "s" : ""\} détecté/);
  assert.match(verification, /Une seule ordonnance/);
  assert.match(verification, /Valider l’ordonnance/);
  assert.doesNotMatch(verification, /Valider \$\{medicaments\.length\} ordonnances/);
});

test("les correspondances ambigues exigent un choix explicite", () => {
  assert.match(medicationCard, /Plusieurs correspondances possibles — à confirmer/);
  assert.match(medicationCard, /Utiliser cette fiche/);
  assert.match(medicationCard, /Créer dans Pharmacie/);
  assert.match(verification, /medicamentsAConfirmer > 0/);
});

test("la carte principale est compacte et les donnees techniques sont repliees", () => {
  const avantDetails = medicationCard.slice(0, medicationCard.indexOf("{med.medicationId ? ("));
  assert.match(avantDetails, /StructuredPackagingEditor/);
  assert.match(packagingEditor, /Aperçu/);
  assert.match(packagingEditor, /apercu\.totalDoses/);
  assert.match(avantDetails, /getCategorieMedicament/);
  assert.match(avantDetails, /À administrer/);
  assert.match(avantDetails, /Dose à vérifier/);
  assert.match(avantDetails, /Durée à vérifier/);
  assert.match(avantDetails, /Délai à vérifier/);
  assert.match(avantDetails, /Dose/);
  assert.match(avantDetails, /Viande\/abats/);
  assert.doesNotMatch(avantDetails, /Substance active/);
  assert.doesNotMatch(avantDetails, /Dose normalisée/);
  assert.doesNotMatch(avantDetails, /Instructions pratiques/);
  assert.match(medicationCard, /Voir les détails/);
  assert.match(medicationCard, /Modifier/);
  assert.match(medicationCard, /Lecture OCR/);
  assert.doesNotMatch(medicationCard, /IA :/);
});

test("le conditionnement structure partage propose les formes personnalisees sans les creer depuis l OCR", () => {
  assert.match(packagingEditor, /\+ Ajouter une forme/);
  assert.match(packagingEditor, /window\.localStorage\.setItem/);
  assert.match(packagingEditor, /structure\.needsVerification/);
  assert.match(packagingEditor, /choisissez une forme avant validation/);
});

test("la verification relit le vrai conditionnement depuis sa preuve sans toucher a la dose", () => {
  assert.match(verification, /normaliserConditionnementExtrait/);
  assert.match(verification, /"conditionnement", "presentation", "deliveredQuantity"/);
  assert.doesNotMatch(verification, /m\.evidence\.dose\?\.sourceText[\s\S]{0,120}conditionnement/);
});

test("la carte separe pharmacie, dose, rythme et instructions", () => {
  assert.match(medicationCard, /✓ Pharmacie/);
  assert.match(medicationCard, /Non reconnu/);
  assert.match(medicationCard, /Associer à une fiche existante/);
  assert.match(medicationCard, /Créer dans Pharmacie/);
  assert.match(medicationCard, /Changer d’association/);
  assert.match(medicationCard, /Aucune fiche ne correspond/);
  assert.match(medicationCard, /formaterDoseCompacte/);
  assert.match(medicationCard, /med\.ia\?\.evidence\.dose\?\.sourceText/);
  const calculDose = medicationCard.slice(
    medicationCard.indexOf("const dose ="),
    medicationCard.indexOf("const doseDetaillee"),
  );
  assert.doesNotMatch(calculDose, /Object\.values\(med\.ia\.evidence\)/);
  assert.match(medicationCard, /rythmeEtDuree/);
  assert.match(medicationCard, /RotateCcw/);
  assert.match(medicationCard, /label="Instructions"/);
});

test("la carte abandonne la preuve OCR des qu'une dose est corrigee manuellement", () => {
  assert.match(verification, /resoudreSourcesDose/);
  assert.match(verification, /doseValue:\s*doseRetenue\.doseValue/);
  assert.match(verification, /doseManuallyEdited:\s*med\.doseManuallyEdited \|\| champDose/);
  assert.match(medicationCard, /preferStructuredDose:\s*med\.doseManuallyEdited/);
  assert.match(verification, /doseValue:\s*med\.doseValue/);
  assert.match(verification, /referenceValue:\s*med\.referenceValue/);
});

test("la carte supprime la validation individuelle sans toucher a la validation globale", () => {
  assert.doesNotMatch(medicationCard, /useState\(false\).*validated/);
  assert.doesNotMatch(medicationCard, /setValidated/);
  assert.doesNotMatch(medicationCard, />Valider</);
  assert.match(verification, /Valider l’ordonnance/);
});

test("le formulaire de modification montre d'abord les informations pratiques", () => {
  const formulaire = medicationCard.slice(
    medicationCard.indexOf('aria-labelledby="medication-edit-heading"'),
    medicationCard.indexOf('<footer className="mt-3">'),
  );
  const avantAvance = formulaire.slice(0, formulaire.indexOf('Détails avancés'));

  assert.match(avantAvance, />Médicament</);
  assert.match(avantAvance, /Nom du médicament/);
  assert.match(medicationCard, /StructuredPackagingEditor/);
  assert.match(packagingEditor, /Conditionnement \/ quantité délivrée/);
  assert.match(avantAvance, />Administration</);
  assert.match(avantAvance, /Dose pratique/);
  assert.match(avantAvance, /doseValue/);
  assert.match(avantAvance, /referenceType/);
  assert.match(avantAvance, />Traitement</);
  assert.match(avantAvance, /administrationCount/);
  assert.match(avantAvance, />Renouvellement</);
  assert.match(avantAvance, />Délais d’attente</);
});

test("les donnees techniques restent editables dans les details avances replies", () => {
  const formulaire = medicationCard.slice(
    medicationCard.indexOf('aria-labelledby="medication-edit-heading"'),
    medicationCard.indexOf('<footer className="mt-3">'),
  );
  const avances = formulaire.slice(formulaire.indexOf('<details'));

  assert.match(avances, /Détails avancés/);
  assert.doesNotMatch(avances, /<details[^>]*\sopen(?:\s|>)/);
  for (const field of [
    "numeroLot",
    "substanceActive",
    "concentration",
    "categorie",
    "familleTherapeutique",
    "formePharmaceutique",
    "normalizedDoseValue",
    "normalizedDoseUnit",
    "administrationInstructions",
    "precautions",
  ]) {
    assert.match(avances, new RegExp(`change\\("${field}"`));
  }
  assert.match(formulaire, /categoryConfirmed/);
  assert.match(formulaire, /confirmer la catégorie/);
});

test("la carte ne repete plus le numero generique du medicament", () => {
  assert.doesNotMatch(medicationCard, /Médicament \{index \+ 1\}/);
});

test("un encadre de delais n'est affiche que lorsque des delais existent", () => {
  assert.match(medicationCard, /\{delaisComplets && \(/);
  assert.doesNotMatch(medicationCard, /Délai non détecté/);
});

test("les delais viande abats et lait ne sont pas melanges", () => {
  assert.match(medicationCard, /Viande : \$\{med\.meatDays\} j/);
  assert.match(medicationCard, /Abats : \$\{med\.offalDays\} j/);
  assert.match(medicationCard, /Lait : \{med\.milkDays\} j/);
  assert.doesNotMatch(medicationCard, /Abats \{med\.milkDays\}/);
});

test("le resume final ne montre plus les anciens compteurs techniques", () => {
  assert.match(verification, /Médicaments reconnus : \{medicamentsRattaches\}/);
  assert.match(verification, /À vérifier : \{medicamentsAConfirmer\}/);
  assert.match(verification, /Tous les médicaments sont prêts à être enregistrés/);
  assert.doesNotMatch(verification, /rattaché\{medicamentsRattaches/);
});

test("une carte est rendue pour chaque medicament", () => {
  assert.match(verification, /medicaments\.map/);
  assert.match(verification, /key=\{med\.key\}/);
  assert.match(verification, /MedicamentVerificationCard/);
});

test("la date de delivrance identique a l'ordonnance reste masquee", () => {
  assert.match(verification, /masquerDateDelivrance/);
  assert.match(verification, /deliveryDateSourcee && !masquerDateDelivrance/);
});

test("la route utilise une transaction et un seul service de creation", () => {
  assert.match(route, /prisma\.\$transaction/);
  assert.match(route, /creerOrdonnanceAvecMedicaments/);
  assert.doesNotMatch(route, /for \(const med of finale\.medicaments\)[\s\S]*tx\.ordonnance\.create/);
});

test("la fiche ordonnance affiche les medicaments lies", () => {
  assert.match(detail, /medicaments\.map/);
  assert.match(detail, /posologieExtraite/);
  assert.match(detail, /statutCorrespondance/);
});

test("le schema conserve le lien historique et ajoute la relation explicite", () => {
  assert.match(schema, /model OrdonnanceMedicament/);
  assert.match(schema, /medicamentId\s+String\?/);
  assert.match(schema, /medicaments\s+OrdonnanceMedicament\[\]/);
});
