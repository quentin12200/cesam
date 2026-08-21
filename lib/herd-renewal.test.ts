import assert from "node:assert/strict";
import test from "node:test";
import {
  auditCurrentMothers,
  buildRenewalGenerationProjection,
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
  renewalGenerationForDate,
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
  assert.ok(result.medianMonths >= 35.9 && result.medianMonths <= 36.1);
  assert.equal(result.fallback, false);
});

test("utilise 36 mois si aucune donnée historique fiable n’existe", () => {
  assert.deepEqual(calculateAverageFirstCalvingAge([{ birthDate: "2025-01-01", calvings: ["2025-06-01"] }]), { averageMonths: 36, medianMonths: 36, sampleSize: 0, fallback: true });
});

test("utilise la médiane pour un âge typique robuste et garde la moyenne au diagnostic", () => {
  const result = calculateAverageFirstCalvingAge([
    { birthDate: "2023-01-01", calvings: ["2026-01-01"] },
    { birthDate: "2023-02-01", calvings: ["2026-02-01"] },
    { birthDate: "2022-01-01", calvings: ["2025-11-01"] },
  ]);
  assert.ok(result.medianMonths >= 35.9 && result.medianMonths <= 36.1);
  assert.ok(result.averageMonths > result.medianMonths);
});

test("une date prévue fiable prime sur l’estimation historique", () => {
  assert.equal(estimateMotherEntryDate({ birthDate: "2024-01-01", expectedCalvingDate: "2026-11-12", firstCalvingAverageMonths: 36 }).toISOString().slice(0, 10), "2026-11-12");
});

test("une génisse sans gestation est projetée depuis sa naissance et la moyenne", () => {
  assert.equal(estimateMotherEntryDate({ birthDate: "2025-05-01", firstCalvingAverageMonths: 36 }).getFullYear(), 2028);
});

test("une petite génisse de 9 mois ne gonfle pas l’année courante", () => {
  const entry = estimateMotherEntryDate({ birthDate: "2025-11-01", firstCalvingAverageMonths: 36 });
  const generations = buildRenewalGenerationProjection({ currentDate: "2026-01-01", generationStartMonth: 9, currentMothers: 70, targetMothers: 70, entries: [{ id: "petite", entryDate: entry, included: false }], identifiedExitsCurrentGeneration: 0 });
  assert.equal(generations.every((generation) => generation.entries === 0), true);
});

test("une moyenne de 18 mois reste dans le pipeline futur", () => {
  const entry = estimateMotherEntryDate({ birthDate: "2025-02-01", firstCalvingAverageMonths: 36 });
  assert.equal(entry.getFullYear(), 2028);
});

test("une grande génisse avec vêlage prévu entre uniquement en 2026", () => {
  const entry = estimateMotherEntryDate({ birthDate: "2023-12-01", expectedCalvingDate: "2026-10-01", firstCalvingAverageMonths: 36 });
  const generations = buildRenewalGenerationProjection({ currentDate: "2026-10-01", generationStartMonth: 9, currentMothers: 70, targetMothers: 70, entries: [{ id: "grande", entryDate: entry }], identifiedExitsCurrentGeneration: 0 });
  assert.equal(generations[0].entries, 1);
  assert.equal(generations[1].entries, 0);
});

test("classe septembre à août dans la même génération", () => {
  assert.equal(renewalGenerationForDate("2026-09-01", 9), 2026);
  assert.equal(renewalGenerationForDate("2027-01-15", 9), 2026);
  assert.equal(renewalGenerationForDate("2027-08-31", 9), 2026);
  assert.equal(renewalGenerationForDate("2027-09-01", 9), 2027);
});

test("accepte un autre mois de début de campagne", () => {
  assert.equal(renewalGenerationForDate("2027-03-15", 4), 2026);
  assert.equal(renewalGenerationForDate("2027-04-01", 4), 2027);
});

test("les générations sont indépendantes sans projection cumulative artificielle", () => {
  const generations = buildRenewalGenerationProjection({ currentDate: "2026-10-01", generationStartMonth: 9, currentMothers: 70, targetMothers: 70, entries: [{ id: "a", entryDate: "2026-11-01" }, { id: "b", entryDate: "2027-10-01" }, { id: "c", entryDate: "2028-10-01" }], identifiedExitsCurrentGeneration: 1 });
  assert.deepEqual(generations.map((generation) => generation.entries), [1, 1, 1]);
  assert.equal("projectedMothers" in generations[2], false);
});

test("calcule les sorties restant à identifier", () => {
  const [generation] = buildRenewalGenerationProjection({ currentDate: "2026-10-01", generationStartMonth: 9, currentMothers: 70, targetMothers: 70, entries: Array.from({ length: 16 }, (_, index) => ({ id: `${index}`, entryDate: "2027-01-01" })), identifiedExitsCurrentGeneration: 4 });
  assert.equal(generation.totalExitsNeeded, 16);
  assert.equal(generation.remainingExits, 12);
});

test("une vache active à engraisser compte comme mère et sortie une seule fois", () => {
  assert.equal(isCurrentMother(1), true);
  assert.equal(isAutomaticPlannedExit(1, "A_ENGRAISSER"), true);
  assert.equal(isAutomaticPlannedExit(1, "ENGRAISSEMENT"), true);
  assert.equal(isAutomaticPlannedExit(0, "ENGRAISSEMENT"), false);
});

test("audite les mères sans doublon et garde une vache importée sans vêlage", () => {
  const audit = auditCurrentMothers([
    { id: "historique", hasCalving: true, effectiveCategory: "VACHE", estGenisse: false, birthDate: "2020-01-01" },
    { id: "importee", hasCalving: false, effectiveCategory: "VACHE", estGenisse: false, birthDate: "2020-01-01" },
    { id: "sortie", hasCalving: true, effectiveCategory: "A_ENGRAISSER", estGenisse: false, birthDate: "2020-01-01" },
    { id: "engraissement", hasCalving: false, effectiveCategory: "ENGRAISSEMENT", estGenisse: false, birthDate: "2020-01-01" },
    { id: "genisse", hasCalving: false, effectiveCategory: "PETITE_GENISSE", estGenisse: true, birthDate: "2025-01-01" },
  ], new Date("2026-08-01"));
  assert.equal(audit.total, 4);
  assert.deepEqual({ cows: audit.cows, toFatten: audit.toFatten, fattening: audit.fattening }, { cows: 2, toFatten: 1, fattening: 1 });
  assert.equal(new Set(audit.motherIds).size, audit.total);
  assert.deepEqual(audit.inconsistentIds, ["importee"]);
});

test("détecte une mère restée en catégorie génisse", () => {
  const audit = auditCurrentMothers([{ id: "x", hasCalving: true, effectiveCategory: "MOYENNE_GENISSE", estGenisse: true, birthDate: "2023-01-01" }], new Date("2026-08-01"));
  assert.deepEqual(audit.inconsistentIds, ["x"]);
});

test("le premier vêlage transforme la génisse en vache", () => {
  assert.deepEqual(motherUpdateAfterCalving(true), { estGenisse: false, categorie: "VACHE" });
  assert.deepEqual(motherUpdateAfterCalving(false), {});
});

test("les décisions temporaires gardent des compteurs cohérents", () => {
  assert.deepEqual(countRenewalDecisions({ a: "NON_DECIDEE", b: "GARDER", c: "A_REVOIR", d: "SORTIR" }), { undecided: 1, kept: 1, review: 1, rejected: 1, total: 4 });
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
  const raw = mergeRenewalSettings('{"version":4,"renewalPlanning":{"firstCalvingAgeMonths":30}}', { targetMothers: 70, renewalRatePercent: 20, renewalGenerationStartMonth: 9 });
  const parsed = JSON.parse(raw);
  assert.equal(parsed.version, 4);
  assert.equal(parsed.renewalPlanning.firstCalvingAgeMonths, 30);
  assert.deepEqual(parseRenewalSettings(raw, 50), { targetMothers: 70, renewalRatePercent: 20, renewalGenerationStartMonth: 9 });
});
