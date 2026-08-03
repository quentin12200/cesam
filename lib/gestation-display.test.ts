import assert from "node:assert/strict";
import test from "node:test";
import { formatGestationDuration } from "./utils.ts";

const cases: Array<[number | null | undefined, string]> = [
  [0, "Gestante 0 j"],
  [30, "Gestante 30 j"],
  [59, "Gestante 59 j"],
  [60, "Gestante 2 mois"],
  [75, "Gestante 3 mois"],
  [89, "Gestante 3 mois"],
  [120, "Gestante 4 mois"],
  [145, "Gestante 5 mois"],
  [null, "Gestante"],
  [undefined, "Gestante"],
];

for (const [days, expected] of cases) {
  test(`${String(days)} jour(s) affiche ${expected}`, () => {
    assert.equal(formatGestationDuration(days), expected);
  });
}

test("une durée non fiable utilise le libellé de repli", () => {
  assert.equal(formatGestationDuration(Number.NaN), "Gestante");
  assert.equal(formatGestationDuration(-1), "Gestante");
});
