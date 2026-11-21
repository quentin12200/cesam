import test from "node:test";
import assert from "node:assert/strict";
import { rechercherActes, type ActeSanitaireReel } from "./carnet-actes.ts";

const actes: ActeSanitaireReel[] = [
  { id: "traitement:1", animalId: "a1", nutrav: "4582", nom: "Belle", date: new Date("2025-11-18T12:00:00Z"), produit: "Bovigrip", medicamentId: null, source: "Traitement", ordonnanceNumero: "ORD-124", executant: "Céline", protocoleNom: null, etapeNom: null },
  { id: "traitement:2", animalId: "a2", nutrav: "3271", nom: null, date: new Date("2024-02-05T12:00:00Z"), produit: "Antibiotique", medicamentId: null, source: "Traitement", ordonnanceNumero: "ORD-118", executant: null, protocoleNom: null, etapeNom: null },
];

test("recherche universelle médicament, animal et ordonnance sur toutes les années", () => {
  for (const q of ["bovigrip", "4582", "Belle", "ord-124"]) {
    assert.deepEqual(rechercherActes(actes, { q }).map((a) => a.id), ["traitement:1"]);
  }
});
test("recherche date française", () => {
  assert.deepEqual(rechercherActes(actes, { q: "05/02/2024" }).map((a) => a.id), ["traitement:2"]);
});
test("tri par numéro d'ordonnance dans les deux sens", () => {
  assert.deepEqual(rechercherActes(actes, { tri: "ordonnance", direction: "asc" }).map((a) => a.id), ["traitement:2", "traitement:1"]);
  assert.deepEqual(rechercherActes(actes, { tri: "ordonnance", direction: "desc" }).map((a) => a.id), ["traitement:1", "traitement:2"]);
});
