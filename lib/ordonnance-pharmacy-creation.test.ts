import assert from "node:assert/strict";
import test from "node:test";
import {
  creerMedicamentPharmacieDepuisOrdonnance,
  CreationPharmacieError,
  type CreationPharmacieInput,
  type CreationPharmaciePersistence,
} from "./ordonnance-pharmacy-creation.ts";
import type { MedicamentCandidateRecord } from "./ordonnance-medication-candidates.ts";

function input(overrides: Partial<CreationPharmacieInput> = {}): CreationPharmacieInput {
  return {
    confirmed: true,
    categoryConfirmed: true,
    medicamentNom: "OXYTETRIN P 220 G AER. 320 ML",
    conditionnement: "1 aérosol de 320 ml",
    formePharmaceutique: "Aérosol",
    voie: "TOPIQUE",
    substanceActive: "Oxytétracycline",
    concentration: "220 g",
    categorie: "Antibiotique",
    doseValue: 1,
    doseUnit: "ml",
    referenceValue: 10,
    referenceUnit: "kg",
    referenceType: "live_weight",
    administrationCount: 1,
    treatmentDurationDays: null,
    administrationIntervalHours: null,
    repeatCondition: null,
    meatDays: 21,
    offalDays: 21,
    milkDays: 7,
    precautions: null,
    ...overrides,
  };
}

function persistence(existing: MedicamentCandidateRecord[] = []) {
  const state = {
    medicaments: [...existing],
    createdMedicament: null as null | Record<string, unknown>,
    conditionnements: [] as Record<string, unknown>[],
    preconisations: [] as Record<string, unknown>[],
  };
  const tx: CreationPharmaciePersistence = {
    medicament: {
      async findMany() { return state.medicaments; },
      async create(args) {
        const data = (args as { data: Record<string, unknown> }).data;
        state.createdMedicament = data;
        const created: MedicamentCandidateRecord = {
          id: "med-created",
          nom: String(data.nom),
          dci: data.dci as string | null,
          forme: data.forme as string | null,
          categorie: String(data.categorie),
          voie: data.voie as string | null,
          delaiAttenteViandeJ: data.delaiAttenteViandeJ as number | null,
          delaiAttenteLaitJ: data.delaiAttenteLaitJ as number | null,
          dosagePourKg: null,
          uniteDosage: null,
          actif: true,
          aliasesVocaux: [],
          preconisations: [],
          conditionnements: [],
        };
        state.medicaments.push(created);
        return created;
      },
    },
    conditionnementMedicament: {
      async create(args) { state.conditionnements.push((args as { data: Record<string, unknown> }).data); return {}; },
    },
    preconisation: {
      async create(args) { state.preconisations.push((args as { data: Record<string, unknown> }).data); return {}; },
    },
  };
  return { tx, state };
}

test("exige une confirmation avant toute creation", async () => {
  const { tx, state } = persistence();
  await assert.rejects(
    () => creerMedicamentPharmacieDepuisOrdonnance(tx, input({ confirmed: false })),
    (error: unknown) => error instanceof CreationPharmacieError && error.code === "CONFIRMATION_REQUISE",
  );
  assert.equal(state.createdMedicament, null);
});

test("cree et retourne la fiche pre-remplie depuis l ordonnance", async () => {
  const { tx, state } = persistence();
  const result = await creerMedicamentPharmacieDepuisOrdonnance(tx, input());
  assert.equal(result.medicament.id, "med-created");
  assert.equal(result.medicament.nom, "OXYTETRIN P 220 G AER. 320 ML");
  assert.equal(result.medicament.forme, "Aérosol");
  assert.equal(result.medicament.voie, "TOPIQUE");
  assert.equal(state.createdMedicament?.dci, "Oxytétracycline");
  assert.deepEqual(state.conditionnements[0], {
    medicamentId: "med-created", quantiteFlacon: 320, uniteFlacon: "ml", actif: true,
  });
});

test("associe immediatement le resultat a la nouvelle fiche", async () => {
  const { tx } = persistence();
  const result = await creerMedicamentPharmacieDepuisOrdonnance(tx, input());
  assert.equal(result.medicament.id, "med-created");
  assert.equal(result.medicament.actif, true);
  assert.equal(result.medicament.categorieLabel, "Antibiotique");
});

for (const actif of [true, false]) {
  test(`bloque le doublon ${actif ? "actif" : "inactif"}`, async () => {
    const existant: MedicamentCandidateRecord = {
      id: actif ? "med-active" : "med-inactive",
      nom: "Oxytetrin P",
      dci: "Oxytétracycline",
      forme: "Aérosol",
      categorie: "ANTIBIOTIQUE",
      voie: "TOPIQUE",
      delaiAttenteViandeJ: 21,
      delaiAttenteLaitJ: 7,
      actif,
      aliasesVocaux: [],
      preconisations: [],
      conditionnements: [],
    };
    const { tx, state } = persistence([existant]);
    await assert.rejects(
      () => creerMedicamentPharmacieDepuisOrdonnance(tx, input()),
      (error: unknown) => error instanceof CreationPharmacieError
        && error.code === "DOUBLON_POSSIBLE"
        && error.candidats[0]?.id === existant.id
        && error.candidats[0]?.actif === actif,
    );
    assert.equal(state.createdMedicament, null);
  });
}

test("enregistre la posologie proposee uniquement avec le statut a verifier", async () => {
  const { tx, state } = persistence();
  const result = await creerMedicamentPharmacieDepuisOrdonnance(tx, input());
  assert.equal(result.preconisationCreee, true);
  assert.equal(state.preconisations.length, 1);
  assert.equal(state.preconisations[0].dose, 1);
  assert.equal(state.preconisations[0].statut, "A_VERIFIER");
  assert.notEqual(state.preconisations[0].statut, "VALIDE");
});
