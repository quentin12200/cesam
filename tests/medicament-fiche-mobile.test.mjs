import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const fiche = readFileSync(new URL("../app/pharmacie/[id]/MedicamentFicheClient.tsx", import.meta.url), "utf8");

test("les préconisations précèdent la conservation après ouverture", () => {
  const preconisations = fiche.indexOf("{/* Préconisations */}");
  const conservation = fiche.indexOf("<ConservationOuvertureSection", preconisations);
  assert.ok(preconisations >= 0);
  assert.ok(conservation > preconisations);
});

test("la voie est abrégée dans le pavé sans supprimer son libellé complet", () => {
  assert.match(fiche, /abregerVoie\(p\.voie\)/);
  assert.match(fiche, /overflow-hidden rounded-xl/);
  assert.match(fiche, /text-2xl leading-none/);
  assert.match(fiche, /break-words/);
  assert.match(fiche, /<b className="block text-gray-400 font-medium">Voie<\/b>\{formatVoie\(p\.voie\)\}/);
});
