import test from "node:test";
import assert from "node:assert/strict";
import { selectGestationForCalving } from "./gestation-calving-selection.ts";

const candidate = (id: string, breeding: string, created: string) => ({
  id, saillie: { date: new Date(breeding) }, createdAt: new Date(created),
});
const calving = new Date("2026-11-09");
test("retient la saillie la plus récente avant vêlage", () => {
  const result = selectGestationForCalving([
    candidate("ancienne", "2026-01-01", "2026-11-08"),
    candidate("bonne", "2026-02-01", "2026-02-01"),
  ], calving);
  assert.equal(result?.id, "bonne");
});
test("ignore une saillie postérieure au vêlage", () => {
  assert.equal(selectGestationForCalving([candidate("future", "2026-11-10", "2026-11-01")], calving), null);
});
test("aucune gestation connue", () => assert.equal(selectGestationForCalving([], calving), null));
test("refuse une date de vêlage invalide", () => assert.equal(selectGestationForCalving([candidate("a", "2026-01-01", "2026-01-01")], new Date(NaN)), null));
test("choix stable si deux saillies ont la même date", () => {
  assert.equal(selectGestationForCalving([
    candidate("ancienne-saisie", "2026-02-01", "2026-02-01"),
    candidate("nouvelle-saisie", "2026-02-01", "2026-02-02"),
  ], calving)?.id, "nouvelle-saisie");
});
