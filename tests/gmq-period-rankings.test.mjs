import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const page=readFileSync(new URL("../app/troupeau/gmq/page.tsx",import.meta.url),"utf8");
const client=readFileSync(new URL("../app/troupeau/gmq/PerformancesVeauxClient.tsx",import.meta.url),"utf8");
test("calves including sold are selected from births without active status",()=>{
 assert.match(page,/veauId: \{ not: null \}/);
 assert.doesNotMatch(page,/statut: "ACTIF"/);
 assert.match(page,/seen\.has\(calf\.id\)/);
});
test("GMQ excludes unweighed calves and counts each measured calf once",()=>{
 assert.match(client,/band\.length < 2/);
 assert.match(client,/0 à 3 mois/);
 assert.match(client,/3 à 6 mois/);
 assert.match(client,/6 à 9 mois/);
 assert.match(client,/9 à 12 mois/);
 assert.match(client,/days > 0/);
 assert.match(client,/gmq===null\?\[\]:\[\{calf:c,gmq\}\]/);
});
test("birth period, sex summaries and parent pair rankings are available",()=>{
 assert.match(client,/period === "year"/);
 assert.match(client,/12 derniers mois/);
 assert.match(client,/24 derniers mois/);
 assert.match(client,/Tout l’historique/);
 assert.match(client,/result\.male/);
 assert.match(client,/result\.female/);
 assert.match(client,/calf\.mereId.*father/);
 assert.match(client,/pereNational/);
});
