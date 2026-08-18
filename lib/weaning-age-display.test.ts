import assert from "node:assert/strict";
import test from "node:test";

import { formatWeaningAgeDays } from "./weaning-age-display.ts";

test("affiche l'âge moyen au sevrage en mois de 30 jours et jours restants", () => {
  assert.equal(formatWeaningAgeDays(18), "18 j");
  assert.equal(formatWeaningAgeDays(45), "1 mois 15 j");
  assert.equal(formatWeaningAgeDays(60), "2 mois");
  assert.equal(formatWeaningAgeDays(208), "6 mois 28 j");
});
