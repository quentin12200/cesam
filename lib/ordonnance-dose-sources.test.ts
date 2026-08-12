import assert from "node:assert/strict";
import test from "node:test";
import {
  formaterDoseSource,
  resoudreSourcesDose,
} from "./ordonnance-dose-sources.ts";
import { controlerCoherenceDosePharmacie } from "./ordonnance-display.ts";

const base = {
  doseValue: "",
  doseUnit: "",
  referenceValue: "",
  referenceUnit: "",
  referenceType: "live_weight",
};

test("conserve 20 mg/kg comme dose pharmacologique indivisible", () => {
  const resolution = resoudreSourcesDose({
    ...base,
    doseValue: "20",
    doseUnit: "mg",
    referenceValue: "1",
    referenceUnit: "kg",
    doseSourceText: "20 mg d’oxytétracycline par kg de poids vif",
  });
  assert.equal(formaterDoseSource(resolution.dosePharmacologique), "20 mg / 1 kg");
  assert.equal(resolution.dosePratique, null);
  assert.equal(resolution.sourceHybrideDetectee, false);
});

test("conserve 1 ml pour 10 kg comme dose pratique indivisible", () => {
  const resolution = resoudreSourcesDose({
    ...base,
    doseValue: "1",
    doseUnit: "ml",
    referenceValue: "10",
    referenceUnit: "kg",
    doseSourceText: "1 ml de solution pour 10 kg de poids vif",
  });
  assert.equal(formaterDoseSource(resolution.dosePratique), "1 ml / 10 kg");
  assert.equal(resolution.dosePharmacologique, null);
  assert.equal(resolution.sourceHybrideDetectee, false);
});

test("separe les deux expressions du cas Tenaline et rejette le tuple hybride", () => {
  const resolution = resoudreSourcesDose({
    ...base,
    doseValue: "20",
    doseUnit: "mg",
    referenceValue: "10",
    referenceUnit: "kg",
    doseSourceText: "20 mg d’oxytétracycline par kg de poids vif, soit 1 ml de solution pour 10 kg de poids vif",
  });
  assert.equal(formaterDoseSource(resolution.dosePratique), "1 ml / 10 kg");
  assert.equal(formaterDoseSource(resolution.dosePharmacologique), "20 mg / 1 kg");
  assert.equal(formaterDoseSource(resolution.doseAffichee), "1 ml / 10 kg");
  assert.equal(resolution.sourceHybrideDetectee, true);
  assert.notEqual(formaterDoseSource(resolution.doseAffichee), "20 mg / 10 kg");
});

test("retrouve deux doses dans deux preuves du meme medicament sans les melanger", () => {
  const resolution = resoudreSourcesDose({
    ...base,
    doseValue: "20",
    doseUnit: "mg",
    referenceValue: "10",
    referenceUnit: "kg",
    doseSourceText: "20 mg d’oxytétracycline par kg de poids vif",
    doseSourceTexts: ["1 ml de solution injectable pour 10 kg de poids vif"],
  });
  assert.equal(formaterDoseSource(resolution.dosePratique), "1 ml / 10 kg");
  assert.equal(formaterDoseSource(resolution.dosePharmacologique), "20 mg / 1 kg");
  assert.equal(formaterDoseSource(resolution.doseAffichee), "1 ml / 10 kg");
  assert.equal(resolution.sourceHybrideDetectee, true);
  assert.notEqual(formaterDoseSource(resolution.doseAffichee), "20 mg / 10 kg");
});

test("une correction humaine reste prioritaire sur les anciennes preuves OCR", () => {
  const resolution = resoudreSourcesDose({
    ...base,
    doseValue: "2",
    doseUnit: "ml",
    referenceValue: "10",
    referenceUnit: "kg",
    doseSourceText: "20 mg/kg, soit 1 ml pour 10 kg",
    correctionManuelle: true,
  });
  assert.equal(formaterDoseSource(resolution.doseAffichee), "2 ml / 10 kg");
  assert.equal(resolution.sourceHybrideDetectee, false);
});

test("les deux doses Tenaline separees ne creent pas un avertissement", () => {
  const resolution = resoudreSourcesDose({
    ...base,
    doseValue: "20",
    doseUnit: "mg",
    referenceValue: "10",
    referenceUnit: "kg",
    doseSourceText: "20 mg/kg, soit 1 ml pour 10 kg",
  });
  const controle = controlerCoherenceDosePharmacie(resolution, {
    id: "MED-0095-TENALINE_L_A",
    nom: "Ténaline L.A.",
    dci: "Oxytétracycline",
    forme: "Solution injectable",
    categorie: "ANTIBIOTIQUE",
    categorieLabel: "Antibiotique",
    voie: "IM",
    delaiAttenteViandeJ: 21,
    delaiAttenteLaitJ: 14,
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
    score: 1,
    concordances: [],
    divergences: [],
  });
  assert.equal(controle.avertissement, false);
  assert.equal(controle.detail, null);
  assert.equal(formaterDoseSource(resolution.doseAffichee), "1 ml / 10 kg");
});

test("reconnait 10 ml pour 100 kg comme equivalent a 1 ml pour 10 kg", () => {
  const resolution = resoudreSourcesDose({
    ...base,
    doseValue: "1",
    doseUnit: "ml",
    referenceValue: "10",
    referenceUnit: "kg",
    doseSourceText: "1 ml pour 10 kg",
  });
  const controle = controlerCoherenceDosePharmacie(resolution, {
    id: "med", nom: "Ténaline", dci: null, forme: null, categorie: "ANTIBIOTIQUE",
    categorieLabel: "Antibiotique", voie: "IM", delaiAttenteViandeJ: 21,
    delaiAttenteLaitJ: 14, score: 1, concordances: [], divergences: [],
    preconisations: [{
      dose: 10, unite: "ml", doseBase: "100KG", voie: "IM", frequence: null,
      delaiAttenteViandeJ: 21, delaiAttenteLaitTraites: 14, statut: "VALIDE",
    }],
  });
  assert.deepEqual(controle, { avertissement: false, detail: null });
});

test("une preconisation Pharmacie a verifier ne cree pas seule un avertissement", () => {
  const resolution = resoudreSourcesDose({
    ...base,
    doseValue: "1",
    doseUnit: "ml",
    referenceValue: "10",
    referenceUnit: "kg",
    doseSourceText: "1 ml pour 10 kg",
  });
  const controle = controlerCoherenceDosePharmacie(resolution, {
    id: "med", nom: "Ténaline", dci: null, forme: null, categorie: "ANTIBIOTIQUE",
    categorieLabel: "Antibiotique", voie: "IM", delaiAttenteViandeJ: 21,
    delaiAttenteLaitJ: 14, score: 1, concordances: [], divergences: [],
    preconisations: [{
      dose: 10, unite: "ml", doseBase: "100KG", voie: "IM", frequence: null,
      delaiAttenteViandeJ: 21, delaiAttenteLaitTraites: 14, statut: "A_VERIFIER",
    }],
  });
  assert.deepEqual(controle, { avertissement: false, detail: null });
});

test("signale une vraie contradiction avec une preconisation Pharmacie validee", () => {
  const resolution = resoudreSourcesDose({
    ...base,
    doseValue: "1",
    doseUnit: "ml",
    referenceValue: "10",
    referenceUnit: "kg",
    doseSourceText: "1 ml pour 10 kg",
  });
  const controle = controlerCoherenceDosePharmacie(resolution, {
    id: "med", nom: "Produit", dci: null, forme: null, categorie: "AUTRE",
    categorieLabel: "Autre", voie: "IM", delaiAttenteViandeJ: null,
    delaiAttenteLaitJ: null, score: 1, concordances: [], divergences: [],
    preconisations: [{
      dose: 20, unite: "ml", doseBase: "100KG", voie: "IM", frequence: null,
      delaiAttenteViandeJ: null, delaiAttenteLaitTraites: null, statut: "VALIDE",
    }],
  });
  assert.equal(controle.avertissement, true);
  assert.match(controle.detail ?? "", /diffère/);
});
