import assert from "node:assert/strict";
import test from "node:test";
import { construireMatriceVaccinale } from "./vaccine-matrix.ts";

test("une ligne par veau et deux colonnes distinctes pour Nasalgen et Bovilis Intranasal", () => {
  const date = new Date("2026-09-18T12:00:00Z");
  const matrice = construireMatriceVaccinale([
    { id: "veau-7511", nutrav: "7511", nom: "Belladonna", vaccinations: [
      { vaccin: "NASALGEN", date, statut: "FAIT" },
      { vaccin: "BOVILIS INTRANASAL RSP LIVE", date, statut: "FAIT" },
    ] },
  ], []);
  assert.equal(matrice.lignes.length, 1);
  assert.deepEqual(matrice.vaccins.map((v) => v.cle), ["BOVILIS INTRANASAL RSP LIVE", "NASALGEN"]);
  assert.equal(matrice.lignes[0].cases.NASALGEN.faits[0].date, date);
  assert.equal(matrice.lignes[0].cases["BOVILIS INTRANASAL RSP LIVE"].faits[0].date, date);
});

test("la case Bovigrip montre le fait et le rappel à faire, puis le rappel fait", () => {
  const primo = new Date("2026-09-11T12:00:00Z");
  const rappel = new Date("2026-10-09T12:00:00Z");
  const animal = { id: "7487", nutrav: "7487", nom: "Badboy", vaccinations: [{ vaccin: "BOVILIS BOVIGRIP", date: primo, statut: "FAIT" }] };
  const preparation = { vaccin: "BOVILIS BOVIGRIP", lignes: [{ animalId: "7487", vaccin: "BOVILIS BOVIGRIP", injection: "Rappel", dateMin: rappel, dateMax: rappel }], aConfirmer: [] };
  const aFaire = construireMatriceVaccinale([animal], [preparation]).lignes[0].cases["BOVILIS BOVIGRIP"];
  assert.equal(aFaire.faits[0].date, primo);
  assert.equal(aFaire.aFaire?.dateMin, rappel);
  const fait = construireMatriceVaccinale([{ ...animal, vaccinations: [...animal.vaccinations, { vaccin: "BOVILIS BOVIGRIP", date: rappel, statut: "FAIT" }] }], []).lignes[0].cases["BOVILIS BOVIGRIP"];
  assert.equal(fait.faits.length, 2);
  assert.equal(fait.aFaire, null);
});

test("un ancien libellé rappel rejoint sa colonne produit sans compter un acte prévu comme fait", () => {
  const matrice = construireMatriceVaccinale([{ id: "1", nutrav: "1", nom: null, vaccinations: [
    { vaccin: "NASALGEN", date: new Date("2026-01-01"), statut: "FAIT" },
    { vaccin: "NASALGEN_RAPPEL", date: new Date("2026-04-01"), statut: "FAIT" },
    { vaccin: "NASALGEN", date: new Date("2026-05-01"), statut: "PREVU" },
  ] }], []);
  assert.deepEqual(matrice.vaccins.map((v) => v.cle), ["NASALGEN"]);
  assert.equal(matrice.lignes[0].cases.NASALGEN.faits.length, 2);
  assert.equal(matrice.lignes[0].cases.NASALGEN.faits[1].rappel, true);
});
