import {test} from "node:test";
import assert from "node:assert/strict";
import {delaisInconnus,delaiSaisi,getAttenteInfoForTraitement} from "./withdrawal.ts";
const acte={dateDebut:new Date("2020-01-01"),dureeJours:1,notes:"[DELAIS_A_COMPLETER]",delaiAttenteViandeJ:null,delaiAttenteLaitJ:null,medicament:{delaiAttenteViandeJ:0,delaiAttenteLaitJ:0}};
test("compléter le catalogue ne régularise pas un acte ancien",()=>{
 assert.deepEqual(delaisInconnus(acte),{viande:true,lait:true});
 assert.equal(getAttenteInfoForTraitement(acte).dateFinAttenteViande,null);
});
test("zéro explicite distinct du vide et régularisation indépendante",()=>{
 assert.deepEqual(delaisInconnus({...acte,delaiAttenteViandeJ:0}),{viande:false,lait:true});
 assert.equal(delaiSaisi(0),true);
 for(const v of [null,"",undefined,-1,1.5,"0",NaN])assert.equal(delaiSaisi(v),false);
});
