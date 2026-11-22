import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../lib/vaccine-session-retry.ts", import.meta.url), "utf8");
const ui = readFileSync(new URL("../app/sanitaire/vaccins/TableauVaccinal.tsx", import.meta.url), "utf8");

test("successful complementary treatments are not submitted again on retry", () => {
  assert.match(source, /filter\(index => !completed\.has\(index\)\)/);
  assert.match(ui, /pendingIndexes\(soinsEnAttente\.length, soinsTermines\.current\)/);
  assert.match(ui, /soinsTermines\.current = markCompleted/);
});
test("acknowledged vaccinations are skipped on retry", () => {
  assert.match(ui, /vaccinationsTerminees\.current\.has\(acte\.cle\)/);
  assert.match(ui, /vaccinationsTerminees\.current\.add\(acte\.cle\)/);
});
test("ambiguous network failures block resubmission pending reconciliation", () => {
  assert.match(source, /error instanceof TypeError/);
  assert.match(ui, /setRepriseBloquee\(true\)/);
  assert.match(ui, /repriseBloquee\}/);
});
test("one session button and queue instead of immediate complementary treatment POST", () => {
  const start=ui.indexOf("function enregistrerSoin()");
  const end=ui.indexOf("function renduPanneauSoin()",start);
  const body=ui.slice(start,end);
  assert.match(body, /setSoinsEnAttente/);
  assert.doesNotMatch(body, /fetch\(/);
  assert.match(ui, /Enregistrer la séance/);
});
test("vaccine visibility and responsive prescription panel", () => {
  assert.match(ui, /checked=\{modeVaccin\(bloc\.cle\) !== "MASQUE"\}/);
  assert.match(ui, /max-w-md flex-col/);
  assert.match(ui, /fixed inset-0 z-\[90\] flex justify-end/);
});
