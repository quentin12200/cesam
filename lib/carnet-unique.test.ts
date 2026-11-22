import test from "node:test";
import assert from "node:assert/strict";
import { construireCarnetUnique, filtrerCarnetUnique } from "./carnet-unique.ts";
import type { CarnetSanitaireRow, EvenementCarnetRow } from "./carnet-sanitaire.ts";
const d=new Date("2026-11-20T12:00:00Z");
const row: CarnetSanitaireRow={id:"v1",date:d,animalId:"a1",animalNutrav:"7485",animalNational:"FR00007485",animalNom:"BANOUFEE",ordonnanceNumero:null,prescripteur:null,produit:"HEPIZOVAC",dose:"4 ml",voie:"SC",motif:"VACCINATION",dateRemiseLait:null,dateRemiseViande:null};
const event:EvenementCarnetRow={id:"e1",date:d,animalId:"a1",animalNutrav:"7485",animalNom:"BANOUFEE",categorie:"Autre",type:"Vaccination",produits:["HEPIZOVAC"],symptomes:[],temperature:null,moment:null,description:"Primo",constatePar:"Céline",resolu:false};
test("vaccination et événement lié : une ligne enrichie du commentaire",()=>{const l=construireCarnetUnique([row],[event],[]);assert.equal(l.length,1);assert.equal(l[0].commentaire,"Primo");});
test("événement distinct conservé et trouvable par symptôme",()=>{const l=construireCarnetUnique([row],[{...event,id:"e2",produits:[],symptomes:["Diarrhée"]}],[]);assert.equal(l.length,2);assert.equal(filtrerCarnetUnique(l,"diarrhée").length,1);});
test("recherche ordonnance et période",()=>{const l=construireCarnetUnique([{...row,ordonnanceNumero:"ORD-23"}],[],[]);assert.equal(filtrerCarnetUnique(l,"ord-23","2026-01-01","2026-12-31").length,1);assert.equal(filtrerCarnetUnique(l,"","2027-01-01","2027-12-31").length,0);});

test("administration appariée : conserver la vaccination, retirer seulement le traitement doublon",()=>{
 const v={...row,id:"v2"};
 const t={...row,id:"t2",motif:"VACCIN",dose:"4 ml"};
 const acte={id:"vaccination:v2",animalId:"a1",nutrav:"7485",nom:"BANOUFEE",date:d,produit:"HEPIZOVAC",medicamentId:null,source:"Vaccination + Traitement" as const,ordonnanceNumero:null,executant:"Céline",protocoleNom:null,etapeNom:null};
 const lignes=construireCarnetUnique([v,t],[event],[acte]);
 assert.equal(lignes.length,1);
 assert.equal(lignes[0].executant,"Céline");
});
test("ne pas supprimer des injections distinctes ambiguës",()=>{
 const v={...row,id:"v2"};
 const t1={...row,id:"t1",motif:"VACCIN"};
 const t2={...row,id:"t2",motif:"VACCIN"};
 const acte={id:"vaccination:v2",animalId:"a1",nutrav:"7485",nom:"BANOUFEE",date:d,produit:"HEPIZOVAC",medicamentId:null,source:"Vaccination + Traitement" as const,ordonnanceNumero:null,executant:null,protocoleNom:null,etapeNom:null};
 assert.equal(construireCarnetUnique([v,t1,t2],[],[acte]).length,3);
});

test("événement ambigu : ne pas attribuer un commentaire à plusieurs injections",()=>{
 const l=construireCarnetUnique([row,{...row,id:"v3"}],[event],[]);
 assert.equal(l.length,3);
 assert.equal(l.filter(x=>x.commentaire==="").length,2);
 assert.equal(l.find(x=>x.id==="evenement:e1")?.commentaire,"Primo");
});
test("événement distinct : numéro national retrouvé sur les actes du même animal",()=>{
 const l=construireCarnetUnique([row],[{...event,id:"e3",produits:[],description:"Surveillance"}],[]);
 assert.equal(l.find(x=>x.id==="evenement:e3")?.animalNational,"FR00007485");
});

test("la mention Vaccination répétée dans la note n'apparaît pas trois fois",()=>{
 const e={...event,description:"Vaccination · Vaccination · Primo"};
 const l=construireCarnetUnique([row],[e],[]);
 assert.equal(l[0].commentaire,"Primo");
});
test("une dose manquante est récupérée uniquement depuis un traitement clairement apparié",()=>{
 const vaccination={...row,id:"v9",origine:"vaccination" as const,dose:""};
 const traitement={...row,id:"t9",origine:"traitement" as const,motif:"Vaccination",dose:"5 ml"};
 const acte={id:"vaccination:v9",animalId:"a1",nutrav:"7485",nom:"BANOUFEE",date:d,produit:"HEPIZOVAC",medicamentId:null,source:"Vaccination + Traitement" as const,ordonnanceNumero:null,executant:null,protocoleNom:null,etapeNom:null};
 const l=construireCarnetUnique([vaccination,traitement],[],[acte]);
 assert.equal(l.length,1);
 assert.equal(l[0].dose,"5 ml");
 assert.equal(l[0].type,"Vaccination");
});
test("une administration d'une autre date est conservée avec sa dose et son origine",()=>{
 const autre=new Date("2026-09-11T12:00:00Z");
 const traitement={...row,id:"t11",date:autre,origine:"traitement" as const,motif:"VACCINATION",dose:"5 ml"};
 const l=construireCarnetUnique([row,traitement],[],[]);
 assert.equal(l.length,2);
 assert.equal(l.find(x=>x.id==="acte:t11")?.type,"Traitement");
 assert.equal(l.find(x=>x.id==="acte:t11")?.dose,"5 ml");
});
test("un traitement explicitement identifié reste un traitement, quel que soit son motif",()=>{
 const traitement={...row,id:"t10",origine:"traitement" as const,motif:"VACCINATION"};
 assert.equal(construireCarnetUnique([traitement],[],[])[0].type,"Traitement");
});
