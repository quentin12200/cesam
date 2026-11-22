import type { CarnetSanitaireRow, EvenementCarnetRow } from "./carnet-sanitaire";
import type { ActeSanitaireReel } from "./carnet-actes";
export type LigneUnique = { id:string; date:Date; animalId:string; animalNutrav:string; animalNational:string; animalNom:string|null; type:"Vaccination"|"Traitement"|"Événement"; produit:string; dose:string; voie:string|null; ordonnance:string|null; prescripteur:string|null; executant:string|null; motif:string|null; commentaire:string; statut:string; remiseLait:Date|null; remiseViande:Date|null };
const jour=(d:Date)=>d.toISOString().slice(0,10);
const comparable=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLocaleLowerCase("fr");
function commentaireEvenement(e:EvenementCarnetRow, acteDejaIdentifie:boolean):string {
 const base=[...e.symptomes,e.description??"",e.temperature!==null?"Température : "+e.temperature+" °C":"",e.moment??""]
  .flatMap(v=>v.split(/\s*[·•]\s*/)).map(v=>v.trim()).filter(Boolean);
 const seen=new Set<string>();
 return base.filter(v=>{
   const key=comparable(v);
   if(acteDejaIdentifie&&key==="vaccination")return false;
   if(seen.has(key))return false;
   seen.add(key);return true;
 }).join(" · ");
}
export function construireCarnetUnique(rows:CarnetSanitaireRow[], evenements:EvenementCarnetRow[], actes:ActeSanitaireReel[]):LigneUnique[]{
 const actesParId=new Map(actes.map(a=>[a.id,a]));
 const apparies=actes.filter(a=>a.source==="Vaccination + Traitement");
 const estMeme=(r:CarnetSanitaireRow,a:ActeSanitaireReel)=>r.animalId===a.animalId&&jour(r.date)===jour(a.date)&&r.produit.trim().toLocaleLowerCase("fr")===a.produit.trim().toLocaleLowerCase("fr");
 // Ne dédupliquer que les couples non ambigus : jamais effacer deux injections distinctes.
 const supprimerTraitements=new Set<string>();
 const completions=new Map<string,CarnetSanitaireRow>();
 const traitementVersVaccination=new Map<string,string>();
 for(const a of apparies){
   const vaccins=rows.filter(r=>(r.origine==="vaccination"||(!r.origine&&r.motif==="VACCINATION"))&&estMeme(r,a));
   const traitements=rows.filter(r=>(r.origine==="traitement"||(!r.origine&&r.motif!=="VACCINATION"))&&estMeme(r,a));
   if(vaccins.length===1&&traitements.length===1){supprimerTraitements.add(traitements[0].id);completions.set(vaccins[0].id,traitements[0]);traitementVersVaccination.set(traitements[0].id,vaccins[0].id);}
 }
 const evenementsParId=new Map(evenements.map(e=>[e.id,e]));
 const evenementVaccinal=(r:CarnetSanitaireRow)=>r.origine==="traitement"&&!!r.evenementId&&comparable(evenementsParId.get(r.evenementId)?.type??"")==="vaccination";
 const lignes:LigneUnique[]=rows.filter(r=>!supprimerTraitements.has(r.id)).map(r=>{
  const a=actesParId.get("traitement:"+r.id)??actesParId.get("vaccination:"+r.id)??apparies.find(a=>estMeme(r,a));
  const complement=completions.get(r.id);
  return {id:"acte:"+r.id,date:r.date,animalId:r.animalId,animalNutrav:r.animalNutrav,animalNational:r.animalNational,animalNom:r.animalNom,type:r.origine==="vaccination"||evenementVaccinal(r)||(!r.origine&&r.motif==="VACCINATION")?"Vaccination":"Traitement",produit:r.produit,dose:r.dose||complement?.dose||"",voie:r.voie??complement?.voie??null,ordonnance:r.ordonnanceNumero??complement?.ordonnanceNumero??null,prescripteur:r.prescripteur??complement?.prescripteur??null,executant:a?.executant??null,motif:r.motif,commentaire:"",statut:"Réalisé",remiseLait:r.dateRemiseLait,remiseViande:r.dateRemiseViande};
 });
 for(const e of evenements){
  const texte=commentaireEvenement(e,false);
  // Un événement qui décrit un acte du même animal, jour et produit enrichit la ligne au lieu de la répéter.
  const ids=e.traitementIds??[];
  // Le rattachement explicite en base est prioritaire : ni le produit ni la date seuls
  // ne prouvent qu'une injection appartient à cet événement.
  const idsVisibles=new Set(ids.map(id=>traitementVersVaccination.get(id)??id));
  const matches=ids.length
   ? lignes.filter(l=>idsVisibles.has(l.id.slice("acte:".length)))
   : lignes.filter(l=>l.animalId===e.animalId&&jour(l.date)===jour(e.date)&&e.produits.some(p=>comparable(p)===comparable(l.produit)));
  if(matches.length>=1){
    // Une seule ligne reçoit le contexte de l'événement; les autres administrations
    // restent distinctes et n'héritent pas de commentaires sans certitude.
    const l=matches[0];
    l.commentaire=[l.commentaire,commentaireEvenement(e,l.type==="Vaccination")].filter(Boolean).join(" · ");
    if(!l.executant)l.executant=e.constatePar;
    continue;
  }
  lignes.push({id:"evenement:"+e.id,date:e.date,animalId:e.animalId,animalNutrav:e.animalNutrav,animalNational:rows.find(r=>r.animalId===e.animalId)?.animalNational??"",animalNom:e.animalNom,type:"Événement",produit:e.produits.join(", ")||e.type,dose:"",voie:null,ordonnance:null,prescripteur:null,executant:e.constatePar,motif:e.categorie,commentaire:texte,statut:e.resolu?"Résolu":"À suivre",remiseLait:null,remiseViande:null});
 }
 return lignes;
}
export function filtrerCarnetUnique(lignes:LigneUnique[],q:string,du?:string,au?:string,type?:string):LigneUnique[]{
 const recherche=q.trim().toLocaleLowerCase("fr");
 return lignes.filter(l=>(!du||jour(l.date)>=du)&&(!au||jour(l.date)<=au)&&(!type||type==="tous"||l.type===type)&&(!recherche||[l.animalNutrav,l.animalNational,l.animalNom,l.produit,l.ordonnance,l.prescripteur,l.executant,l.motif,l.commentaire,jour(l.date),l.date.toLocaleDateString("fr-FR")].some(v=>String(v??"").toLocaleLowerCase("fr").includes(recherche))));
}
