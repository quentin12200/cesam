import assert from "node:assert/strict";
import test from "node:test";
import {
  apercuConditionnement,
  conditionnementCanonique,
  evidenceAvecConditionnementCorrige,
  extraireConditionnementDepuisTexte,
  resoudreConditionnementStructure,
} from "./ordonnance-packaging.ts";

test("cas A : conserve conditionnement, quantite et doses HIPRABOVIS sans prendre la posologie", () => {
  const structure = resoudreConditionnementStructure({
    conditionnement: null,
    sourceTexts: [
      "HIPRABOVIS SOMNI LKT FL.50ML(10D.)",
      "Qté : 3",
      "2 ml IM",
    ],
  });

  assert.deepEqual(structure, {
    deliveredQuantity: 3,
    containerType: "flacon",
    contentValue: 50,
    contentUnit: "ml",
    dosesPerContainer: 10,
    sourceText: "HIPRABOVIS SOMNI LKT FL.50ML(10D.)",
    needsVerification: false,
    rawContainerType: null,
  });
  assert.equal(conditionnementCanonique(structure), "3 flacon de 50 ml · 10 doses");
  assert.deepEqual(apercuConditionnement(structure), {
    ligne: "3 × flacons 50 mL · 10 doses chacun",
    totalDoses: "30 doses au total",
  });
  assert.equal(extraireConditionnementDepuisTexte("Administrer 2 ml IM"), null);
});

test("cas B : un vrai flacon de 2 ml reste distinct de la dose de 2 ml", () => {
  const structure = resoudreConditionnementStructure({
    sourceTexts: ["FL.2ML(1D.)", "Qté 1", "Administrer 2 ml"],
  });

  assert.equal(structure.containerType, "flacon");
  assert.equal(structure.contentValue, 2);
  assert.equal(structure.contentUnit, "ml");
  assert.equal(structure.dosesPerContainer, 1);
  assert.equal(structure.deliveredQuantity, 1);
  assert.equal(apercuConditionnement(structure).ligne, "1 × flacon 2 mL · 1 dose");
});

test("cas C : lit une quantite prefixee et un sachet de 100 g", () => {
  const structure = resoudreConditionnementStructure({ conditionnement: "2 SACH.100G" });
  assert.equal(structure.deliveredQuantity, 2);
  assert.equal(structure.containerType, "sachet");
  assert.equal(structure.contentValue, 100);
  assert.equal(structure.contentUnit, "g");
  assert.equal(apercuConditionnement(structure).ligne, "2 × sachets 100 g");
});

test("cas D : normalise les variantes typographiques du meme flacon", () => {
  for (const source of [
    "FL.50ML(10D.)",
    "FL 50ML (10D)",
    "FL. 50 ML 10 D.",
    "flacon 50 ml 10 doses",
  ]) {
    const structure = resoudreConditionnementStructure({ conditionnement: source });
    assert.equal(structure.containerType, "flacon", source);
    assert.equal(structure.contentValue, 50, source);
    assert.equal(structure.contentUnit, "ml", source);
    assert.equal(structure.dosesPerContainer, 10, source);
  }
});

test("cas E : un contenant OCR douteux reste Autre et a verifier", () => {
  const structure = resoudreConditionnementStructure({ conditionnement: "PRESENTOIR 15ML" });
  assert.equal(structure.containerType, "autre");
  assert.equal(structure.contentValue, 15);
  assert.equal(structure.contentUnit, "ml");
  assert.equal(structure.needsVerification, true);
  assert.equal(structure.rawContainerType, "PRESENTOIR");
});

test("une correction manuelle remplace uniquement la preuve de presentation", () => {
  const evidenceJson = evidenceAvecConditionnementCorrige(
    JSON.stringify({
      presentation: { value: { containerType: "flacon", volumeValue: 2, volumeUnit: "ml" } },
      dose: { value: "2 ml", sourceText: "Administrer 2 ml", confidence: 0.98 },
    }),
    "3 flacon de 50 ml · 10 doses",
  );
  const evidence = JSON.parse(evidenceJson ?? "{}");
  assert.deepEqual(evidence.presentation.value, {
    containerType: "flacon",
    volumeValue: 50,
    volumeUnit: "ml",
    dosesPerContainer: 10,
    deliveredQuantity: 3,
  });
  assert.equal(evidence.presentation.zone, "correction_manuelle");
  assert.equal(evidence.deliveredQuantity.value, 3);
  assert.equal(evidence.dose.value, "2 ml");
});
