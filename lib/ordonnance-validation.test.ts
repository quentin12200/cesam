import assert from "node:assert/strict";
import test from "node:test";
import {
  creerOrdonnanceAvecMedicaments,
  formatPosologieExtraite,
  OrdonnanceValidationError,
  type MedicamentValidationInput,
  type OrdonnancePersistence,
  type OrdonnanceValidationInput,
} from "./ordonnance-validation.ts";
import { formaterConditionnementVisuel } from "./ordonnance-display.ts";
import { normaliserAnalyseOrdonnance } from "./ordonnance-extraction.ts";
import { appliquerTranscriptionParBlocs } from "./ordonnance-transcription.ts";

function medicamentInput(overrides: Partial<MedicamentValidationInput> = {}): MedicamentValidationInput {
  return {
    medicationId: "med-tenaline",
    createMedication: false,
    categoryConfirmed: false,
    medicamentNom: "TENALINE LA FL. 250 ML",
    numeroLot: "2111AA",
    substanceActive: "Oxytetracycline",
    concentration: null,
    categorie: "Antibiotique",
    familleTherapeutique: "Tetracyclines",
    formePharmaceutique: "Solution injectable",
    conditionnement: "Flacon 250 ml",
    voie: "IM",
    doseValue: 1,
    doseUnit: "ml",
    referenceValue: 10,
    referenceUnit: "kg",
    referenceType: "live_weight",
    normalizedDoseValue: 0.1,
    normalizedDoseUnit: "ml/kg",
    administrationCount: 1,
    administrationIntervalHours: null,
    treatmentDurationDays: 3,
    repeatCondition: null,
    administrationInstructions: null,
    withdrawalPeriods: { meatDays: 21, offalDays: 21, milkDays: 7 },
    precautions: null,
    evidence: { dose: { sourceText: "1 ml / 10 kg", confidence: 0.98 } },
    ...overrides,
  };
}

function ordonnanceInput(medicaments: MedicamentValidationInput[]): OrdonnanceValidationInput {
  return {
    prescriptionDate: new Date("2026-08-03"),
    lastVisitDate: new Date("2026-04-14"),
    deliveryDate: null,
    ordonnanceNumero: "26-08-0001",
    veterinaire: "Dr Test",
    motif: null,
    animaux: null,
    evidence: {},
    medicaments,
  };
}

function creerMemoire(options: { failLinkAt?: number; medicamentActif?: boolean } = {}) {
  const state = {
    medicaments: [{
      id: "med-tenaline",
      nom: "Tenaline LA",
      dci: "Oxytetracycline" as string | null,
      forme: "Solution injectable" as string | null,
      categorie: "ANTIBIOTIQUE",
      voie: "IM" as string | null,
      delaiAttenteViandeJ: 21 as number | null,
      delaiAttenteLaitJ: 7 as number | null,
      actif: options.medicamentActif ?? true,
      aliasesVocaux: [] as Array<{ alias: string; transcription: string }>,
    }],
    ordonnances: [] as Array<Record<string, unknown>>,
    liens: [] as Array<Record<string, unknown>>,
  };
  const tx: OrdonnancePersistence = {
    medicament: {
      async findMany() { return state.medicaments; },
      async findUnique(args) {
        const id = (args as { where: { id: string } }).where.id;
        return state.medicaments.find((medicament) => medicament.id === id) ?? null;
      },
      async create(args) {
        const data = (args as { data: Record<string, unknown> }).data;
        const created = {
          id: `med-${state.medicaments.length + 1}`,
          nom: String(data.nom),
          dci: data.dci as string | null,
          forme: data.forme as string | null,
          categorie: String(data.categorie),
          voie: data.voie as string | null,
          delaiAttenteViandeJ: data.delaiAttenteViandeJ as number | null,
          delaiAttenteLaitJ: data.delaiAttenteLaitJ as number | null,
          actif: true,
          aliasesVocaux: [],
        };
        state.medicaments.push(created);
        return created;
      },
    },
    ordonnance: {
      async create(args) {
        const data = (args as { data: Record<string, unknown> }).data;
        state.ordonnances.push(data);
        return { id: `ord-${state.ordonnances.length}` };
      },
    },
    ordonnanceMedicament: {
      async create(args) {
        if (options.failLinkAt === state.liens.length) throw new Error("SIMULATED_LINK_FAILURE");
        const data = (args as { data: Record<string, unknown> }).data;
        state.liens.push(data);
        return { id: `link-${state.liens.length}` };
      },
    },
  };
  return { state, tx };
}

test("cree une seule ordonnance et une liaison pour un medicament", async () => {
  const { state, tx } = creerMemoire();
  const conditionnement = "1 flacon de 50 ml · 10 doses";
  const result = await creerOrdonnanceAvecMedicaments(
    tx,
    ordonnanceInput([medicamentInput({ conditionnement })]),
    ["doc.jpg"],
  );
  assert.equal(state.ordonnances.length, 1);
  assert.equal(state.liens.length, 1);
  assert.equal(result.medicamentIds.length, 1);
  assert.equal(state.liens[0].posologieExtraite, "1 ml / 10 kg de poids vif");
  assert.equal(state.liens[0].numeroLot, "2111AA");
  assert.equal(state.liens[0].conditionnement, conditionnement);
  assert.equal(state.ordonnances[0].conditionnement, conditionnement);
});

test("conserve HIPRABOVIS de la proposition structuree jusqu a la liaison en base", async () => {
  const proposition = normaliserAnalyseOrdonnance(appliquerTranscriptionParBlocs({
    transcription: {
      entete: { lignes: ["ordonnance n°26-08-0694[V] le 19/08/2026"] },
      medicaments: [{
        identification: ["HIPRABOVIS SOMNI LKT"],
        presentation: ["FL.50ML(10D.)", "Qté : 3"],
        posologie: ["Administrer 2 ml par animal"],
        renouvellement: [],
        delaisAttente: [],
        instructionsPrecautions: [],
        autres: [],
      }],
    },
    medicaments: [{
      medicamentNom: "HIPRABOVIS SOMNI LKT",
      presentation: {
        containerType: "flacon",
        volumeValue: 50,
        volumeUnit: "ml",
        deliveredQuantity: 3,
        sourceText: "FL.50ML(10D.)\nQté : 3",
      },
      conditionnement: "Flacon 2 ml",
      dose: {
        doseValue: 2,
        doseUnit: "ml",
        referenceValue: null,
        referenceUnit: null,
        referenceType: "animal",
      },
      evidence: {
        conditionnement: { value: "FL.50ML(10D.)", sourceText: "FL.50ML(10D.)", confidence: 0.98 },
        deliveredQuantity: { value: 3, sourceText: "Qté : 3", confidence: 0.98 },
        dose: { value: "2 ml", sourceText: "Administrer 2 ml par animal", confidence: 0.98 },
      },
    }],
  }));
  const extrait = proposition.medicaments?.[0];
  assert.ok(extrait);
  const { state, tx } = creerMemoire();
  await creerOrdonnanceAvecMedicaments(tx, ordonnanceInput([medicamentInput({
    medicamentNom: extrait.medicamentNom ?? "",
    conditionnement: "Flacon 2 ml",
    doseValue: extrait.doseValue,
    doseUnit: extrait.doseUnit,
    referenceValue: extrait.referenceValue,
    referenceUnit: extrait.referenceUnit,
    referenceType: extrait.referenceType,
    evidence: extrait.evidence,
  })]), ["hiprabovis.jpg"]);

  assert.equal(state.liens[0].conditionnement, "3 flacon de 50 ml · 10 doses");
  assert.equal(state.liens[0].posologieExtraite, "2 ml");
  assert.deepEqual(formaterConditionnementVisuel(String(state.liens[0].conditionnement)), {
    ligne: "3 × flacons 50 ml · 10 doses chacun",
    totalDoses: "30 doses au total",
  });
  const evidenceEnregistree = JSON.parse(String(state.liens[0].evidenceJson));
  assert.equal(evidenceEnregistree.presentation.value.deliveredQuantity, 3);
  assert.match(evidenceEnregistree.presentation.sourceText, /FL\.50ML\(10D\.\)/);
  assert.equal(evidenceEnregistree.deliveredQuantity.value, 3);
  assert.match(evidenceEnregistree.dose.sourceText, /2 ml/);
});

test("conserve un vrai flacon HIPRABOVIS de 2 ml distinct de sa dose de 2 ml", async () => {
  const { state, tx } = creerMemoire();
  await creerOrdonnanceAvecMedicaments(tx, ordonnanceInput([medicamentInput({
    conditionnement: "Flacon 2 ml",
    doseValue: 2,
    doseUnit: "ml",
    referenceValue: null,
    referenceUnit: null,
    referenceType: "animal",
    evidence: {
      presentation: {
        value: { deliveredQuantity: 1 },
        sourceText: "FL.2ML(1D.)",
        confidence: 0.98,
      },
      deliveredQuantity: { value: 1, sourceText: "Qté : 1", confidence: 0.98 },
      dose: { value: "2 ml", sourceText: "Administrer 2 ml", confidence: 0.98 },
    },
  })]), ["flacon-2ml.jpg"]);

  assert.equal(state.liens[0].conditionnement, "1 flacon de 2 ml · 1 dose");
  assert.equal(state.liens[0].posologieExtraite, "2 ml");
});

test("conserve plusieurs consignes pratiques dans la liaison ordonnance medicament", async () => {
  const dosesPratiques = [{
    categorieAnimaux: "Adultes",
    doseValue: "10",
    doseUnit: "ml",
    poidsMinKg: null,
    poidsMaxKg: null,
    frequence: "par jour",
    maximum: true,
    origine: "ordonnance" as const,
    sourceText: "Bovins adultes : 10 ml maximum par jour",
    aVerifier: false,
  }, {
    categorieAnimaux: "Veaux",
    doseValue: "2",
    doseUnit: "ml",
    poidsMinKg: "40",
    poidsMaxKg: "50",
    frequence: "par jour",
    maximum: false,
    origine: "ordonnance" as const,
    sourceText: "Veaux : 2 ml pour 40 à 50 kg par jour",
    aVerifier: false,
  }];
  const med = medicamentInput({ dosesPratiques });
  const { state, tx } = creerMemoire();

  await creerOrdonnanceAvecMedicaments(tx, ordonnanceInput([med]), ["doc.jpg"]);

  assert.equal(formatPosologieExtraite(med), "Max : 10 ml / jour\nVeaux : 2 ml / 40–50 kg / jour");
  assert.equal(state.liens[0].posologieExtraite, "Max : 10 ml / jour\nVeaux : 2 ml / 40–50 kg / jour");
  assert.deepEqual(JSON.parse(String(state.liens[0].evidenceJson)).dosesPratiques, dosesPratiques);
});

test("refuse la validation tant qu une posologie pratique est a verifier", async () => {
  const { state, tx } = creerMemoire();
  const med = medicamentInput({
    dosesPratiques: [{
      categorieAnimaux: "Veaux",
      doseValue: "10",
      doseUnit: "ml",
      poidsMinKg: "40",
      poidsMaxKg: "50",
      frequence: "par jour",
      maximum: true,
      origine: "ordonnance",
      sourceText: "10 ml maximum pour adultes ; 2 ml pour 40 à 50 kg pour veaux",
      aVerifier: true,
    }],
  });

  await assert.rejects(
    creerOrdonnanceAvecMedicaments(tx, ordonnanceInput([med]), ["doc.jpg"]),
    (error: unknown) => error instanceof OrdonnanceValidationError && error.code === "DOSE_A_VERIFIER",
  );
  assert.equal(state.ordonnances.length, 0);
  assert.equal(state.liens.length, 0);
});

test("cree une seule ordonnance et plusieurs liaisons", async () => {
  const { state, tx } = creerMemoire();
  const second = medicamentInput({
    medicationId: null,
    createMedication: true,
    medicamentNom: "PRODUIT DISTINCT",
    substanceActive: null,
    numeroLot: null,
    categorie: "Vaccin",
    categoryConfirmed: false,
  });
  await creerOrdonnanceAvecMedicaments(tx, ordonnanceInput([medicamentInput(), second]), ["doc.jpg"]);
  assert.equal(state.ordonnances.length, 1);
  assert.equal(state.liens.length, 2);
  assert.equal(state.medicaments[1].categorie, "AUTRE", "une catégorie IA non confirmée reste incertaine");
});

test("refuse de creer un doublon ressemblant", async () => {
  const { tx } = creerMemoire();
  await assert.rejects(
    creerOrdonnanceAvecMedicaments(tx, ordonnanceInput([
      medicamentInput({ medicationId: null, createMedication: true }),
    ]), ["doc.jpg"]),
    (error: unknown) => error instanceof OrdonnanceValidationError
      && error.code === "MEDICAMENT_POSSIBLE_EXISTANT",
  );
});

test("refuse aussi de dupliquer une fiche inactive ressemblante", async () => {
  const { tx } = creerMemoire({ medicamentActif: false });
  await assert.rejects(
    creerOrdonnanceAvecMedicaments(tx, ordonnanceInput([
      medicamentInput({ medicationId: null, createMedication: true }),
    ]), ["doc.jpg"]),
    (error: unknown) => error instanceof OrdonnanceValidationError
      && error.code === "MEDICAMENT_POSSIBLE_EXISTANT",
  );
});

test("une erreur de liaison peut annuler toute la transaction", async () => {
  const { state, tx } = creerMemoire({ failLinkAt: 0 });
  const snapshot = structuredClone(state);
  await assert.rejects(async () => {
    try {
      await creerOrdonnanceAvecMedicaments(tx, ordonnanceInput([medicamentInput()]), ["doc.jpg"]);
    } catch (error) {
      state.medicaments.splice(0, state.medicaments.length, ...snapshot.medicaments);
      state.ordonnances.splice(0, state.ordonnances.length, ...snapshot.ordonnances);
      state.liens.splice(0, state.liens.length, ...snapshot.liens);
      throw error;
    }
  }, /SIMULATED_LINK_FAILURE/);
  assert.equal(state.ordonnances.length, 0);
  assert.equal(state.liens.length, 0);
});
