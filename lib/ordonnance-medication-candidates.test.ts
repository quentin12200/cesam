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
  dosagePourKg: 10,
  uniteDosage: "ml",
  preconisations: [{
    dose: 10,
    unite: "ml",
    doseBase: "100KG",
    voie: "IM",
    frequence: "1 fois par jour",
    delaiAttenteViandeJ: 21,
    delaiAttenteLaitTraites: 14,
    statut: "A_VERIFIER",
  }],
  conditionnements: [{ quantiteFlacon: 100, uniteFlacon: "ml" }],
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
  assert.equal(candidats[0].uniteDosage, "ml");
  assert.equal(candidats[0].preconisations?.[0].statut, "A_VERIFIER");
  assert.deepEqual(candidats[0].conditionnements, [{ quantiteFlacon: 100, uniteFlacon: "ml" }]);
  assert.deepEqual(candidats[1].aliases, ["Tenaline ancien", "ténaline ancien"]);
  assert.equal("where" in (requete as Record<string, unknown>), false);
  assert.equal((requete as { select: { actif: boolean } }).select.actif, true);
  assert.equal((requete as { select: { preconisations: unknown } }).select.preconisations != null, true);
  assert.equal((requete as { select: { conditionnements: unknown } }).select.conditionnements != null, true);
});
