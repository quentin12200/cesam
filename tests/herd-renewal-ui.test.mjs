import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboard = readFileSync(new URL("../app/troupeau/renouvellement/RenewalDashboard.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/troupeau/renouvellement/page.tsx", import.meta.url), "utf8");

test("la vue mobile expose les chiffres, la projection et la comparaison", () => {
  for (const text of ["mères actuelles", "besoin / an", "candidates", "sorties prévues", "Projection :", "Comparer les candidates"]) assert.match(dashboard, new RegExp(text));
  assert.match(dashboard, /grid-cols-2[^\n]*sm:grid-cols-4/);
  assert.match(dashboard, /rounded-xl/);
});

test("les décisions restent temporaires et couvrent les trois états", () => {
  assert.match(dashboard, /GARDER/);
  assert.match(dashboard, /A_REVOIR/);
  assert.match(dashboard, /SORTIR/);
  assert.match(dashboard, /aucun animal n’est modifié/);
});

test("les candidates viennent seulement des catégories de renouvellement et réutilisent la généalogie", () => {
  assert.match(page, /RENEWAL_CANDIDATE_CATEGORIES/);
  assert.match(page, /resolveCandidateParents/);
  assert.match(page, /directMother: identity\(animal\.mere\)/);
  assert.match(page, /breedingBull: identity/);
});

test("le regroupement père et mère ainsi que les tris demandés sont présents", () => {
  for (const text of ["Par père", "Par mère", "Date de naissance", "Poids", "Âge"]) assert.match(dashboard, new RegExp(text));
});
