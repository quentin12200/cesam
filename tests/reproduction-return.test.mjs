import test from "node:test";
import assert from "node:assert/strict";
import { safeReturnTo } from "../lib/reproduction-return.ts";

test("conserve une fiche et ses paramètres comme origine", () => {
  assert.equal(
    safeReturnTo("/troupeau/0000?onglet=identite"),
    "/troupeau/0000?onglet=identite"
  );
});

test("conserve l’accueil comme origine", () => {
  assert.equal(safeReturnTo("/"), "/");
});

test("refuse une destination externe", () => {
  assert.equal(safeReturnTo("https://example.com"), null);
  assert.equal(safeReturnTo("//example.com"), null);
});

test("accepte l’absence d’origine pour les parcours historiques", () => {
  assert.equal(safeReturnTo(null), null);
});
