import test from "node:test";
import assert from "node:assert/strict";
import { getEchoListEntryDays, getEchoListStatus } from "../lib/echo-list-status.ts";

test("classe les sous-statuts de la liste d'échographie", () => {
  assert.deepEqual(getEchoListStatus(34, 40), {
    label: "Bientôt prête pour l’échographie",
    countdown: "Prête dans 6 jours",
    sortGroup: 3,
  });
  assert.equal(getEchoListStatus(35, 40).countdown, "Prête dans 5 jours");
  assert.equal(getEchoListStatus(39, 40).countdown, "Prête demain");
  assert.equal(getEchoListStatus(40, 40).countdown, "Prête aujourd’hui");
  assert.equal(getEchoListStatus(44, 40).countdown, "En retard de 4 jours");
});

test("utilise le seuil principal lorsque la phase préparatoire est désactivée", () => {
  assert.equal(getEchoListEntryDays({ usePreparationPhase: true, listFromDays: 35, dueFromDays: 40 }), 35);
  assert.equal(getEchoListEntryDays({ usePreparationPhase: false, listFromDays: 35, dueFromDays: 40 }), 40);
});
