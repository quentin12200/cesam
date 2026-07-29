import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const reproductionPage = await read("../app/config/reproduction/page.tsx");
const dryOffForm = await read("../app/config/reproduction/DryOffSettingsForm.tsx");
const rulesForm = await read("../app/config/reproduction/ReproductionRulesForm.tsx");
const exploitationApi = await read("../app/api/exploitation-config/route.ts");
const rulesApi = await read("../app/api/reproduction-rules/route.ts");
const animalPage = await read("../app/troupeau/[nutrav]/page.tsx");

test("la page Reproduction présente une seule règle visible de repos post-vêlage", () => {
  assert.match(reproductionPage, /reproReposObjectifJours: true/);
  assert.match(reproductionPage, /applyPostCalvingRestDays/);
  assert.match(reproductionPage, /ReproductionRulesForm initial=\{reproductionRules\}/);
  assert.doesNotMatch(dryOffForm, /repos post-vêlage|reproReposObjectifJours/i);
  assert.match(rulesForm, /config\.phases\.map/);
});

test("le réglage de tarissement reste séparé et inchangé", () => {
  assert.match(dryOffForm, /Tarissement/);
  assert.match(dryOffForm, /tarissementVeauAgeMois/);
  assert.match(dryOffForm, /fetch\("\/api\/exploitation-config"/);
  assert.doesNotMatch(dryOffForm, /reproductionRulesJson/);
  assert.match(animalPage, /dryOffCalfAgeMonths: configAffichage\.tarissementVeauAgeMois/);
});

test("la règle du cycle synchronise la valeur canonique utilisée par le cercle", () => {
  assert.match(rulesApi, /getPostCalvingRestDays\(nextConfig\)/);
  assert.match(rulesApi, /reproReposObjectifJours: postCalvingRestDays/);
  assert.match(rulesApi, /applyPostCalvingRestDays/);
  assert.match(animalPage, /restObjectiveDays: configAffichage\.reproReposObjectifJours/);
  assert.match(animalPage, /configAffichage\.reproReposObjectifJours\s*\)/);
});

test("la route Exploitation ne peut plus créer une seconde valeur concurrente", () => {
  const patchBody = exploitationApi.slice(exploitationApi.indexOf("export async function PATCH"));
  assert.doesNotMatch(patchBody, /reproReposObjectifJours/);
  assert.match(patchBody, /tarissementVeauAgeMois/);
});
