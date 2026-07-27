import test from "node:test";
import assert from "node:assert/strict";
import { safeReturnTo, withReturnTo } from "../lib/origin-navigation.ts";

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
  assert.equal(safeReturnTo("/\\example.com"), null);
});

test("accepte l’absence d’origine pour les parcours historiques", () => {
  assert.equal(safeReturnTo(null), null);
});

test("ajoute l’origine à une URL qui possède déjà des paramètres", () => {
  assert.equal(
    withReturnTo("/reproduction?action=saillie", "/troupeau/0000?onglet=reproduction"),
    "/reproduction?action=saillie&returnTo=%2Ftroupeau%2F0000%3Fonglet%3Dreproduction"
  );
});

test("conserve les paramètres, l’ancre et remplace une ancienne origine", () => {
  assert.equal(
    withReturnTo(
      "/reproduction?action=ia&returnTo=%2Fancienne#formulaire",
      "/reproduction?filtre=JAUNE#animal-0000"
    ),
    "/reproduction?action=ia&returnTo=%2Freproduction%3Ffiltre%3DJAUNE%23animal-0000#formulaire"
  );
});

test("n’ajoute jamais une origine invalide", () => {
  assert.equal(withReturnTo("/reproduction?action=ia", "https://example.com"), "/reproduction?action=ia");
});
