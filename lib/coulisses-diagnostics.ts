export type Finding = { domain: "Reproduction" | "Filiation" | "Pesées" | "Sanitaire" | "Effectifs"; id: string; label: string; animalNumber: string };
type Animal = { id:string; nutrav:string; statut:string; danais:Date; mereId:string|null; sexbov:string; reproductionEtatManuel:string|null; reproductionEtatModifieAt:Date|null; velagesVache:{date:Date}[]; sortie:{type:string}|null };
type Calf = { id:string; statut:string; animalId:string|null; velage:{vacheId:string; vache:{nutrav:string}}; animal:{nutrav:string; mereId:string|null; statut:string}|null };
type Weight = { id:string; poids:number; date:Date; animal:{nutrav:string; danais:Date} };
type Treatment = { id:string; ordonnanceAAssocier:boolean; ordonnanceId:string|null; ordonnanceNumero:string|null; animal:{nutrav:string} };
export function detectFindings(animals:Animal[], calves:Calf[], weights:Weight[], treatments:Treatment[]):Finding[] {
 const findings:Finding[]=[];
 for(const a of animals){
  const last=a.velagesVache[0]?.date;
  if(a.sexbov==="F"&&a.statut==="ACTIF"&&last&&["VERT","ROSE"].includes(a.reproductionEtatManuel??"")&&(!a.reproductionEtatModifieAt||a.reproductionEtatModifieAt<=last)) findings.push({domain:"Reproduction",id:a.id,animalNumber:a.nutrav,label:"Statut manuel pleine/imminente antérieur au dernier vêlage"});
  if(a.mereId===a.id) findings.push({domain:"Filiation",id:a.id,animalNumber:a.nutrav,label:"Animal déclaré comme sa propre mère"});
  if(a.statut==="ACTIF"&&a.sortie?.type==="MORT") findings.push({domain:"Effectifs",id:a.id,animalNumber:a.nutrav,label:"Animal actif avec une sortie pour mortalité"});
 }
 for(const c of calves){
  if(c.statut==="MORT_NE"&&c.animal?.statut==="ACTIF") findings.push({domain:"Effectifs",id:c.id,animalNumber:c.animal.nutrav,label:"Mort-né lié à une fiche active"});
  if(c.animal?.mereId&&c.animal.mereId!==c.velage.vacheId) findings.push({domain:"Filiation",id:c.id,animalNumber:c.animal.nutrav,label:"Mère de la fiche différente de la mère du vêlage"});
 }
 for(const w of weights) if(!Number.isFinite(w.poids)||w.poids<=0||w.date<w.animal.danais) findings.push({domain:"Pesées",id:w.id,animalNumber:w.animal.nutrav,label:"Poids non positif ou pesée antérieure à la naissance"});
 for(const t of treatments) if(t.ordonnanceAAssocier&&!t.ordonnanceId&&!t.ordonnanceNumero) findings.push({domain:"Sanitaire",id:t.id,animalNumber:t.animal.nutrav,label:"Ordonnance signalée à associer, référence absente"});
 return findings;
}
