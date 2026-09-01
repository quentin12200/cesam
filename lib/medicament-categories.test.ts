import assert from "node:assert/strict";
import test from "node:test";
import {
  abregerVoie,
  valeurCategoriePersonnalisee,
  getCategoriesMedicamentUtilisees,
  getCategorieMedicament,
  trouverCategorieProche,
} from "./medicament-categories.ts";

test("abrège les voies longues pour les pavés mobiles", () => {
  assert.equal(abregerVoie("INTRANASALE"), "IN");
  assert.equal(abregerVoie("INTRAMUSCULAIRE"), "IM");
  assert.equal(abregerVoie("SOUS-CUTANEE"), "SC");
  assert.equal(abregerVoie("INTRAVEINEUSE"), "IV");
  assert.equal(abregerVoie(null), "—");
});

test("retrouve une categorie existante malgre casse accents et espaces", () => {
  const categories = getCategoriesMedicamentUtilisees([]);
  assert.equal(trouverCategorieProche("  àntiBiotique ", categories)?.code, "ANTIBIOTIQUE");
});

test("rapproche une petite faute sans choisir entre plusieurs categories", () => {
  const categories = getCategoriesMedicamentUtilisees([]);
  assert.equal(trouverCategorieProche("Antibiotque", categories)?.code, "ANTIBIOTIQUE");
  assert.equal(trouverCategorieProche("Anti", categories), null);
});

test("conserve une categorie personnalisee utilisee dans Pharmacie", () => {
  const categories = getCategoriesMedicamentUtilisees(["PRODUIT_RESPIRATOIRE"]);
  assert.equal(categories.find((item) => item.code === "PRODUIT_RESPIRATOIRE")?.label, "Produit respiratoire");
  assert.equal(getCategorieMedicament("PRODUIT_RESPIRATOIRE").label, "Produit respiratoire");
});

test("conserve le nom choisi en normalisant seulement les espaces", () => {
  assert.equal(valeurCategoriePersonnalisee("  Soin   respiratoire  "), "Soin respiratoire");
});
