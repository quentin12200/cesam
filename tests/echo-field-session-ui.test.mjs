import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const [page, session, route, home, animalPage] = await Promise.all([
  readFile(new URL("../app/reproduction/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/reproduction/EchoFieldSessionModal.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/echographies/batch/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/troupeau/[nutrav]/page.tsx", import.meta.url), "utf8"),
]);

test("la vue À écho ouvre une séance et permet réellement la sélection multiple", () => {
  assert.match(page, /Saisir les échographies/);
  assert.match(page, /setEchoSessionCows\(vachesAvecEtat\.filter/);
  assert.match(page, /filterEtat === "JAUNE"[\s\S]*Saisir les échos/);
  assert.match(page, /aria-label={`Sélectionner \$\{vache\.nutrav\}`}/);
  assert.match(page, /Tout sélectionner/);
});

test("la séance utilise une date commune avec calendrier et une saisie rapide par vache", () => {
  assert.match(session, /type="date"/);
  assert.match(session, /Date de la séance/);
  assert.match(session, />\s*Pleine\s*</);
  assert.match(session, />\s*Vide\s*</);
  assert.match(session, /Stade de gestation/);
  assert.match(session, /Début estimé/);
  assert.match(session, /Les .* resteront dans « À écho »/);
});

test("les précisions et suites terrain sont enregistrées avec le batch", () => {
  for (const label of ["Cyclée", "Métrite", "Metrabol à prévoir", "Bolus à prévoir", "Note facultative"]) {
    assert.match(session, new RegExp(label));
  }
  assert.match(session, /\/api\/echographies\/batch/);
  assert.match(route, /prisma\.\$transaction/);
  assert.match(route, /evenementSanitaire\.create/);
  assert.match(route, /resolu: false/);
  assert.match(route, /CREATE_ECHOGRAPHIE_BATCH/);
});

test("les actions issues des échographies remontent avec les numéros sur l’accueil", () => {
  assert.match(home, /interventionsSanitairesUrgentes/);
  assert.match(home, /Metrabol à prévoir/);
  assert.match(home, /intervention\.animal\.nutrav/);
});

test("la fiche vache affiche la remarque d’échographie réellement enregistrée", () => {
  assert.match(animalPage, /observationEcho \?\? currentBreeding\?\.gestation\?\.sousResultat/);
});
