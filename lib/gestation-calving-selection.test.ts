import test from "node:test";
import assert from "node:assert/strict";
import { selectGestationForCalving } from "./gestation-calving-selection.ts";

const candidate = (id: string, breeding: string, etat = "VERT") => ({
  id, etat, saillie: { date: new Date(breeding) }, createdAt: new Date("2026-11-01"),
});
const calving = new Date("2026-11-09");
test("associe une unique gestation confirmée", () => {
  assert.equal(selectGestationForCalving([candidate("confirmee", "2026-02-01")], calving)?.id, "confirmee");
});
test("ignore une tentative non confirmée plus récente", () => {
  assert.equal(selectGestationForCalving([
    candidate("confirmee", "2026-02-01"),
    candidate("tentative", "2026-04-01", "GRIS"),
  ], calving)?.id, "confirmee");
});
test("ne devine pas entre deux gestations confirmées", () => {
  assert.equal(selectGestationForCalving([
    candidate("premiere", "2026-02-01"),
    candidate("seconde", "2026-03-01"),
  ], calving), null);
});
test("ne confirme pas une gestation grise", () => {
  assert.equal(selectGestationForCalving([candidate("incertaine", "2026-02-01", "GRIS")], calving), null);
});
test("ne confirme pas une gestation rose", () => {
  assert.equal(selectGestationForCalving([candidate("incertaine", "2026-02-01", "ROSE")], calving), null);
});
test("ignore une saillie postérieure au vêlage", () => {
  assert.equal(selectGestationForCalving([candidate("future", "2026-11-10")], calving), null);
});
test("aucune gestation connue", () => assert.equal(selectGestationForCalving([], calving), null));
test("refuse une date de vêlage invalide", () => assert.equal(selectGestationForCalving([candidate("a", "2026-01-01")], new Date(NaN)), null));
test("ignore une gestation confirmée dont la date de saillie est invalide", () => {
  assert.equal(selectGestationForCalving([candidate("a", "date-invalide")], calving), null);
});

test("un cycle 2026 ignore une ancienne gestation confirmée du cycle 2025", () => {
  const gestations = [
    candidate("cycle2025", "2025-02-01"),
    candidate("cycle2026", "2026-02-01"),
  ];
  assert.equal(selectGestationForCalving(gestations, calving, new Date("2025-11-01"))?.id, "cycle2026");
});
test("le nouveau cycle après vêlage ne reprend pas la gestation précédente", () => {
  assert.equal(selectGestationForCalving([candidate("cycle2025", "2025-02-01")], calving, new Date("2025-11-01")), null);
});
test("deux gestations confirmées dans le même cycle restent ambiguës", () => {
  assert.equal(selectGestationForCalving([
    candidate("a", "2026-01-01"), candidate("b", "2026-02-01"),
  ], calving, new Date("2025-11-01")), null);
});
test("une gestation du jour du précédent vêlage ne devient pas le nouveau cycle", () => {
  assert.equal(selectGestationForCalving([candidate("a", "2025-11-01")], calving, new Date("2025-11-01")), null);
});
