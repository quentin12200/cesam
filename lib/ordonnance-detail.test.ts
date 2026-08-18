import assert from "node:assert/strict";
import test from "node:test";
import { ordonnanceMedicationSources } from "./ordonnance-detail.ts";

test("récupère les trois médicaments historiques regroupés par document", () => {
  const sources = ordonnanceMedicationSources([
    { id: "ord-1", medicamentNom: "BOOST’VO", medicaments: [] },
    { id: "ord-2", medicamentNom: "RISPOVAL", medicaments: [] },
    { id: "ord-3", medicamentNom: "CANDILAT", medicaments: [] },
  ]);

  assert.equal(sources.length, 3);
  assert.deepEqual(sources.map((source) => source.row.medicamentNom), ["BOOST’VO", "RISPOVAL", "CANDILAT"]);
  assert.ok(sources.every((source) => source.kind === "legacy"));
});

test("conserve les trois relations de la nouvelle ordonnance sans les dupliquer", () => {
  const sources = ordonnanceMedicationSources([
    {
      id: "ord-complete",
      medicamentNom: "BOOST’VO",
      medicaments: [{ id: "med-1" }, { id: "med-2" }, { id: "med-3" }],
    },
    { id: "ord-ancienne", medicamentNom: "BOOST’VO", medicaments: [] },
  ]);

  assert.equal(sources.length, 3);
  assert.deepEqual(sources.map((source) => source.kind), ["relation", "relation", "relation"]);
});
