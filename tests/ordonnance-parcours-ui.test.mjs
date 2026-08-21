import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [liste, detail, route, pharmacieClient, pharmaciePage] = await Promise.all([
  readFile(new URL("../app/ordonnances/OrdonnancesClient.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/ordonnances/[id]/OrdonnanceDetailClient.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/ordonnances/[id]/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/pharmacie/PharmacieClient.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/pharmacie/page.tsx", import.meta.url), "utf8"),
]);

test("la liste propose la suppression de toute l'ordonnance avec confirmation", () => {
  assert.match(liste, /label: "Supprimer l’ordonnance"/);
  assert.match(liste, /Elle devra être rescannée/);
  assert.match(liste, /method: "DELETE"/);
  assert.match(liste, /router\.refresh\(\)/);
  assert.match(route, /supprimerGroupeOrdonnance/);
  assert.match(route, /prisma\.\$transaction/);
});

test("Réanalyser utilise le pipeline multi-pages complet sans appliquer une lecture partielle", () => {
  assert.match(detail, /chargerPagesOrdonnance\(documentUrlsAffiches\)/);
  assert.match(detail, /scanAndCreateExtraction\(pages\)/);
  assert.match(detail, /\/ordonnances\/a-verifier\/\$\{extractionId\}/);
  assert.doesNotMatch(detail, /appliquerReanalyse/);
  assert.doesNotMatch(detail, /fetch\("\/api\/scan-ordonnance"/);
  assert.doesNotMatch(detail, /Appliquer aux champs/);
});

test("l'onglet Pharmacie est initialisé et conservé dans l'URL", () => {
  assert.match(pharmaciePage, /params\.vue === "ordonnances"/);
  assert.match(pharmaciePage, /initialView=\{initialView\}/);
  assert.match(pharmacieClient, /useState<"medicaments" \| "ordonnances">\(initialView\)/);
  assert.match(pharmacieClient, /router\.replace\(`\/pharmacie\?vue=\$\{id\}`/);
  assert.match(pharmacieClient, /scroll: false/);
});
