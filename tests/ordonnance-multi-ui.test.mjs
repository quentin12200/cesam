import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const [verification, medicationCard, route, detail, schema] = await Promise.all([
  readFile(new URL("../app/ordonnances/a-verifier/[id]/VerificationOrdonnanceClient.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/ordonnances/a-verifier/[id]/MedicamentVerificationCard.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/extractions-ordonnance/[id]/valider/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/ordonnances/[id]/OrdonnanceDetailClient.tsx", import.meta.url), "utf8"),
  readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
]);

test("l'ecran annonce le nombre de medicaments sans multiplier les ordonnances", () => {
  assert.match(verification, /médicament\{medicaments\.length > 1 \? "s" : ""\} détecté/);
  assert.match(verification, /Une seule ordonnance/);
  assert.match(verification, /Valider l’ordonnance/);
  assert.doesNotMatch(verification, /Valider \$\{medicaments\.length\} ordonnances/);
});

test("les correspondances ambigues exigent un choix explicite", () => {
  assert.match(medicationCard, /Plusieurs correspondances possibles — à confirmer/);
  assert.match(medicationCard, /Utiliser cette fiche/);
  assert.match(medicationCard, /Créer une fiche/);
  assert.match(verification, /medicamentsAConfirmer > 0/);
});

test("la carte principale est compacte et les donnees techniques sont repliees", () => {
  const avantDetails = medicationCard.slice(0, medicationCard.indexOf("<details"));
  assert.match(avantDetails, /Présentation|presentation/);
  assert.match(avantDetails, /Quantité/);
  assert.match(avantDetails, /Dose/);
  assert.match(avantDetails, /Délais d’attente/);
  assert.doesNotMatch(avantDetails, /Substance active/);
  assert.doesNotMatch(avantDetails, /Dose normalisée/);
  assert.doesNotMatch(avantDetails, /Instructions pratiques/);
  assert.match(medicationCard, /Voir les détails/);
  assert.match(medicationCard, /Modifier/);
  assert.match(medicationCard, /Lecture OCR/);
  assert.doesNotMatch(medicationCard, /IA :/);
});

test("la carte separe pharmacie, dose, rythme et instructions", () => {
  assert.match(medicationCard, /✓ Fiche pharmacie reconnue/);
  assert.match(medicationCard, /Médicament non reconnu dans votre pharmacie/);
  assert.match(medicationCard, /Associer à un médicament existant/);
  assert.match(medicationCard, /Créer une fiche/);
  assert.match(medicationCard, /formaterDoseCompacte/);
  assert.match(medicationCard, /protocoleCompact/);
  assert.match(medicationCard, /label="Instructions"/);
});

test("les delais viande abats et lait ne sont pas melanges", () => {
  assert.match(medicationCard, /Viande et abats/);
  assert.match(medicationCard, /Lait \{med\.milkDays\} j/);
  assert.doesNotMatch(medicationCard, /Abats \{med\.milkDays\}/);
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
