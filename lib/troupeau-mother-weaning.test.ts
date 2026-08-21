import assert from "node:assert/strict";
import test from "node:test";
import { getMotherWeaningDisplay } from "./troupeau-mother-weaning.ts";

test("affiche le numéro de la mère connue et Non sevrée", () => {
  assert.deepEqual(getMotherWeaningDisplay({ motherNutrav: "7142", sevreFait: false, dateSevrage: null }), {
    motherLabel: "7142",
    statusLabel: "Non sevrée",
    weaned: false,
  });
});

test("affiche un tiret quand la mère est inconnue", () => {
  assert.deepEqual(getMotherWeaningDisplay({ motherNutrav: null, sevreFait: false, dateSevrage: null }), {
    motherLabel: "—",
    statusLabel: null,
    weaned: null,
  });
});

test("affiche Sevrée et sa date lorsqu’elle existe", () => {
  const result = getMotherWeaningDisplay({ motherNutrav: "7142", sevreFait: true, dateSevrage: "2026-08-21T12:00:00.000Z" });
  assert.equal(result.motherLabel, "7142");
  assert.match(result.statusLabel ?? "", /^Sevrée · 21\/08\/2026$/);
  assert.equal(result.weaned, true);
});
