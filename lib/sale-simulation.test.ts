import assert from "node:assert/strict";
import test from "node:test";
import { parseSaleSimulationPayload } from "./sale-simulation-persistence.ts";
import { elapsedWholeDays, predictedWeight, retainedWeight, saleSimulationSummary, weightForSource, type SaleSimulationLineInput } from "./sale-simulation.ts";

const line: SaleSimulationLineInput = {
  animalId: "a1", lastWeight: 450, lastWeightDate: "2026-08-01T00:00:00.000Z", gmq: 1.2,
  predictedWeight: 462, merchantWeight: 455, manualWeight: 460, source: "LAST_WEIGHT",
  individualRefaction: null, individualPriceKg: null,
};

test("prédit le poids avec le GMQ et le nombre de jours", () => {
  assert.equal(elapsedWholeDays(new Date("2026-08-01"), new Date("2026-08-11")), 10);
  assert.equal(predictedWeight(450, 1.2, 10), 462);
});

test("n'invente aucune prédiction sans GMQ exploitable", () => {
  assert.equal(predictedWeight(450, null, 10), null);
  assert.equal(predictedWeight(450, -0.2, 10), null);
  assert.equal(predictedWeight(450, 1.2, 0), null);
});

test("conserve chaque source et choisit uniquement celle demandée", () => {
  assert.equal(weightForSource(line), 450);
  assert.equal(weightForSource({ ...line, source: "PREDICTED" }), 462);
  assert.equal(weightForSource({ ...line, source: "MERCHANT" }), 455);
  assert.equal(weightForSource({ ...line, source: "MANUAL" }), 460);
});

test("applique la réfaction sans écraser le poids utilisé", () => {
  assert.equal(retainedWeight(500, 2), 490);
  assert.equal(weightForSource(line), 450);
});

test("recalcule immédiatement le résumé du lot", () => {
  const summary = saleSimulationSummary([line, { ...line, animalId: "a2", lastWeight: 550 }], 2, 3);
  assert.deepEqual(summary, { animalCount: 2, totalUsedWeight: 1000, totalRetainedWeight: 980, totalAmount: 2940, averageAmount: 1470 });
});

test("fige le poids correspondant à la source lors de l'enregistrement", () => {
  const parsed = parseSaleSimulationPayload({ refactionGlobale: 2, prixKgGlobal: 3, lines: [{ ...line, source: "MERCHANT" }] });
  assert.equal(parsed.lines[0].poidsUtilise, 455);
  assert.equal(parsed.lines[0].lastWeight, 450);
  assert.equal(parsed.lines[0].predictedWeight, 462);
});

test("refuse une source sans poids disponible", () => {
  assert.throws(() => parseSaleSimulationPayload({ lines: [{ ...line, source: "MERCHANT", merchantWeight: null }] }), /indisponible/);
});
