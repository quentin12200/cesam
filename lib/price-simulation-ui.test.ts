import assert from "node:assert/strict";
import test from "node:test";
import type { FieldSessionEntry } from "./field-weighing.ts";
import {
  emptySectionLabel,
  sectionUiState,
  selectHeaviestThrough,
} from "./price-simulation-ui.ts";

const entries: FieldSessionEntry[] = [
  { id: "a", nutrav: "1", sexe: "M", poids: 500, gmq: 1, selected: true },
  { id: "b", nutrav: "2", sexe: "M", poids: 450, gmq: 1, selected: true },
  { id: "c", nutrav: "3", sexe: "M", poids: 400, gmq: 1, selected: true },
];

test("une section vide reste compacte et sans actions", () => {
  assert.deepEqual(sectionUiState(0, 0), {
    empty: true,
    showSelectionActions: false,
    showPriceAction: false,
  });
  assert.equal(emptySectionLabel("M"), "Aucun mâle dans cette séance");
  assert.equal(emptySectionLabel("F"), "Aucune femelle dans cette séance");
});

test("la barre de prix apparaît uniquement après une sélection", () => {
  assert.equal(sectionUiState(3, 0).showPriceAction, false);
  assert.equal(sectionUiState(3, 1).showPriceAction, true);
});

test("sélectionne du plus lourd jusqu'à la ligne choisie", () => {
  assert.deepEqual(selectHeaviestThrough(entries, 1), ["a", "b"]);
});
