import {test} from "node:test";
import assert from "node:assert/strict";
import {buildEchoRecap} from "./echo-recap.ts";
test("pleines et vides, sans saillie, sans doublons de demandes",()=>{
 const a={id:"a",nutrav:"12",nobovi:"Fictive A"},b={id:"b",nutrav:"2",nobovi:null},c={id:"c",nutrav:"3",nobovi:"Fictive C"};
 const rows=buildEchoRecap([{id:"g1",resultatEcho:"PLEINE",joursGestation:80,saillie:{animal:a}},{id:"g2",resultatEcho:"VIDE",joursGestation:40,saillie:{animal:c}}],[{id:"r1",animal:a},{id:"r2",animal:b},{id:"r3",animal:b}]);
 assert.deepEqual(rows.map(r=>[r.number,r.result,r.days]),[["2","VIDE",null],["3","VIDE",null],["12","PLEINE",80]]);
});
test("liste vide",()=>assert.deepEqual(buildEchoRecap([],[]),[]));

test("métadonnées du rapport et observation négative",()=>{const a={id:"a",nutrav:"12",nobovi:"Fictive"},b={id:"b",nutrav:"13",nobovi:null};const date=new Date("2026-11-26");const rows=buildEchoRecap([{id:"g",resultatEcho:"PLEINE",joursGestation:90,dateEcho:date,observationEcho:"Contrôle",saillie:{id:"s",animal:a,taureau:{id:"t",nopere:"Fictif",nupere:"123"}}}],[{id:"r",animal:b,clotureeAt:date,observation:"Vide"}]);assert.equal(rows[0].bull,"Fictif");assert.equal(rows[0].saillieId,"s");assert.equal(rows[0].date,date);assert.equal(rows[1].observation,"Vide");assert.equal(rows[1].saillieId,null);});
