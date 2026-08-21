import assert from "node:assert/strict";
import test from "node:test";
import { getCategorie } from "./utils.ts";

const now = new Date();
function monthsAgo(months: number) { const date = new Date(now); date.setMonth(date.getMonth() - months); return date; }

test("une petite génisse sélectionnée progresse avec l’âge", () => {
  assert.equal(getCategorie("F", monthsAgo(9), true, "PETITE_GENISSE"), "PETITE_GENISSE");
  assert.equal(getCategorie("F", monthsAgo(18), true, "PETITE_GENISSE"), "MOYENNE_GENISSE");
  assert.equal(getCategorie("F", monthsAgo(30), true, "PETITE_GENISSE"), "GRANDE_GENISSE");
});

test("une moyenne génisse devient grande sans régresser", () => {
  assert.equal(getCategorie("F", monthsAgo(30), true, "MOYENNE_GENISSE"), "GRANDE_GENISSE");
  assert.equal(getCategorie("F", monthsAgo(9), true, "MOYENNE_GENISSE"), "MOYENNE_GENISSE");
});

test("les catégories métier explicites ne sont pas remplacées par l’âge", () => {
  assert.equal(getCategorie("F", monthsAgo(18), true, "VELLE"), "VELLE");
  assert.equal(getCategorie("F", monthsAgo(18), true, "PRESELECTION_GENISSE"), "PRESELECTION_GENISSE");
  assert.equal(getCategorie("F", monthsAgo(18), true, "A_ENGRAISSER"), "A_ENGRAISSER");
  assert.equal(getCategorie("F", monthsAgo(18), true, "ENGRAISSEMENT"), "ENGRAISSEMENT");
});
