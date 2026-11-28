import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
test("trois formulaires partagent les mêmes sélecteurs et validation serveur",()=>{
 for(const path of ["app/pharmacie/[id]/MedicamentFicheClient.tsx","app/pharmacie/[id]/MedicamentDetailClient.tsx","app/pharmacie/PharmacieClient.tsx"]){
 const s=read(path);for(const type of ["DCI","CATEGORIE","VOIE"])assert.match(s,new RegExp('MedicamentReferenceSelect type="'+type+'"'));assert.match(s,/referencesControlees:true/);}
 for(const path of ["app/api/medicaments/route.ts","app/api/medicaments/[id]/route.ts"])assert.match(read(path),/verifierReferences/);
 assert.match(read("app/api/pharmacie/referentiels/route.ts"),/upsert/);
});
