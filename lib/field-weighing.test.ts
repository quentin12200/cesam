import assert from "node:assert/strict";
import test from "node:test";
import { calculateGmqKgPerDay, selectedAverage } from "./field-weighing.ts";

test("calcule le GMQ en kg/j avec une décimale", () => {
  assert.equal(
    calculateGmqKgPerDay(260, new Date("2026-07-31"), {
      poids: 200,
      date: new Date("2026-06-01"),
    }),
    1,
  );
});

test("ne calcule pas de GMQ sans poids antérieur exploitable", () => {
  assert.equal(calculateGmqKgPerDay(260, new Date("2026-07-31"), null), null);
  assert.equal(
    calculateGmqKgPerDay(260, new Date("2026-07-31"), {
      poids: 250,
      date: new Date("2026-07-31"),
    }),
    null,
  );
});

test("calcule la moyenne entière des seuls animaux sélectionnés", () => {
  assert.equal(
    selectedAverage([
      { poids: 201, selected: true },
      { poids: 204, selected: false },
      { poids: 206, selected: true },
    ]),
    204,
  );
  assert.equal(selectedAverage([{ poids: 201, selected: false }]), null);
});
