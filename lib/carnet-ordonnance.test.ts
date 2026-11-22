import test from "node:test";
import assert from "node:assert/strict";
import { numeroOrdonnanceCarnet, prescripteurCarnet } from "./carnet-ordonnance.ts";

test("MHE : numéro de l'ordonnance liée affiché si absent de la vaccination",()=>{
 assert.equal(numeroOrdonnanceCarnet(null,{numero:"MHE-2026-014",veterinaireNom:"Dr Martin"}),"MHE-2026-014");
});
test("le numéro saisi sur la vaccination prime sur l'ordonnance liée",()=>{
 assert.equal(numeroOrdonnanceCarnet("MHE-2026-015",{numero:"MHE-2026-014"}),"MHE-2026-015");
});
test("espaces seuls : utilise le repli lié, sans créer de numéro",()=>{
 assert.equal(numeroOrdonnanceCarnet("  ",{numero:"  ORD-38  "}),"ORD-38");
 assert.equal(numeroOrdonnanceCarnet("  ",null),null);
 assert.equal(numeroOrdonnanceCarnet(null,{numero:null}),null);
});
test("aucune ordonnance liée : ne jamais associer une ordonnance par produit/date",()=>{
 assert.equal(numeroOrdonnanceCarnet(undefined,undefined),null);
 assert.equal(prescripteurCarnet(null,undefined),null);
});
test("prescripteur : celui de l'acte est prioritaire, sinon celui de l'ordonnance liée",()=>{
 const ordonnance={numero:"MHE-2026-014",veterinaireNom:"Dr Martin"};
 assert.equal(prescripteurCarnet(null,ordonnance),"Dr Martin");
 assert.equal(prescripteurCarnet("Dr Dupont",ordonnance),"Dr Dupont");
 assert.equal(prescripteurCarnet(" ",ordonnance),"Dr Martin");
});
test("traitement : même résolution que vaccination",()=>{
 assert.equal(numeroOrdonnanceCarnet(null,{numero:"TRT-2026-52"}),"TRT-2026-52");
 assert.equal(prescripteurCarnet(null,{veterinaireNom:"Dr Dupont"}),"Dr Dupont");
});
