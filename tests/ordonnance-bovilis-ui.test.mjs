import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [scanRoute, verificationCard, verificationClient] = await Promise.all([
  readFile(new URL("../app/api/scan-ordonnance/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/ordonnances/a-verifier/[id]/MedicamentVerificationCard.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/ordonnances/a-verifier/[id]/VerificationOrdonnanceClient.tsx", import.meta.url), "utf8"),
]);

test("conserve gpt-4o-mini et cadre le cas BOVILIS", () => {
  assert.match(scanRoute, /const MODEL = "gpt-4o-mini"/);
  assert.match(scanRoute, /5X1 D\.\+SOLV/);
  assert.match(scanRoute, /15 doses au total/);
  assert.match(scanRoute, /tableau de reconstitution/);
  assert.match(scanRoute, /toutes les denrées : 0 jour/);
});

test("affiche une synthèse des conditions avec actions près des incertitudes", () => {
  assert.match(verificationCard, /conditionsImportantes\.map/);
  assert.match(verificationCard, />\s*Confirmer\s*</);
  assert.match(verificationCard, />\s*Corriger\s*</);
  assert.match(verificationCard, /title=\{condition\.sourceText\}/);
  assert.match(verificationClient, /conditionsImportantes:[\s\S]*sourceText/);
});
