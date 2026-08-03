import assert from "node:assert/strict";
import test from "node:test";
import { normaliserAnalyseOrdonnance } from "./ordonnance-extraction.ts";

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
