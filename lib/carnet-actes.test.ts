import assert from "node:assert/strict";
import test from "node:test";
import { rechercherActes, unifierActesDuCarnet, type ActeSanitaireReel,
  type TraitementCarnet, type VaccinationCarnet } from "./carnet-actes.ts";

const tequila = { id: "a7926", nutrav: "7926", nom: "TEQUILA" };
const voisine = { id: "a7510", nutrav: "7510", nom: "BETTY" };
const jour = new Date("2026-10-12T12:00:00Z");
const vaccination = (change: Partial<VaccinationCarnet> = {}): VaccinationCarnet => ({
  id: "v1", animal: tequila, date: jour, statut: "FAIT", vaccin: "ROTAVEC CORONA",
  medicamentId: "rota", medicamentNom: "ROTAVEC CORONA",
  protocoleNom: "CRYPTO | ROTAVEC", etapeNom: "ROTAVEC", ...change,
});
const traitement = (change: Partial<TraitementCarnet> = {}): TraitementCarnet => ({
  id: "t1", animal: tequila, date: jour, medicamentNom: "ROTAVEC CORONA",
  medicamentId: "rota", executant: "Samuel", protocoleNom: null, etapeNom: null, ...change,
});

test("une administration Vaccination + Traitement est comptée une fois, avec produit, source, exécutant et protocole", () => {
  const actes = unifierActesDuCarnet([vaccination()], [traitement()]);
  assert.equal(actes.length, 1);
  assert.deepEqual({ produit: actes[0].produit, source: actes[0].source, executant: actes[0].executant,
    protocole: actes[0].protocoleNom }, {
    produit: "ROTAVEC CORONA", source: "Vaccination + Traitement", executant: "Samuel", protocole: "CRYPTO | ROTAVEC",
  });
});

test("deux médicaments du même jour restent deux actes et un traitement sans protocole reste visible", () => {
  const actes = unifierActesDuCarnet([vaccination()], [traitement(),
    traitement({ id: "t-crypto", medicamentId: "crypto", medicamentNom: "BOVILIS CRYPTIUM", executant: "Céline" })]);
  assert.deepEqual(actes.map((a) => a.produit).sort(), ["BOVILIS CRYPTIUM", "ROTAVEC CORONA"]);
  assert.equal(actes.find((a) => a.produit === "BOVILIS CRYPTIUM")?.protocoleNom, null);
});

test("un traitement distinct ne disparaît pas à côté d'une vaccination sans medicamentId", () => {
  const actes = unifierActesDuCarnet([vaccination({ medicamentId: null })], [
    traitement({ medicamentId: "anti-inflammatoire", medicamentNom: "MELOXICAM" }),
  ]);
  assert.deepEqual(actes.map((a) => a.produit).sort(), ["MELOXICAM", "ROTAVEC CORONA"]);
  assert.deepEqual(actes.map((a) => a.source).sort(), ["Traitement", "Vaccination"]);
});

test("plusieurs administrations du même produit et jour restent autant de lignes réelles", () => {
  const actes = unifierActesDuCarnet([vaccination()], [traitement(), traitement({ id: "t2" })]);
  assert.equal(actes.length, 2);
  assert.deepEqual(actes.map((a) => a.source).sort(), ["Traitement", "Vaccination + Traitement"]);
});

test("deux identifiants de médicaments distincts ne sont jamais fusionnés sur leur nom", () => {
  const actes = unifierActesDuCarnet([vaccination()], [traitement({ medicamentId: "autre" })]);
  assert.equal(actes.length, 2);
});

test("un ancien traitement sans identifiant médical est rapproché par libellé exact seulement si la paire est unique", () => {
  const unique = unifierActesDuCarnet([vaccination()], [traitement({ medicamentId: null })]);
  assert.equal(unique.length, 1);
  assert.equal(unique[0].source, "Vaccination + Traitement");
  const ambigu = unifierActesDuCarnet([vaccination(), vaccination({ id: "v2" })], [traitement({ medicamentId: null })]);
  assert.equal(ambigu.length, 3, "une paire ambiguë n'est pas effacée par déduction");
});

test("une vaccination non FAIT n'est pas présentée comme administration réelle", () => {
  assert.deepEqual(unifierActesDuCarnet([vaccination({ statut: "PREVU" })], []), []);
});

test("filtres par période, médicament et animal, puis quatre tris cliquables", () => {
  const actes = unifierActesDuCarnet([
    vaccination(), vaccination({ id: "v2", animal: voisine, date: new Date("2026-10-13T12:00:00Z"),
      medicamentId: "crypto", medicamentNom: "BOVILIS CRYPTIUM" }),
  ], [traitement()]);
  assert.deepEqual(rechercherActes(actes, { du: "2026-10-12", au: "2026-10-12", produit: "rotavec", animal: "tequila" })
    .map((a) => a.nutrav), ["7926"]);
  assert.deepEqual(rechercherActes(actes, { tri: "date", direction: "desc" }).map((a) => a.nutrav), ["7510", "7926"]);
  assert.deepEqual(rechercherActes(actes, { tri: "animal", direction: "asc" }).map((a) => a.nutrav), ["7510", "7926"]);
  assert.deepEqual(rechercherActes(actes, { tri: "produit", direction: "asc" }).map((a) => a.nutrav), ["7510", "7926"]);
  assert.deepEqual(rechercherActes(actes, { tri: "executant", direction: "desc" }).map((a) => a.nutrav), ["7926", "7510"]);
});

test("un traitement non classé reste trouvable par ses données propres, quel que soit le médicament", () => {
  const acte: ActeSanitaireReel = { id: "traitement:ancien", animalId: "a1234", nutrav: "1234", nom: "NUAGE",
    date: new Date("2026-09-07T12:00:00Z"), produit: "PRODUIT-EXEMPLE", medicamentId: null, source: "Traitement",
    executant: null, protocoleNom: null, etapeNom: null };
  assert.deepEqual(rechercherActes([acte], { du: "2026-09-07", au: "2026-09-07",
    produit: "produit exemple", animal: "nuage" }), [acte]);
});
