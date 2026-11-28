import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const ui = readFileSync(new URL("../app/pharmacie/PharmacieClient.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../app/api/medicaments/route.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/pharmacie/page.tsx", import.meta.url), "utf8");
test("category picker is a select, not a free-text datalist", () => {
 assert.match(ui, /<MedicamentReferenceSelect type="CATEGORIE"/);
 assert.doesNotMatch(ui, /<datalist id="categories-medicament-ajout"/);
 assert.match(readFileSync(new URL("../app/pharmacie/MedicamentReferenceSelect.tsx", import.meta.url), "utf8"), /Ajouter et sélectionner/);
 assert.match(readFileSync(new URL("../app/api/pharmacie/referentiels/route.ts", import.meta.url), "utf8"), /referenceProche/);
});
test("new category is saved with medication and reloaded from existing medicines", () => {
 assert.match(api, /categorie: categorie \? valeurCategoriePersonnalisee\(categorie\)/);
 assert.match(page, /categorie: true/);
 assert.match(ui, /getCategoriesMedicamentUtilisees\(medicaments\.map/);
});
