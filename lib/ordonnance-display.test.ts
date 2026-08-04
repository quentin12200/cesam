import assert from "node:assert/strict";
import test from "node:test";
import {
  analyserPresentation,
  estInstructionPratique,
  formaterDose,
  formaterDoseCompacte,
  formaterRenouvellement,
  formaterRythme,
  formaterVoie,
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
  assert.equal(formaterRythme({ administrationCount: "1", administrationInstructions: "" }), "1 injection");
  assert.equal(formaterRenouvellement({ administrationIntervalHours: "72", repeatCondition: "si les signes persistent" }), "renouvelable après 72 h si les signes persistent");
});

test("privilegie la dose pratique en volume dans le resume", () => {
  const dose = {
    doseValue: "1", doseUnit: "ml", referenceValue: "10", referenceUnit: "kg", referenceType: "live_weight",
    normalizedDoseValue: "20", normalizedDoseUnit: "mg/kg",
  };
  assert.equal(formaterDoseCompacte(dose), "1 ml / 10 kg");
  assert.doesNotMatch(formaterDoseCompacte(dose) ?? "", /20 mg/);
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
