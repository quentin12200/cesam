import assert from "node:assert/strict";
import test from "node:test";
import { formatAgeTerrain } from "./animal-age.ts";

const reference = new Date("2026-10-01T12:00:00Z");

test("l'âge terrain reste en jours avant 30 jours", () => {
  assert.equal(formatAgeTerrain("2026-09-13T12:00:00Z", reference), "18 j");
});

test("l'âge terrain affiche les mois et jours avant un an", () => {
  assert.equal(formatAgeTerrain("2026-07-18T12:00:00Z", reference), "2 m 13 j");
});

test("l'âge terrain devient compact en années et mois à partir d'un an", () => {
  assert.equal(formatAgeTerrain("2025-08-01T12:00:00Z", reference), "1 a 2 m");
});
