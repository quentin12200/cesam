import assert from "node:assert/strict";
import test from "node:test";
import { construireJoursCalendrier, dateAffichageActionAgenda, libelleFenetreVaccinale, regrouperActionsAgenda, selectionDepuisGroupeAgenda, type ActionAgenda } from "./vaccine-agenda.ts";

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
  assert.deepEqual(libelleFenetreVaccinale("PREVU", "2026-11-04T12:00:00Z", "2026-11-22T12:00:00Z", true), { statut: "", date: "dès 04/11" });
  assert.deepEqual(libelleFenetreVaccinale("BIENTOT", "2026-11-04T12:00:00Z", "2026-11-22T12:00:00Z", true), { statut: "bientôt", date: "dès 04/11" });
  assert.deepEqual(libelleFenetreVaccinale("A_FAIRE", "2026-11-04T12:00:00Z", "2026-11-22T12:00:00Z", true), { statut: "à faire", date: "depuis 04/11" });
  assert.deepEqual(libelleFenetreVaccinale("A_FAIRE", "2026-11-14T12:00:00Z", "2026-11-14T12:00:00Z"), { statut: "à faire", date: "le 14/11" });
  assert.deepEqual(libelleFenetreVaccinale("A_FAIRE", "2026-11-14T12:00:00Z", "2026-11-21T12:00:00Z"), { statut: "à faire", date: "14/11 → 21/11" });
  assert.deepEqual(libelleFenetreVaccinale("EN_RETARD", "2026-10-01T12:00:00Z", "2026-10-05T12:00:00Z"), { statut: "en retard", date: "01/10 → 05/10" });
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

test("le calendrier mensuel commence un lundi et couvre six semaines", () => {
  const jours = construireJoursCalendrier(new Date(2026, 10, 1, 12));
  assert.equal(jours.length, 42);
  assert.equal(jours[0].cle, "2026-10-26");
  assert.equal(jours[0].date.getDay(), 1);
  assert.equal(jours.filter((jour) => jour.dansMois).length, 30);
});

test("les actions actives sont visibles aujourd'hui et les actions futures à l'ouverture de leur fenêtre", () => {
  const aujourdHui = new Date(2026, 9, 10, 12);
  const [aFaire] = regrouperActionsAgenda([action({ statut: "A_FAIRE" })]);
  const [enRetard] = regrouperActionsAgenda([action({ statut: "EN_RETARD" })]);
  const [bientot] = regrouperActionsAgenda([action({ statut: "BIENTOT", dateMin: "2026-11-18T12:00:00Z" })]);
  assert.equal(dateAffichageActionAgenda(aFaire, aujourdHui), "2026-10-10");
  assert.equal(dateAffichageActionAgenda(enRetard, aujourdHui), "2026-10-10");
  assert.equal(dateAffichageActionAgenda(bientot, aujourdHui), "2026-11-18");
});

test("préparer une action transmet exactement les animaux et cellules du groupe au tableau", () => {
  const [groupe] = regrouperActionsAgenda([
    action({ animalId: "a1", etapeId: "rappel" }),
    action({ animalId: "a2", etapeId: "rappel" }),
  ]);
  assert.deepEqual(selectionDepuisGroupeAgenda(groupe), {
    animalIds: ["a1", "a2"],
    actes: ["a1|rappel", "a2|rappel"],
  });
});
