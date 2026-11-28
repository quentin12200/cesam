import {test} from "node:test";
import assert from "node:assert/strict";
import {normaliserUniteDose,lireDose,doseValide} from "./dose-units.ts";
test("unités et synonymes sans conversion de quantité",()=>{
 for(const [a,b] of [["cc","ml"],["ML","ml"],["cp","comprimé"],["comprimé","comprimé"],["L","L"],["UI","UI"],["bolus","bolus"],["ml/kg",""],["inconnue",""]]) assert.equal(normaliserUniteDose(a),b);
});
test("décimales françaises et valeurs invalides",()=>{
 for(const s of ["2,5","2.5"," 2,5 "]) assert.equal(lireDose(s),2.5);
 for(const s of ["","0","-2","2 ml","2,5.1","1e3","NaN","Infinity"]) assert.equal(lireDose(s),null);
 assert.equal(doseValide("2,5",""),false);
 assert.equal(doseValide("2,5","cc"),true);
 assert.equal(doseValide("",""),true);
});
