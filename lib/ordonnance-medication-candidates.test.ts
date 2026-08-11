import assert from "node:assert/strict";
import test from "node:test";
import {
  chargerCandidatsOrdonnance,
  type MedicamentCandidateRecord,
} from "./ordonnance-medication-candidates.ts";

const base = {
  dci: "Oxytétracycline",
  forme: "Solution injectable",
  categorie: "ANTIBIOTIQUE",
  voie: "IM",
  delaiAttenteViandeJ: 21,
  delaiAttenteLaitJ: 7,
  aliasesVocaux: [],
};

test("charge les fiches actives et inactives avec la meme requete", async () => {
  let requete: unknown;
  const medicaments: MedicamentCandidateRecord[] = [
    { ...base, id: "active", nom: "Ténaline", actif: true },
    {
      ...base,
      id: "inactive",
      nom: "Ténaline historique",
      actif: false,
      aliasesVocaux: [{ alias: "Tenaline ancien", transcription: "ténaline ancien" }],
    },
  ];
  const candidats = await chargerCandidatsOrdonnance(async (args) => {
    requete = args;
    return medicaments;
  });

  assert.equal(candidats.length, 2);
  assert.equal(candidats[0].actif, true);
  assert.equal(candidats[1].actif, false);
  assert.deepEqual(candidats[1].aliases, ["Tenaline ancien", "ténaline ancien"]);
  assert.equal("where" in (requete as Record<string, unknown>), false);
  assert.equal((requete as { select: { actif: boolean } }).select.actif, true);
});
