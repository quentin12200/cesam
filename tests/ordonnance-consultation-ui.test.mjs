import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, client, route] = await Promise.all([
  readFile(new URL("../app/ordonnances/[id]/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/ordonnances/[id]/OrdonnanceDetailClient.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/ordonnances/[id]/route.ts", import.meta.url), "utf8"),
]);

test("ouvre une consultation complète avant le formulaire de modification", () => {
  assert.match(client, /useState\(false\)/);
  assert.match(client, /editing \? "Fermer" : "Modifier l’ordonnance"/);
  assert.match(client, /editing && <div className="bg-white/);
  assert.match(client, /medicaments\.map/);
  assert.match(page, /ordonnancesDuDocument/);
  assert.match(page, /source === sourceAttendue/);
});

test("une ordonnance de trois médicaments garde le regroupement pendant la consultation et l’édition", () => {
  assert.match(page, /ordonnanceMedicationSources\(ordonnancesDuDocument\)/);
  assert.match(page, /storageType: "legacy"/);
  assert.match(client, /medicationDrafts\.map/);
  assert.match(client, /medicaments: medicationDrafts/);
  assert.match(route, /ordonnanceMedicament\.updateMany/);
  assert.match(route, /medicament\.storageType === "legacy"/);
  assert.match(route, /tx\.ordonnance\.updateMany/);
  assert.match(route, /ordonnanceId: \{ in: ordonnanceIdsAutorises \}/);
  assert.doesNotMatch(client, /router\.push\([^)]*medicament/);
});

test("affiche séparément conditionnement et quantité à administrer", () => {
  assert.match(page, /normaliserConditionnementEnregistre/);
  assert.match(page, /evidenceJson: item\.evidenceJson/);
  assert.match(client, /formaterConditionnementVisuel\(medicament\.conditionnement\)/);
  assert.match(client, /conditionnementVisuel\.totalDoses/);
  assert.match(client, /lignesDosePratiqueConsultation\(medicament\.posologieExtraite\)/);
  assert.match(client, /dosesPratiques\.map/);
  assert.match(client, /getCategorieMedicament/);
  assert.match(page, /categorie: item\.medicament\.categorie/);
  assert.doesNotMatch(client, /`À administrer : \$\{dose\}`/);
  assert.match(client, /rounded-full bg-gray-100/);
  assert.match(client, /rounded-full bg-orange-50/);
});

test("conserve le document original et masque le renouvellement interdit de la carte", () => {
  assert.match(client, /documentUrlsAffiches\.map/);
  assert.match(client, /formaterRenouvellementUtile/);
  assert.match(client, /medicament\.repeatCondition && !renouvellement/);
});
