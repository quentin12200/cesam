import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resumeFriseQuestionnaire } from "./vaccine-questionnaire-timeline.ts";

test("la frise reste non engageante avant le choix du démarrage", () => {
  assert.deepEqual(resumeFriseQuestionnaire(null, false), {
    etapesInitiales: [],
    initialTermine: false,
    entretien: false,
  });
});

test("la frise décrit une dose unique seulement après ce choix", () => {
  assert.deepEqual(resumeFriseQuestionnaire("DOSE_UNIQUE", false), {
    etapesInitiales: ["Dose unique"],
    initialTermine: true,
    entretien: false,
  });
});

test("la frise décrit la Primo et le Rappel seulement après ce choix", () => {
  assert.deepEqual(resumeFriseQuestionnaire("PRIMO_RAPPEL", false), {
    etapesInitiales: ["Primo", "Rappel"],
    initialTermine: true,
    entretien: false,
  });
});

test("l'absence de préconisation conserve le blocage et propose la fiche Pharmacie", () => {
  const source = readFileSync(new URL("../app/config/protocoles/ProtocoleQuestionnaire.tsx", import.meta.url), "utf8");
  assert.match(source, /if \(page === 0\) return Boolean\(med && med\.preconisations\.length > 0\)/);
  assert.match(source, /href=\{`\/pharmacie\/\$\{medicamentSelectionne\.id\}`\}/);
  assert.match(source, />Compléter la fiche Pharmacie</);
});
