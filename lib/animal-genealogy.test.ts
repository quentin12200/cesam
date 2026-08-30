import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAncestryUpdate,
  canUseAnimalAsParent,
  isSameAncestryIdentity,
  rankAncestryMatches,
  resolveAncestryIdentity,
  resolveBiologicalMother,
  resolveFatherLabel,
  resolveParentWorkNumber,
  workNumberFromHistoricalNational,
  type AncestrySearchMatch,
} from "./animal-genealogy.ts";

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

test("9226 conserve MALICE dans l'arbre sans mereId", () => {
  const mother = resolveAncestryIdentity([{
    workNumber: null,
    nationalNumber: "8235464428",
    name: "MALICE",
    linkedAnimalNutrav: null,
  }]);
  assert.equal(mother?.nationalNumber, "8235464428");
  assert.equal(mother?.name, "MALICE");
});

test("la fiche affiche uniquement le numéro de travail résolu", () => {
  assert.equal(resolveParentWorkNumber({
    linkedWorkNumber: null,
    historicalMatchedWorkNumber: "4428",
    manualWorkNumber: "autre",
  }), "4428");
  assert.equal(resolveParentWorkNumber({
    linkedWorkNumber: null,
    historicalMatchedWorkNumber: null,
    historicalNationalNumber: "FR8235464428",
    manualWorkNumber: null,
  }), "4428");
  assert.equal(workNumberFromHistoricalNational("FR4635275801"), "5801");
});

test("une mère sortie reste recherchable et le n° travail exact est prioritaire", () => {
  const matches: AncestrySearchMatch[] = [
    { key: "name", source: "HISTORIQUE", sourceId: null, workNumber: null, nationalNumber: "FR92", name: "92", status: null },
    { key: "inactive", source: "ANIMAL", sourceId: "m1", workNumber: "92", nationalNumber: "FR0092", name: "MALICE", status: "SORTI" },
  ];
  const ranked = rankAncestryMatches(matches, "92");
  assert.equal(ranked[0].key, "inactive");
  assert.equal(ranked[0].status, "SORTI");
});

test("la recherche priorise travail, national, suffixe national puis nom", () => {
  const matches: AncestrySearchMatch[] = [
    { key: "name", source: "ANIMAL", sourceId: "a1", workNumber: "1111", nationalNumber: "FR1111111111", name: "5801", status: "ACTIF" },
    { key: "suffix", source: "TAUREAU", sourceId: "t1", workNumber: null, nationalNumber: "FR4635275801", name: "MICKEY", status: "SORTI" },
    { key: "work", source: "ANIMAL", sourceId: "a2", workNumber: "5801", nationalNumber: "FR4635275801", name: "MICKEY", status: "SORTI" },
  ];
  assert.deepEqual(rankAncestryMatches(matches, "5801").map((match) => match.key), ["work", "suffix", "name"]);
});

test("une saisie sans correspondance stocke seulement un snapshot manuel", () => {
  assert.deepEqual(buildAncestryUpdate({
    parent: "MERE",
    source: "MANUEL",
    sourceId: null,
    workNumber: "M-92",
    nationalNumber: "FR0092",
    name: "MALICE",
  }), {
    mereTravailManuel: "M-92",
    mereNationalManuel: "FR0092",
    mereNomManuel: "MALICE",
  });
});

test("une correspondance existante crée un lien, jamais un faux parent", () => {
  assert.deepEqual(buildAncestryUpdate({
    parent: "MERE",
    source: "ANIMAL",
    sourceId: "animal-malice",
    workNumber: "4428",
    nationalNumber: "8235464428",
    name: "MALICE",
  }), { mereId: "animal-malice" });
  assert.deepEqual(buildAncestryUpdate({
    parent: "PERE",
    source: "TAUREAU",
    sourceId: "bull-1",
    workNumber: "",
    nationalNumber: "FR-P1",
    name: "PERE",
  }), { taureauId: "bull-1" });
  assert.deepEqual(buildAncestryUpdate({
    parent: "PERE",
    source: "ANIMAL",
    sourceId: "mickey-animal",
    workNumber: "5801",
    nationalNumber: "FR4635275801",
    name: "MICKEY",
  }), {
    pereTravailManuel: "5801",
    pereNationalManuel: "FR4635275801",
    pereNomManuel: "MICKEY",
  });
});

test("un animal ne peut pas être son propre parent", () => {
  assert.equal(canUseAnimalAsParent({
    targetId: "animal-1",
    candidateId: "animal-1",
    candidateSex: "F",
    parent: "MERE",
  }), false);
  assert.equal(isSameAncestryIdentity({
    targetWorkNumber: "92-26",
    targetNationalNumbers: ["FR001234"],
    candidateWorkNumber: "92-26",
    candidateNationalNumber: null,
  }), true);
  assert.equal(isSameAncestryIdentity({
    targetWorkNumber: "92-26",
    targetNationalNumbers: ["FR001234"],
    candidateWorkNumber: "autre",
    candidateNationalNumber: "001234",
  }), true);
});

test("une mère Animal doit être femelle et un père Animal mâle", () => {
  assert.equal(canUseAnimalAsParent({ targetId: "c", candidateId: "f", candidateSex: "F", parent: "MERE" }), true);
  assert.equal(canUseAnimalAsParent({ targetId: "c", candidateId: "m", candidateSex: "M", parent: "MERE" }), false);
  assert.equal(canUseAnimalAsParent({ targetId: "c", candidateId: "m", candidateSex: "M", parent: "PERE" }), true);
  assert.equal(canUseAnimalAsParent({ targetId: "c", candidateId: "f", candidateSex: "F", parent: "PERE" }), false);
});
