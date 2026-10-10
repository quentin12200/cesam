import assert from "node:assert/strict";
import test from "node:test";
import { libelleFenetreVaccinale, regrouperActionsAgenda, type ActionAgenda } from "./vaccine-agenda.ts";

function action(partiel: Partial<ActionAgenda> = {}): ActionAgenda {
  return {
    animalId: "a1",
    nutrav: "7501",
    nom: null,
    medicamentId: "med-bovigrip",
    medicamentNom: "Bovigrip",
    protocoleId: "proto-1",
    etapeId: "rappel",
    etapeLabel: "Rappel",
    typeEtape: "INITIAL",
    statut: "A_FAIRE",
    dateMin: "2026-10-01T12:00:00.000Z",
    dateMax: "2026-10-20T12:00:00.000Z",
    dateVelageReference: null,
    ...partiel,
  };
}

test("les libellés expliquent le sens de la fenêtre sans date nue", () => {
  assert.deepEqual(libelleFenetreVaccinale("PREVU", "2026-11-04T12:00:00Z", "2026-11-22T12:00:00Z"), { statut: "", date: "dès 04/11" });
  assert.deepEqual(libelleFenetreVaccinale("A_FAIRE", "2026-11-04T12:00:00Z", "2026-11-22T12:00:00Z"), { statut: "à faire", date: "jusqu’au 22/11" });
  assert.deepEqual(libelleFenetreVaccinale("EN_RETARD", "2026-10-01T12:00:00Z", "2026-10-05T12:00:00Z"), { statut: "en retard", date: "depuis 05/10" });
});

test("l'Agenda mélange tous les vaccins et ordonne retard, à faire, bientôt puis prévu", () => {
  const groupes = regrouperActionsAgenda([
    action({ animalId: "a-prevu", medicamentId: "med-autre", medicamentNom: "Autre vaccin", statut: "PREVU", dateMin: "2026-12-01T12:00:00Z", dateMax: "2026-12-15T12:00:00Z" }),
    action({ animalId: "a-faire-2", medicamentId: "med-crypto", medicamentNom: "Cryptium", statut: "A_FAIRE", dateMax: "2026-10-22T12:00:00Z" }),
    action({ animalId: "a-retard", medicamentNom: "Bovigrip", statut: "EN_RETARD", dateMax: "2026-10-05T12:00:00Z" }),
    action({ animalId: "a-bientot", medicamentId: "med-crypto", medicamentNom: "Cryptium", statut: "BIENTOT", dateMin: "2026-11-18T12:00:00Z", dateMax: "2026-11-30T12:00:00Z" }),
    action({ animalId: "a-faire-1", medicamentId: "med-bovigrip", medicamentNom: "Bovigrip", statut: "A_FAIRE", dateMax: "2026-10-18T12:00:00Z" }),
  ]);
  assert.deepEqual(groupes.map((groupe) => groupe.statut), ["EN_RETARD", "A_FAIRE", "A_FAIRE", "BIENTOT", "PREVU"]);
  assert.deepEqual(groupes.map((groupe) => groupe.medicamentNom), ["Bovigrip", "Bovigrip", "Cryptium", "Cryptium", "Autre vaccin"]);
});

test("les animaux ayant même vaccin, étape, statut et fenêtre sont regroupés uniquement pour la présentation", () => {
  const groupes = regrouperActionsAgenda([
    action({ animalId: "a1", nutrav: "7501" }),
    action({ animalId: "a2", nutrav: "7502" }),
  ]);
  assert.equal(groupes.length, 1);
  assert.deepEqual(groupes[0].actions.map((item) => item.nutrav), ["7501", "7502"]);
});
