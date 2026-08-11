import assert from "node:assert/strict";
import test from "node:test";
import {
  normaliserAnalyseOrdonnance,
  reevaluerCorrespondancesOrdonnance,
  trouverCorrespondancesMedicaments,
} from "./ordonnance-extraction.ts";
import { medicamentsDepuisProposition } from "./ordonnance-types.ts";
import { analyserPresentation } from "./ordonnance-display.ts";

const tenaline = {
  id: "med-tenaline",
  nom: "Tenaline LA",
  dci: "Oxytetracycline",
  forme: "Solution injectable",
  categorie: "ANTIBIOTIQUE",
  voie: "IM",
  delaiAttenteViandeJ: 21,
  delaiAttenteLaitJ: 7,
  actif: true,
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

test("prend la date lisible du bloc ordonnance plutot qu'une valeur IA erronee", () => {
  const dates = normaliserAnalyseOrdonnance({
    dates: { prescriptionDate: "2026-04-01", lastVisitDate: "2026-06-01" },
    dateCandidates: [
      {
        value: "2026-04-01",
        sourceText: "ordonnance n°26-06-0002[V] le 01/06/2026",
        confidence: 0.99,
      },
      {
        value: "2026-06-01",
        sourceText: "Dernière visite le 14/04/2026",
        confidence: 0.98,
      },
    ],
    medicaments: [{ medicamentNom: "TENALINE" }],
  });
  assert.equal(dates.prescriptionDate, "2026-06-01");
  assert.equal(dates.lastVisitDate, "2026-04-14");
  assert.notEqual(dates.prescriptionDate, "2026-04-01");
});

test("prend exclusivement la date placee apres le numero d'ordonnance", () => {
  const dates = normaliserAnalyseOrdonnance({
    dates: { prescriptionDate: "2026-04-14" },
    evidence: {
      prescriptionDate: {
        value: "2026-04-14",
        sourceText: "Dernière visite le 14/04/2026 — ordonnance n°26-06-0002[V] le 01/06/2026 — délivré ce jour",
        confidence: 0.99,
      },
      deliveryDate: { value: null, sourceText: "Délivré ce jour", confidence: 0.98 },
    },
    medicaments: [{ medicamentNom: "TENALINE" }],
  });
  assert.equal(dates.prescriptionDate, "2026-06-01");
  assert.equal(dates.deliveryDate, "2026-06-01");
});

test("refuse une date de prescription sans numero d'ordonnance adjacent", () => {
  const dates = normaliserAnalyseOrdonnance({
    dates: { prescriptionDate: "2026-04-14" },
    evidence: {
      prescriptionDate: { value: "2026-04-14", sourceText: "Prescription le 14/04/2026", confidence: 0.99 },
    },
    medicaments: [{ medicamentNom: "TENALINE" }],
  });
  assert.equal(dates.prescriptionDate, null);
});

test("affiche la date en francais apres son classement", () => {
  const date = new Date("2026-06-01T12:00:00.000Z");
  assert.equal(date.toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  }), "01/06/2026");
});

test("ne classe pas une date isolee sans libelle", () => {
  const dates = normaliserAnalyseOrdonnance({
    dates: { prescriptionDate: "2026-06-01", lastVisitDate: "2026-04-14" },
    dateCandidates: [{ value: "2026-06-01", sourceText: "01/06/2026" }],
    medicaments: [{ medicamentNom: "TENALINE" }],
  });
  assert.equal(dates.prescriptionDate, null);
  assert.equal(dates.lastVisitDate, null);
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

test("conserve les trois delais d'attente detectes", () => {
  const med = normaliserAnalyseOrdonnance({
    medicaments: [{
      medicamentNom: "TENALINE",
      withdrawalPeriods: { meatDays: 21, offalDays: 21, milkDays: 7 },
    }],
  }).medicaments![0];
  assert.deepEqual(med.withdrawalPeriods, { meatDays: 21, offalDays: 21, milkDays: 7 });
});

test("rapproche Tenaline de la fiche existante sans en creer une", () => {
  const match = analyse.medicaments![0].medicationMatch;
  assert.equal(match?.id, "med-tenaline");
  assert.equal(match?.nom, "Tenaline LA");
  assert.equal(match?.categorieLabel, "Antibiotique");
});

test("rapproche le nom OCR complet de la fiche commerciale Tenaline", () => {
  const candidatPharmacie = {
    id: "med-tenaline-pharmacie",
    nom: "Ténaline",
    dci: "Oxytétracycline",
    forme: "Solution injectable",
    categorie: "ANTIBIOTIQUE",
    voie: "IM",
    delaiAttenteViandeJ: 21,
    delaiAttenteLaitJ: 7,
    actif: true,
    aliases: [],
  };
  const proposition = normaliserAnalyseOrdonnance({
    medicaments: [{ medicamentNom: "TENALINE LA CLAS SOL INJ FL. 100 ML" }],
  }, [candidatPharmacie]);
  assert.equal(proposition.medicaments?.[0].medicationMatch?.id, "med-tenaline-pharmacie");
  assert.equal(proposition.medicaments?.[0].medicationMatch?.nom, "Ténaline");
  assert.equal(proposition.medicaments?.[0].medicationMatch?.categorieLabel, "Antibiotique");
  assert.equal(proposition.medicaments?.[0].medicationMatchStatus, "matched");
  assert.equal(proposition.medicaments?.[0].medicationMatch?.actif, true);
});

test("retrouve une fiche Tenaline inactive sans proposer un doublon", () => {
  const proposition = normaliserAnalyseOrdonnance({
    medicaments: [{ medicamentNom: "TENALINE LA CLAS SOL INJ FL. 100 ML" }],
  }, [{ ...tenaline, actif: false }]);
  assert.equal(proposition.medicaments?.[0].medicationMatch?.id, "med-tenaline");
  assert.equal(proposition.medicaments?.[0].medicationMatch?.actif, false);
  assert.equal(proposition.medicaments?.[0].medicationMatchStatus, "matched");
});

test("tolere une espace ou une confusion de lettre mineure dans le nom commercial", () => {
  const fichePharmacie = { ...tenaline, nom: "Ténaline" };
  for (const nom of ["TENA LINE", "TENALlNE"]) {
    const proposition = normaliserAnalyseOrdonnance({
      medicaments: [{ medicamentNom: nom }],
    }, [fichePharmacie]);
    assert.equal(proposition.medicaments?.[0].medicationMatch?.id, "med-tenaline", nom);
    assert.equal(proposition.medicaments?.[0].medicationMatchStatus, "matched", nom);
  }
});

test("reevalue une ancienne extraction non rapprochee", () => {
  const ancienMedicament = {
    ...analyse.medicaments![0],
    medicationMatch: null,
    medicationMatches: [],
    medicationMatchStatus: "unmatched" as const,
  };
  const reevaluee = reevaluerCorrespondancesOrdonnance({ medicaments: [ancienMedicament] }, [tenaline]);
  assert.equal(reevaluee.medicaments?.[0].medicationMatch?.id, "med-tenaline");
  assert.equal(reevaluee.medicaments?.[0].medicationMatchStatus, "matched");
});

test("reevalue aussi une ancienne extraction ambigue sans choix manuel", () => {
  const ancienMedicament = {
    ...analyse.medicaments![0],
    medicationMatch: null,
    medicationMatches: [],
    medicationMatchStatus: "ambiguous" as const,
  };
  const reevaluee = reevaluerCorrespondancesOrdonnance({ medicaments: [ancienMedicament] }, [tenaline]);
  assert.equal(reevaluee.medicaments?.[0].medicationMatch?.id, "med-tenaline");
  assert.equal(reevaluee.medicaments?.[0].medicationMatchStatus, "matched");
});

test("ne remplace jamais une association manuelle existante", () => {
  const manuel = {
    ...analyse.medicaments![0],
    medicationMatchStatus: "manually_confirmed" as const,
    medicationMatch: { ...analyse.medicaments![0].medicationMatch!, id: "med-choisi-manuellement" },
  };
  const reevaluee = reevaluerCorrespondancesOrdonnance({ medicaments: [manuel] }, [tenaline]);
  assert.equal(reevaluee.medicaments?.[0].medicationMatch?.id, "med-choisi-manuellement");
  assert.equal(reevaluee.medicaments?.[0].medicationMatchStatus, "manually_confirmed");
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
      prescriptionDate: { value: "2026-08-03", sourceText: "Ordonnance n° 1 le 03/08/2026", confidence: 0.95 },
      lastVisitDate: { value: "2026-04-14", sourceText: "Dernière visite le 14/04/2026", confidence: 0.95 },
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

test("conserve un flacon delivre et distingue sa quantite de son volume", () => {
  const proposition = normaliserAnalyseOrdonnance({
    medicaments: [{ medicamentNom: "TENALINE", conditionnement: "1 flacon de 100 ml" }],
  });
  assert.equal(proposition.medicaments?.[0].conditionnement, "1 flacon de 100 ml");
  assert.deepEqual(analyserPresentation(proposition.medicaments?.[0].conditionnement), {
    presentation: "flacon de 100 ml",
    quantite: 1,
  });
});

test("utilise uniquement la date de l'ordonnance quand le document indique delivre ce jour", () => {
  const dates = normaliserAnalyseOrdonnance({
    dates: { prescriptionDate: "2026-08-03", deliveryDate: "2023-01-12" },
    evidence: {
      prescriptionDate: {
        value: "2026-08-03",
        sourceText: "Ordonnance n° 1 le 03/08/2026",
        confidence: 0.99,
      },
      deliveryDate: { value: null, sourceText: "Délivré ce jour", confidence: 0.98 },
    },
    medicaments: [{ medicamentNom: "TENALINE" }],
  });
  assert.equal(dates.deliveryDate, "2026-08-03");
  assert.notEqual(dates.deliveryDate, "2023-01-12");
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
