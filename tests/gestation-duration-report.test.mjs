import test from "node:test";
import assert from "node:assert/strict";
import { classifyGestation, summarizeGestations } from "../lib/gestation-duration-report.ts";

const date = (day: string) => new Date(day + "T00:00:00.000Z");
const base = {
  id: "velage-1", motherId: "mere-1", calvingDate: date("2026-10-20"),
  breedingDate: date("2026-01-01"), estimatedBreeding: false,
  linkedMotherId: "mere-1", qualification: "NORMAL", previousCalvings: 0,
  conflictingBreedings: 0,
};

test("une gestation liée et datée est retenue, un premier vêlage est primipare", () => {
  const row = classifyGestation(base);
  assert.equal(row.durationDays, 292);
  assert.equal(row.category, "PRIMIPARE");
  assert.equal(row.exclusion, null);
});

test("une multipare est distinguée", () => {
  assert.equal(classifyGestation({ ...base, previousCalvings: 2 }).category, "MULTIPARE");
});

test("les liens incertains, dates estimées et avortements sont exclus", () => {
  assert.equal(classifyGestation({ ...base, linkedMotherId: null }).exclusion, "Saillie ou gestation non liée");
  assert.equal(classifyGestation({ ...base, linkedMotherId: "autre-mere" }).exclusion, "Mère incohérente");
  assert.equal(classifyGestation({ ...base, estimatedBreeding: true }).exclusion, "Date de saillie estimée");
  assert.equal(classifyGestation({ ...base, conflictingBreedings: 1 }).exclusion, "Autre saillie possible dans le cycle");
  assert.equal(classifyGestation({ ...base, qualification: "AVORTEMENT" }).exclusion, "Avortement");
});

test("une durée hors plage est exclue", () => {
  assert.match(classifyGestation({ ...base, breedingDate: date("2026-09-01") }).exclusion ?? "", /hors plage/);
});

test("les jumeaux ne doublent pas une ligne de vêlage et les exclus ne faussent pas la moyenne", () => {
  const rows = [classifyGestation(base), classifyGestation({ ...base, id: "velage-2", previousCalvings: 1, estimatedBreeding: true })];
  const stats = summarizeGestations(rows);
  assert.equal(stats.total, 2);
  assert.equal(stats.included, 1);
  assert.equal(stats.excluded, 1);
  assert.equal(stats.mean, 292);
  assert.equal(stats.primipares.count, 1);
  assert.equal(stats.multipares.count, 0);
});
