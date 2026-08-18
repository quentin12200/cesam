import assert from "node:assert/strict";
import test from "node:test";
import { ajouterPagesOrdonnance, supprimerPageOrdonnance } from "./ordonnance-scan-pages.ts";

test("prépare une ordonnance d'une page", () => {
  assert.deepEqual(ajouterPagesOrdonnance([], ["page-1"]), ["page-1"]);
});

test("ajoute deux pages dans leur ordre de sélection", () => {
  assert.deepEqual(ajouterPagesOrdonnance([], ["page-1", "page-2"]), ["page-1", "page-2"]);
});

test("conserve l'ordre quand une page est ajoutée ensuite", () => {
  const pages = ajouterPagesOrdonnance(["page-1", "page-2"], ["page-3"]);
  assert.deepEqual(pages, ["page-1", "page-2", "page-3"]);
});

test("supprime uniquement la page choisie avant le scan", () => {
  assert.deepEqual(
    supprimerPageOrdonnance(["page-1", "page-2", "page-3"], 1),
    ["page-1", "page-3"],
  );
});
