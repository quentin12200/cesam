import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as schedule from "../lib/preconisation-schedule.ts";

const require = createRequire(import.meta.url);
function route(path, prisma, logAction = async () => "undo") {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const compiled = { exports: {} };
  const dependencies = {
    "@/lib/prisma": { prisma },
    "@/lib/action-log": { logAction },
    "@/lib/preconisation-schedule": schedule,
  };
  new Function("require", "module", "exports", outputText)((name) => dependencies[name] ?? require(name), compiled, compiled.exports);
  return compiled.exports;
}
const request = (body) => ({ json: async () => body });
const params = { params: Promise.resolve({ id: "preco" }) };

test("POST enregistre la fréquence, les moments, quatre jours et la consigne sans confondre le total", async () => {
  let stored;
  const api = route("../app/api/preconisations/route.ts", {
    medicament: { findUnique: async () => ({ nom: "Médicament test" }) },
    preconisation: { create: async ({ data }) => (stored = { id: "preco", ...data }) },
  });
  const response = await api.POST(request({ medicamentId: "med", frequence: "2 fois par jour (matin et soir)", dureeValeur: "4", dureeUnite: "JOUR", nombreAdministrations: "8", precautions: "Consigne du vétérinaire" }));
  assert.equal(response.status, 201);
  assert.equal(stored.frequence, "2 fois par jour (matin et soir)");
  assert.equal(stored.dureeValeur, 4);
  assert.equal(stored.nombreAdministrations, 8);
  assert.equal(stored.precautions, "Consigne du vétérinaire");
});

test("PATCH de statut laisse le rythme existant intact", async () => {
  let patch;
  const api = route("../app/api/preconisations/[id]/route.ts", {
    preconisation: {
      findUnique: async () => ({ id: "preco", frequence: "Texte historique", dureeValeur: 4, dureeUnite: "JOUR", nombreAdministrations: 8 }),
      update: async ({ data }) => (patch = data),
    },
  });
  const response = await api.PATCH(request({ statut: "VALIDE" }), params);
  assert.equal(response.status, 200);
  assert.deepEqual(patch, { statut: "VALIDE" });
});

test("passer en prise unique est annulable avec restauration de toute la durée", async () => {
  let undo;
  let patch;
  const prev = { id: "preco", frequence: "2_PAR_JOUR", dureeValeur: 4, dureeUnite: "JOUR", nombreAdministrations: 8 };
  const api = route("../app/api/preconisations/[id]/route.ts", {
    preconisation: { findUnique: async () => prev, update: async ({ data }) => (patch = data) },
  }, async (_type, _description, action) => { undo = action; return "undo"; });
  await api.PATCH(request({ frequence: "DOSE_UNIQUE" }), params);
  assert.deepEqual(patch, { frequence: "DOSE_UNIQUE", dureeValeur: null, dureeUnite: null, nombreAdministrations: 1 });
  assert.deepEqual(undo.data, { frequence: "2_PAR_JOUR", dureeValeur: 4, dureeUnite: "JOUR", nombreAdministrations: 8 });
});

test("POST et PATCH refusent les durées invalides avant toute écriture", async () => {
  const prisma = new Proxy({}, { get() { assert.fail("Aucun accès en base attendu"); } });
  for (const [file, method] of [["../app/api/preconisations/route.ts", "POST"], ["../app/api/preconisations/[id]/route.ts", "PATCH"]]) {
    const api = route(file, prisma);
    const response = await api[method](request({ dureeValeur: -1 }), params);
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /durée/);
  }
});
