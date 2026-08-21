import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAnnualRenewalProjection,
  calculateAnnualRenewalNeed,
  calculateAverageFirstCalvingAge,
  countRenewalDecisions,
  estimateMotherEntryDate,
  groupCandidatesByParent,
  isAutomaticPlannedExit,
  isCurrentMother,
  mergeRenewalSettings,
  motherUpdateAfterCalving,
  parentDisplay,
  parseRenewalSettings,
  resolveCandidateParents,
} from "./herd-renewal.ts";

test("calcule le besoin annuel cible", () => assert.equal(calculateAnnualRenewalNeed(70, 20), 14));

test("calcule la moyenne réelle au premier vêlage et ignore les données corrompues", () => {
  const result = calculateAverageFirstCalvingAge([
    { birthDate: "2023-01-01", calvings: ["2026-01-01", "2027-01-01"] },
    { birthDate: "2022-06-01", calvings: ["2025-06-01"] },
    { birthDate: "2025-01-01", calvings: ["2025-06-01"] },
  ]);
  assert.equal(result.sampleSize, 2);
  assert.ok(result.averageMonths >= 35.9 && result.averageMonths <= 36.1);
  assert.equal(result.fallback, false);
});

test("utilise 36 mois si aucune donnée historique fiable n’existe", () => {
  assert.deepEqual(calculateAverageFirstCalvingAge([{ birthDate: "2025-01-01", calvings: ["2025-06-01"] }]), { averageMonths: 36, sampleSize: 0, fallback: true });
});

test("une date prévue fiable prime sur l’estimation historique", () => {
  assert.equal(estimateMotherEntryDate({ birthDate: "2024-01-01", expectedCalvingDate: "2026-11-12", firstCalvingAverageMonths: 36 }).toISOString().slice(0, 10), "2026-11-12");
});

test("une génisse sans gestation est projetée depuis sa naissance et la moyenne", () => {
  assert.equal(estimateMotherEntryDate({ birthDate: "2025-05-01", firstCalvingAverageMonths: 36 }).getFullYear(), 2028);
});

test("une petite génisse de 9 mois ne gonfle pas l’année courante", () => {
  const entry = estimateMotherEntryDate({ birthDate: "2025-11-01", firstCalvingAverageMonths: 36 });
  const years = buildAnnualRenewalProjection({ currentYear: 2026, currentMothers: 70, targetMothers: 70, entries: [{ id: "petite", entryDate: entry }], identifiedExitsCurrentYear: 0 });
  assert.equal(years[0].entries, 0);
  assert.equal(years.find((year) => year.year === 2028)?.entries, 1);
});

test("une moyenne de 18 mois reste dans le pipeline futur", () => {
  const entry = estimateMotherEntryDate({ birthDate: "2025-02-01", firstCalvingAverageMonths: 36 });
  assert.equal(entry.getFullYear(), 2028);
});

test("une grande génisse avec vêlage prévu entre uniquement en 2026", () => {
  const entry = estimateMotherEntryDate({ birthDate: "2023-12-01", expectedCalvingDate: "2026-10-01", firstCalvingAverageMonths: 36 });
  const years = buildAnnualRenewalProjection({ currentYear: 2026, currentMothers: 70, targetMothers: 70, entries: [{ id: "grande", entryDate: entry }], identifiedExitsCurrentYear: 0 });
  assert.equal(years[0].entries, 1);
  assert.equal(years[1].entries, 0);
});

test("la projection compte seulement les entrées de chaque année", () => {
  const years = buildAnnualRenewalProjection({ currentYear: 2026, currentMothers: 70, targetMothers: 70, entries: [{ id: "a", entryDate: "2026-05-01" }, { id: "b", entryDate: "2027-05-01" }, { id: "c", entryDate: "2028-05-01" }], identifiedExitsCurrentYear: 1 });
  assert.equal(years.length, 3);
  assert.deepEqual(years.map((year) => year.entries), [1, 1, 1]);
  assert.equal(years[0].projectedMothers, 70);
});

test("une vache active à engraisser compte comme mère et sortie une seule fois", () => {
  assert.equal(isCurrentMother(1), true);
  assert.equal(isAutomaticPlannedExit(1, "A_ENGRAISSER"), true);
  assert.equal(isAutomaticPlannedExit(1, "ENGRAISSEMENT"), true);
  assert.equal(isAutomaticPlannedExit(0, "ENGRAISSEMENT"), false);
});

test("le premier vêlage transforme la génisse en vache", () => {
  assert.deepEqual(motherUpdateAfterCalving(true), { estGenisse: false, categorie: "VACHE" });
  assert.deepEqual(motherUpdateAfterCalving(false), {});
});

test("les décisions temporaires gardent des compteurs cohérents", () => {
  assert.deepEqual(countRenewalDecisions({ a: "GARDER", b: "A_REVOIR", c: "SORTIR" }), { kept: 1, review: 1, rejected: 1, total: 3 });
});

test("retrouve la généalogie et conserve les inconnus", () => {
  const parents = resolveCandidateParents({ directMother: { workNumber: "7421", name: "Daisy" }, breedingBull: { name: "ZEUS", nationalNumber: "FR01" } });
  assert.equal(parentDisplay(parents.mother, "mother"), "7421 Daisy");
  assert.equal(parentDisplay(parents.father, "father"), "ZEUS · FR01");
  assert.equal(parentDisplay(null, "father"), "Père inconnu");
});

test("regroupe les candidates par père", () => {
  const values = [{ father: { name: "ZEUS" } }, { father: { name: "ZEUS" } }, { father: null }];
  const groups = groupCandidatesByParent(values, (candidate) => candidate.father, "Père inconnu");
  assert.equal(groups[0].candidates.length, 2);
});

test("préserve les règles existantes et les anciennes clés de configuration", () => {
  const raw = mergeRenewalSettings('{"version":4,"renewalPlanning":{"firstCalvingAgeMonths":30}}', { targetMothers: 70, renewalRatePercent: 20 });
  const parsed = JSON.parse(raw);
  assert.equal(parsed.version, 4);
  assert.equal(parsed.renewalPlanning.firstCalvingAgeMonths, 30);
  assert.deepEqual(parseRenewalSettings(raw, 50), { targetMothers: 70, renewalRatePercent: 20 });
});
