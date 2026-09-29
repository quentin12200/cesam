import assert from "node:assert/strict";
import test from "node:test";
import { trierInterventionsVaccinales } from "./vaccine-schedule.ts";

test("les interventions se trient par date puis par vaccin et animal", () => {
  const entree = [
    { protocoleId: "b", vaccin: "Bovigrip", animalId: "1", nutrav: "7502", nom: null, injection: "Rappel", dateMin: new Date("2026-10-16"), dateMax: new Date("2026-10-16"), statut: "TROP_TOT" },
    { protocoleId: "b", vaccin: "Bovigrip", animalId: "2", nutrav: "7487", nom: null, injection: "Rappel", dateMin: new Date("2026-10-09"), dateMax: new Date("2026-10-09"), statut: "TROP_TOT" },
    { protocoleId: "n", vaccin: "Nasalgen", animalId: "3", nutrav: "7511", nom: null, injection: "Primo", dateMin: new Date("2026-10-09"), dateMax: new Date("2026-10-09"), statut: "TROP_TOT" },
  ];
  assert.deepEqual(trierInterventionsVaccinales(entree).map((l) => l.nutrav), ["7487", "7511", "7502"]);
  assert.equal(entree[0].nutrav, "7502");
});
