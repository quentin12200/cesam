import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildWeaningDryOffCandidates,
  classifyWeaningWindow,
  collectLinkedCycleCalves,
  getCurrentCalvingCycle,
  resolveCalfCycle,
} from "../lib/weaning-dry-off.ts";

const now = new Date("2026-07-29T10:00:00.000Z");

function linkedCalf(id, statut = "ACTIF", sevreFait = false) {
  return { id, statut, sevreFait };
}

function mother(latestCycleId = "cycle-current", overrides = {}) {
  return {
    id: "mother-1",
    nutrav: "0001",
    nobovi: "Mère",
    statut: "ACTIF",
    tarieFaite: false,
    dateTarie: null,
    velagesVache: [
      { id: latestCycleId, date: new Date("2026-01-01T08:00:00.000Z") },
    ],
    ...overrides,
  };
}

function cycle(calves, overrides = {}) {
  return {
    id: "cycle-current",
    date: new Date("2026-01-01T08:00:00.000Z"),
    vache: mother(),
    veau: calves[0] ?? null,
    veauxDetails: calves.map((animal) => ({ animal })),
    ...overrides,
  };
}

function calfRecord(
  linked,
  originCycle,
  relation = "secondary",
  overrides = {}
) {
  return {
    id: linked.id,
    nutrav: linked.id,
    nobovi: `Veau ${linked.id}`,
    danais: new Date("2026-01-01T08:00:00.000Z"),
    statut: linked.statut,
    sevreFait: linked.sevreFait,
    dateSevrage: null,
    velageVeau: relation === "primary" ? originCycle : null,
    veauxVelage:
      relation === "secondary" ? [{ velage: originCycle }] : [],
    ...overrides,
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
  assert.equal(atThreshold.window, "NOW");
  assert.equal(atThreshold.reachedThresholdToday, true);
  assert.equal(soon.window, "SOON");
});

test("un vêlage de trois veaux retrouve le principal et tous les secondaires sans doublon", () => {
  const calves = [
    linkedCalf("1001"),
    linkedCalf("1002"),
    linkedCalf("1003"),
  ];
  const origin = cycle(calves);
  origin.veauxDetails.push({ animal: calves[0] });

  assert.equal(collectLinkedCycleCalves(origin).length, 3);
  assert.equal(resolveCalfCycle(calfRecord(calves[0], origin, "primary"))?.id, origin.id);
  assert.equal(resolveCalfCycle(calfRecord(calves[2], origin))?.id, origin.id);

  const candidates = buildWeaningDryOffCandidates(
    [
      calfRecord(calves[0], origin, "primary"),
      calfRecord(calves[1], origin),
      calfRecord(calves[2], origin),
    ],
    6,
    now
  );
  assert.deepEqual(
    candidates.map((candidate) => candidate.calf.id),
    ["1001", "1002", "1003"]
  );
  assert.ok(candidates.every((candidate) => candidate.mother.id === "mother-1"));
});

test("un vêlage simple tarit automatiquement la mère au sevrage", () => {
  const onlyCalf = linkedCalf("1001");
  const origin = cycle([onlyCalf]);
  const [candidate] = buildWeaningDryOffCandidates(
    [calfRecord(onlyCalf, origin, "primary")],
    6,
    now
  );
  assert.equal(candidate.willAutoDryOff, true);
  assert.equal(candidate.cyclePendingCount, 1);
});

test("le premier veau de deux ne tarit pas automatiquement la mère", () => {
  const calves = [linkedCalf("1001"), linkedCalf("1002")];
  const origin = cycle(calves);
  const candidates = buildWeaningDryOffCandidates(
    [
      calfRecord(calves[0], origin, "primary"),
      calfRecord(calves[1], origin),
    ],
    6,
    now
  );
  assert.ok(candidates.every((candidate) => !candidate.willAutoDryOff));
  assert.ok(candidates.every((candidate) => candidate.cyclePendingCount === 2));
});

test("le dernier veau non sevré de deux déclenche le tarissement automatique", () => {
  const calves = [linkedCalf("1001", "ACTIF", true), linkedCalf("1002")];
  const origin = cycle(calves);
  const candidates = buildWeaningDryOffCandidates(
    [calfRecord(calves[1], origin)],
    6,
    now
  );
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].willAutoDryOff, true);
  assert.equal(candidates[0].cycleWeanedCount, 1);
});

test("trois veaux sevrés à des dates différentes conservent le bon avancement", () => {
  const calves = [
    linkedCalf("1001", "ACTIF", true),
    linkedCalf("1002", "ACTIF", true),
    linkedCalf("1003"),
  ];
  const origin = cycle(calves);
  const [candidate] = buildWeaningDryOffCandidates(
    [calfRecord(calves[2], origin)],
    6,
    now
  );
  assert.equal(candidate.cycleCalfCount, 3);
  assert.equal(candidate.cycleWeanedCount, 2);
  assert.equal(candidate.cyclePendingCount, 1);
  assert.equal(candidate.willAutoDryOff, true);
});

test("un veau sorti, mort ou vendu ne bloque pas indéfiniment le tarissement", () => {
  for (const status of ["SORTI", "MORT", "VENDU"]) {
    const calves = [linkedCalf(`inactive-${status}`, status), linkedCalf("active")];
    const origin = cycle(calves);
    const current = getCurrentCalvingCycle(calfRecord(calves[1], origin));
    assert.equal(current?.pendingCalves.length, 1);
    const [candidate] = buildWeaningDryOffCandidates(
      [calfRecord(calves[1], origin)],
      6,
      now
    );
    assert.equal(candidate.willAutoDryOff, true);
  }
});

test("un ancien veau déjà sevré n’est jamais une tâche de tarissement", () => {
  const old = linkedCalf("old", "ACTIF", true);
  const origin = cycle([old]);
  const candidates = buildWeaningDryOffCandidates(
    [
      calfRecord(old, origin, "primary", {
        dateSevrage: new Date("2020-07-01T10:00:00.000Z"),
      }),
    ],
    6,
    now
  );
  assert.equal(candidates.length, 0);
});

test("un cycle antérieur est exclu si la mère a vêlé depuis", () => {
  const linked = linkedCalf("old-cycle-calf");
  const oldCycle = cycle([linked], {
    id: "cycle-old",
    vache: mother("cycle-new"),
  });
  assert.equal(getCurrentCalvingCycle(calfRecord(linked, oldCycle)), null);
  assert.equal(
    buildWeaningDryOffCandidates(
      [calfRecord(linked, oldCycle)],
      6,
      now
    ).length,
    0
  );
});

test("un simple lien généalogique sans vêlage fiable reste hors liste opérationnelle", () => {
  const linked = linkedCalf("genealogy-only");
  const record = calfRecord(linked, cycle([linked]), "none", {
    mere: mother(),
  });
  assert.equal(resolveCalfCycle(record), null);
  assert.equal(buildWeaningDryOffCandidates([record], 6, now).length, 0);
});

test("une ligne sevrée reste grisée et réversible exactement douze heures", () => {
  const linked = linkedCalf("recent", "ACTIF", true);
  const origin = cycle([linked]);
  const recent = calfRecord(linked, origin, "primary", {
    dateSevrage: new Date("2026-07-29T09:00:00.000Z"),
    automaticDryOffAtWeaning: true,
  });
  const [candidate] = buildWeaningDryOffCandidates([recent], 6, now);
  assert.equal(candidate.recentlyWeaned, true);
  assert.equal(candidate.needsWeaning, false);
  assert.equal(candidate.automaticDryOffAtWeaning, true);
  assert.equal(
    buildWeaningDryOffCandidates(
      [recent],
      6,
      new Date("2026-07-29T21:00:01.000Z")
    ).length,
    0
  );
});

const panel = await readFile(
  new URL("../app/components/WeaningDryOffPanel.tsx", import.meta.url),
  "utf8"
);
const dashboard = await readFile(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
);
const api = await readFile(
  new URL("../app/api/sevrage-tarissement/route.ts", import.meta.url),
  "utf8"
);
const dataSource = await readFile(
  new URL("../lib/weaning-dry-off-data.ts", import.meta.url),
  "utf8"
);
const animalApi = await readFile(
  new URL("../app/api/animaux/[nutrav]/route.ts", import.meta.url),
  "utf8"
);
const calvingApi = await readFile(
  new URL("../app/api/velages/route.ts", import.meta.url),
  "utf8"
);

test("la source ne charge que le cycle relié et les sevrages des douze dernières heures", () => {
  assert.match(dataSource, /velageVeau: \{ isNot: null \}/);
  assert.match(dataSource, /veauxVelage: \{ some: \{\} \}/);
  assert.doesNotMatch(dataSource, /mereId: \{ not: null \}/);
  assert.match(dataSource, /12 \* 60 \* 60 \* 1000/);
  assert.match(dataSource, /SEVRAGE_TARISSEMENT_AUTO/);
});

test("le swipe gauche enregistre directement et le swipe droit annule", () => {
  assert.match(panel, /data-swipe-direction=\{candidate\.recentlyWeaned \? "right" : "left"\}/);
  assert.match(panel, /onTouchEnd/);
  assert.match(panel, /currentOffset\.current <= -SWIPE_THRESHOLD/);
  assert.match(panel, /currentOffset\.current >= SWIPE_THRESHOLD/);
  assert.match(panel, /onQuickAction\(candidate, quickAction\)/);
  assert.doesNotMatch(panel, /window\.confirm/);
});

test("un swipe incomplet ou annulé restaure la ligne", () => {
  assert.match(panel, /updateOffset\(0\)/);
  assert.match(panel, /onTouchCancel/);
  assert.match(panel, /horizontalSwipe/);
});

test("l’interface attend response.ok et conserve les erreurs sur la ligne", () => {
  const responseCheck = panel.indexOf("if (!response.ok)");
  const stateUpdate = panel.indexOf("setCandidates((current)", responseCheck);
  assert.ok(responseCheck >= 0);
  assert.ok(stateUpdate > responseCheck);
  assert.match(panel, /role="alert"/);
});

test("les boutons ordinateur proposent Sevrer puis Annuler pendant douze heures", () => {
  assert.match(panel, /className="hidden shrink-0 flex-wrap gap-1\.5 md:flex"/);
  assert.match(panel, /\? "Annuler"\s*: "Sevrer"/);
  assert.match(panel, /REVERSIBLE_DURATION_MS/);
  assert.match(panel, /window\.setInterval\(removeExpired, 60_000\)/);
});

test("l’ordinateur n’affiche qu’un bouton principal et garde le tarissement en action secondaire", () => {
  const desktopStart = panel.indexOf(
    'className="hidden shrink-0 flex-wrap gap-1.5 md:flex"'
  );
  const desktopEnd = panel.indexOf("</div>", desktopStart);
  const desktopActions = panel.slice(desktopStart, desktopEnd);
  assert.equal(desktopActions.match(/<button/g)?.length, 1);
  assert.match(desktopActions, /"Sevrer"/);
  assert.doesNotMatch(desktopActions, /Tarir la mère/);
  assert.match(panel, /aria-label="Autres actions"/);
  assert.match(panel, /Tarir la mère séparément/);
});

test("l’accueil distingue visuellement le veau et la mère avec le même poids", () => {
  assert.match(panel, /compact \? \(/);
  assert.match(panel, /className="grid grid-cols-2 gap-2"/);
  assert.match(panel, />\s*Veau\s*</);
  assert.match(panel, />\s*Mère\s*</);
  assert.equal(
    panel.match(/font-mono text-base font-black leading-tight/g)?.length,
    2
  );
});

test("l’accueil affiche clairement l’âge du veau et l’état reproductif existant de la mère", () => {
  assert.match(panel, /Âge du veau · \{formatAge/);
  assert.match(panel, /Mère · \{getEtatLabel\(motherReproductionStatus\)\}/);
  assert.match(panel, /getBadgeClass\(\s*motherReproductionStatus\s*\)/);
  assert.match(
    dashboard,
    /motherReproductionStatuses\[vache\.id\] =\s*\(vache\.reproductionEtatManuel[\s\S]*\?\? etat/
  );
  assert.match(
    dashboard,
    /motherReproductionStatuses=\{data\.motherReproductionStatuses\}/
  );
});

test("le tarissement manuel est retiré de l’accueil mais reste sur la page dédiée", () => {
  assert.match(
    panel,
    /!compact && !candidate\.recentlyWeaned && candidate\.needsDryOff/
  );
  assert.match(panel, /Tarir la mère séparément/);
  assert.match(panel, /onManualDryOff=\{openManualDryOff\}/);
});

test("le message du dernier veau est réservé à un vrai vêlage multiple déjà partiellement sevré", () => {
  assert.match(panel, /candidate\.cycleCalfCount > 1/);
  assert.match(panel, /candidate\.cycleWeanedCount > 0/);
  assert.match(panel, /candidate\.cyclePendingCount === 1/);
  assert.match(panel, /showLastCalfMessage/);
});

test("les deux aides de swipe restent discrètes et limitées au mobile", () => {
  assert.match(panel, /Glisser à gauche pour sevrer/);
  assert.match(panel, /Glisser à droite pour annuler/);
  assert.match(panel, /text-slate-400 md:hidden/);
});

test("l’API ne tarit automatiquement qu’en l’absence d’un autre veau actif non sevré", () => {
  assert.match(api, /remainingCalves === 0/);
  assert.match(api, /tx\.animal\.count/);
  assert.match(api, /automaticDryOff/);
  assert.match(api, /SEVRAGE_TARISSEMENT_AUTO/);
  assert.match(api, /TARISSEMENT_MANUEL/);
  assert.match(api, /effectiveActionDate/);
});

test("l’annulation restaure le veau et protège un tarissement manuel", () => {
  assert.match(api, /action === "UNDO_WEANING"/);
  assert.match(api, /"TARISSEMENT_MANUEL"/);
  assert.match(api, /\.includes\(latestDryOffLog\.type\)/);
  assert.match(api, /sevreFait: false, dateSevrage: null/);
  assert.match(api, /reverted: true, revertedAt: new Date\(\)/);
});

test("l’ancienne route générique ne peut plus appliquer la cascade incorrecte", () => {
  assert.match(animalApi, /Le sevrage doit utiliser le parcours dédié/);
  assert.doesNotMatch(animalApi, /Cascade sevrage/);
});

test("un nouveau vêlage efface toujours le statut et l’ancienne date de tarissement", () => {
  assert.match(calvingApi, /tarieFaite: false, dateTarie: null/);
  assert.match(calvingApi, /dateTarie: prevDateTarie/);
});
