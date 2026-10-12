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

test("une Vaccination legacy sans médicament et son unique Traitement VACCIN du jour restent un seul fait", () => {
  const actes = unifierActesVaccinaux(
    [vaccination({ medicamentId: null, vaccin: "Ancien protocole combiné", protocoleId: "legacy" })],
    [traitement({ id: "traitement-source", protocoleVaccinId: null })],
  );
  assert.equal(actes.length, 1);
  assert.equal(actes[0].sourceType, "VACCINATION", "la source structurée reste prioritaire");
  assert.equal(actes[0].medicamentId, "med-bovigrip", "l'identité certaine vient du Traitement réel sans modifier la base");
});

test("deux médicaments différents le même jour restent deux actes distincts", () => {
  const actes = unifierActesVaccinaux([], [
    traitement({ medicamentId: "med-bovigrip", medicamentNom: "BOVILIS BOVIGRIP" }),
    traitement({ medicamentId: "med-rispoval", medicamentNom: "RISPOVAL RS+PI3 INTRANASAL" }),
  ]);
  assert.equal(actes.length, 2);
});

test("une Vaccination legacy neutralisée après vérification ne crée pas un troisième fait", () => {
  const date = new Date("2025-10-15T12:00:00Z");
  const actes = unifierActesVaccinaux(
    [vaccination({ sourceId: "v-generique", date, medicamentId: null, vaccin: "Protocole legacy", protocoleId: null, statut: "NEUTRALISE_DOUBLON_LEGACY" })],
    [
      traitement({ id: "t-cryptium", dateDebut: date, medicamentId: "med-cryptium", medicamentNom: "CRYPTIUM" }),
      traitement({ id: "t-rotavec", dateDebut: date, medicamentId: "med-rotavec", medicamentNom: "ROTAVEC" }),
    ],
  );
  assert.equal(actes.length, 2);
  assert.deepEqual(actes.map((acte) => acte.sourceId).sort(), ["t-cryptium", "t-rotavec"]);
  assert.deepEqual(actes.map((acte) => acte.medicamentId).sort(), ["med-cryptium", "med-rotavec"]);
});

test("sans vérification de couverture, une Vaccination générique n'est pas masquée abusivement", () => {
  const date = new Date("2025-10-15T12:00:00Z");
  const actes = unifierActesVaccinaux(
    [vaccination({ sourceId: "v-generique", date, medicamentId: null, vaccin: "Protocole legacy" })],
    [
      traitement({ id: "t-a", dateDebut: date, medicamentId: "med-a", medicamentNom: "A" }),
      traitement({ id: "t-b", dateDebut: date, medicamentId: "med-b", medicamentNom: "B" }),
    ],
  );
  assert.equal(actes.length, 3, "l'extraction doit d'abord vérifier que tous les médicaments possibles sont couverts");
});

test("plusieurs Vaccination génériques le même jour restent visibles comme incohérence non couverte", () => {
  const date = new Date("2025-10-15T12:00:00Z");
  const actes = unifierActesVaccinaux(
    [
      vaccination({ sourceId: "v-generique-1", date, medicamentId: null, vaccin: "Legacy 1" }),
      vaccination({ sourceId: "v-generique-2", date, medicamentId: null, vaccin: "Legacy 2" }),
    ],
    [
      traitement({ id: "t-a", dateDebut: date, medicamentId: "med-a", medicamentNom: "A" }),
      traitement({ id: "t-b", dateDebut: date, medicamentId: "med-b", medicamentNom: "B" }),
    ],
  );
  assert.equal(actes.length, 4);
  assert.equal(actes.filter((acte) => acte.medicamentId === null).length, 2);
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
