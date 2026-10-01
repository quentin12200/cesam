import assert from "node:assert/strict";
import test from "node:test";
import { comparerUrgenceVaccinale, formatTempsAvantVelage, type CelluleVaccinaleTri } from "./vaccine-table-presentation.ts";

test("le tri vaccinal place retard, bientôt, à faire puis sans échéance", () => {
  const cellules: CelluleVaccinaleTri[] = [
    { statut: "VIDE", date: null },
    { statut: "A_FAIRE", date: "2026-12-01T00:00:00.000Z" },
    { statut: "EN_RETARD", date: "2026-09-01T00:00:00.000Z" },
    { statut: "BIENTOT", date: "2026-10-15T00:00:00.000Z" },
  ];
  assert.deepEqual(cellules.sort(comparerUrgenceVaccinale).map((cellule) => cellule.statut), ["EN_RETARD", "BIENTOT", "A_FAIRE", "VIDE"]);
});

test("à urgence égale, l'échéance la plus proche vient en premier", () => {
  const proche = { statut: "A_FAIRE", date: "2026-10-10T00:00:00.000Z" } as const;
  const loin = { statut: "A_FAIRE", date: "2026-11-10T00:00:00.000Z" } as const;
  assert.ok(comparerUrgenceVaccinale(proche, loin) < 0);
});

test("le temps avant vêlage est lisible en jours puis en mois", () => {
  const reference = new Date("2026-10-01T12:00:00Z");
  assert.equal(formatTempsAvantVelage("2026-10-19T12:00:00Z", reference), "J-18");
  assert.equal(formatTempsAvantVelage("2026-12-13T12:00:00Z", reference), "2 m 12 j");
  assert.equal(formatTempsAvantVelage("2027-01-01T12:00:00Z", reference), "3 m");
});
