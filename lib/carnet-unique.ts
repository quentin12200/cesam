import type { CarnetSanitaireRow, EvenementCarnetRow } from "./carnet-sanitaire";
import type { ActeSanitaireReel } from "./carnet-actes";
export type LigneUnique = { id:string; date:Date; animalId:string; animalNutrav:string; animalNational:string; animalNom:string|null; type:"Vaccination"|"Traitement"|"Événement"; produit:string; dose:string; voie:string|null; ordonnance:string|null; prescripteur:string|null; executant:string|null; motif:string|null; commentaire:string; statut:string; remiseLait:Date|null; remiseViande:Date|null };
const jour=(d:Date)=>d.toISOString().slice(0,10);
export function construireCarnetUnique(rows:CarnetSanitaireRow[], evenements:EvenementCarnetRow[], actes:ActeSanitaireReel[]):LigneUnique[]{
 const actesParId=new Map(actes.map(a=>[a.id,a]));
 const traitements=new Set(actes.filter(a=>a.source==="Vaccination + Traitement").map(a=>a.id.split(":")[1]));
 const lignes:LigneUnique[]=rows.filter(r=>!traitements.has(r.id)||r.motif==="VACCINATION").map(r=>{
  const a=actesParId.get("traitement:"+r.id)??actesParId.get("vaccination:"+r.id);
  return {id:"acte:"+r.id,date:r.date,animalId:r.animalId,animalNutrav:r.animalNutrav,animalNational:r.animalNational,animalNom:r.animalNom,type:r.motif==="VACCINATION"?"Vaccination":"Traitement",produit:r.produit,dose:r.dose,voie:r.voie,ordonnance:r.ordonnanceNumero,prescripteur:r.prescripteur,executant:a?.executant??null,motif:r.motif,commentaire:"",statut:"Réalisé",remiseLait:r.dateRemiseLait,remiseViande:r.dateRemiseViande};
 });
 for(const e of evenements){
  const texte=[...e.symptomes,e.description??"",e.temperature!==null?"Température : "+e.temperature+" °C":"",e.moment??""].filter(Boolean).join(" · ");
  // Un événement qui décrit un acte du même animal, jour et produit enrichit la ligne au lieu de la répéter.
  const matches=lignes.filter(l=>l.animalId===e.animalId&&jour(l.date)===jour(e.date)&&e.produits.some(p=>p.trim().toLowerCase()===l.produit.trim().toLowerCase()));
  if(matches.length){for(const l of matches){l.commentaire=[l.commentaire,texte].filter(Boolean).join(" · ");if(!l.executant)l.executant=e.constatePar;}continue;}
  lignes.push({id:"evenement:"+e.id,date:e.date,animalId:e.animalId,animalNutrav:e.animalNutrav,animalNational:"",animalNom:e.animalNom,type:"Événement",produit:e.produits.join(", ")||e.type,dose:"",voie:null,ordonnance:null,prescripteur:null,executant:e.constatePar,motif:e.categorie,commentaire:texte,statut:e.resolu?"Résolu":"À suivre",remiseLait:null,remiseViande:null});
 }
 return lignes;
}
export function filtrerCarnetUnique(lignes:LigneUnique[],q:string,du?:string,au?:string,type?:string):LigneUnique[]{
 const recherche=q.trim().toLocaleLowerCase("fr");
 return lignes.filter(l=>(!du||jour(l.date)>=du)&&(!au||jour(l.date)<=au)&&(!type||type==="tous"||l.type===type)&&(!recherche||[l.animalNutrav,l.animalNational,l.animalNom,l.produit,l.ordonnance,l.prescripteur,l.executant,l.motif,l.commentaire,jour(l.date),l.date.toLocaleDateString("fr-FR")].some(v=>String(v??"").toLocaleLowerCase("fr").includes(recherche))));
}
