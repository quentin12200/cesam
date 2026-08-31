import assert from "node:assert/strict";
import test from "node:test";
import { statutPlanningVaccin } from "./vaccine-planning-status.ts";

const utc = (value: string) => new Date(`${value}T12:00:00.000Z`);
const debut = utc("2026-09-10");
const fin = utc("2026-09-20");

test("le planning vaccinal suit bleu jaune vert orange rouge", () => {
  assert.equal(statutPlanningVaccin(utc("2026-09-02"), debut, fin), "TROP_TOT");
  assert.equal(statutPlanningVaccin(utc("2026-09-03"), debut, fin), "A_PREVOIR");
  assert.equal(statutPlanningVaccin(utc("2026-09-10"), debut, fin), "A_FAIRE");
  assert.equal(statutPlanningVaccin(utc("2026-09-20"), debut, fin), "A_FAIRE");
  assert.equal(statutPlanningVaccin(utc("2026-09-21"), debut, fin), "EN_RETARD_LEGER");
  assert.equal(statutPlanningVaccin(utc("2026-09-23"), debut, fin), "EN_RETARD_LEGER");
  assert.equal(statutPlanningVaccin(utc("2026-09-24"), debut, fin), "EN_RETARD");
});
