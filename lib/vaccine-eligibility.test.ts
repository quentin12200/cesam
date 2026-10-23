import assert from "node:assert/strict";
import test from "node:test";
import { expliquerExclusionsVaccinales, estAnimalConcerneParProtocole } from "./vaccine-eligibility.ts";

const velle = { categorie: "VELLE", sexbov: "F", groupeNom: null, nombreVelages: 0, gestation: false };
const cible = { categoriesJson: null, sexeCible: null, gestante: null, rangVelageMin: null, rangVelageMax: null, lotCible: null };

test("le groupe Veaux comprend expressément les velles", () => {
  const p = { ...cible, categoriesJson: JSON.stringify(["VEAU"]) };
  assert.equal(estAnimalConcerneParProtocole(velle, p), true);
  assert.deepEqual(expliquerExclusionsVaccinales(velle, p), []);
});

test("un ciblage Génisses et Vaches ne doit pas masquer une VELLE sans donner la raison exacte", () => {
  const p = { ...cible, categoriesJson: JSON.stringify(["GENISSE", "VACHE"]) };
  assert.equal(estAnimalConcerneParProtocole(velle, p), false);
  assert.deepEqual(expliquerExclusionsVaccinales(velle, p), [{
    critere: "CATEGORIE",
    detail: "Catégorie actuelle : Velle ; catégories ciblées : Génisses, Vaches.",
  }]);
  assert.equal(estAnimalConcerneParProtocole({ ...velle, categorie: "PETITE_GENISSE" }, p), true);
});

test("une intranasale ciblant Veaux peut exclure pour un lot, même si la catégorie est compatible", () => {
  const p = { ...cible, categoriesJson: JSON.stringify(["VEAU"]), lotCible: "Nouveaux-nés" };
  assert.deepEqual(expliquerExclusionsVaccinales(velle, p).map(x=>x.critere), ["LOT"]);
});

test("affiche tous les critères différents qui empêchent le ciblage", () => {
  const p = { ...cible, categoriesJson: JSON.stringify(["GENISSE"]), sexeCible: "M", gestante: true,
    rangVelageMin: 1, lotCible: "Lot naissance" };
  assert.deepEqual(expliquerExclusionsVaccinales(velle, p).map(x=>x.critere),
    ["CATEGORIE", "SEXE", "GESTATION", "RANG_VELAGE", "LOT"]);
  assert.equal(estAnimalConcerneParProtocole(velle,p),false);
});

test("la classification GENISSE représente les catégories précises de génisses, pas VELLE", () => {
  const p={...cible,categoriesJson:JSON.stringify(["GENISSE"])};
  for(const categorie of ["PRESELECTION_GENISSE","PETITE_GENISSE","MOYENNE_GENISSE","GRANDE_GENISSE"])
    assert.equal(estAnimalConcerneParProtocole({...velle,categorie},p),true);
  assert.equal(estAnimalConcerneParProtocole(velle,p),false);
});

test("ROTAVEC : tous les gestants quelle que soit leur categorie, sans male ni femelle non gestante", () => {
  const rotavec = { ...cible, categoriesJson: JSON.stringify([]), sexeCible: "F", gestante: true };
  for (const categorie of ["VACHE", "GRANDE_GENISSE", "A_ENGRAISSER", "ENGRAISSEMENT"]) {
    assert.equal(estAnimalConcerneParProtocole({ ...velle, categorie, gestation: true }, rotavec), true, categorie);
  }
  assert.equal(estAnimalConcerneParProtocole({ ...velle, categorie: "VACHE", gestation: false }, rotavec), false);
  assert.equal(estAnimalConcerneParProtocole({ ...velle, categorie: "TAUREAU", sexbov: "M", gestation: false }, rotavec), false);
});
