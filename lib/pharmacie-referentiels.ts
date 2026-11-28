import {CATEGORIES_MEDICAMENT,getCategorieMedicament,normaliserLibelleCategorie} from "./medicament-categories";
export type TypePharmacie="DCI"|"CATEGORIE"|"VOIE";
export type OptionPharmacie={value:string;label:string};
export type MedReference={dci:string|null;categorie:string;voie:string|null};
export type RefReference={type:string;code:string;libelle:string;actif:boolean};
export const cleReference=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("fr").trim().replace(/\s+/g," ");
export const VOIES_COMMUNES:OptionPharmacie[]=[
 {value:"PO",label:"Orale"},{value:"SC",label:"Sous-cutanée"},{value:"IM",label:"Intramusculaire"},{value:"IV",label:"Intraveineuse"},{value:"NASALE",label:"Intranasale"},{value:"POUR_ON",label:"Pour-on"},{value:"IMM",label:"Intramammaire"},{value:"IU",label:"Intra-utérine"},{value:"CUTANEE",label:"Cutanée / externe"},{value:"OCULAIRE",label:"Oculaire"}
];
const aliases:Record<string,string>={"vo":"PO","orale":"PO","po":"PO","intranasale":"NASALE","nasale":"NASALE","in":"NASALE","intramammaire":"IMM","intra_uterine":"IU","intra uterine":"IU","intra-uterine":"IU","pour-on":"POUR_ON","pour on":"POUR_ON","sous cutanee":"SC","sous-cutanee":"SC","intramusculaire":"IM","intraveineuse":"IV","cutanee":"CUTANEE","oculaire":"OCULAIRE"};
export const cleOption=(type:TypePharmacie,v:string)=>type==="VOIE"?cleReference((Object.hasOwn(aliases,cleReference(v))?aliases[cleReference(v)]:v)):type==="CATEGORIE"?normaliserLibelleCategorie(v):cleReference(v);
export function optionsPharmacie(type:TypePharmacie,meds:MedReference[],refs:RefReference[]):OptionPharmacie[]{
 const standards=type==="VOIE"?VOIES_COMMUNES:type==="CATEGORIE"?CATEGORIES_MEDICAMENT.map(c=>({value:c.code,label:c.label})):[];
 const custom=refs.filter(r=>r.type===type&&r.actif).map(r=>({value:type==="VOIE"?r.code:r.libelle,label:r.libelle}));
 const existing=meds.flatMap(m=>{const v=type==="DCI"?m.dci:type==="CATEGORIE"?m.categorie:m.voie;return v?.trim()?[{value:v,label:type==="CATEGORIE"?getCategorieMedicament(v).label:v}]:[]});
 const map=new Map<string,OptionPharmacie>();
 for(const o of [...standards,...custom,...existing]){const k=cleOption(type,o.value);if(k&&!map.has(k)&&![...map.values()].some(p=>cleOption(type,p.label)===cleOption(type,o.label)))map.set(k,o);}
 return [...map.values()].sort((a,b)=>a.label.localeCompare(b.label,"fr"));
}
export function trouverReference(type:TypePharmacie,v:string,options:OptionPharmacie[]){const k=cleOption(type,v);return options.find(o=>cleOption(type,o.value)===k||cleOption(type,o.label)===k);}
export function referenceProche(type:TypePharmacie,v:string,options:OptionPharmacie[]){
 const a=cleOption(type,v);if(a.length<5)return [];
 const dist=(x:string,y:string)=>{let p=Array.from({length:y.length+1},(_,i)=>i);for(let i=1;i<=x.length;i++){const n=[i];for(let j=1;j<=y.length;j++)n[j]=Math.min(n[j-1]+1,p[j]+1,p[j-1]+(x[i-1]===y[j-1]?0:1));p=n;}return p[y.length];};
 return options.filter(o=>dist(a,cleOption(type,o.label))<=(a.length>=9?2:1));
}
