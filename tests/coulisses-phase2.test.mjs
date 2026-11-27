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

test("global settings opens the same Coulisses hub and retains existing settings", () => {
 const panel = read("components/GlobalSettingsButton.tsx");
 assert.match(panel, /href="\/config\/coulisses" prefetch=\{false\} onClick=\{\(\) => setOpen\(false\)\}/);
 assert.match(panel, /href="\/lab"/);
 assert.match(panel, /Prototypes sur données fictives/);
 assert.doesNotMatch(panel, /Prototype en lecture seule|href="\/taureaux\/controle"/);
 for (const item of ["IdentificationSettings", "PreconisationReferentielsSettings", "ouvrirHistorique", "setProfile", "/config/notifications", "/config/reproduction"]) assert.ok(panel.includes(item), item);
 assert.match(panel, /min-h-12 min-w-0/);
 assert.match(panel, /break-words/);
 assert.match(panel, /aria-label="Fermer les paramètres"/);
 assert.match(read("app/config/coulisses/page.tsx"), /href: "\/taureaux\/controle"/);
});
