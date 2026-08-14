import assert from "node:assert/strict";
import test from "node:test";
import {
  calculerDoseVolumiqueSure,
  choisirBaseAffichageDose,
  dosesPratiquesIncoherentes,
  extraireConcentrationsCalcul,
  extraireDosesPharmacologiquesCalcul,
  extraireDosesPratiquesContextuelles,
  formaterDosePratiqueContextuelle,
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

test("conserve deux doses pratiques adulte et veau sans les fusionner", () => {
  const doses = extraireDosesPratiquesContextuelles([
    "10 ml maximum par jour pour les bovins adultes ; 2 ml pour 40 à 50 kg par jour pour les veaux",
  ]);
  assert.deepEqual(doses.map(formaterDosePratiqueContextuelle), [
    "Max : 10 ml / jour",
    "Veaux : 2 ml / 40–50 kg / jour",
  ]);
  assert.equal(doses[1].poidsMinKg, "40");
  assert.equal(doses[1].poidsMaxKg, "50");
  assert.doesNotMatch(doses.map(formaterDosePratiqueContextuelle).join(" "), /\bPV\b/i);
});

test("ne transfere ni categorie ni poids ni maximum entre deux consignes Diurizone", () => {
  const doses = extraireDosesPratiquesContextuelles([
    "10 ml maximum par jour pour les bovins adultes ; 2 ml pour 40 à 50 kg par jour pour les veaux",
  ]);

  assert.deepEqual(doses.map((dose) => ({
    categorie: dose.categorieAnimaux,
    poidsMinKg: dose.poidsMinKg,
    poidsMaxKg: dose.poidsMaxKg,
    maximum: dose.maximum,
  })), [{
    categorie: "Adultes", poidsMinKg: null, poidsMaxKg: null, maximum: true,
  }, {
    categorie: "Veaux", poidsMinKg: "40", poidsMaxKg: "50", maximum: false,
  }]);
});

test("signale deux posologies contradictoires attribuees aux veaux", () => {
  const doses = [{
    categorieAnimaux: "Veaux", doseValue: "10", doseUnit: "ml", poidsMinKg: "40", poidsMaxKg: "50",
    frequence: "par jour", maximum: true, origine: "ordonnance" as const, sourceText: "bloc OCR", aVerifier: false,
  }, {
    categorieAnimaux: "Veaux", doseValue: "2", doseUnit: "ml", poidsMinKg: "40", poidsMaxKg: "50",
    frequence: "par jour", maximum: true, origine: "ordonnance" as const, sourceText: "bloc OCR", aVerifier: false,
  }];

  assert.equal(dosesPratiquesIncoherentes(doses), true);
});

test("traite une mention maximum comme un plafond distinct de la dose principale", () => {
  const [plafond] = extraireDosesPratiquesContextuelles(["Bovins adultes : 10 ml maximum par jour"]);
  assert.equal(plafond.maximum, true);
  assert.equal(plafond.poidsMinKg, null);
  assert.equal(formaterDosePratiqueContextuelle(plafond), "Max : 10 ml / jour");
});

test("calcule la fourchette adulte Diurizone quand les deux substances concordent", () => {
  const doses = extraireDosesPharmacologiquesCalcul([
    "Dexaméthasone : 0,01 à 0,02 mg/kg",
    "Hydrochlorothiazide : 1 à 2 mg/kg",
  ]);
  const concentrations = extraireConcentrationsCalcul([
    "Dexaméthasone : 0,5 mg/ml ; Hydrochlorothiazide : 50 mg/ml",
  ], true);
  const resultat = calculerDoseVolumiqueSure(doses, concentrations);

  assert.equal(resultat.aVerifier, false);
  assert.equal(formaterDosePratiqueContextuelle({
    ...resultat.dose!, categorieAnimaux: "Adultes", frequence: "par jour",
  }), "Adultes : 2 à 4 ml / 100 kg / jour");
});

test("calcule une dose en ml uniquement avec une concentration fiable de la meme substance", () => {
  const resultat = calculerDoseVolumiqueSure(
    [{ substance: "molécule A", mgParKg: 2 }],
    [{ substance: "Molécule A", mgParMl: 100, fiable: true }],
  );
  assert.equal(formaterDosePratiqueContextuelle(resultat.dose!), "2 ml / 100 kg");
  assert.equal(resultat.aVerifier, false);
});

test("choisit 10 kg ou 100 kg sans modifier la proportion", () => {
  assert.deepEqual(choisirBaseAffichageDose(0.1), { doseMl: 1, poidsKg: 10 });
  assert.deepEqual(choisirBaseAffichageDose(0.02), { doseMl: 2, poidsKg: 100 });
});

test("accepte plusieurs substances seulement lorsque leurs calculs concordent", () => {
  const coherent = calculerDoseVolumiqueSure(
    [{ substance: "A", mgParKg: 2 }, { substance: "B", mgParKg: 4 }],
    [{ substance: "A", mgParMl: 100, fiable: true }, { substance: "B", mgParMl: 200, fiable: true }],
  );
  assert.equal(coherent.dose?.doseValue, "2");
  assert.equal(coherent.aVerifier, false);

  const contradictoire = calculerDoseVolumiqueSure(
    [{ substance: "A", mgParKg: 2 }, { substance: "B", mgParKg: 4 }],
    [{ substance: "A", mgParMl: 100, fiable: true }, { substance: "B", mgParMl: 100, fiable: true }],
  );
  assert.equal(contradictoire.dose, null);
  assert.equal(contradictoire.aVerifier, true);
});

test("n invente aucun calcul sans concentration fiable", () => {
  const resultat = calculerDoseVolumiqueSure(
    [{ substance: "A", mgParKg: 2 }],
    [{ substance: "A", mgParMl: 100, fiable: false }],
  );
  assert.equal(resultat.dose, null);
  assert.equal(resultat.aVerifier, true);
});

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

test("interdit a 20 mg de recuperer la reference d'une dose pratique plus loin", () => {
  const resolution = resoudreSourcesDose({
    ...base,
    doseValue: "20",
    doseUnit: "mg",
    referenceValue: "10",
    referenceUnit: "kg",
    doseSourceText: "20 mg d’oxytétracycline soit 1 ml de solution injectable pour 10 kg de poids vif",
  });

  assert.equal(resolution.dosePharmacologique, null);
  assert.equal(formaterDoseSource(resolution.dosePratique), "1 ml / 10 kg");
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
