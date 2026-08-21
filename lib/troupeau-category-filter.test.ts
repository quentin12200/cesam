import assert from "node:assert/strict";
import test from "node:test";
import { subMonths } from "date-fns";
import { filtrerAnimauxParCategorie } from "./troupeau-category-filter.ts";

const now = new Date();
const femelles = [
  { id: "velle", sexbov: "F", danais: subMonths(now, 6), estGenisse: true, categorie: "VELLE" },
  { id: "petite", sexbov: "F", danais: subMonths(now, 9), estGenisse: true, categorie: "PETITE_GENISSE" },
  { id: "moyenne", sexbov: "F", danais: subMonths(now, 18), estGenisse: true, categorie: "MOYENNE_GENISSE" },
  { id: "grande", sexbov: "F", danais: subMonths(now, 30), estGenisse: true, categorie: "GRANDE_GENISSE" },
  { id: "vache", sexbov: "F", danais: subMonths(now, 48), estGenisse: false, categorie: "VACHE" },
];

test("chaque filtre conserve uniquement sa catégorie effective", () => {
  for (const [categorie, id] of [
    ["VELLE", "velle"],
    ["PETITE_GENISSE", "petite"],
    ["MOYENNE_GENISSE", "moyenne"],
    ["GRANDE_GENISSE", "grande"],
    ["VACHE", "vache"],
  ] as const) {
    assert.deepEqual(filtrerAnimauxParCategorie(femelles, categorie).map((animal) => animal.id), [id]);
  }
});

test("Femelles ET Petite génisse exclut une Velle du même âge", () => {
  const animaux = [
    ...femelles,
    { id: "male", sexbov: "M", danais: subMonths(now, 9), estGenisse: true, categorie: "PETITE_GENISSE" },
  ].filter((animal) => animal.sexbov === "F");
  assert.deepEqual(filtrerAnimauxParCategorie(animaux, "PETITE_GENISSE").map((animal) => animal.id), ["petite"]);
});

test("les catégories commerciales et présélection restent strictes", () => {
  const animaux = [
    { id: "preselection", sexbov: "F", danais: subMonths(now, 9), estGenisse: true, categorie: "PRESELECTION_GENISSE" },
    { id: "a-engraisser", sexbov: "F", danais: subMonths(now, 18), estGenisse: true, categorie: "A_ENGRAISSER" },
    { id: "engraissement", sexbov: "F", danais: subMonths(now, 18), estGenisse: true, categorie: "ENGRAISSEMENT" },
  ];
  assert.deepEqual(filtrerAnimauxParCategorie(animaux, "PRESELECTION_GENISSE").map((animal) => animal.id), ["preselection"]);
  assert.deepEqual(filtrerAnimauxParCategorie(animaux, "A_ENGRAISSER").map((animal) => animal.id), ["a-engraisser"]);
  assert.deepEqual(filtrerAnimauxParCategorie(animaux, "ENGRAISSEMENT").map((animal) => animal.id), ["engraissement"]);
});

test("un filtre absent ou inconnu ne modifie pas la liste", () => {
  assert.equal(filtrerAnimauxParCategorie(femelles, undefined), femelles);
  assert.equal(filtrerAnimauxParCategorie(femelles, "INCONNUE"), femelles);
});
