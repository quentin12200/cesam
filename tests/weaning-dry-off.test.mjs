import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  applySuccessfulWeaningDryOffAction,
  buildWeaningDryOffCandidates,
  classifyWeaningWindow,
  resolveCalfMother,
} from "../lib/weaning-dry-off.ts";

const now = new Date("2026-07-29T10:00:00.000Z");
const mother = {
  id: "mother-1",
  nutrav: "0001",
  nobovi: "Mère",
  statut: "ACTIF",
  tarieFaite: false,
  dateTarie: null,
};

function calf(id, nutrav, danais, links = {}) {
  return {
    id,
    nutrav,
    nobovi: `Veau ${nutrav}`,
    danais: new Date(danais),
    statut: "ACTIF",
    sevreFait: false,
    dateSevrage: null,
    velageVeau: null,
    veauxVelage: [],
    mere: null,
    ...links,
  };
}

test("le mois d’anticipation et le seuil exact ne se chevauchent pas", () => {
  const atThreshold = classifyWeaningWindow(
    new Date("2026-01-29T00:00:00.000Z"),
    6,
    now
  );
  const soon = classifyWeaningWindow(
    new Date("2026-02-15T00:00:00.000Z"),
    6,
    now
  );
  const tooEarly = classifyWeaningWindow(
    new Date("2026-03-01T00:00:00.000Z"),
    6,
    now
  );

  assert.equal(atThreshold.window, "NOW");
  assert.equal(atThreshold.reachedThresholdToday, true);
  assert.equal(soon.window, "SOON");
  assert.equal(tooEarly.window, null);
});

test("la mère du vêlage est prioritaire puis mereId sert de repli", () => {
  const official = { ...mother, id: "official" };
  const secondary = { ...mother, id: "secondary" };
  const genealogy = { ...mother, id: "genealogy" };

  assert.equal(
    resolveCalfMother({
      velageVeau: { vache: official },
      veauxVelage: [{ velage: { vache: secondary } }],
      mere: genealogy,
    })?.id,
    "official"
  );
  assert.equal(resolveCalfMother({ mere: genealogy })?.id, "genealogy");
});

test("un vêlage de trois veaux retourne trois lignes sans doublon", () => {
  const calves = [
    calf("calf-1", "1001", "2026-01-01", {
      velageVeau: { vache: mother },
      veauxVelage: [{ velage: { vache: mother } }],
      mere: mother,
    }),
    calf("calf-2", "1002", "2026-01-01", {
      veauxVelage: [{ velage: { vache: mother } }],
      mere: mother,
    }),
    calf("calf-3", "1003", "2026-01-01", {
      veauxVelage: [{ velage: { vache: mother } }],
      mere: mother,
    }),
  ];

  const candidates = buildWeaningDryOffCandidates(
    [...calves, calves[1]],
    6,
    now
  );

  assert.deepEqual(
    candidates.map((candidate) => candidate.calf.id).sort(),
    ["calf-1", "calf-2", "calf-3"]
  );
  assert.ok(candidates.every((candidate) => candidate.mother?.id === mother.id));
});

test("un veau relié uniquement par mereId reste candidat", () => {
  const candidates = buildWeaningDryOffCandidates(
    [calf("calf-4", "1004", "2026-01-01", { mere: mother })],
    6,
    now
  );
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].mother?.id, mother.id);
});

test("les animaux sortis sont exclus", () => {
  const exited = calf("calf-5", "1005", "2026-01-01", { mere: mother });
  exited.statut = "SORTI";
  assert.equal(buildWeaningDryOffCandidates([exited], 6, now).length, 0);
});

test("les actions combinée et séparées conservent les actions restantes", () => {
  const candidate = buildWeaningDryOffCandidates(
    [calf("calf-6", "1006", "2026-01-01", { mere: mother })],
    6,
    now
  )[0];

  const weanedOnly = applySuccessfulWeaningDryOffAction(
    candidate,
    "WEAN_ONLY",
    "2026-07-29"
  );
  assert.equal(weanedOnly?.needsWeaning, false);
  assert.equal(weanedOnly?.needsDryOff, true);

  const driedOnly = applySuccessfulWeaningDryOffAction(
    candidate,
    "DRY_OFF_ONLY",
    "2026-07-28"
  );
  assert.equal(driedOnly?.needsWeaning, true);
  assert.equal(driedOnly?.needsDryOff, false);

  assert.equal(
    applySuccessfulWeaningDryOffAction(
      candidate,
      "COMBINED",
      "2026-07-29"
    ),
    null
  );
});

const home = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const panel = await readFile(
  new URL("../app/components/WeaningDryOffPanel.tsx", import.meta.url),
  "utf8"
);
const page = await readFile(
  new URL("../app/troupeau/sevrage/page.tsx", import.meta.url),
  "utf8"
);
const api = await readFile(
  new URL("../app/api/sevrage-tarissement/route.ts", import.meta.url),
  "utf8"
);
const calvingApi = await readFile(
  new URL("../app/api/velages/route.ts", import.meta.url),
  "utf8"
);
const dataSource = await readFile(
  new URL("../lib/weaning-dry-off-data.ts", import.meta.url),
  "utf8"
);

test("l’accueil utilise la source unique sans seuil fixe de 180 jours", () => {
  assert.match(home, /getWeaningDryOffCandidates\(now\)/);
  assert.match(home, /WeaningDryOffPanel/);
  assert.doesNotMatch(home, /sixMonthsAgo|fiveMonthsAgo|addDays\(now, -180\)/);
});

test("la source couvre le veau principal, tous les VeauVelage et mereId", () => {
  assert.match(dataSource, /velageVeau: \{ isNot: null \}/);
  assert.match(dataSource, /veauxVelage: \{ some: \{\} \}/);
  assert.match(dataSource, /mereId: \{ not: null \}/);
  assert.match(dataSource, /buildWeaningDryOffCandidates/);
});

test("le panneau attend response.ok avant de retirer une ligne", () => {
  const responseCheck = panel.indexOf("if (!response.ok)");
  const stateUpdate = panel.indexOf("setCandidates((current)");
  assert.ok(responseCheck >= 0);
  assert.ok(stateUpdate > responseCheck);
  assert.match(panel, /role="alert"/);
});

test("la page dédiée réutilise les candidats et l’historique existant", () => {
  assert.match(page, /getWeaningDryOffCandidates/);
  assert.match(page, /getVeauxSevres/);
  assert.match(page, /WeaningDryOffPanel/);
  assert.match(page, /Récemment effectués/);
  assert.match(page, /getMeresTariesRecemment/);
  assert.match(page, /veauxVelage/);
  assert.match(page, /resolveCalfMother\(a\)/);
});

test("l’API réalise les actions dans une transaction et conserve l’annulation", () => {
  assert.match(api, /prisma\.\$transaction/);
  assert.match(api, /SEVRAGE_TARISSEMENT/);
  assert.match(api, /WEAN_ONLY/);
  assert.match(api, /DRY_OFF_ONLY/);
  assert.match(api, /revertData: JSON\.stringify\(revertSteps\)/);
});

test("un nouveau vêlage efface le statut et l’ancienne date de tarissement", () => {
  assert.match(calvingApi, /tarieFaite: false, dateTarie: null/);
  assert.match(calvingApi, /dateTarie: prevDateTarie/);
});
