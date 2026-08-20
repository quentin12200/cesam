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
      medicaments: [
        { id: "med-1", nomExtrait: "BOOST’VO" },
        { id: "med-2", nomExtrait: "RISPOVAL" },
        { id: "med-3", nomExtrait: "CANDILAT" },
      ],
    },
    { id: "ord-ancienne", medicamentNom: "BOOST’VO", medicaments: [] },
  ]);

  assert.equal(sources.length, 3);
  assert.deepEqual(sources.map((source) => source.kind), ["relation", "relation", "relation"]);
});

test("combine les lignes du document et conserve l'identifiant de la version HIPRABOVIS la plus riche", () => {
  const evidenceRiche = JSON.stringify({
    presentation: { deliveredQuantity: { value: 3, sourceText: "Qté : 3" } },
    lecture: { sourceText: "FL.50ML(10D.)" },
  });
  const sources = ordonnanceMedicationSources([{
    id: "ord-complete",
    medicamentNom: "HIPRABOVIS SOMNI",
    medicaments: [
      { id: "med-hipra-pauvre", medicamentId: "pharma-hipra", nomExtrait: "HIPRABOVIS SOMNI", conditionnement: "Flacon 2 ml", evidenceJson: null },
      { id: "med-bovilis", medicamentId: "pharma-bovilis", nomExtrait: "BOVILIS BOVIGRIP", conditionnement: "Flacon 50 ml", evidenceJson: null },
      { id: "med-3", medicamentId: "pharma-3", nomExtrait: "MÉDICAMENT 3", conditionnement: null, evidenceJson: null },
      { id: "med-4", medicamentId: "pharma-4", nomExtrait: "MÉDICAMENT 4", conditionnement: null, evidenceJson: null },
      { id: "med-5", medicamentId: "pharma-5", nomExtrait: "MÉDICAMENT 5", conditionnement: null, evidenceJson: null },
    ],
  }, {
    id: "ord-hipra-riche",
    medicamentNom: "HIPRABOVIS SOMNI",
    medicaments: [
      { id: "med-hipra-riche", medicamentId: "pharma-hipra", nomExtrait: "HIPRABOVIS SOMNI", conditionnement: "Flacon 2 ml", evidenceJson: evidenceRiche },
    ],
  }]);

  assert.equal(sources.length, 5);
  assert.equal(sources[0].kind, "relation");
  if (sources[0].kind !== "relation") return;
  assert.equal(sources[0].ordonnanceId, "ord-hipra-riche");
  assert.equal((sources[0].medication as { id?: string }).id, "med-hipra-riche");
});
