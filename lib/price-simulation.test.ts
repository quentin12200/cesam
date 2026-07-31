import assert from "node:assert/strict";
import test from "node:test";
import type { FieldSessionEntry } from "./field-weighing.ts";
import {
  assignPriceGroup,
  generalEstimate,
  groupEntries,
  groupForEntry,
  groupStats,
  individualEstimate,
  parsePriceGroups,
  removePriceGroup,
  serializePriceGroups,
  sexTotals,
  sortEntriesByWeight,
  type PriceGroup,
} from "./price-simulation.ts";

const entries: FieldSessionEntry[] = [
  { id: "m1", nutrav: "1001", sexe: "M", poids: 400, gmq: 1, selected: true },
  { id: "m2", nutrav: "1002", sexe: "M", poids: 450, gmq: 1.2, selected: true },
  { id: "m3", nutrav: "1003", sexe: "M", poids: 400, gmq: 0.9, selected: true },
  { id: "f1", nutrav: "2001", sexe: "F", poids: 350, gmq: 0.8, selected: true },
  { id: "f2", nutrav: "2002", sexe: "F", poids: 375, gmq: null, selected: true },
];

const maleKg: PriceGroup = {
  id: "g1", sexe: "M", peseeIds: ["m1", "m2"], mode: "PER_KG", tarif: 5.1,
};
const femaleHead: PriceGroup = {
  id: "g2", sexe: "F", peseeIds: ["f1"], mode: "PER_HEAD", tarif: 1450,
};

test("trie les poids décroissants et reste stable à poids égal", () => {
  assert.deepEqual(sortEntriesByWeight(entries).map((entry) => entry.id), ["m2", "m1", "m3", "f2", "f1"]);
});

test("calcule les estimations individuelles selon les deux modes", () => {
  assert.equal(individualEstimate(412, "PER_KG", 5.1), 2101.2);
  assert.equal(individualEstimate(412, "PER_HEAD", 1850), 1850);
  assert.equal(Math.round(individualEstimate(412, "PER_KG", 5.1)), 2101);
});

test("calcule exactement le résumé d'un groupe", () => {
  assert.deepEqual(groupEntries(maleKg, entries).map((entry) => entry.id), ["m2", "m1"]);
  assert.deepEqual(groupStats(maleKg, entries), {
    animalCount: 2,
    totalWeight: 850,
    averageWeight: 425,
    totalEstimate: 4335,
    averageEstimate: 2167.5,
  });
});

test("gère plusieurs groupes et sépare les totaux mâles et femelles", () => {
  const groups = [maleKg, { ...maleKg, id: "g3", peseeIds: ["m3"], tarif: 4.8 }, femaleHead];
  assert.equal(sexTotals(groups, entries, "M").animalCount, 3);
  assert.equal(sexTotals(groups, entries, "M").totalEstimate, 6255);
  assert.equal(sexTotals(groups, entries, "F").totalEstimate, 1450);
  assert.equal(generalEstimate(groups, entries), 7705);
});

test("déplace explicitement un animal au lieu de le dupliquer", () => {
  const moved = assignPriceGroup([maleKg], {
    id: "g3", sexe: "M", peseeIds: ["m1"], mode: "PER_HEAD", tarif: 1800,
  });
  assert.equal(groupForEntry(moved, "m1")?.id, "g3");
  assert.equal(moved.flatMap((group) => group.peseeIds).filter((id) => id === "m1").length, 1);
  assert.deepEqual(moved.find((group) => group.id === "g1")?.peseeIds, ["m2"]);
});

test("recalcule après retrait, tarif, mode et suppression sans toucher aux pesées", () => {
  const fewer = assignPriceGroup([maleKg], { ...maleKg, peseeIds: ["m2"] });
  assert.equal(groupStats(fewer[0], entries).totalEstimate, 2295);
  assert.equal(groupStats({ ...fewer[0], tarif: 5.5 }, entries).totalEstimate, 2475);
  assert.equal(groupStats({ ...fewer[0], mode: "PER_HEAD", tarif: 1700 }, entries).totalEstimate, 1700);
  assert.deepEqual(removePriceGroup(fewer, "g1"), []);
  assert.equal(entries.length, 5);
});

test("exclut les animaux sans tarif des totaux", () => {
  const totals = sexTotals([maleKg], entries, "M");
  assert.equal(totals.animalCount, 2);
  assert.equal(totals.totalWeight, 850);
});

test("persiste et restaure uniquement les sources de la simulation", () => {
  const groups = [maleKg, femaleHead];
  assert.deepEqual(parsePriceGroups(serializePriceGroups(groups)), groups);
  assert.deepEqual(parsePriceGroups("invalide"), []);
});
