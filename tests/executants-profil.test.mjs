import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
test("profil partagé après hydratation, choix manuel prioritaire",()=>{
 const provider=read("components/UserPreferencesProvider.tsx");
 assert.match(provider,/context\?\.ready \? context\.profile : ""/);
 for(const p of ["app/sanitaire/vaccins/TableauVaccinal.tsx","app/troupeau/[nutrav]/TraitementForm.tsx"]) assert.match(read(p),/executantChoisi \|\| profilExecutant/);
 const event=read("app/sanitaire/nouvel-evenement/NouvelEvenementForm.tsx");
 assert.match(event,/d\.executant \|\| profilExecutant/);
 assert.doesNotMatch(event,/Constaté par|setConstatePar/);
});
test("ordre des profils, intervenants et enregistrement individuel",()=>{
 const select=read("app/sanitaire/nouvel-evenement/ExecutantSelect.tsx");
 assert.match(select,/profile === "Samuel" \? \["Samuel", "Céline"\] : \["Céline", "Samuel"\]/);
 assert.match(select,/localeCompare\(b,"fr"\)/);
 assert.match(select,/fetch\("\/api\/intervenants"/);
 assert.match(read("app/api/traitements/route.ts"),/executant: typeof executant === "string"/);
});
