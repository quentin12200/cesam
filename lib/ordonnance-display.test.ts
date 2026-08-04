import assert from "node:assert/strict";
import test from "node:test";
import {
  analyserPresentation,
  formaterDose,
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
  assert.equal(formaterRythme({ administrationCount: "1", administrationInstructions: "" }), "Administration unique");
  assert.equal(formaterRenouvellement({ administrationIntervalHours: "72", repeatCondition: "si les signes persistent" }), "possible après 72 h si les signes persistent");
});
