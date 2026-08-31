import assert from "node:assert/strict";
import test from "node:test";
import { extraireConditionsImportantes } from "./ordonnance-important-conditions.ts";

test("extrait les conditions utiles avec leur texte source exact", () => {
  const sources = [
    "Utilisable dès la naissance chez les veaux.",
    "Administrer 3 semaines avant vêlage.",
    "Rappel après 4 semaines.",
    "Réservé aux vaches et génisses.",
    "Ne pas utiliser chez les animaux malades.",
  ];
  const conditions = extraireConditionsImportantes(sources);

  for (const type of ["age_minimum", "velage", "rappel", "categorie_animaux", "restriction"]) {
    assert.ok(conditions.some((condition) => condition.type === type), `condition ${type} absente`);
  }
  assert.ok(conditions.every((condition) => sources.includes(condition.sourceText)));
});
