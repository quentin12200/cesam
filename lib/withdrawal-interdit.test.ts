import {test} from "node:test";
import assert from "node:assert/strict";
import {getAttenteInfo, getAttenteInfoForTraitement,delaisInconnus,delaiRenseigne,formatDelai} from "./withdrawal.ts";
test("interdit ne produit aucune date, même des années après",()=>{
 const a=getAttenteInfo(new Date("2020-01-01"),0,-1,new Date("2026-01-01"));
 assert.equal(a.laitInterdit,true);assert.equal(a.dateFinAttenteLait,null);assert.equal(a.enAttenteLait,true);assert.equal(a.enAttenteViande,false);
 const b=getAttenteInfo(new Date("2020-01-01"),-1,0,new Date("2026-01-01"));
 assert.equal(b.viandeInterdite,true);assert.equal(b.dateFinAttenteViande,null);assert.equal(b.enAttenteViande,true);assert.equal(b.enAttenteLait,false);
});
test("interdit, zéro et inconnu distincts",()=>{
 assert.equal(formatDelai(-1),"Interdit");assert.equal(formatDelai(0),"0 j");assert.equal(formatDelai(null),"Inconnu");
 assert.equal(delaiRenseigne(-1),true);assert.equal(delaiRenseigne(-2),false);assert.equal(delaiRenseigne(null),false);
 const a={dateDebut:new Date("2020-01-01"),dureeJours:1,delaiAttenteViandeJ:0,delaiAttenteLaitJ:-1};
 assert.deepEqual(delaisInconnus(a),{viande:false,lait:false});assert.equal(getAttenteInfoForTraitement(a).laitInterdit,true);
});
