import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/troupeau/page.tsx", import.meta.url), "utf8");

test("la page filtre sur la catégorie effective puis recalcule le compteur", () => {
  assert.match(page, /filtrerAnimauxParCategorie\(animauxNonFiltres, categorie\)/);
  assert.match(page, /total: animaux\.length/);
  assert.doesNotMatch(page, /case "PETITE_GENISSE"/);
  assert.doesNotMatch(page, /case "MOYENNE_GENISSE"/);
});
