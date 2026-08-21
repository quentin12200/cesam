import assert from "node:assert/strict";
import test from "node:test";
import { getMotherWeaningDisplay } from "./troupeau-mother-weaning.ts";

test("affiche le numéro de la mère connue et Non sevrée", () => {
  assert.deepEqual(getMotherWeaningDisplay({ motherNutrav: "7142", sevreFait: false }), {
    motherLabel: "7142",
    statusLabel: "Non sevrée",
    weaned: false,
  });
});

test("affiche un tiret quand la mère est inconnue", () => {
  assert.deepEqual(getMotherWeaningDisplay({ motherNutrav: null, sevreFait: false }), {
    motherLabel: "—",
    statusLabel: "Non sevrée",
    weaned: false,
  });
});

test("ne montre aucun statut pour un animal sevré", () => {
  assert.deepEqual(getMotherWeaningDisplay({ motherNutrav: "7142", sevreFait: true }), {
    motherLabel: "7142",
    statusLabel: null,
    weaned: true,
  });
});
