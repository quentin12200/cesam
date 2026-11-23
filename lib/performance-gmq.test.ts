import test from "node:test";
import assert from "node:assert/strict";
import { calculerGmq, comparerGmqParPere } from "./performance-gmq";

const p = (date: string, poids: number) => ({ date: new Date(date), poids });
test("GMQ uses elapsed time between first and last weighings, not calf age", () => {
  assert.equal(calculerGmq([p("2026-01-10",100),p("2026-02-09",130)]),1000);
  assert.equal(calculerGmq([p("2026-02-09",130),p("2026-01-10",100)]),1000);
});
test("GMQ excludes missing, same-date or invalid weights", () => {
  assert.equal(calculerGmq([]),null);
  assert.equal(calculerGmq([p("2026-01-10",100)]),null);
  assert.equal(calculerGmq([p("2026-01-10",100),p("2026-01-10",130)]),null);
  assert.equal(calculerGmq([p("2026-01-10",NaN),p("2026-02-10",130)]),null);
});
test("father comparisons average calves, count valid calves, and omit unknown fathers", () => {
  assert.deepEqual(comparerGmqParPere([
    {pereNom:"A",gmq:1000},{pereNom:"A",gmq:1200},{pereNom:"B",gmq:1300},
    {pereNom:"A",gmq:null},{pereNom:null,gmq:9999}
  ]),[
    {pereNom:"B",nombreVeaux:1,gmqMoyen:1300},
    {pereNom:"A",nombreVeaux:2,gmqMoyen:1100}
  ]);
});
