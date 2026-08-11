import assert from "node:assert/strict";
import test from "node:test";
import {
  analyserPresentation,
  estInstructionPratique,
  formaterDose,
  formaterDoseCompacte,
  formaterPresentationCompacte,
  formaterRenouvellement,
  formaterRythme,
  formaterVoie,
  resoudreDosePratique,
} from "./ordonnance-display.ts";

test("distingue la presentation et la quantite delivree", () => {
  assert.deepEqual(analyserPresentation("1 flacon de 100 ml"), {
    presentation: "flacon de 100 ml",
    quantite: 1,
  });
});

test("conserve une presentation sans inventer de quantite", () => {
  assert.deepEqual(analyserPresentation("Flacon 250 ml"), {
    presentation: "Flacon de 250 ml",
    quantite: null,
  });
});

test("affiche la presentation et la quantite sans doublon", () => {
  assert.equal(formaterPresentationCompacte("1 flacon de 100 ml"), "Flacon 100 ml · Qté 1");
  assert.equal(formaterPresentationCompacte("Flacon 250 ml"), "Flacon 250 ml");
});

test("formate la posologie ponderale en une phrase compacte", () => {
  assert.equal(formaterDose({
    doseValue: "1",
    doseUnit: "ml",
    referenceValue: "10",
    referenceUnit: "kg",
    referenceType: "live_weight",
  }), "1 ml pour 10 kg de poids vif");
});

test("rend la voie et le protocole lisibles", () => {
  assert.equal(formaterVoie("IM"), "Intramusculaire");
  assert.equal(formaterRythme({ administrationCount: "1", administrationInstructions: "" }), "Injection unique");
  assert.equal(formaterRenouvellement({ administrationIntervalHours: "72", repeatCondition: "si les signes persistent" }), "Renouvelable après 72 h si les signes persistent");
});

test("privilegie la dose pratique en volume dans le resume", () => {
  const dose = {
    doseValue: "20", doseUnit: "mg", referenceValue: "1", referenceUnit: "kg", referenceType: "live_weight",
    formePharmaceutique: "Solution injectable",
    doseSourceText: "20 mg d'oxytétracycline par kg de poids vif, soit 1 ml pour 10 kg",
  };
  assert.equal(formaterDoseCompacte(dose), "1 ml / 10 kg");
  assert.doesNotMatch(formaterDoseCompacte(dose) ?? "", /20 mg/);
  assert.equal(formaterDose(dose), "20 mg pour 1 kg de poids vif");
});

test("affiche la dose pratique du cas reel Tenaline au lieu de combiner mg et reference volumique", () => {
  const tenaline = {
    doseValue: "20",
    doseUnit: "mg",
    referenceValue: "10",
    referenceUnit: "kg",
    referenceType: "live_weight",
    formePharmaceutique: "Solution injectable",
    doseSourceText: "20 mg d'oxytétracycline par kg de poids vif, soit 1 ml pour 10 kg",
  };
  assert.equal(formaterDoseCompacte(tenaline), "1 ml / 10 kg");
  assert.deepEqual(resoudreDosePratique(tenaline), {
    doseValue: "1",
    doseUnit: "ml",
    referenceValue: "10",
    referenceUnit: "kg",
    referenceType: "live_weight",
  });
});

test("une correction humaine des champs structures prime sur une ancienne preuve OCR", () => {
  assert.equal(formaterDoseCompacte({
    doseValue: "25",
    doseUnit: "mg",
    referenceValue: "1",
    referenceUnit: "kg",
    referenceType: "live_weight",
    formePharmaceutique: "Solution injectable",
    doseSourceText: "20 mg par kg, soit 1 ml pour 10 kg",
    preferStructuredDose: true,
  }), "25 mg / 1 kg");
});

test("une dose pratique structuree prime sur une preuve OCR plus ancienne", () => {
  assert.equal(formaterDoseCompacte({
    doseValue: "2",
    doseUnit: "ml",
    referenceValue: "10",
    referenceUnit: "kg",
    referenceType: "live_weight",
    formePharmaceutique: "Solution injectable",
    doseSourceText: "1 ml pour 10 kg",
  }), "2 ml / 10 kg");
});

test("n'invente aucune conversion entre mg et ml", () => {
  assert.equal(formaterDoseCompacte({
    doseValue: "20",
    doseUnit: "mg",
    referenceValue: "1",
    referenceUnit: "kg",
    referenceType: "live_weight",
    formePharmaceutique: "Solution injectable",
    doseSourceText: "20 mg par kg de poids vif",
  }), "20 mg / 1 kg");
});

test("ignore une dose pratique issue d'une autre preuve OCR", () => {
  const doseAvecAutrePreuve = {
    doseValue: "20",
    doseUnit: "mg",
    referenceValue: "1",
    referenceUnit: "kg",
    referenceType: "live_weight",
    formePharmaceutique: "Solution injectable",
    doseSourceText: "20 mg par kg de poids vif",
    autreSourceOcr: "1 ml pour 10 kg",
  };
  assert.equal(formaterDoseCompacte(doseAvecAutrePreuve), "20 mg / 1 kg");
});

test("ne transforme pas une consigne pratique en rythme", () => {
  const instruction = "Injection intramusculaire, administrer le flacon en position debout";
  assert.equal(estInstructionPratique(instruction), true);
  assert.equal(formaterRythme({ administrationCount: "", administrationInstructions: instruction }), null);
});

test("evite de repeter l'intervalle de renouvellement", () => {
  const result = formaterRenouvellement({
    administrationIntervalHours: "72",
    repeatCondition: "Renouvelable après 72 heures si nécessaire",
  });
  assert.equal(result, "Renouvelable après 72 heures si nécessaire");
  assert.equal((result?.match(/72/g) ?? []).length, 1);
});
