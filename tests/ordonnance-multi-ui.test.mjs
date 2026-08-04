import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const [verification, route, detail, schema] = await Promise.all([
  readFile(new URL("../app/ordonnances/a-verifier/[id]/VerificationOrdonnanceClient.tsx", import.meta.url), "utf8"),
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
  assert.match(verification, /Plusieurs correspondances possibles — à confirmer/);
  assert.match(verification, /Utiliser cette fiche/);
  assert.match(verification, /Créer cette fiche après vérification/);
  assert.match(verification, /medicamentsAConfirmer > 0/);
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
