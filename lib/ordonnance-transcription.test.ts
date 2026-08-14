import assert from "node:assert/strict";
import test from "node:test";
import { formaterPresentationCompacte } from "./ordonnance-display.ts";
import { formaterDosePratiqueContextuelle, formaterDoseSource } from "./ordonnance-dose-sources.ts";
import { normaliserAnalyseOrdonnance } from "./ordonnance-extraction.ts";
import { appliquerTranscriptionParBlocs } from "./ordonnance-transcription.ts";

test("reconstruit le cas reel Tenaline uniquement depuis ses blocs transcrits", () => {
  const analyseIA = {
    transcription: {
      entete: {
        lignes: [
          "Dernière visite : 14/04/2026",
          "ordonnance n°26-06-0002[V] le 01/06/2026",
        ],
      },
      medicaments: [{
        identification: ["TENALINE LA CLAS SOL INJ"],
        presentation: ["FL. 100 ML", "Qté : 1"],
        posologie: [
          "20 mg d’oxytétracycline par kg de poids vif",
          "soit 1 ml de solution injectable pour 10 kg de poids vif",
        ],
        renouvellement: ["seconde administration après 72 heures si nécessaire"],
        delaisAttente: ["Viande et abats : 21 jours", "Lait : 7 jours"],
        instructionsPrecautions: [],
        autres: [],
      }],
    },
    // Propositions IA volontairement fausses : les blocs certains doivent primer.
    dates: { prescriptionDate: "2026-01-01", lastVisitDate: "2023-04-14" },
    ordonnanceNumero: "incorrect",
    medicaments: [{
      medicamentNom: "TENALINE",
      conditionnement: "100 unités",
      dose: {
        doseValue: 20,
        doseUnit: "mg",
        referenceValue: 10,
        referenceUnit: "kg",
        referenceType: "live_weight",
      },
      administrationProtocol: {
        administrationCount: 2,
        administrationIntervalHours: 72,
        repeatCondition: "Viande et abats : 21 jours, lait : 7 jours",
      },
      withdrawalPeriods: { meatDays: 1, offalDays: 1, milkDays: null },
    }],
  };

  const proposition = normaliserAnalyseOrdonnance(appliquerTranscriptionParBlocs(analyseIA));
  const medicament = proposition.medicaments![0];

  assert.equal(proposition.prescriptionDate, "2026-06-01");
  assert.equal(proposition.lastVisitDate, "2026-04-14");
  assert.equal(proposition.ordonnanceNumero, "26-06-0002[V]");
  assert.equal(formaterPresentationCompacte(medicament.conditionnement), "Flacon 100 ml · Qté 1");
  assert.equal(formaterDoseSource(medicament.dosePratique ?? null), "1 ml / 10 kg");
  assert.equal(formaterDoseSource(medicament.dosePharmacologique ?? null), "20 mg / 1 kg");
  assert.notEqual(
    `${medicament.doseValue} ${medicament.doseUnit} / ${medicament.referenceValue} ${medicament.referenceUnit}`,
    "20 mg / 10 kg",
  );
  assert.notEqual(medicament.normalizedDoseValue, 2);
  assert.equal(medicament.administrationCount, 1);
  assert.equal(medicament.administrationIntervalHours, 72);
  assert.equal(medicament.repeatCondition, "si nécessaire");
  assert.deepEqual(medicament.withdrawalPeriods, { meatDays: 21, offalDays: 21, milkDays: 7 });
  assert.doesNotMatch(medicament.repeatCondition ?? "", /viande|abats|lait/i);
});

test("ne recupere aucune donnee dans un bloc metier voisin", () => {
  const analyse = appliquerTranscriptionParBlocs({
    transcription: {
      entete: { lignes: [] },
      medicaments: [{
        identification: ["PRODUIT"],
        presentation: [],
        posologie: ["20 mg par kg"],
        renouvellement: ["Viande et abats : 21 jours"],
        delaisAttente: ["seconde administration après 72 heures si nécessaire"],
        instructionsPrecautions: [],
        autres: ["1 ml pour 10 kg"],
      }],
    },
    medicaments: [{ medicamentNom: "PRODUIT" }],
  });
  const medicament = normaliserAnalyseOrdonnance(analyse).medicaments![0];

  assert.equal(medicament.dosePratique, null);
  assert.equal(medicament.repeatCondition, null);
  assert.deepEqual(medicament.withdrawalPeriods, { meatDays: null, offalDays: null, milkDays: null });
});

test("retrouve le veterinaire et separe deux medicaments regroupes par l IA", () => {
  const candidatTenaline = {
    id: "med-tenaline",
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
  const analyseIA = {
    transcription: {
      entete: {
        lignes: [
          "DrV Gauthier LADANT",
          "Dernière visite : 14/04/2026",
          "ordonnance n°26-06-0002[V] le 01/06/2026",
        ],
      },
      medicaments: [{
        identification: [],
        presentation: [],
        posologie: [],
        renouvellement: [],
        delaisAttente: [],
        instructionsPrecautions: [],
        autres: [
          "1 - TENALINE LA CLAS SOL INJ FL. 100 ML",
          "Qté : 1",
          "20 mg d’oxytétracycline par kg de poids vif",
          "soit 1 ml de solution injectable pour 10 kg de poids vif",
          "2 - OXYTERIN P 220 G AER. 320 ML",
          "Qté : 1",
        ],
      }],
    },
    veterinaire: null,
    medicaments: [{ medicamentNom: null }],
  };

  const proposition = normaliserAnalyseOrdonnance(
    appliquerTranscriptionParBlocs(analyseIA),
    [candidatTenaline],
  );

  assert.equal(proposition.veterinaire, "DrV Gauthier LADANT");
  assert.equal(proposition.prescriptionDate, "2026-06-01");
  assert.equal(proposition.lastVisitDate, "2026-04-14");
  assert.equal(proposition.medicaments?.length, 2);
  assert.equal(proposition.medicaments?.[0].medicamentNom, "TENALINE LA CLAS SOL INJ FL. 100 ML");
  assert.equal(proposition.medicaments?.[0].medicationMatch?.id, "med-tenaline");
  assert.equal(proposition.medicaments?.[1].medicamentNom, "OXYTERIN P 220 G AER. 320 ML");
});

test("retrouve Diurizone depuis une identification de bloc transmise comme texte", () => {
  const candidatDiurizone = {
    id: "med-diurizone",
    nom: "DIURIZONE",
    dci: null,
    forme: "Solution injectable",
    categorie: "DIURETIQUE_CORTISONE",
    voie: "IV / IM / SC",
    delaiAttenteViandeJ: 3,
    delaiAttenteLaitJ: 2,
    actif: true,
    aliases: [],
  };
  const analyseIA = {
    transcription: {
      entete: {
        lignes: [
          "Dr Hélène Defrance",
          "Dernière visite : 14/04/2026",
          "ordonnance n°26-05-0764[V] le 26/05/2026",
        ],
      },
      medicaments: [{
        // Le service IA peut renvoyer une chaîne multiligne malgré le tableau demandé.
        identification: "1 - DIURIZONE SOLUTION INJECTABLE FL. 50 ML",
        presentation: "Qté : 1\nLot : 15731B\nSolution injectable",
        posologie: [
          "Dexaméthasone : 0,01 à 0,02 mg/kg",
          "Hydrochlorothiazide : 1 à 2 mg/kg",
          "10 ml maximum par jour pour les bovins adultes ; 2 ml pour 40 à 50 kg par jour pour les veaux",
          "Administrer pendant 3 jours",
          "Voies : intraveineuse, intramusculaire ou sous-cutanée",
        ],
        renouvellement: "Renouvellement interdit",
        delaisAttente: "Viande et abats : 3 jours\nLait : 2 jours",
        instructionsPrecautions: [],
        autres: [],
      }],
    },
    veterinaire: "Dr Hélène Defrance",
    medicaments: [{
      medicamentNom: null,
      voie: null,
      substanceActive: "Dexaméthasone + Hydrochlorothiazide",
      concentration: "Dexaméthasone : 0,5 mg/ml ; Hydrochlorothiazide : 50 mg/ml",
      administrationProtocol: {},
      evidence: {
        concentration: {
          value: "Dexaméthasone : 0,5 mg/ml ; Hydrochlorothiazide : 50 mg/ml",
          sourceText: "Dexaméthasone : 0,5 mg/ml ; Hydrochlorothiazide : 50 mg/ml",
          confidence: 0.99,
        },
      },
    }],
  };

  const proposition = normaliserAnalyseOrdonnance(
    appliquerTranscriptionParBlocs(analyseIA),
    [candidatDiurizone],
  );
  const medicament = proposition.medicaments?.[0];

  assert.equal(proposition.prescriptionDate, "2026-05-26");
  assert.equal(proposition.lastVisitDate, "2026-04-14");
  assert.equal(proposition.ordonnanceNumero, "26-05-0764[V]");
  assert.equal(proposition.veterinaire, "Dr Hélène Defrance");
  assert.equal(medicament?.medicamentNom, "DIURIZONE SOLUTION INJECTABLE FL. 50 ML");
  assert.equal(medicament?.medicationMatch?.id, "med-diurizone");
  assert.equal(formaterPresentationCompacte(medicament?.conditionnement ?? null), "Flacon 50 ml · Qté 1");
  assert.equal(medicament?.numeroLot, "15731B");
  assert.equal(formaterDoseSource(medicament?.dosePharmacologique ?? null), "0.02 mg / 1 kg");
  assert.equal(medicament?.dosesPratiques?.length, 3);
  assert.deepEqual(medicament?.dosesPratiques?.map((dose) => formaterDosePratiqueContextuelle(dose)), [
    "Adultes : 2 à 4 ml / 100 kg / jour",
    "Max : 10 ml / jour",
    "Veaux : 2 ml / 40–50 kg / jour",
  ]);
  assert.doesNotMatch(medicament?.dosesPratiques?.map((dose) => formaterDosePratiqueContextuelle(dose)).join(" ") ?? "", /\bPV\b/i);
  assert.equal(medicament?.treatmentDurationDays, 3);
  assert.equal(medicament?.voie, "IV / IM / SC");
  assert.equal(medicament?.repeatCondition, "renouvellement interdit");
  assert.equal(medicament?.doseSourceConflict, false);
  assert.deepEqual(medicament?.withdrawalPeriods, { meatDays: 3, offalDays: 3, milkDays: 2 });
});
