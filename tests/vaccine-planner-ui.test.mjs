import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("la fiche Pharmacie expose la conservation par défaut et les surcharges", () => {
  const page = read("app/pharmacie/[id]/page.tsx");
  const client = read("app/pharmacie/[id]/MedicamentFicheClient.tsx");
  const section = read("app/pharmacie/[id]/ConservationOuvertureSection.tsx");
  assert.match(page, /conservationOuvertureStatut/);
  assert.match(client, /ConservationOuvertureSection/);
  assert.match(section, /Utiliser la règle par défaut/);
  assert.match(section, /Information inconnue/);
  assert.match(section, /À utiliser immédiatement/);
  assert.match(section, /Peut être conservé/);
  assert.match(section, /Source \(RCP, vétérinaire…\)/);
});

test("la première vue du planificateur reste factuelle et rattachée à la gestation", () => {
  const loader = read("lib/vaccine-preparation-data.ts");
  const page = read("app/sanitaire/vaccins/page.tsx");
  assert.match(loader, /vaccination\.gestationId === gestation\?\.id/);
  assert.match(loader, /calculerActionVaccinale/);
  assert.match(page, /dateMin/);
  assert.match(page, /dateMax/);
  assert.doesNotMatch(loader, /\.create\(|\.update\(/);
});

test("les APIs séparent dose administrée et doses commerciales", () => {
  const batch = read("app/api/vaccinations/batch/route.ts");
  const usages = read("app/api/flacons-vaccins/[id]/utilisations/route.ts");
  assert.match(batch, /etapeProtocoleId/);
  assert.match(batch, /gestationId/);
  assert.match(batch, /typeInjection/);
  assert.match(batch, /dose/);
  assert.match(usages, /dosesUtilisees/);
  assert.match(usages, /Reliquat insuffisant/);
});
