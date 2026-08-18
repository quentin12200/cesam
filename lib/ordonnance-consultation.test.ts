import assert from "node:assert/strict";
import test from "node:test";
import { formaterVoiesConsultation, lignesDosePratiqueConsultation } from "./ordonnance-consultation.ts";

test("sépare la dose pratique du conditionnement", () => {
  assert.deepEqual(lignesDosePratiqueConsultation("2 ml"), ["À administrer : 2 ml"]);
});

test("conserve séparément les posologies pratiques DIURIZONE", () => {
  assert.deepEqual(lignesDosePratiqueConsultation(
    "Adultes : 2 à 4 ml / 100 kg / jour\nMax : 10 ml / jour\nVeaux : 2 ml / 40–50 kg / jour",
  ), [
    "Adultes : 2 à 4 ml / 100 kg / jour",
    "Max : 10 ml / jour",
    "Veaux : 2 ml / 40–50 kg / jour",
  ]);
});

test("la dose pharmacologique seule reste hors de la vue compacte", () => {
  assert.deepEqual(lignesDosePratiqueConsultation("20 mg / 1 kg"), []);
});

test("rend les voies multiples compactes", () => {
  assert.equal(formaterVoiesConsultation("IV / IM / SC"), "IV · IM · SC");
});
