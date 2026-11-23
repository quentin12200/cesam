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
