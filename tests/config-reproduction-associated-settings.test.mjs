import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const reproductionPage = await readFile(
  new URL("../app/config/reproduction/page.tsx", import.meta.url),
  "utf8"
);
const settingsForm = await readFile(
  new URL(
    "../app/config/reproduction/PostCalvingSettingsForm.tsx",
    import.meta.url
  ),
  "utf8"
);
const apiRoute = await readFile(
  new URL("../app/api/exploitation-config/route.ts", import.meta.url),
  "utf8"
);
const animalPage = await readFile(
  new URL("../app/troupeau/[nutrav]/page.tsx", import.meta.url),
  "utf8"
);

test("la page Reproduction charge les deux valeurs depuis ExploitationConfig", () => {
  assert.match(reproductionPage, /reproReposObjectifJours: true/);
  assert.match(reproductionPage, /tarissementVeauAgeMois: true/);
  assert.match(reproductionPage, /reproReposObjectifJours: stored\?\.reproReposObjectifJours \?\? 60/);
  assert.match(reproductionPage, /tarissementVeauAgeMois: stored\?\.tarissementVeauAgeMois \?\? 6/);
  assert.match(reproductionPage, /PostCalvingSettingsForm/);
});

test("les réglages déplacés sont distincts du formulaire des règles du cycle", () => {
  assert.match(settingsForm, /Après le vêlage/);
  assert.match(settingsForm, /Objectif de repos post-vêlage/);
  assert.match(settingsForm, /Durée de repos visée avant la remise à la reproduction/);
  assert.match(settingsForm, /Tarissement/);
  assert.match(settingsForm, /Proposer le tarissement lorsque le veau atteint/);
  assert.match(settingsForm, /CESAM utilise cet âge pour afficher la proposition de tarissement/);
  assert.doesNotMatch(settingsForm, /reproductionRulesJson/);
});

test("l’enregistrement partiel envoie uniquement les deux champs existants", () => {
  assert.match(settingsForm, /fetch\("\/api\/exploitation-config"/);
  assert.match(settingsForm, /method: "PATCH"/);
  assert.match(settingsForm, /body: JSON\.stringify\(form\)/);
  assert.match(settingsForm, /reproReposObjectifJours: initial\.reproReposObjectifJours \?\? 60/);
  assert.match(settingsForm, /tarissementVeauAgeMois: initial\.tarissementVeauAgeMois \?\? 6/);
  assert.doesNotMatch(settingsForm, /\bipg\b|raisonSociale|veterinaireNom|affichageDelaiAttente/);
});

test("la route existante ne met à jour que les champs fournis", () => {
  for (const field of [
    "reproReposObjectifJours",
    "tarissementVeauAgeMois",
  ]) {
    assert.match(
      apiRoute,
      new RegExp(
        `safe${field === "reproReposObjectifJours" ? "ReposJours" : "TarissementMois"} !== undefined && \\{ ${field}:`
      )
    );
  }
  assert.match(apiRoute, /ipg !== undefined && \{ ipg:/);
  assert.match(apiRoute, /veterinaireNom !== undefined && \{ veterinaireNom:/);
  assert.match(apiRoute, /affichageDelaiAttente !== undefined && \{ affichageDelaiAttente \}/);
});

test("le cercle et la proposition de tarissement conservent les mêmes sources", () => {
  assert.match(
    animalPage,
    /restObjectiveDays: configAffichage\.reproReposObjectifJours/
  );
  assert.match(
    animalPage,
    /dryOffCalfAgeMonths: configAffichage\.tarissementVeauAgeMois/
  );
});
