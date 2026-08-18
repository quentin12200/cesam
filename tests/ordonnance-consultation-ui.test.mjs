import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, client] = await Promise.all([
  readFile(new URL("../app/ordonnances/[id]/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/ordonnances/[id]/OrdonnanceDetailClient.tsx", import.meta.url), "utf8"),
]);

test("ouvre une consultation complète avant le formulaire de modification", () => {
  assert.match(client, /useState\(false\)/);
  assert.match(client, /editing \? "Fermer" : "Modifier"/);
  assert.match(client, /editing && <div className="bg-white/);
  assert.match(client, /medicaments\.map/);
  assert.match(page, /ordonnancesDuDocument/);
});

test("affiche séparément conditionnement et quantité à administrer", () => {
  assert.match(client, /formaterPresentationCompacte\(medicament\.conditionnement\)/);
  assert.match(client, /lignesDosePratiqueConsultation\(medicament\.posologieExtraite\)/);
  assert.match(client, /dosesPratiques\.map/);
});

test("conserve le document original et masque le renouvellement interdit de la carte", () => {
  assert.match(client, /documentUrlsAffiches\.map/);
  assert.match(client, /formaterRenouvellementUtile/);
  assert.match(client, /medicament\.repeatCondition && !renouvellement/);
});
