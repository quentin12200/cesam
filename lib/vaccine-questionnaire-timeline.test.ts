import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resumeFriseQuestionnaire } from "./vaccine-questionnaire-timeline.ts";

test("la frise reste non engageante avant le choix du démarrage", () => {
  assert.deepEqual(resumeFriseQuestionnaire(null, { rappelDefini: false, initialTermine: false, entretienDefini: false }), {
    etapesInitiales: [],
    afficherDelaiRappel: false,
    initialTermine: false,
    entretien: false,
  });
});

test("la frise décrit une dose unique sans anticiper la fin du protocole", () => {
  assert.deepEqual(resumeFriseQuestionnaire("DOSE_UNIQUE", { rappelDefini: false, initialTermine: false, entretienDefini: false }), {
    etapesInitiales: ["Dose unique"],
    afficherDelaiRappel: false,
    initialTermine: false,
    entretien: false,
  });
});

test("Primo et Rappel n'affichent aucun délai par défaut", () => {
  assert.deepEqual(resumeFriseQuestionnaire("PRIMO_RAPPEL", { rappelDefini: false, initialTermine: false, entretienDefini: false }), {
    etapesInitiales: ["Primo", "Rappel"],
    afficherDelaiRappel: false,
    initialTermine: false,
    entretien: false,
  });
});

test("le délai puis la fin du protocole apparaissent seulement après validation", () => {
  assert.equal(resumeFriseQuestionnaire("PRIMO_RAPPEL", { rappelDefini: true, initialTermine: false, entretienDefini: false }).afficherDelaiRappel, true);
  assert.equal(resumeFriseQuestionnaire("PRIMO_RAPPEL", { rappelDefini: true, initialTermine: false, entretienDefini: false }).initialTermine, false);
  assert.equal(resumeFriseQuestionnaire("PRIMO_RAPPEL", { rappelDefini: true, initialTermine: true, entretienDefini: false }).initialTermine, true);
});

test("la frise question 1 conserve seulement le nom du vaccin", () => {
  const source = readFileSync(new URL("../app/config/protocoles/ProtocoleQuestionnaire.tsx", import.meta.url), "utf8");
  assert.match(source, /<p className="mt-2 font-semibold text-gray-900">\{med\.nom\}<\/p>\{resume\.etapesInitiales\.length > 0/);
  assert.match(source, /rappelDefini: form\.initialTermine/);
  assert.match(source, />✓ Protocole initial terminé</);
});

test("l'absence de préconisation conserve le blocage et propose la fiche Pharmacie", () => {
  const source = readFileSync(new URL("../app/config/protocoles/ProtocoleQuestionnaire.tsx", import.meta.url), "utf8");
  assert.match(source, /if \(page === 0\) return Boolean\(med && med\.preconisations\.length > 0\)/);
  assert.match(source, /href=\{`\/pharmacie\/\$\{medicamentSelectionne\.id\}`\}/);
  assert.match(source, />Compléter la fiche Pharmacie</);
});
