import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [animalPage, treePage, treeClient, ancestryEditor, ancestryRoute, migration] = await Promise.all([
  readFile(new URL("../app/troupeau/[nutrav]/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/troupeau/[nutrav]/arbre/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/troupeau/[nutrav]/arbre/ArbreClient.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/troupeau/[nutrav]/arbre/AncestryEditor.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/animaux/[nutrav]/ascendance/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../prisma/migrations/20260829120000_add_manual_ancestry_snapshots/migration.sql", import.meta.url), "utf8"),
]);

test("la fiche affiche numéro de travail et nom, sans numéro national", () => {
  assert.match(animalPage, /motherWorkNumber \?\? "—"/);
  assert.match(animalPage, /fatherWorkNumber \?\? "—"/);
  assert.match(animalPage, /motherWorkNumber && motherName/);
  assert.match(animalPage, /fatherWorkNumber && fatherName/);
  assert.doesNotMatch(animalPage, /Race père/);
});

test("l'arbre lit les historiques mère et père et ne lie que les Animal CESAM", () => {
  assert.match(treePage, /nationalNumber: animal\.numeip \?\? animal\.mereNationalManuel/);
  assert.match(treePage, /name: animal\.nomeip \?\? animal\.mereNomManuel/);
  assert.match(treePage, /birthVelage\.pereNunati/);
  assert.match(treeClient, /node\.linkNutrav \? `/);
  assert.match(ancestryEditor, />\s*Renseigner\s*</);
  assert.match(ancestryEditor, /match\.workNumber \?\? "—"/);
  assert.match(ancestryEditor, /match\.name \?\? "—"/);
  assert.match(ancestryEditor, /match\.nationalNumber \?\? "—"/);
});

test("la recherche couvre les animaux sortis et toutes les sources demandées", () => {
  assert.doesNotMatch(ancestryRoute, /statut: "ACTIF"/);
  for (const field of ["nutrav", "nunati", "numeroNational", "nobovi", "numeip", "nomeip", "nupere", "nopere", "pereNunati", "pereNom"]) {
    assert.match(ancestryRoute, new RegExp(field));
  }
  assert.doesNotMatch(ancestryRoute, /\.animal\.create|\.taureau\.create/);
});

test("la recherche et l'API bloquent auto-parent et sexe incohérent", () => {
  assert.match(ancestryRoute, /canUseAnimalAsParent/);
  assert.match(ancestryRoute, /isSameAncestryIdentity/);
  assert.match(ancestryRoute, /animal\.sexbov/);
  assert.match(ancestryRoute, /parent !== "PERE"/);
});

test("la migration est uniquement additive", () => {
  assert.equal((migration.match(/ALTER TABLE "Animal" ADD COLUMN/g) ?? []).length, 6);
  assert.doesNotMatch(migration, /DROP|DELETE|CREATE TABLE|RENAME/i);
});
