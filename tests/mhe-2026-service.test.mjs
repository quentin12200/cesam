import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("ts-node").register({ transpileOnly: true, compilerOptions: { module: "CommonJS", moduleResolution: "node" } });
require("tsconfig-paths").register({ baseUrl: process.cwd(), paths: { "@/*": ["*"] } });

const medicine = { id: "actual-hepizovac-id", nom: "HEPIZOVAC - MHE" };
const config = {
  version: 1, medicamentId: medicine.id, cible: { tousBovins: true, categories: [] },
  demarrage: { type: "PRIMO_RAPPEL", etapePrimoId: "p", etapeRappelId: "r", calendrierPrimo: { type: "SANS_REGLE" }, rappel: { type: "DELAI_FIXE", delai: { valeur: 21, unite: "JOUR" }, preconisationPrimoId: "prec", preconisationRappelId: "prec", resterDansFenetrePrimo: false } },
  entretien: { actif: false },
};
const protocol = { id: "mhe", configurationQuestionnaireJson: JSON.stringify(config), etapes: ["p", "r"].map((id) => ({ id, cycle: "INITIAL", obligatoire: true, medicaments: [{ medicamentId: medicine.id, preconisationId: "prec" }] })) };
const animals = [
  { id: "a", nutrav: "1234", nunati: "8235590987", numeroNational: null, danais: new Date("2025-01-01T12:00:00Z") },
  { id: "b", nutrav: "9261", nunati: "", numeroNational: null, danais: new Date("2026-01-01T12:00:00Z") },
];
const vaccines = [{ id: "legacy", animalId: "a", vaccin: "HEPIZOVAC - MHE", date: new Date("2026-02-05T00:00:00Z"), medicamentId: null, protocoleId: null, etapeProtocoleId: null, statut: "FAIT" }];
const treatments = [{ id: "t", animalId: "a", dateDebut: new Date("2026-02-05T00:00:00Z"), medicamentId: medicine.id, protocoleVaccinId: null, etapeProtocoleVaccinId: null }];
const statuses = new Map();
let creates = 0, updates = 0;
const db = {
  $transaction: async (callback) => callback(db),
  medicament: { findMany: async () => [medicine] },
  protocoleVaccin: { findMany: async () => [protocol], findUnique: async () => protocol },
  animal: { findMany: async () => animals, findUnique: async ({ where }) => animals.find((animal) => animal.id === where.id) },
  vaccination: {
    findMany: async ({ where }) => where.animalId?.in ? vaccines : vaccines.filter((item) => item.animalId === where.animalId && item.protocoleId === where.protocoleId && item.statut === "FAIT" && item.etapeProtocoleId),
    update: async ({ where, data }) => { updates++; Object.assign(vaccines.find((item) => item.id === where.id), data); },
    create: async ({ data }) => { creates++; vaccines.push({ id: `created-${creates}`, statut: "FAIT", ...data }); },
  },
  traitement: {
    findMany: async ({ where }) => where.animalId?.in ? treatments : treatments.filter((item) => item.animalId === where.animalId && item.protocoleVaccinId === where.protocoleVaccinId && item.etapeProtocoleVaccinId),
    update: async ({ where, data }) => { updates++; Object.assign(treatments.find((item) => item.id === where.id), data); },
  },
  preconisation: { findUnique: async () => ({ medicamentId: medicine.id, dose: 4, voie: "SC" }) },
  statutProtocoleVaccinal: {
    findUnique: async ({ where }) => statuses.get(where.animalId_protocoleId.animalId) ?? null,
    create: async ({ data }) => { statuses.set(data.animalId, { id: `status-${data.animalId}`, ...data }); },
    update: async ({ where, data }) => { const key = where.id.replace("status-", ""); statuses.set(key, { ...statuses.get(key), ...data }); },
  },
};
const prismaModulePath = require.resolve("../lib/prisma.ts");
require.cache[prismaModulePath] = { id: prismaModulePath, filename: prismaModulePath, loaded: true, exports: { prisma: db } };
const { analyserMhe2026, appliquerMhe2026 } = require("../lib/mhe-2026-import.ts");

test("dry-run sans écriture, puis transaction idempotente avec rattachement des deux sources", async () => {
  const before = await analyserMhe2026();
  assert.equal(before.animauxAttendus, 54);
  assert.equal(before.animauxTrouves, 2);
  assert.equal(before.aRattacher, 1);
  assert.equal(before.aCreer, 3);
  assert.equal(creates + updates, 0);

  const applied = await appliquerMhe2026();
  assert.equal(applied.rattaches, 1);
  assert.equal(applied.crees, 3);
  assert.equal(creates, 3);
  assert.equal(vaccines.find((item) => item.id === "legacy").date.toISOString(), "2026-02-05T00:00:00.000Z");
  assert.equal(vaccines.find((item) => item.id === "legacy").medicamentId, medicine.id);
  assert.equal(vaccines.find((item) => item.id === "legacy").etapeProtocoleId, "p");
  assert.equal(treatments[0].etapeProtocoleVaccinId, "p");
  assert.ok(vaccines.filter((item) => item.animalId === "a" && item.date.toISOString().startsWith("2026-02-05")).length === 1);
  assert.ok(vaccines.filter((item) => item.id.startsWith("created-")).every((item) => item.dose === 4 && item.voie === "SC"));
  assert.equal(statuses.size, 2);

  const again = await appliquerMhe2026();
  assert.equal(again.crees, 0);
  assert.equal(again.rattaches, 0);
  assert.equal(creates, 3);
  assert.equal(updates, 2);
});
