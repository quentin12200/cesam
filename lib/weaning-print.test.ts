import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWeaningPrintGroups,
  getWeaningPrintMotherInfo,
  type WeaningPrintCandidate,
} from "./weaning-print.ts";

const now = new Date("2026-08-29T12:00:00.000Z");

function candidate(
  id: string,
  birthDate: string,
  overrides: Partial<WeaningPrintCandidate> = {},
): WeaningPrintCandidate {
  return {
    id,
    nutrav: id,
    birthDate: new Date(birthDate),
    statut: "ACTIF",
    sevreFait: false,
    motherNutrav: "M-1",
    motherStatus: "Vide",
    motherHasActiveEchoRequest: false,
    ...overrides,
  };
}

test("sépare les veaux de six mois et ceux de cinq à moins de six mois", () => {
  const groups = buildWeaningPrintGroups([
    candidate("ready", "2026-02-28T12:00:00.000Z"),
    candidate("upcoming", "2026-03-15T12:00:00.000Z"),
    candidate("too-young", "2026-04-01T12:00:00.000Z"),
  ], now);

  assert.deepEqual(groups.ready.map((row) => row.id), ["ready"]);
  assert.deepEqual(groups.upcoming.map((row) => row.id), ["upcoming"]);
});

test("exclut les animaux sevrés, inactifs et les adultes incohérents", () => {
  const groups = buildWeaningPrintGroups([
    candidate("weaned", "2026-02-01T12:00:00.000Z", { sevreFait: true }),
    candidate("inactive", "2026-02-01T12:00:00.000Z", { statut: "VENDU" }),
    candidate("adult", "2024-01-01T12:00:00.000Z"),
  ], now);

  assert.deepEqual(groups, { ready: [], upcoming: [] });
});

test("trie du plus âgé au plus jeune", () => {
  const groups = buildWeaningPrintGroups([
    candidate("youngest", "2026-02-20T12:00:00.000Z"),
    candidate("oldest", "2026-01-10T12:00:00.000Z"),
    candidate("middle", "2026-02-01T12:00:00.000Z"),
  ], now);

  assert.deepEqual(groups.ready.map((row) => row.id), ["oldest", "middle", "youngest"]);
});

test("priorise la demande d'échographie active", () => {
  assert.deepEqual(getWeaningPrintMotherInfo(true, "Gestante"), {
    motherStatus: "À écho",
    simultaneousTask: "☐ Échographier mère",
  });
  assert.deepEqual(getWeaningPrintMotherInfo(false, "Gestante"), {
    motherStatus: "Gestante",
    simultaneousTask: "—",
  });
  const groups = buildWeaningPrintGroups([
    candidate("echo", "2026-02-01T12:00:00.000Z", {
      motherStatus: "Gestante",
      motherHasActiveEchoRequest: true,
    }),
  ], now);
  assert.equal(groups.ready[0]?.motherStatus, "À écho");
  assert.equal(groups.ready[0]?.simultaneousTask, "☐ Échographier mère");
});

test("supporte une mère ou un statut absent", () => {
  const info = getWeaningPrintMotherInfo(false, null);
  const groups = buildWeaningPrintGroups([
    candidate("without-mother", "2026-02-01T12:00:00.000Z", {
      motherNutrav: null,
      motherStatus: info.motherStatus,
    }),
  ], now);

  assert.equal(groups.ready[0]?.motherNutrav, null);
  assert.equal(groups.ready[0]?.motherStatus, "Inconnu");
  assert.equal(groups.ready[0]?.simultaneousTask, "—");
});
