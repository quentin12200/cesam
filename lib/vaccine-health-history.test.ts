import assert from "node:assert/strict";
import test from "node:test";
import { unifierActesVaccinaux } from "./vaccine-acts.ts";
import { construireHistoriqueVaccinalSante } from "./vaccine-health-history.ts";

test("la fiche Santé expose une vraie Vaccination datée avec ses informations réelles", () => {
  const date = new Date("2026-10-12T10:00:00Z");
  const actes = unifierActesVaccinaux([{
    sourceId: "vaccination-1", date, vaccin: "BOVILIS CRYPTIUM", medicamentId: "med-cryptium",
    protocoleId: "protocole", etapeProtocoleId: "entretien", etapeLabel: "Entretien",
    gestationId: "gestation", statut: "FAIT", voie: "SC", dose: 2, uniteDosage: "ml",
  }], []);
  assert.deepEqual(construireHistoriqueVaccinalSante(actes), [{
    sourceType: "VACCINATION", sourceId: "vaccination-1", date, medicament: "BOVILIS CRYPTIUM",
    etape: "Entretien", voie: "SC", dose: 2, unite: "ml",
  }]);
});

test("un statut de protocole sans acte réel ne crée aucune ligne Santé", () => {
  assert.deepEqual(construireHistoriqueVaccinalSante([]), []);
});

test("Vaccination legacy + Traitement réel du même jour restent une seule ligne Santé", () => {
  const date = new Date("2025-10-15T12:00:00Z");
  const actes = unifierActesVaccinaux(
    [{ sourceId: "v1", date, vaccin: "Legacy", medicamentId: null, protocoleId: "legacy", etapeProtocoleId: null, gestationId: null, statut: "FAIT" }],
    [{ id: "t1", dateDebut: date, medicamentNom: "VACCIN RÉEL", medicamentId: "med-1", voie: "SC", dose: 2, uniteDosage: "ml" }],
  );
  assert.equal(construireHistoriqueVaccinalSante(actes).length, 1);
});
