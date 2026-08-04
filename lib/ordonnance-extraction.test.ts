import assert from "node:assert/strict";
import test from "node:test";
import {
  normaliserAnalyseOrdonnance,
  trouverCorrespondancesMedicaments,
} from "./ordonnance-extraction.ts";
import { medicamentsDepuisProposition } from "./ordonnance-types.ts";

const tenaline = {
  id: "med-tenaline",
  nom: "Tenaline LA",
  dci: "Oxytetracycline",
  forme: "Solution injectable",
  categorie: "ANTIBIOTIQUE",
  voie: "IM",
  delaiAttenteViandeJ: 21,
  delaiAttenteLaitJ: 7,
  aliases: [],
};

const analyse = normaliserAnalyseOrdonnance({
  dateCandidates: [
    { value: "2026-04-14", sourceText: "Dernière visite le : 14/04/2026", zone: "corps" },
    { value: "2026-08-03", sourceText: "Ordonnance n° 26-08-0001, le 03/08/2026", zone: "en-tete" },
  ],
  medicaments: [{
    medicamentNom: "TENALINE LA CLAS SOL INJ FL. 250 ML",
    substanceActive: "Oxytetracycline",
    categorie: "Antibiotique",
    familleTherapeutique: "Tetracyclines",
    formePharmaceutique: "Solution injectable",
    conditionnement: "Flacon 250 ml",
    voie: "IM",
    dose: {
      doseValue: 1,
      doseUnit: "ml",
      referenceValue: 10,
      referenceUnit: "kg",
      referenceType: "live_weight",
      normalizedDoseValue: 0.1,
      normalizedDoseUnit: "ml/kg",
    },
    administrationProtocol: {
      administrationCount: 1,
      administrationIntervalHours: 72,
      treatmentDurationDays: null,
      repeatCondition: "Si les signes cliniques persistent",
      administrationInstructions: "Injection intramusculaire unique",
    },
    withdrawalPeriods: { meatDays: 21, offalDays: 21, milkDays: 7 },
  }],
}, [tenaline]);

test("classe les dates selon leur libelle", () => {
  assert.equal(analyse.prescriptionDate, "2026-08-03");
  assert.equal(analyse.lastVisitDate, "2026-04-14");
});

test("conserve la posologie ponderale sans la convertir en dose fixe", () => {
  const med = analyse.medicaments![0];
  assert.equal(med.doseValue, 1);
  assert.equal(med.referenceValue, 10);
  assert.equal(med.referenceType, "live_weight");
  assert.equal(med.normalizedDoseValue, 0.1);
});

test("separe le protocole des delais d'attente", () => {
  const med = analyse.medicaments![0];
  assert.equal(med.administrationCount, 1);
  assert.equal(med.administrationIntervalHours, 72);
  assert.equal(med.treatmentDurationDays, null);
  assert.deepEqual(med.withdrawalPeriods, { meatDays: 21, offalDays: 21, milkDays: 7 });
});

test("rapproche Tenaline de la fiche existante sans en creer une", () => {
  const match = analyse.medicaments![0].medicationMatch;
  assert.equal(match?.id, "med-tenaline");
  assert.equal(match?.nom, "Tenaline LA");
  assert.equal(match?.categorieLabel, "Antibiotique");
});

test("conserve plusieurs medicaments dans une seule extraction structuree", () => {
  const multi = normaliserAnalyseOrdonnance({
    medicaments: [
      { medicamentNom: "TENALINE LA", numeroLot: "2111AA" },
      { medicamentNom: "METACAM", conditionnement: "Flacon 250 ml" },
    ],
  }, [tenaline]);
  assert.equal(multi.medicaments?.length, 2);
  assert.equal(multi.medicaments?.[0].numeroLot, "2111AA");
  assert.equal(multi.medicaments?.[1].conditionnement, "Flacon 250 ml");
});

test("ne choisit pas entre plusieurs correspondances plausibles", () => {
  const candidats = [
    tenaline,
    { ...tenaline, id: "med-tenaline-250", nom: "Tenaline LA 250 ml" },
  ];
  const ambigu = normaliserAnalyseOrdonnance({
    medicaments: [{ medicamentNom: "Tenaline LA flacon" }],
  }, candidats);
  assert.equal(ambigu.medicaments?.[0].medicationMatch, null);
  assert.equal(ambigu.medicaments?.[0].medicationMatchStatus, "ambiguous");
  assert.equal(ambigu.medicaments?.[0].medicationMatches.length, 2);
});

test("classe un medicament absent comme non trouve", () => {
  const matches = trouverCorrespondancesMedicaments("PRODUIT INCONNU", null, [tenaline]);
  assert.deepEqual(matches, []);
});

test("ignore une date de delivrance sans libelle justificatif", () => {
  const dates = normaliserAnalyseOrdonnance({
    dates: {
      prescriptionDate: "2026-08-03",
      lastVisitDate: "2026-04-14",
      deliveryDate: "2023-01-12",
    },
    evidence: {
      deliveryDate: { value: "2023-01-12", sourceText: "12/01/2023", confidence: 0.91 },
    },
    medicaments: [{ medicamentNom: "TENALINE LA" }],
  });
  assert.equal(dates.prescriptionDate, "2026-08-03");
  assert.equal(dates.lastVisitDate, "2026-04-14");
  assert.equal(dates.deliveryDate, null);
});

test("conserve une date de delivrance explicitement sourcee", () => {
  const dates = normaliserAnalyseOrdonnance({
    dates: { deliveryDate: "2026-08-03" },
    evidence: {
      deliveryDate: {
        value: "2026-08-03",
        sourceText: "Date de délivrance : 03/08/2026",
        confidence: 0.96,
      },
    },
    medicaments: [{ medicamentNom: "TENALINE LA" }],
  });
  assert.equal(dates.deliveryDate, "2026-08-03");
});

test("conserve le rapprochement des brouillons crees avant la liste de candidats", () => {
  const [medicament] = medicamentsDepuisProposition({
    medicaments: [{
      ...analyse.medicaments![0],
      medicationMatches: undefined as never,
      medicationMatchStatus: undefined as never,
    }],
  });
  assert.equal(medicament.medicationMatchStatus, "matched");
  assert.equal(medicament.medicationMatches[0]?.id, "med-tenaline");
});
