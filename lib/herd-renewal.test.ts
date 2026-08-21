import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateAnnualRenewalNeed,
  calculateRenewalProjection,
  countRenewalDecisions,
  groupCandidatesByParent,
  mergeRenewalSettings,
  parentDisplay,
  parseRenewalSettings,
  projectionMessage,
  renewalPilotMessage,
  RENEWAL_CANDIDATE_CATEGORIES,
  resolveCandidateParents,
} from "./herd-renewal.ts";

test("calcule le besoin annuel depuis l’objectif et le taux", () => {
  assert.equal(calculateAnnualRenewalNeed(70, 20), 14);
});

test("limite les candidates aux quatre catégories de renouvellement demandées", () => {
  assert.deepEqual(RENEWAL_CANDIDATE_CATEGORIES, ["PRESELECTION_GENISSE", "PETITE_GENISSE", "MOYENNE_GENISSE", "GRANDE_GENISSE"]);
  assert.equal(RENEWAL_CANDIDATE_CATEGORIES.includes("VELLE" as never), false);
});

test("projette une hausse de deux mères", () => {
  assert.deepEqual(calculateRenewalProjection({ currentMothers: 70, targetMothers: 70, renewalRatePercent: 20, candidates: 17, keptCandidates: 14, plannedExits: 12 }), {
    annualNeed: 14, selectionMargin: 3, projectedMothers: 72, change: 2,
  });
  assert.match(projectionMessage(70, 14, 12).text, /augmentera de 2 mères/);
});

test("identifie une projection stable", () => {
  const projection = calculateRenewalProjection({ currentMothers: 70, targetMothers: 70, renewalRatePercent: 20, candidates: 17, keptCandidates: 14, plannedExits: 14 });
  assert.equal(projection.projectedMothers, 70);
  assert.equal(projectionMessage(70, 14, 14).text, "Troupeau stable : environ 70 mères.");
});

test("signale une marge ou un manque sans décider à la place de l’éleveur", () => {
  assert.equal(renewalPilotMessage(17, 14).tone, "green");
  assert.match(renewalPilotMessage(17, 14).text, /marge de sélection correcte/);
  assert.equal(renewalPilotMessage(9, 14).tone, "red");
  assert.match(renewalPilotMessage(9, 14).text, /risque de manquer/);
  assert.equal(renewalPilotMessage(20, 14).tone, "orange");
});

test("retrouve la mère directe et le père de la saillie en priorité", () => {
  const parents = resolveCandidateParents({
    directMother: { id: "m1", workNumber: "7421", name: "Daisy" },
    calvingMother: { id: "m2", workNumber: "7000" },
    breedingBull: { id: "p1", name: "ZEUS", nationalNumber: "FR01" },
    calvingFather: { name: "Ancien père" },
  });
  assert.equal(parentDisplay(parents.mother, "mother"), "7421 Daisy");
  assert.equal(parentDisplay(parents.father, "father"), "ZEUS · FR01");
});

test("utilise les replis du vêlage et n’invente pas les parents manquants", () => {
  const fallback = resolveCandidateParents({ calvingMother: { workNumber: "7100" }, calvingFather: { nationalNumber: "FR99" } });
  assert.equal(parentDisplay(fallback.mother, "mother"), "7100");
  assert.equal(parentDisplay(fallback.father, "father"), "FR99");
  assert.equal(parentDisplay(null, "mother"), "Mère inconnue");
  assert.equal(parentDisplay(null, "father"), "Père inconnu");
});

test("regroupe les candidates par père sans produire de recommandation", () => {
  const candidates = [{ id: "1", father: { name: "ZEUS" } }, { id: "2", father: { name: "ZEUS" } }, { id: "3", father: null }];
  const groups = groupCandidatesByParent(candidates, (candidate) => candidate.father, "Père inconnu");
  assert.equal(groups[0].label, "ZEUS");
  assert.equal(groups[0].candidates.length, 2);
  assert.equal(groups[1].label, "Père inconnu");
});

test("compte de façon cohérente Garder, À revoir et Sortir", () => {
  assert.deepEqual(countRenewalDecisions({ a: "GARDER", b: "GARDER", c: "A_REVOIR", d: "SORTIR" }), { kept: 2, review: 1, rejected: 1, total: 4 });
});

test("stocke la configuration dans le JSON existant sans écraser les règles", () => {
  const raw = mergeRenewalSettings('{"version":4,"alerts":{"dryOff":true}}', { targetMothers: 70, renewalRatePercent: 20, firstCalvingAgeMonths: 30 });
  const parsed = JSON.parse(raw);
  assert.equal(parsed.version, 4);
  assert.equal(parsed.alerts.dryOff, true);
  assert.deepEqual(parseRenewalSettings(raw, 50), { targetMothers: 70, renewalRatePercent: 20, firstCalvingAgeMonths: 30 });
});
