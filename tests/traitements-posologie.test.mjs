import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const form = readFileSync(new URL("../app/sanitaire/nouvel-evenement/TraitementDraftRow.tsx", import.meta.url), "utf8");
test("selecting a medicine clears administered dose rather than copying dosage per kg", () => {
  const selection = form.slice(form.indexOf("function choisirMedicament"), form.indexOf("  return (",form.indexOf("function choisirMedicament")));
  assert.match(selection, /dose: ""/);
  assert.doesNotMatch(selection, /String\(preconisation\.dose\)|String\(m\.dosagePourKg\)/);
});
test("reference guidance is displayed with status, base, route, duration and withdrawal", () => {
  for (const field of ["p.statut","p.doseBase","p.voie","p.dureeValeur","p.delaiAttenteViandeJ","p.delaiAttenteLaitTraites","draft.medicament.delaiAttenteLaitJ"]) {
    assert.ok(form.includes(field), field);
  }
  assert.match(form,/Voir la fiche pharmacie/);
  assert.match(form,/La dose administrée reste à renseigner manuellement/);
});

import { calculerDose, preparerExecutants, referencePourCalcul } from "../app/sanitaire/nouvel-evenement/saisie-traitement.ts";

const reference = { id: "demo", statut: "VALIDE", dose: 1, unite: "mL", doseBase: "10 KG", voie: "SC" };

test("une référence validée permet le calcul avec le poids estimé", () => {
  const dose = referencePourCalcul([reference], "SC");
  assert.ok(dose);
  assert.equal(calculerDose(dose, "200"), "20");
  assert.equal(calculerDose(dose, "2,5"), "0.25");
  assert.equal(calculerDose(dose, ""), null);
  assert.equal(calculerDose(dose, "-2"), null);
  assert.equal(referencePourCalcul([{ ...reference, doseBase: "100KG" }], "SC").baseKg, 100);
  assert.equal(referencePourCalcul([{ ...reference, doseBase: "KG" }], "SC").baseKg, 1);
});

test("la quantité reste absente si la référence est ambiguë ou inexploitable", () => {
  assert.equal(referencePourCalcul([reference, { ...reference, id: "autre" }], "SC"), null);
  assert.equal(referencePourCalcul([{ ...reference, statut: "A_VERIFIER" }], "SC"), null);
  assert.equal(referencePourCalcul([{ ...reference, doseBase: "ANIMAL" }], "SC"), null);
  assert.equal(referencePourCalcul([reference], "IM"), null);
});

test("les éleveurs remontent et seul un nom existant et univoque sert de défaut", () => {
  const noms = ["Alice", "Samuel", "Céline Exemple"].map((nom) => ({ nom }));
  const { ordonnes, parDefaut } = preparerExecutants(noms);
  assert.deepEqual(ordonnes.map(({ nom }) => nom), ["Céline Exemple", "Samuel", "Alice"]);
  assert.equal(parDefaut, "Céline Exemple");
  assert.equal(preparerExecutants([{ nom: "Samuel" }]).parDefaut, "");
  assert.equal(preparerExecutants([{ nom: "Céline A" }, { nom: "Céline B" }]).parDefaut, "");
});

test("le formulaire limite le calcul à un animal et enregistre l’exécutant affiché", () => {
  const page = readFileSync(new URL("../app/sanitaire/nouvel-evenement/NouvelEvenementForm.tsx", import.meta.url), "utf8");
  assert.match(page, /selectedAnimaux\.length === 1 \? selectedAnimaux\[0\]\.id : null/);
  assert.match(page, /draft\.executant \?\? executants\.parDefaut/);
  assert.match(form, /animalPourCalcul && reference/);
  assert.match(form, /value=\{draft\.executant \?\? executantParDefaut\}/);
});
