import test from "node:test";
import assert from "node:assert/strict";
import { dansImpression, periodeValide } from "./carnet-periode-impression.ts";

const date = (v: string) => new Date(v + "T12:00:00Z");
test("période personnalisée inclut les deux bornes", () => {
  const choix = { mode: "periode" as const, annee: 2026, mois: null, du: "2026-01-01", au: "2026-12-31" };
  assert.equal(periodeValide(choix), true);
  assert.equal(dansImpression(date("2026-01-01"), choix), true);
  assert.equal(dansImpression(date("2026-12-31"), choix), true);
  assert.equal(dansImpression(date("2025-12-31"), choix), false);
  assert.equal(dansImpression(date("2027-01-01"), choix), false);
});
test("mois affiché et année complète", () => {
  assert.equal(dansImpression(date("2026-11-20"), { mode: "mois", annee: 2026, mois: 11 }), true);
  assert.equal(dansImpression(date("2026-10-20"), { mode: "mois", annee: 2026, mois: 11 }), false);
  assert.equal(dansImpression(date("2026-10-20"), { mode: "annee", annee: 2026, mois: 11 }), true);
  assert.equal(dansImpression(date("2025-10-20"), { mode: "annee", annee: 2026, mois: 11 }), false);
});
test("refuser les dates inversées ou invalides", () => {
  assert.equal(periodeValide({ mode: "periode", annee: 2026, mois: null, du: "2026-12-31", au: "2026-01-01" }), false);
  assert.equal(periodeValide({ mode: "periode", annee: 2026, mois: null, du: "2026-02-30", au: "2026-12-31" }), false);
});
