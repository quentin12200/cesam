import assert from "node:assert/strict";
import test from "node:test";
import { vaccinationsSansEtapeFiable, type VaccinationHistorique } from "./vaccine-history.ts";

const protocole = {
  id: "nasalgen",
  noms: ["NASALGEN", "Nasalgen"],
  medicamentIds: ["med-nasalgen"],
  etapeIds: ["primo", "rappel"],
};
const date = new Date("2026-09-11T12:00:00Z");

function vaccination(overrides: Partial<VaccinationHistorique>): VaccinationHistorique {
  return { date, vaccin: "NASALGEN", medicamentId: null, protocoleId: null, etapeProtocoleId: null, ...overrides };
}

test("l'ancien Nasalgen sans protocole est signalé même si un statut primo à faire existe", () => {
  assert.deepEqual(vaccinationsSansEtapeFiable([vaccination({})], protocole).map((item) => item.vaccin), ["NASALGEN"]);
});

test("une injection liée au protocole mais sans étape reste à vérifier", () => {
  assert.equal(vaccinationsSansEtapeFiable([vaccination({ protocoleId: "nasalgen" })], protocole).length, 1);
});

test("une étape réellement reliée est prise en charge par le calcul normal", () => {
  assert.equal(vaccinationsSansEtapeFiable([vaccination({ protocoleId: "nasalgen", etapeProtocoleId: "primo" })], protocole).length, 0);
});

test("un autre protocole et un nom voisin ne sont pas confondus avec Nasalgen", () => {
  assert.equal(vaccinationsSansEtapeFiable([
    vaccination({ vaccin: "NASALGEN_RAPPEL" }),
    vaccination({ protocoleId: "autre", medicamentId: "med-nasalgen" }),
    vaccination({ vaccin: "AUTRE", medicamentId: null }),
  ], protocole).length, 0);
});

test("le médicament associé permet de repérer une ancienne saisie avec un autre libellé", () => {
  assert.equal(vaccinationsSansEtapeFiable([vaccination({ vaccin: "Nasalgen 3", medicamentId: "med-nasalgen" })], protocole).length, 1);
});
