import assert from "node:assert/strict";
import test from "node:test";
import { getVaccinProtocolSteps, isMheVendable, type ProtocoleVaccinConfig } from "./utils.ts";
import { unifierActesVaccinaux } from "./vaccine-acts.ts";

// Reproduit le protocole réel "BOVILIS BOVIGRIP" (primo simple, pas de rappel configuré ici).
const protocoleBovigrip: ProtocoleVaccinConfig = {
  id: "proto-bovigrip", nom: "BOVILIS BOVIGRIP", label: "Bovilis Bovigrip", ordre: 1,
  ageMinJours: 0, urgenceJours: 7, estRappel: false, primoNom: null,
  delaiRappelJours: null, urgenceRappelJours: null, obligatoireVente: false,
  voiePrimo: "SC", voieRappel: "SC", rappelAnnuel: false, actif: true,
};

test("la fiche animal reconnaît un Bovigrip saisi uniquement en Traitement comme fait (pas 'en retard')", () => {
  const danais = new Date("2026-06-21T12:00:00Z"); // veau né il y a plus de 90 jours
  const acteFusionne = unifierActesVaccinaux([], [
    { dateDebut: new Date("2026-09-21T12:00:00Z"), medicamentNom: "BOVILIS BOVIGRIP", medicamentId: "med-bovigrip" },
  ]);

  // Avant le correctif, animal.vaccinations (table Vaccination seule) est vide : le bug reproduit.
  const avantCorrectif = getVaccinProtocolSteps(danais, [], [protocoleBovigrip]);
  assert.equal(avantCorrectif[0].status, "due");
  assert.equal(avantCorrectif[0].isUrgent, true, "reproduit bien le bug initial : En retard — à faire maintenant");

  const apresCorrectif = getVaccinProtocolSteps(danais, acteFusionne, [protocoleBovigrip]);
  assert.equal(apresCorrectif[0].status, "done");
  assert.equal(apresCorrectif[0].isUrgent, false);
  assert.equal(apresCorrectif[0].doneDate?.toISOString(), "2026-09-21T12:00:00.000Z");
});

test("un Bovigrip saisi via Vaccination structurée reste reconnu comme fait (non régression)", () => {
  const danais = new Date("2026-06-21T12:00:00Z");
  const acteFusionne = unifierActesVaccinaux(
    [{ date: new Date("2026-09-21T12:00:00Z"), vaccin: "BOVILIS BOVIGRIP", medicamentId: "med-bovigrip", protocoleId: null, etapeProtocoleId: null, gestationId: null, statut: "FAIT" }],
    []
  );
  const steps = getVaccinProtocolSteps(danais, acteFusionne, [protocoleBovigrip]);
  assert.equal(steps[0].status, "done");
});

test("MHE vendable même quand primo et rappel ont été saisis en Traitement, pas en Vaccination", () => {
  const acteFusionne = unifierActesVaccinaux([], [
    { dateDebut: new Date("2026-01-01T12:00:00Z"), medicamentNom: "MHE", medicamentId: "med-mhe" },
    { dateDebut: new Date("2026-01-22T12:00:00Z"), medicamentNom: "MHE_RAPPEL", medicamentId: "med-mhe-rappel" },
  ]);
  const avantCorrectif = isMheVendable([]);
  assert.equal(avantCorrectif.vendable, false, "reproduit bien le bug initial");

  const apresCorrectif = isMheVendable(acteFusionne);
  assert.equal(apresCorrectif.vendable, true);
});
