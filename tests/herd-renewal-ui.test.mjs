import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboard = readFileSync(new URL("../app/troupeau/renouvellement/RenewalDashboard.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/troupeau/renouvellement/page.tsx", import.meta.url), "utf8");
const calvingRoute = readFileSync(new URL("../app/api/velages/route.ts", import.meta.url), "utf8");

test("affiche la moyenne réelle, la sélection des petites et la projection annuelle", () => {
  for (const text of ["1er vêlage moyen", "Sélection en cours — Petites génisses", "Projection multi-années", "Mères au début", "Sorties nécessaires"]) assert.match(dashboard, new RegExp(text));
  assert.doesNotMatch(dashboard, /1er vêlage \(mois\)/);
});

test("compare uniquement les petites génisses", () => {
  assert.match(dashboard, /pipelineCandidates\.filter\(\(candidate\) => candidate\.category === "PETITE_GENISSE"\)/);
  assert.match(dashboard, /Comparer les candidates/);
  for (const text of ["Par père", "Par mère", "GARDER", "A_REVOIR", "SORTIR"]) assert.match(dashboard, new RegExp(text));
});

test("sépare le pipeline petite, moyenne, grande et les présélections", () => {
  for (const value of ["PETITE_GENISSE", "MOYENNE_GENISSE", "GRANDE_GENISSE", "Présélections à venir"]) assert.match(dashboard, new RegExp(value));
  assert.match(page, /PRESELECTION_GENISSE/);
});

test("reconnaît les anciennes mères par leurs vêlages et les sorties commerciales", () => {
  assert.match(page, /isCurrentMother\(animal\.velagesVache\.length\)/);
  assert.match(page, /isAutomaticPlannedExit\(animal\.velagesVache\.length, animal\.categorie\)/);
});

test("la création du premier vêlage applique la transition vers vache", () => {
  assert.match(calvingRoute, /isFirstCalving = vache\._count\.velagesVache === 0/);
  assert.match(calvingRoute, /motherUpdateAfterCalving\(isFirstCalving\)/);
  assert.match(calvingRoute, /categorie: prevCategorie, estGenisse: prevEstGenisse/);
});
