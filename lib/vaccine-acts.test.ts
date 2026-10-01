import assert from "node:assert/strict";
import test from "node:test";
import { unifierActesVaccinaux, type ActeTraitementVaccin, type ActeVaccination } from "./vaccine-acts.ts";

const vaccination = (overrides: Partial<ActeVaccination> = {}): ActeVaccination => ({
  date: new Date("2026-09-21T12:00:00Z"),
  vaccin: "BOVILIS BOVIGRIP",
  medicamentId: "med-bovigrip",
  protocoleId: null,
  etapeProtocoleId: null,
  gestationId: null,
  statut: "FAIT",
  ...overrides,
});

const traitement = (overrides: Partial<ActeTraitementVaccin> = {}): ActeTraitementVaccin => ({
  dateDebut: new Date("2026-09-21T12:00:00Z"),
  medicamentNom: "BOVILIS BOVIGRIP",
  medicamentId: "med-bovigrip",
  ...overrides,
});

test("un vaccin enregistré uniquement via Traitement + médicament VACCIN apparaît comme fait", () => {
  const actes = unifierActesVaccinaux([], [traitement()]);
  assert.equal(actes.length, 1);
  assert.equal(actes[0].vaccin, "BOVILIS BOVIGRIP");
  assert.equal(actes[0].statut, "FAIT");
  assert.equal(actes[0].sourceType, "TRAITEMENT");
});

test("un vaccin enregistré via Vaccination apparaît comme fait", () => {
  const actes = unifierActesVaccinaux([vaccination()], []);
  assert.equal(actes.length, 1);
  assert.equal(actes[0].medicamentId, "med-bovigrip");
  assert.equal(actes[0].sourceType, "VACCINATION");
});

test("le même acte présent dans les deux sources n'est affiché qu'une seule fois, la Vaccination gagne", () => {
  const actes = unifierActesVaccinaux(
    [vaccination({ protocoleId: "proto-1", etapeProtocoleId: "etape-1" })],
    [traitement()]
  );
  assert.equal(actes.length, 1);
  assert.equal(actes[0].protocoleId, "proto-1", "la version Vaccination, plus riche, doit être conservée");
});

test("deux médicaments différents le même jour restent deux actes distincts", () => {
  const actes = unifierActesVaccinaux([], [
    traitement({ medicamentId: "med-bovigrip", medicamentNom: "BOVILIS BOVIGRIP" }),
    traitement({ medicamentId: "med-rispoval", medicamentNom: "RISPOVAL RS+PI3 INTRANASAL" }),
  ]);
  assert.equal(actes.length, 2);
});

test("un Traitement sans médicament identifié n'est jamais fusionné ni ajouté à l'aveugle", () => {
  const actes = unifierActesVaccinaux([], [traitement({ medicamentId: null, medicamentNom: "Vaccin libre" })]);
  assert.equal(actes.length, 0);
});

test("une Vaccination non FAIT (ex: PREVU) n'est pas comptée comme faite et n'écrase pas le Traitement correspondant", () => {
  const actes = unifierActesVaccinaux([vaccination({ statut: "PREVU" })], [traitement()]);
  assert.equal(actes.length, 1);
  assert.equal(actes[0].statut, "FAIT");
});

test("même médicament, jours différents : deux actes distincts (deux vraies injections)", () => {
  const actes = unifierActesVaccinaux([], [
    traitement({ dateDebut: new Date("2026-09-11T12:00:00Z") }),
    traitement({ dateDebut: new Date("2026-10-09T12:00:00Z") }),
  ]);
  assert.equal(actes.length, 2);
});
