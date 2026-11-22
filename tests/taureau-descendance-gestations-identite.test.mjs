import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const page = read("../app/taureaux/[id]/page.tsx");
const editor = read("../app/taureaux/[id]/BullIdentityEditor.tsx");
const api = read("../app/api/taureaux/route.ts");

test("la fiche affiche les futures gestations sans attribution par nom", () => {
  assert.match(page, /taureauId: bull\.id/);
  assert.match(page, /Gestations confirmées/);
  assert.match(page, /Gestations à vérifier/);
  assert.match(page, /"VERT", "ROSE"/);
  assert.match(page, /"GRIS", "JAUNE"/);
  assert.match(page, /dateVelagePrevue/);
  assert.match(page, /saillie\.animal\.nutrav/);
  assert.doesNotMatch(page, /where: \{.*nopere: bull\.nopere/);
});

test("la correction préserve les liens et bloque les doublons", () => {
  assert.match(api, /export async function PATCH/);
  assert.match(api, /normalizeGenealogyNational\(other\.nupere\)/);
  assert.match(api, /status: 409/);
  assert.match(api, /prisma\.\$transaction/);
  assert.match(api, /fullNational\(oldNumber\)/);
  assert.match(api, /pereNationalManuel: oldNumber/);
  assert.match(api, /pereNunati: oldNumber/);
});

test("numéro de travail dérivé et zéros conservés", () => {
  const work = number => /\d{4}$/.exec(number.replace(/\s+/g, ""))?.[0] ?? "Non renseigné";
  assert.equal(work("FR1234560012"), "0012");
  assert.equal(work("UMETXO"), "Non renseigné");
  assert.match(editor, /N° de travail calculé/);
  assert.match(editor, /Corriger le nom \/ numéro/);
});
