import test from "node:test";
import assert from "node:assert/strict";
import {animalTabHref} from "./origin-navigation.ts";
test("le changement d'onglet conserve filtres, ancre et mode test",()=>{
 const origin="/troupeau?lot=genisses&tri=age#liste";
 const url=new URL(animalTabHref("DEMO","sante",true,origin),"https://cesam.local");
 assert.equal(url.searchParams.get("returnTo"),origin);
 assert.equal(url.searchParams.get("onglet"),"sante");
 assert.equal(url.searchParams.get("testRepro"),"1");
});
test("un retour externe ou absent est ignoré",()=>{
 for(const origin of [null,"//example.com","https://example.com"]){
 const url=new URL(animalTabHref("DEMO","reproduction",false,origin),"https://cesam.local");
 assert.equal(url.searchParams.has("returnTo"),false);
 }
});
