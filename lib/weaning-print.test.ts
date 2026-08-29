import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWeaningPrintGroups,
  getWeaningPrintMotherInfo,
  type WeaningPrintCandidate,
} from "./weaning-print.ts";
import { classifyWeaningWindow, type WeaningWindow } from "./weaning-dry-off.ts";

const now = new Date("2026-08-29T12:00:00.000Z");

function candidate(
  id: string,
  birthDate: string,
  window: WeaningWindow,
  overrides: Partial<WeaningPrintCandidate> = {},
): WeaningPrintCandidate {
  return {
    id,
    nutrav: id,
    birthDate: new Date(birthDate),
    window,
    needsWeaning: true,
    sex: "F",
    motherNutrav: "M-1",
    motherStatus: "Vide",
    motherHasActiveEchoRequest: false,
    ...overrides,
  };
}

test("conserve les groupes NOW et SOON fournis par la logique opérationnelle", () => {
  const thresholdMonths = 8;
  const readyWindow = classifyWeaningWindow(new Date("2025-12-28T12:00:00.000Z"), thresholdMonths, now).window;
  const upcomingWindow = classifyWeaningWindow(new Date("2026-01-15T12:00:00.000Z"), thresholdMonths, now).window;
  assert.equal(readyWindow, "NOW");
  assert.equal(upcomingWindow, "SOON");

  const groups = buildWeaningPrintGroups([
    candidate("ready", "2025-12-28T12:00:00.000Z", readyWindow),
    candidate("upcoming", "2026-01-15T12:00:00.000Z", upcomingWindow),
  ]);

  assert.deepEqual(groups.ready.map((row) => row.id), ["ready"]);
  assert.deepEqual(groups.upcoming.map((row) => row.id), ["upcoming"]);
});

test("n'ajoute aucun animal absent des candidats opérationnels", () => {
  const groups = buildWeaningPrintGroups([
    candidate("operational", "2025-12-01T12:00:00.000Z", "NOW"),
  ]);

  assert.deepEqual(groups.ready.map((row) => row.id), ["operational"]);
  assert.equal(groups.ready.some((row) => row.id === "ten-months-without-valid-cycle"), false);
});

test("exclut les candidats récemment sevrés proposés seulement pour annulation", () => {
  const groups = buildWeaningPrintGroups([
    candidate("recently-weaned", "2025-12-01T12:00:00.000Z", "NOW", { needsWeaning: false }),
  ]);

  assert.deepEqual(groups, { ready: [], upcoming: [] });
});

test("trie du plus âgé au plus jeune", () => {
  const groups = buildWeaningPrintGroups([
    candidate("youngest", "2026-02-20T12:00:00.000Z", "NOW"),
    candidate("oldest", "2026-01-10T12:00:00.000Z", "NOW"),
    candidate("middle", "2026-02-01T12:00:00.000Z", "NOW"),
  ]);

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
    candidate("echo", "2026-02-01T12:00:00.000Z", "NOW", {
      motherStatus: "Gestante",
      motherHasActiveEchoRequest: true,
    }),
  ]);
  assert.equal(groups.ready[0]?.motherStatus, "À écho");
  assert.equal(groups.ready[0]?.simultaneousTask, "☐ Échographier mère");
});

test("affiche le sexe et supporte une mère ou un statut absent", () => {
  const info = getWeaningPrintMotherInfo(false, null);
  const groups = buildWeaningPrintGroups([
    candidate("without-mother", "2026-02-01T12:00:00.000Z", "NOW", {
      motherNutrav: null,
      motherStatus: info.motherStatus,
      sex: null,
    }),
  ]);

  assert.equal(groups.ready[0]?.motherNutrav, null);
  assert.equal(groups.ready[0]?.motherStatus, "Inconnu");
  assert.equal(groups.ready[0]?.simultaneousTask, "—");
  assert.equal(groups.ready[0]?.sexLabel, "—");
});
