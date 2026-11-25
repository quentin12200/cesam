import {test} from "node:test";
import assert from "node:assert/strict";
import {shouldResetReproductionAtCalving, effectiveManualReproduction, automaticReproductionReset} from "../lib/calving-reproduction-reset.ts";
const date=(s:string)=>new Date(s);
test("recent calving clears manual override without permanent rest",()=>{
 assert.equal(shouldResetReproductionAtCalving(date("2026-11-25"),null,date("2026-01-01"),date("2026-11-24")),true);
 assert.equal(automaticReproductionReset.reproductionEtatManuel,null);
 assert.equal(effectiveManualReproduction("VERT",date("2026-11-24"),date("2026-11-25")),null);
});
test("backdated calving preserves subsequent cycle and decision",()=>{
 assert.equal(shouldResetReproductionAtCalving(date("2026-01-01"),null,date("2026-03-01"),null),false);
 assert.equal(shouldResetReproductionAtCalving(date("2026-01-01"),date("2026-02-01"),null,null),false);
 assert.equal(effectiveManualReproduction("VERT",date("2026-03-01"),date("2026-01-01")),"VERT");
});
