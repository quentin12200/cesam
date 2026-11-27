import {test} from "node:test";
import assert from "node:assert/strict";
import {detectFindings} from "./coulisses-diagnostics.ts";
test("historical unnumbered stillborn is not a live-animal anomaly; mixed twins remain distinct",()=>{
 const velage={vacheId:"m",vache:{nutrav:"1000"}};
 const good={id:"d1",statut:"MORT_NE",animalId:null,animal:null,velage};
 const living={id:"d2",statut:"VIVANT",animalId:"a",animal:{nutrav:"2000",mereId:"m",statut:"ACTIF"},velage};
 assert.deepEqual(detectFindings([], [good,living], [], []),[]);
 assert.equal(detectFindings([], [{...living,statut:"MORT_NE"}], [], [])[0].domain,"Effectifs");
});
test("finds stale pregnancy, self-parent and invalid weight without modifying input",()=>{
 const a={id:"a",nutrav:"1000",statut:"ACTIF",danais:new Date("2020-01-01"),mereId:"a",sexbov:"F",reproductionEtatManuel:"VERT",reproductionEtatModifieAt:new Date("2026-01-01"),velagesVache:[{date:new Date("2026-02-01")}],sortie:null};
 const before=structuredClone(a);
 assert.deepEqual(detectFindings([a],[],[{id:"w",poids:0,date:new Date(),animal:a}],[]).map(f=>f.domain),["Reproduction","Filiation","Pesées"]);
 assert.deepEqual(a,before);
 assert.deepEqual(detectFindings([{...a,mereId:null,reproductionEtatModifieAt:new Date("2026-03-01")}],[],[],[]),[]);
});
