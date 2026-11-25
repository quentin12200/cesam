import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
test("Lab uses fixtures and not the real father component or database", () => {
 const page = read("app/lab/page.tsx");
 assert.match(page, /DEMO_WORKSPACE_ANIMALS/);
 assert.doesNotMatch(page, /prisma|GENEA_DATA|LabFathers|fetch\(/);
 for (const path of ["LabExplorer.tsx","LabCreatePanel.tsx"]) {
   const source = read("app/lab/"+path);
   assert.doesNotMatch(source, /LabFathers|fetch\(|\/api\/|href=|next\/link|destinations/);
 }
});
test("real father tool retained in private Coulisses route", () => {
 const page = read("app/config/coulisses/peres/page.tsx");
 assert.match(page, /<LabFathers fathers=\{fathers\}/);
 assert.match(page, /prisma\.taureau\.findMany/);
 assert.match(page, /GENEA_DATA/);
 assert.match(read("app/lab/LabFathers.tsx"), /method:"PATCH"/);
 assert.doesNotMatch(read("middleware.ts"), /"\/config(?:\/coulisses)?"/);
});
