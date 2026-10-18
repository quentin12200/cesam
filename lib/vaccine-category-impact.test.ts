import assert from "node:assert/strict";
import test from "node:test";
import { comparerPopulationCible } from "./vaccine-category-impact.ts";

const animal = (categorie: string, sexe: string) => ({
  categorie, sexe, groupeNom: null, nombreVelages: 0, gestation: false,
});
const animaux = [animal("VELLE","F"), animal("VEAU_M","M"), animal("PETITE_GENISSE","F"),
  animal("VACHE","F"), animal("TAUREAU","M")];
const cible = (categories: string[]) => ({
  categories, sexeCible:null, gestante:null, rangVelageMin:null,
  rangVelageMax:null, lotCible:null,
});

test("montre une velle qui entre dans un protocole ciblant auparavant Génisses + Vaches", () => {
  assert.deepEqual(comparerPopulationCible(animaux,cible(["VELLE","GENISSE","VACHE"]),cible(["GENISSE","VACHE"])),{
    animauxVises:3,nouvellementVises:1,neSerontPlusVises:0,populationActive:5,
  });
});
test("une restriction à Velles exclut les autres catégories et annonce le nombre sortant", () => {
  assert.deepEqual(comparerPopulationCible(animaux,cible(["VELLE"]),cible(["VEAU","GENISSE","VACHE"])),{
    animauxVises:1,nouvellementVises:0,neSerontPlusVises:3,populationActive:5,
  });
});
test("à la création, l'aperçu annonce seulement les bovins visés, pas des migrations", () => {
  assert.deepEqual(comparerPopulationCible(animaux,cible(["VELLE","GENISSE","VACHE"]),null),{
    animauxVises:3,nouvellementVises:0,neSerontPlusVises:0,populationActive:5,
  });
});
test("les critères de sexe et de gestation restent appliqués avec les catégories", () => {
  assert.equal(comparerPopulationCible(animaux,{...cible(["VEAU"]),sexeCible:"F"},null).animauxVises,1);
  assert.equal(comparerPopulationCible(animaux,{...cible(["VELLE"]),gestante:true},null).animauxVises,0);
});
