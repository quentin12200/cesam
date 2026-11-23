import test from "node:test";
import assert from "node:assert/strict";
import { getCategorieMedicament, getCategoriesMedicamentUtilisees, valeurCategoriePersonnalisee } from "./medicament-categories.ts";

test("une catégorie libre est conservée et réutilisable", () => {
  const name = valeurCategoriePersonnalisee("  Antispasmodique  ");
  assert.equal(name, "Antispasmodique");
  assert.equal(valeurCategoriePersonnalisee("Antibiotique"), "ANTIBIOTIQUE");
  assert.equal(valeurCategoriePersonnalisee("anti-inflammatoire"), "ANTI_INFLAMMATOIRE");
  const options = getCategoriesMedicamentUtilisees([name]);
  assert.equal(options.find((c) => c.code === name)?.label, name);
  assert.equal(getCategorieMedicament(name).label, name);
});

test("Autre reste lisible pour les fiches historiques mais absent des choix neufs", () => {
  assert.equal(getCategorieMedicament("AUTRE").label, "Autre");
  assert.equal(getCategoriesMedicamentUtilisees([]).some((c) => c.code === "AUTRE"), false);
  assert.equal(getCategoriesMedicamentUtilisees(["AUTRE"]).some((c) => c.code === "AUTRE"), true);
});
