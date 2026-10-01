import assert from "node:assert/strict";
import test from "node:test";
import {
  gestationIdAEnregistrer,
  nutravsSelectionnes,
  regrouperActesVaccinaux,
  vaccinationAppartientAuCycleCourant,
} from "./vaccination-session.ts";

test("une sélection partielle transmet exactement les sept animaux cochés", () => {
  const lignes = Array.from({ length: 19 }, (_, index) => ({ animalId: `animal-${index + 1}`, nutrav: String(7500 + index) }));
  const selection = new Set(lignes.slice(0, 7).map((ligne) => ligne.animalId));
  assert.deepEqual(nutravsSelectionnes(lignes, selection), lignes.slice(0, 7).map((ligne) => ligne.nutrav));
});

test("aucune sélection ne transmet aucun animal", () => {
  assert.deepEqual(nutravsSelectionnes([{ animalId: "animal-1", nutrav: "7505" }], new Set()), []);
});

test("une étape non VELAGE conserve la gestation d'un protocole lié au vêlage", () => {
  const etapes = [
    { id: "avant-velage", reference: "VELAGE" },
    { id: "rappel", reference: "ETAPE_PRECEDENTE" },
  ];
  const gestationId = gestationIdAEnregistrer(etapes, "gestation-courante");

  assert.equal(gestationId, "gestation-courante");
  assert.equal(vaccinationAppartientAuCycleCourant(true, gestationId, "gestation-courante"), true);
  assert.equal(vaccinationAppartientAuCycleCourant(true, null, "gestation-courante"), false);
});

test("un protocole sans repère VELAGE n'enregistre pas de gestation", () => {
  assert.equal(gestationIdAEnregistrer([{ reference: "AGE" }], "gestation-courante"), null);
});

test("la vérification regroupe les actes par médicament et étape sans mélanger les animaux", () => {
  const actes = [
    { animalId: "7518", medicamentId: "bovigrip", etapeId: "primo" },
    { animalId: "7515", medicamentId: "bovigrip", etapeId: "primo" },
    { animalId: "7494", medicamentId: "bovigrip", etapeId: "rappel" },
    { animalId: "7502", medicamentId: "nasym", etapeId: "injection-2" },
  ];
  const groupes = regrouperActesVaccinaux(actes, (acte) => acte.medicamentId, (acte) => acte.etapeId);

  assert.deepEqual(groupes.map((groupe) => ({
    cle: groupe.cle,
    animaux: groupe.actes.map((acte) => acte.animalId),
  })), [
    { cle: "bovigrip|primo", animaux: ["7518", "7515"] },
    { cle: "bovigrip|rappel", animaux: ["7494"] },
    { cle: "nasym|injection-2", animaux: ["7502"] },
  ]);
});
