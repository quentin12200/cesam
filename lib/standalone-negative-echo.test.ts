import assert from "node:assert/strict";
import test from "node:test";
import { belongsToEchoActionList } from "./echo-request-state.ts";
import { buildStandaloneNegativeEchoPlan } from "./standalone-negative-echo.ts";

test("VIDE sans saillie clôt la demande manuelle et retire la vache de À écho", () => {
  const echoDate = new Date("2026-09-03T00:00:00.000Z");
  const plan = buildStandaloneNegativeEchoPlan({
    id: "vache-vide",
    aEchographier: true,
    reproductionEtatManuel: null,
    reproductionEtatPrecedent: null,
    reproductionEtatModifieAt: null,
    demandesEchographie: [{
      id: "demande-manuelle",
      origine: "MANUELLE",
      etat: "A_FAIRE",
      clotureeAt: null,
      requestKey: "MANUAL_ACTIVE:vache-vide",
      observation: null,
    }],
  }, echoDate, "Contrôle terrain");

  assert.deepEqual(plan.animalUpdate, {
    aEchographier: false,
    reproductionEtatManuel: "ROUGE",
    reproductionEtatPrecedent: null,
    reproductionEtatModifieAt: echoDate,
  });
  assert.deepEqual(plan.requestUpdates, [{
    id: "demande-manuelle",
    data: {
      etat: "REALISEE",
      clotureeAt: echoDate,
      observation: "Contrôle terrain",
      requestKey: null,
    },
  }]);
  assert.equal(plan.requestCreate, null);
  assert.equal(belongsToEchoActionList({
    aEchographier: plan.animalUpdate.aEchographier,
    reproductionEtatManuel: plan.animalUpdate.reproductionEtatManuel,
    demandesEchographie: plan.requestUpdates.map((request) => ({ etat: request.data.etat })),
  }), false);
});

test("VIDE sans demande active conserve un enregistrement réalisé sans créer de saillie", () => {
  const echoDate = new Date("2026-09-03T00:00:00.000Z");
  const plan = buildStandaloneNegativeEchoPlan({
    id: "vache-vide",
    aEchographier: false,
    reproductionEtatManuel: "REPOS",
    reproductionEtatPrecedent: null,
    reproductionEtatModifieAt: null,
    demandesEchographie: [],
  }, echoDate);

  assert.equal(plan.requestCreate?.saillieId, null);
  assert.equal(plan.requestCreate?.etat, "REALISEE");
  assert.equal(plan.requestCreate?.origine, "MANUELLE");
  assert.equal(plan.requestCreate?.clotureeAt, echoDate);
});
