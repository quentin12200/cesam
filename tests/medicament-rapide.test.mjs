import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
test("création temporaire sans unité inventée et recherche de doublons",()=>{
 const api=read("app/api/medicaments/route.ts");
 assert.match(api,/temporaire === true \? null/);
 assert.match(api,/existants.find/);
 assert.match(read("app/sanitaire/nouvel-evenement/MedicamentPicker.tsx"),/temporaire:true/);
});
test("sorties : délai inconnu sans limite de temps ni confirmation de contournement",()=>{
 for(const p of ["app/api/sorties/route.ts","app/api/sorties/[id]/route.ts","app/api/traitements/attente/route.ts"]){
 const c=read(p);assert.match(c,/delaisInconnus/);assert.doesNotMatch(c,/subDays\(/);
 }
 assert.match(read("app/api/traitements/[id]/route.ts"),/confirmeDelais !== true/);
});
test("alerte persistante et correction par acte",()=>{
 assert.match(read("app/pharmacie/PharmacieClient.tsx"),/provisoires.length/);
 assert.match(read("app/pharmacie/[id]/MedicamentFicheClient.tsx"),/RegulariserActe/);
 assert.match(read("app/sanitaire/vaccins/TableauVaccinal.tsx"),/MedicamentPicker allowQuickCreate/);
});
