import assert from "node:assert/strict";
import test from "node:test";
import {
  analyserPresentation,
  estInstructionPratique,
  formaterDose,
  formaterDoseCompacte,
  formaterMedicamentPourListe,
  formaterPresentationCompacte,
  formaterRenouvellement,
  formaterRenouvellementUtile,
  formaterRythme,
  formaterVoie,
  normaliserConditionnementExtrait,
  normaliserConditionnementEnregistre,
  resoudreDosePratique,
} from "./ordonnance-display.ts";

test("distingue la presentation et la quantite delivree", () => {
  assert.deepEqual(analyserPresentation("1 flacon de 100 ml"), {
    presentation: "flacon de 100 ml",
    quantite: 1,
  });
});

test("conserve une presentation sans inventer de quantite", () => {
  assert.deepEqual(analyserPresentation("Flacon 250 ml"), {
    presentation: "Flacon de 250 ml",
    quantite: null,
  });
});

test("affiche la presentation et la quantite sans doublon", () => {
  assert.equal(formaterPresentationCompacte("1 flacon de 100 ml"), "Flacon 100 ml · Qté 1");
  assert.equal(formaterPresentationCompacte("Flacon 250 ml"), "Flacon 250 ml");
});

test("prepare les medicaments de l'ordonnance pour une liste compacte", () => {
  const cas = [
    ["IPALIGO VEAU PÂTE INJ. PRESENTOIR 15 ML", "3 présentoirs de 15 ml", "IPALIGO VEAU PÂTE INJ.", "Présentoir 15 ml", 3],
    ["BOOSTY’VO 1 SER. 15 ML", "5 seringues de 15 ml", "BOOSTY’VO", "Seringue 15 ml", 5],
    ["DOPRAM V 2% INTRANASALE FL. 10 ML", "1 flacon de 10 ml", "DOPRAM V 2% INTRANASALE", "Flacon 10 ml", 1],
    ["HIPRABOVIS SOMNI LKT FL. 10 D.", "4 flacons de 10 doses", "HIPRABOVIS SOMNI LKT", "Flacon 10 doses", 4],
    ["BOVILIS BOVIGRIP FL. 50 ML 10 D.", "4 flacons de 50 ml · 10 doses", "BOVILIS BOVIGRIP", "Flacon 50 ml · 10 doses", 4],
  ] as const;

  for (const [nomExtrait, conditionnement, nom, presentation, quantite] of cas) {
    assert.deepEqual(formaterMedicamentPourListe({ nomExtrait, conditionnement }), {
      nom,
      presentation,
      quantite,
    });
  }
});

test("interprete BT 5 D comme un conditionnement sans inventer de volume", () => {
  assert.equal(formaterPresentationCompacte("BT 5 D."), "Boîte de 5 doses");
  assert.equal(formaterPresentationCompacte("BT 5 D. de 2 ml"), "Boîte de 5 doses de 2 ml");
  assert.doesNotMatch(formaterPresentationCompacte("BT 5 D.") ?? "", /5 ml/i);
});

test("ne transforme jamais un volume initial en quantite delivree", () => {
  assert.deepEqual(analyserPresentation("100 ml"), {
    presentation: "100 ml",
    quantite: null,
  });
  assert.equal(formaterPresentationCompacte("100 ml"), "100 ml");
  assert.notEqual(formaterPresentationCompacte("100 ml"), "Ml · Qté 100");
});

test("reconstruit le flacon et la quantite depuis des preuves explicites", () => {
  const conditionnement = normaliserConditionnementExtrait({
    conditionnement: "100 MI",
    sourceTexts: ["TENALINE LA CLAS SOL INJ FL. 100 ML — Qté : 1"],
  });
  assert.equal(conditionnement, "1 flacon de 100 ml");
  assert.equal(formaterPresentationCompacte(conditionnement), "Flacon 100 ml · Qté 1");
});

test("normalise les variantes compactes d'un flacon de 50 ml et 10 doses", () => {
  for (const conditionnement of [
    "FL.50ML(10D.)",
    "FL. 50 ML (10 D.)",
    "FL 50ML 10D",
    "FL.50 ML 10 D.",
  ]) {
    const normalise = normaliserConditionnementExtrait({ conditionnement });
    assert.equal(formaterPresentationCompacte(normalise), "Flacon 50 ml · 10 doses");
  }
});

test("conserve un vrai flacon de 2 ml sans le confondre avec une dose", () => {
  assert.equal(
    formaterPresentationCompacte(normaliserConditionnementExtrait({ conditionnement: "FL. 2 ML" })),
    "Flacon 2 ml",
  );
  assert.equal(
    formaterPresentationCompacte(normaliserConditionnementExtrait({ conditionnement: "FL.2ML(1D.)" })),
    "Flacon 2 ml · 1 dose",
  );
  assert.match(
    formaterPresentationCompacte(normaliserConditionnementExtrait({ conditionnement: "BT 1 D. FL. 2 ML" })) ?? "",
    /Flacon de 2 ml/i,
  );
  assert.equal(normaliserConditionnementExtrait({ conditionnement: null, sourceTexts: ["Dose : 2 ml"] }), null);
  assert.equal(normaliserConditionnementExtrait({ conditionnement: null, sourceTexts: ["Administrer 2 ml"] }), null);
});

test("priorise la quantite delivree structuree sans confondre volume et nombre de doses", () => {
  const flacon = normaliserConditionnementExtrait({
    conditionnement: "4 FL. 50 ML",
    presentation: { deliveredQuantity: 1 },
  });
  assert.equal(formaterPresentationCompacte(flacon), "Flacon 50 ml · Qté 1");

  const boite = normaliserConditionnementExtrait({
    conditionnement: "BT 5 D.",
    presentation: { deliveredQuantity: 1 },
  });
  assert.equal(formaterPresentationCompacte(boite), "Boîte de 5 doses · Qté 1");
  assert.doesNotMatch(formaterPresentationCompacte(boite) ?? "", /Qté 5/);
});

test("retrouve une quantite historique depuis les preuves enregistrees", () => {
  const conditionnement = normaliserConditionnementEnregistre({
    conditionnement: "Flacon 50 ml",
    evidenceJson: JSON.stringify({
      conditionnement: {
        value: "Flacon 50 ml",
        sourceText: "FL. 50 ML — Délivré ce jour Qté : 1",
      },
    }),
  });
  assert.equal(formaterPresentationCompacte(conditionnement), "Flacon 50 ml · Qté 1");
});

test("separe conditionnement compact, quantite livree et dose d'administration", () => {
  const conditionnement = normaliserConditionnementExtrait({
    conditionnement: "FL.50ML(10D.)",
    presentation: { deliveredQuantity: 1 },
    sourceTexts: ["Administrer 2 ml"],
  });
  assert.equal(formaterPresentationCompacte(conditionnement), "Flacon 50 ml · 10 doses · Qté 1");
  assert.doesNotMatch(conditionnement ?? "", /2 ml/);
  assert.deepEqual(formaterMedicamentPourListe({
    nomExtrait: "HIPRABOVIS SOMNI LKT FL.50ML(10D.)",
    conditionnement,
  }), {
    nom: "HIPRABOVIS SOMNI LKT",
    presentation: "Flacon 50 ml · 10 doses",
    quantite: 1,
  });
});

test("formate la posologie ponderale en une phrase compacte", () => {
  assert.equal(formaterDose({
    doseValue: "1",
    doseUnit: "ml",
    referenceValue: "10",
    referenceUnit: "kg",
    referenceType: "live_weight",
  }), "1 ml pour 10 kg de poids vif");
});

test("rend la voie et le protocole lisibles", () => {
  assert.equal(formaterVoie("IM"), "Intramusculaire");
  assert.equal(formaterRythme({ administrationCount: "1", administrationInstructions: "" }), "Injection unique");
  assert.equal(formaterRenouvellement({ administrationIntervalHours: "72", repeatCondition: "si les signes persistent" }), "Renouvelable après 72 h si les signes persistent");
});

test("privilegie la dose pratique en volume dans le resume", () => {
  const dose = {
    doseValue: "20", doseUnit: "mg", referenceValue: "1", referenceUnit: "kg", referenceType: "live_weight",
    formePharmaceutique: "Solution injectable",
    doseSourceText: "20 mg d'oxytétracycline par kg de poids vif, soit 1 ml pour 10 kg",
  };
  assert.equal(formaterDoseCompacte(dose), "1 ml / 10 kg");
  assert.doesNotMatch(formaterDoseCompacte(dose) ?? "", /20 mg/);
  assert.equal(formaterDose(dose), "20 mg pour 1 kg de poids vif");
});

test("affiche la dose pratique du cas reel Tenaline au lieu de combiner mg et reference volumique", () => {
  const tenaline = {
    doseValue: "20",
    doseUnit: "mg",
    referenceValue: "10",
    referenceUnit: "kg",
    referenceType: "live_weight",
    formePharmaceutique: "Solution injectable",
    doseSourceText: "20 mg d'oxytétracycline par kg de poids vif, soit 1 ml pour 10 kg",
  };
  assert.equal(formaterDoseCompacte(tenaline), "1 ml / 10 kg");
  assert.deepEqual(resoudreDosePratique(tenaline), {
    doseValue: "1",
    doseUnit: "ml",
    referenceValue: "10",
    referenceUnit: "kg",
    referenceType: "live_weight",
  });
});

test("une correction humaine des champs structures prime sur une ancienne preuve OCR", () => {
  assert.equal(formaterDoseCompacte({
    doseValue: "25",
    doseUnit: "mg",
    referenceValue: "1",
    referenceUnit: "kg",
    referenceType: "live_weight",
    formePharmaceutique: "Solution injectable",
    doseSourceText: "20 mg par kg, soit 1 ml pour 10 kg",
    preferStructuredDose: true,
  }), "25 mg / 1 kg");
});

test("une dose pratique structuree prime sur une preuve OCR plus ancienne", () => {
  assert.equal(formaterDoseCompacte({
    doseValue: "2",
    doseUnit: "ml",
    referenceValue: "10",
    referenceUnit: "kg",
    referenceType: "live_weight",
    formePharmaceutique: "Solution injectable",
    doseSourceText: "1 ml pour 10 kg",
    preferStructuredDose: true,
  }), "2 ml / 10 kg");
});

test("n'invente aucune conversion entre mg et ml", () => {
  assert.equal(formaterDoseCompacte({
    doseValue: "20",
    doseUnit: "mg",
    referenceValue: "1",
    referenceUnit: "kg",
    referenceType: "live_weight",
    formePharmaceutique: "Solution injectable",
    doseSourceText: "20 mg par kg de poids vif",
  }), "20 mg / 1 kg");
});

test("ignore une dose pratique issue d'une autre preuve OCR", () => {
  const doseAvecAutrePreuve = {
    doseValue: "20",
    doseUnit: "mg",
    referenceValue: "1",
    referenceUnit: "kg",
    referenceType: "live_weight",
    formePharmaceutique: "Solution injectable",
    doseSourceText: "20 mg par kg de poids vif",
    autreSourceOcr: "1 ml pour 10 kg",
  };
  assert.equal(formaterDoseCompacte(doseAvecAutrePreuve), "20 mg / 1 kg");
});

test("ne transforme pas une consigne pratique en rythme", () => {
  const instruction = "Injection intramusculaire, administrer le flacon en position debout";
  assert.equal(estInstructionPratique(instruction), true);
  assert.equal(formaterRythme({ administrationCount: "", administrationInstructions: instruction }), null);
});

test("evite de repeter l'intervalle de renouvellement", () => {
  const result = formaterRenouvellement({
    administrationIntervalHours: "72",
    repeatCondition: "Renouvelable après 72 heures si nécessaire",
  });
  assert.equal(result, "Renouvelable après 72 h si nécessaire");
  assert.equal((result?.match(/72/g) ?? []).length, 1);
});

test("affiche clairement un renouvellement interdit", () => {
  assert.equal(formaterRenouvellement({
    administrationIntervalHours: "",
    repeatCondition: "renouvellement interdit",
  }), "Renouvellement interdit");
});

test("masque un renouvellement interdit uniquement dans la consultation compacte", () => {
  assert.equal(formaterRenouvellementUtile({
    administrationIntervalHours: "",
    repeatCondition: "renouvellement interdit",
  }), null);
  assert.equal(formaterRenouvellementUtile({
    administrationIntervalHours: "72",
    repeatCondition: "si nécessaire",
  }), "Renouvelable après 72 h si nécessaire");
});

test("retire la dose pharmacologique du renouvellement", () => {
  assert.equal(formaterRenouvellement({
    administrationIntervalHours: "72",
    repeatCondition: "administration une deuxième administration de 20 mg d’oxytétracycline après 72 heures si nécessaire",
  }), "Renouvelable après 72 h si nécessaire");
});
