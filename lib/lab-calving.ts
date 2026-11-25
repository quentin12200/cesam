import { consumesLoopNumber } from "./velage-safety.ts";
import { shouldResetReproductionAtCalving, effectiveManualReproduction } from "./calving-reproduction-reset.ts";
import { conflictingFatherIdentity } from "./gmq-father-conflict.ts";

export type DemoCalf = { status: "VIVANT" | "MORT_NE"; sex: "F" | "M"; number: string };
export type DemoBirth = { date: string; calves: DemoCalf[]; father: string; observedFather: string; laterBreeding: boolean };
export function simulateBirth(input: DemoBirth) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("Date requise");
  const date = new Date(input.date+"T00:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==input.date) throw new Error("Date invalide");
  if (![1,2].includes(input.calves.length)) throw new Error("Un ou deux veaux requis");
  if (!input.father) throw new Error("Choisir le père ou Inconnu");
  const sources = [input.father,input.observedFather].filter(x=>x&&x!=="INCONNU").map(national=>({national}));
  if (conflictingFatherIdentity(sources)) throw new Error("Filiation contradictoire : vérifier le père");
  const living = input.calves.filter(c=>consumesLoopNumber(c.status));
  if (living.some(c=>!/^\d{4}$/.test(c.number))) throw new Error("Numéro fictif à quatre chiffres requis pour chaque veau vivant");
  if (new Set(living.map(c=>c.number)).size!==living.length) throw new Error("Numéros de veaux vivants en double");
  const later = input.laterBreeding ? new Date(date.getTime()+86400000*60) : null;
  const reset=shouldResetReproductionAtCalving(date,null,later,later);
  const manual=effectiveManualReproduction("VERT",later??new Date(date.getTime()-86400000),date);
  const national=sources[0]?.national??null;
  return {births:input.calves.length, twins:input.calves.length===2, living:living.length, stillborn:input.calves.length-living.length, loops:living.length, reset, manual:reset?null:manual, calves:input.calves.map(c=>({status:c.status,sex:c.sex,number:consumesLoopNumber(c.status)?c.number:null,animalId:consumesLoopNumber(c.status)?"demo-calf-"+c.number:null,motherId:"demo-mother-calving",fatherNational:national}))};
}
