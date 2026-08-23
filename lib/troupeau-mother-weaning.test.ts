import assert from "node:assert/strict";
import test from "node:test";
import { getMotherWeaningDisplay } from "./troupeau-mother-weaning.ts";

test("affiche le numéro de la mère connue et Non sevrée", () => {
  assert.deepEqual(getMotherWeaningDisplay({ motherNutrav: "7142", sevreFait: false, birthDate: "2026-01-01", now: new Date("2026-08-23") }), {
    motherLabel: "7142",
    statusLabel: "Non sevré",
    weaned: false,
  });
});

test("affiche un tiret quand la mère est inconnue", () => {
  assert.deepEqual(getMotherWeaningDisplay({ motherNutrav: null, sevreFait: false, birthDate: "2026-01-01", now: new Date("2026-08-23") }), {
    motherLabel: "—",
    statusLabel: "Non sevré",
    weaned: false,
  });
});

test("ne montre aucun statut pour un animal sevré", () => {
  assert.deepEqual(getMotherWeaningDisplay({ motherNutrav: "7142", sevreFait: true, birthDate: "2026-01-01", now: new Date("2026-08-23") }), {
    motherLabel: "7142",
    statusLabel: null,
    weaned: true,
  });
});

test("considère un animal d’un an ou plus comme sevré malgré une ancienne donnée incomplète", () => {
  assert.deepEqual(getMotherWeaningDisplay({ motherNutrav: "7142", sevreFait: false, birthDate: "2025-08-23", now: new Date("2026-08-23") }), {
    motherLabel: "7142",
    statusLabel: null,
    weaned: true,
  });
});
