import assert from "node:assert/strict";
import test from "node:test";
import {
  basculerCategorieVaccinale, categorieVaccinaleSelectionnee, sexeImpliciteCategorieVaccinale,
} from "./vaccine-category-selection.ts";
import { estAnimalConcerneParProtocole } from "./vaccine-eligibility.ts";

test("la famille Veaux historique couvre toujours les mâles et les velles", () => {
  const cible = ["VEAU"];
  assert.equal(categorieVaccinaleSelectionnee(cible, "VELLE"), true);
  assert.equal(categorieVaccinaleSelectionnee(cible, "VEAU_M"), true);
  const ancienne = { categoriesJson: JSON.stringify(cible), sexeCible: null,
    gestante: null, rangVelageMin: null, rangVelageMax: null, lotCible: null };
  const velle = { categorie: "VELLE", sexbov: "F", groupeNom: null, nombreVelages: 0, gestation: false };
  assert.equal(estAnimalConcerneParProtocole(velle, ancienne), true);
});

test("cocher une seule velle ne cible pas les veaux mâles", () => {
  const selection = basculerCategorieVaccinale([], "VELLE");
  assert.deepEqual(selection, ["VELLE"]);
  assert.equal(categorieVaccinaleSelectionnee(selection, "VEAU_M"), false);
});

test("décocher Velle depuis Tous les veaux ne laisse que les veaux mâles", () => {
  assert.deepEqual(basculerCategorieVaccinale(["VEAU"], "VELLE"), ["VEAU_M"]);
  assert.deepEqual(basculerCategorieVaccinale(["VEAU_M"], "VELLE"), ["VEAU"]);
});

test("Génisses historiques couvre les quatre catégories détaillées", () => {
  const anciens = ["GENISSE", "VACHE"];
  const restreint = basculerCategorieVaccinale(anciens, "MOYENNE_GENISSE");
  assert.equal(restreint.includes("GENISSE"), false);
  assert.equal(restreint.includes("VACHE"), true);
  assert.deepEqual(new Set(restreint), new Set([
    "VACHE", "PRESELECTION_GENISSE", "PETITE_GENISSE", "GRANDE_GENISSE",
  ]));
  assert.equal(categorieVaccinaleSelectionnee(restreint, "MOYENNE_GENISSE"), false);
});

test("la sélection Velles + Génisses + Vaches permet MHE sans toucher à la catégorie de l'animal", () => {
  const selection = basculerCategorieVaccinale(["GENISSE", "VACHE"], "VELLE");
  assert.deepEqual(new Set(selection), new Set(["GENISSE","VACHE","VELLE"]));
  const velle = { categorie:"VELLE", sexbov:"F", groupeNom:null, nombreVelages:0, gestation:false };
  assert.equal(estAnimalConcerneParProtocole(velle, {
    categoriesJson: JSON.stringify(selection), sexeCible:null, gestante:null,
    rangVelageMin:null, rangVelageMax:null, lotCible:null,
  }), true);
});

test("le sexe implicite reste cohérent avec les nouvelles catégories", () => {
  assert.equal(sexeImpliciteCategorieVaccinale(["VELLE", "GENISSE", "VACHE"]), "F");
  assert.equal(sexeImpliciteCategorieVaccinale(["VEAU_M", "TAUREAU"]), "M");
  assert.equal(sexeImpliciteCategorieVaccinale(["VEAU"]), null);
  assert.equal(sexeImpliciteCategorieVaccinale(["VELLE", "VEAU_M"]), null);
  assert.equal(sexeImpliciteCategorieVaccinale(["A_ENGRAISSER"]), null);
});
