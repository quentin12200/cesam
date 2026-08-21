import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboard = readFileSync(new URL("../app/troupeau/renouvellement/RenewalDashboard.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/troupeau/renouvellement/page.tsx", import.meta.url), "utf8");
const calvingRoute = readFileSync(new URL("../app/api/velages/route.ts", import.meta.url), "utf8");

test("affiche un tableau de bord compact et des générations", () => {
  for (const text of ["1er vêlage typique", "Sélection en cours", "Mes générations", "Début de la campagne de renouvellement", "Mères présentes", "Voir le détail"]) assert.match(dashboard, new RegExp(text));
  for (const removed of ["Projection multi-années", "Mères au début", "projectedMothers"]) assert.doesNotMatch(dashboard, new RegExp(removed));
});

test("compare uniquement les petites génisses", () => {
  assert.match(dashboard, /pipelineCandidates\.filter\(\(candidate\) => candidate\.category === "PETITE_GENISSE"\)/);
  assert.match(dashboard, />Comparer</);
  for (const text of ["Par père", "Par mère", "NON_DECIDEE", "GARDER", "A_REVOIR", "SORTIR", "à décider"]) assert.match(dashboard, new RegExp(text));
});

test("sépare le mini-pipeline petite, moyenne, grande et les présélections", () => {
  for (const value of ["PETITE_GENISSE", "MOYENNE_GENISSE", "GRANDE_GENISSE", "Présélections à venir", "Petites", "Moyennes", "Grandes", "Vaches"]) assert.match(dashboard, new RegExp(value));
  assert.match(page, /PRESELECTION_GENISSE/);
});

test("audite les anciennes mères et les sorties commerciales", () => {
  assert.match(page, /auditCurrentMothers/);
  assert.match(page, /effectiveCategory/);
  assert.match(page, /A_ENGRAISSER/);
  assert.match(page, /ENGRAISSEMENT/);
});

test("la création du premier vêlage applique la transition vers vache", () => {
  assert.match(calvingRoute, /isFirstCalving = vache\._count\.velagesVache === 0/);
  assert.match(calvingRoute, /motherUpdateAfterCalving\(isFirstCalving\)/);
  assert.match(calvingRoute, /categorie: prevCategorie, estGenisse: prevEstGenisse/);
});
