import test from "node:test";
import assert from "node:assert/strict";
import { resolveBiologicalMother, resolveFatherLabel } from "./animal-genealogy.ts";

const activeMother = { id: "m1", nutrav: "92", nobovi: "Malice", statut: "ACTIF" };

test("affiche une mère liée active", () => {
  assert.equal(resolveBiologicalMother({
    linkedMother: activeMother,
    birthMother: null,
    historicalNumber: null,
    historicalName: null,
  }).linked, activeMother);
});

test("affiche toujours une mère liée sortie", () => {
  const inactiveMother = { ...activeMother, statut: "VENDU" };
  assert.equal(resolveBiologicalMother({
    linkedMother: inactiveMother,
    birthMother: null,
    historicalNumber: null,
    historicalName: null,
  }).linked, inactiveMother);
});

test("utilise la mère du vêlage puis le nom maternel historique", () => {
  const fromBirth = resolveBiologicalMother({
    linkedMother: null,
    birthMother: activeMother,
    historicalNumber: "FR0001",
    historicalName: "Historique",
  });
  assert.equal(fromBirth.linked, activeMother);

  const historical = resolveBiologicalMother({
    linkedMother: null,
    birthMother: null,
    historicalNumber: "FR0092",
    historicalName: "Malice",
  });
  assert.equal(historical.historicalLabel, "FR0092 Malice");
});

test("affiche le taureau explicitement lié", () => {
  assert.equal(resolveFatherLabel({
    linkedNumber: "FR-P1",
    linkedName: "Taureau IA",
    birthNumber: "FR-P2",
    birthName: "Père vêlage",
  }), "FR-P1 Taureau IA");
});

test("utilise le père déclaré au vêlage sans taureau lié", () => {
  assert.equal(resolveFatherLabel({
    linkedNumber: null,
    linkedName: null,
    birthNumber: "FR-P2",
    birthName: "Père vêlage",
  }), "FR-P2 Père vêlage");
});

test("ne fabrique aucun père quand aucune donnée n'existe", () => {
  assert.equal(resolveFatherLabel({
    linkedNumber: null,
    linkedName: null,
    birthNumber: null,
    birthName: null,
  }), null);
});
