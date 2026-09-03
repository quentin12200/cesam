import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [page, table, mobile, summary, batchRoute, singleRoute, manualRequests, requestState, filters] = await Promise.all([
  readFile(new URL("../app/troupeau/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/troupeau/TroupeauTableau.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/troupeau/TroupeauMobileList.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/troupeau/ReproductionCycleSummary.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/animaux/echo-requests/batch/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/animaux/[nutrav]/echo-request/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/manual-echo-requests.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/echo-request-state.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/troupeau-filters.ts", import.meta.url), "utf8"),
]);

test("le troupeau charge tout l'historique utile et construit le résumé du cycle", () => {
  assert.match(page, /getCurrentReproductionSummary/);
  assert.match(page, /getCurrentCycleBreeding/);
  assert.doesNotMatch(page.match(/saillies:\s*\{[\s\S]*?velagesVache:/)?.[0] ?? "", /take:\s*1/);
  for (const field of ["dateEcho", "resultatEcho", "type: true"]) assert.match(page, new RegExp(field));
});

test("le tableau affiche le cycle, la demande active et le tri par dernier vêlage", () => {
  assert.match(table, /ReproductionCycleSummary/);
  assert.match(table, /animal\.aEchographier/);
  assert.match(summary, /Aucune écho depuis vêlage/);
  assert.match(summary, /❌ Négative/);
  assert.match(summary, /✓ Positive/);
  assert.match(table, /triAsc="velage_asc"/);
  assert.match(table, /triDesc="velage_desc"/);
  assert.match(filters, /"velage_asc", "velage_desc"/);
});

test("la sélection multiple ne détourne pas le clic de ligne", () => {
  assert.match(table, /Sélectionner toutes les femelles visibles compatibles/);
  assert.match(table, /selectedIds\.size/);
  assert.match(table, /Ajouter.*à échographier/);
  assert.match(table, /onClick=\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.match(table, /router\.push\(`\/troupeau\/\$\{animal\.nutrav\}`\)/);
});

test("le batch et la route individuelle partagent la règle anti-doublon", () => {
  assert.match(batchRoute, /createManualEchoRequest/);
  assert.match(singleRoute, /createManualEchoRequest/);
  assert.match(manualRequests, /etat: "A_FAIRE"/);
  assert.match(manualRequests, /status: "ALREADY_ACTIVE"/);
  assert.match(manualRequests, /buildManualEchoRequestData/);
  assert.match(requestState, /requestKey: `MANUAL_ACTIVE:\$\{input\.animalId\}`/);
  assert.match(batchRoute, /new Set/);
  assert.match(table, /alreadyActive/);
  assert.match(table, /router\.refresh\(\)/);
});

test("le mobile affiche le résumé minimal quand Reproduction est visible", () => {
  assert.match(mobile, /isVisible\("reproduction"\).*reproduction/);
  assert.match(mobile, /ReproductionCycleSummary summary=\{animal\.reproductionSummary\} compact/);
  assert.match(summary, /Vêlée il y a/);
  assert.match(summary, /Aucune écho depuis vêlage/);
  assert.match(summary, /il y a.*j/);
});
