"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Check, ClipboardList, Search, Users, Zap } from "lucide-react";

type Animal = { id: string; nutrav: string; nobovi: string | null; sexbov: string; aEchographier?: boolean; reproduction?: string | null };
type Mode = "choix" | "rapide" | "collectif" | "combinee";
type Etape = "Pesée" | "Vaccination" | "Échographie" | "Antiparasitaire" | "Traitement" | "Parage";
type Scope = "tous" | "echo" | "selection";
type Rule = { id: string; etape: Etape; cible: Scope; animaux: string[]; produit: string };
type Acte = { rule: string; valeur: string; result: "fait" | "nonfait" };
const TYPES: Etape[] = ["Pesée", "Vaccination", "Échographie", "Antiparasitaire", "Traitement", "Parage"];
const destinations: Record<string,string> = {
  "Vêlage": "/velage?nouveau=1", "Pesée": "/troupeau/pesee",
  "Événement sanitaire": "/sanitaire/nouvel-evenement", "Saillie / IA": "/reproduction",
  "Échographie": "/reproduction", "Chaleur": "/reproduction",
  "Vaccination": "/sanitaire/vaccins", "Antiparasitaire": "/sanitaire/nouvel-evenement",
  "Traitement": "/sanitaire/nouvel-evenement", "Parage": "/parage",
};
const defaultRules: Rule[] = [
  {id:"poids",etape:"Pesée",cible:"tous",animaux:[],produit:""},
  {id:"echo",etape:"Échographie",cible:"echo",animaux:[],produit:""},
];
function ruleName(rule: Rule) { return rule.produit.trim() || rule.etape; }

export default function LabCreatePanel({ animaux }: { animaux: Animal[] }) {
  const [mode,setMode]=useState<Mode>("choix");
  const [action,setAction]=useState<string|null>(null);
  const [rules,setRules]=useState<Rule[]>(defaultRules);
  const [addType,setAddType]=useState<Etape>("Vaccination");
  const [preparation,setPreparation]=useState(true);
  const [numero,setNumero]=useState("");
  const [search,setSearch]=useState("");
  const [scopeRule,setScopeRule]=useState<string|null>(null);
  const [records,setRecords]=useState<Record<string,Acte[]>>({});
  const [extras,setExtras]=useState<Record<string,Etape[]>>({});
  const [weight,setWeight]=useState("");
  const [echoResult,setEchoResult]=useState("PLEINE");
  const [historique,setHistorique]=useState(false);
  const [notice,setNotice]=useState("");
  const animal=animaux.find(a=>a.nutrav.toLowerCase()===numero.trim().toLowerCase()) ?? null;
  const candidates=useMemo(()=>animaux.filter(a=>(a.nutrav+" "+(a.nobovi||"")).toLowerCase().includes(search.toLowerCase())).slice(0,18),[animaux,search]);
  const echoIds=useMemo(()=>animaux.filter(a=>a.aEchographier).map(a=>a.id),[animaux]);
  function concerne(rule:Rule, a:Animal) { return rule.cible==="tous" || rule.cible==="echo"&&echoIds.includes(a.id) || rule.cible==="selection"&&rule.animaux.includes(a.id); }
  const planned=animal?rules.filter(r=>concerne(r,animal)):[];
  const other=animal?(extras[animal.id]||[]):[];
  const current=animal?(records[animal.id]||[]):[];
  const complete=(r:Rule,a:Animal)=> (records[a.id]||[]).some(x=>x.rule===r.id&&x.result==="fait");
  const remainingEcho=rules.filter(r=>r.etape==="Échographie").reduce((sum,r)=>sum+animaux.filter(a=>concerne(r,a)&&!complete(r,a)).length,0);
  function chooseMode(next:Mode){setMode(next);setAction(null);setNotice("");}
  function updateRule(id:string, patch:Partial<Rule>){setRules(p=>p.map(r=>r.id===id?{...r,...patch}:r));}
  function addRule(){setRules(p=>[...p,{id:"rule"+Date.now(),etape:addType,cible:addType==="Échographie"?"echo":"tous",animaux:[],produit:""}]);}
  function mark(id:string,value:string,result:"fait"|"nonfait"="fait"){
    if(!animal)return;
    setRecords(p=>({...p,[animal.id]:[...(p[animal.id]||[]).filter(x=>x.rule!==id),{rule:id,valeur:value,result}]}));
    setNotice("Simulation mémorisée uniquement dans cet écran.");
  }
  function nextAnimal(){setNumero("");setWeight("");setNotice("");}
  const card="rounded-xl border border-gray-200 bg-white p-3";
  return <section className="space-y-4">
    {mode!=="choix"&&<button type="button" onClick={()=>chooseMode("choix")} className="flex min-h-10 items-center gap-2 text-sm font-bold text-green-800"><ChevronLeft size={16}/> Modes de travail</button>}
    {mode==="choix"&&<>
      <h2 className="text-xl font-black">Que veux-tu faire ?</h2>
      <p className="text-sm text-gray-600">Trois façons de travailler, en utilisant les outils de CESAM.</p>
      {[
        {id:"rapide" as Mode,title:"Action immédiate",desc:"Un vêlage, une pesée ou une observation",Icon:Zap},
        {id:"collectif" as Mode,title:"Même acte sur un groupe",desc:"Vaccination, traitement, échographie…",Icon:Users},
        {id:"combinee" as Mode,title:"Passage à la contention",desc:"Séquence préparée, bovins dans le désordre",Icon:ClipboardList}
      ].map(x=><button type="button" key={x.id} onClick={()=>chooseMode(x.id)} className="flex min-h-20 w-full items-center gap-3 rounded-xl border bg-white p-4 text-left"><x.Icon size={26} className="text-green-700"/><span className="min-w-0 flex-1"><b className="block">{x.title}</b><span className="text-xs text-gray-500">{x.desc}</span></span><ChevronRight size={18}/></button>)}
    </>}
    {(mode==="rapide"||mode==="collectif")&&<>
      <h2 className="text-lg font-black">{mode==="rapide"?"Action immédiate":"Travail collectif"}</h2>
      <div className="grid grid-cols-2 gap-2">{(mode==="rapide"?["Vêlage","Pesée","Événement sanitaire","Saillie / IA","Échographie","Chaleur"]:["Vaccination","Échographie","Traitement","Antiparasitaire","Pesée","Parage"]).map(label=><button type="button" key={label} onClick={()=>setAction(label)} className="min-h-16 rounded-xl border bg-white p-3 text-sm font-semibold">{label}</button>)}</div>
      {action&&<div className="space-y-2 rounded-xl border border-green-300 bg-green-50 p-4"><b>{action}</b><p className="text-sm">Ce raccourci ouvre le parcours existant de CESAM, en dehors du LAB. Tu pourras y enregistrer de vrais actes.</p><Link href={destinations[action]} className="block rounded-lg bg-green-700 p-3 text-center text-sm font-bold text-white">Ouvrir dans CESAM</Link></div>}
    </>}
    {mode==="combinee"&&<>
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"><b>Prototype sans enregistrement.</b> Les poids, résultats et validations ci-dessous ne sont jamais transmis à CESAM. Ils disparaissent en quittant ou rechargeant cette page.</div>
      <div className="flex items-center justify-between gap-2"><div><h2 className="text-xl font-black">Passage à la contention</h2><p className="text-xs text-gray-500">{preparation?"Préparer la séquence":"Saisir le numéro qui arrive"}</p></div><button type="button" onClick={()=>{setPreparation(p=>!p);setNotice("");}} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold">{preparation?"Passer en séance →":"Modifier la préparation"}</button></div>
      {preparation?<>
        <h3 className="font-bold">Opérations et animaux concernés</h3>
        <p className="text-xs text-gray-600">Une intervention peut viser tous les bovins, les vaches à échographier ou ta propre sélection. Ce choix est indépendant pour chaque opération.</p>
        {rules.map(rule=><div key={rule.id} className={card+" space-y-2"}>
          <div className="flex items-center justify-between gap-2"><b>{rule.etape}</b><button type="button" onClick={()=>setRules(p=>p.filter(r=>r.id!==rule.id))} className="text-xs font-semibold text-red-700">Retirer</button></div>
          {["Vaccination","Antiparasitaire","Traitement"].includes(rule.etape)&&<label className="block text-xs font-semibold">Produit à présélectionner<input value={rule.produit} onChange={e=>updateRule(rule.id,{produit:e.target.value})} placeholder="Nom du médicament ou vaccin…" className="mt-1 w-full rounded-lg border p-3 text-base"/></label>}
          <label className="block text-xs font-semibold">Animaux concernés
            <select value={rule.cible} onChange={e=>updateRule(rule.id,{cible:e.target.value as Scope})} className="mt-1 w-full rounded-lg border bg-white p-3 text-sm">
              <option value="tous">Tous les bovins qui passent</option>
              <option value="echo">Liste à échographier dans CESAM ({echoIds.length})</option>
              <option value="selection">Sélection personnalisée ({rule.animaux.length})</option>
            </select>
          </label>
          {rule.cible==="selection"&&<button type="button" onClick={()=>setScopeRule(scopeRule===rule.id?null:rule.id)} className="rounded-lg bg-green-50 px-3 py-2 text-xs font-bold text-green-800">Choisir les animaux ({rule.animaux.length})</button>}
          {scopeRule===rule.id&&rule.cible==="selection"&&<div className="space-y-2"><input aria-label="Rechercher les animaux à cibler" value={search} onChange={e=>setSearch(e.target.value)} className="w-full rounded-lg border p-2" placeholder="Numéro ou nom…"/><div className="max-h-48 overflow-y-auto">{candidates.map(a=><label key={a.id} className="flex min-h-10 items-center gap-2 border-b p-2 text-sm"><input type="checkbox" checked={rule.animaux.includes(a.id)} onChange={e=>updateRule(rule.id,{animaux:e.target.checked?[...rule.animaux,a.id]:rule.animaux.filter(id=>id!==a.id)})}/>{a.nutrav} · {a.nobovi||"Sans nom"}</label>)}</div></div>}
        </div>)}
        <div className="flex gap-2"><select aria-label="Nouvelle opération" value={addType} onChange={e=>setAddType(e.target.value as Etape)} className="min-w-0 flex-1 rounded-xl border bg-white p-3 text-sm">{TYPES.map(t=><option key={t}>{t}</option>)}</select><button type="button" onClick={addRule} className="rounded-xl border border-green-700 px-3 font-bold text-green-800">+ Ajouter</button></div>
        <button type="button" disabled={rules.length===0} onClick={()=>setPreparation(false)} className="w-full rounded-xl bg-green-700 p-4 font-bold text-white disabled:opacity-50">Commencer la simulation →</button>
      </>:<>
        <div className="rounded-xl bg-green-50 p-3"><div className="flex justify-between gap-2 text-sm"><b>{Object.keys(records).filter(id=>records[id].some(x=>x.result==="fait")).length} bovin(s) traités</b><span>{remainingEcho} écho(s) encore prévues</span></div><p className="mt-1 text-xs text-gray-600">Résultats uniquement simulés dans cette page.</p></div>
        <label className="block text-sm font-bold">Numéro du bovin dans la cage<input autoFocus value={numero} onChange={e=>{setNumero(e.target.value);setNotice("");setWeight("");}} placeholder="Taper le numéro…" inputMode="numeric" className="mt-2 w-full rounded-xl border-2 border-green-500 bg-white p-4 text-lg"/></label>
        {numero.trim()&&!animal&&<p className="rounded-lg bg-amber-50 p-3 text-sm">Numéro non trouvé dans le troupeau actif.</p>}
        {animal&&<div className="space-y-3 rounded-2xl border-2 border-green-600 bg-green-50 p-3">
          <div><p className="text-xs font-bold text-green-700">ANIMAL IDENTIFIÉ</p><h3 className="text-xl font-black">{animal.nutrav} · {animal.nobovi||"Sans nom"} <span className={animal.sexbov==="F"?"text-purple-700":"text-blue-700"}>{animal.sexbov==="F"?"♀":"♂"}</span></h3><p className="text-xs text-gray-600">{planned.length} action(s) prévue(s) · {other.length} ajoutée(s) individuellement</p></div>
          {[...planned.map(rule=>({id:rule.id,label:ruleName(rule),etape:rule.etape})),...other.map(t=>({id:"extra-"+t,label:t+" · individuel",etape:t}))].map(entry=>{
            const record=current.find(r=>r.rule===entry.id);
            return <div key={entry.id} className="space-y-2 rounded-xl border bg-white p-3">
              <div className="flex items-center justify-between gap-2"><b className="text-sm">{entry.label}</b>{record&&<span className={record.result==="fait"?"rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-800":"rounded-full bg-gray-100 px-2 py-1 text-xs font-bold"}>{record.result==="fait"?"✓ Simulé":"Non fait"}</span>}</div>
              {entry.etape==="Pesée"&&<input type="number" min="0" value={weight} onChange={e=>setWeight(e.target.value)} aria-label="Poids en kilogrammes" placeholder="Poids (kg)" className="w-full rounded-lg border p-3 text-base"/>}
              {entry.etape==="Échographie"&&<select value={echoResult} onChange={e=>setEchoResult(e.target.value)} aria-label="Résultat de l'échographie" className="w-full rounded-lg border p-3"><option value="PLEINE">Pleine</option><option value="VIDE">Vide</option><option value="DOUTE">Doute / à revoir</option></select>}
              <div className="flex gap-2"><button type="button" disabled={entry.etape==="Pesée"&&(!weight||Number(weight)<=0)} onClick={()=>mark(entry.id,entry.etape==="Pesée"?weight+" kg":entry.etape==="Échographie"?echoResult:entry.label)} className="min-h-11 flex-1 rounded-lg bg-green-700 px-3 text-xs font-bold text-white disabled:opacity-50">✓ Marquer fait</button><button type="button" onClick={()=>mark(entry.id,"", "nonfait")} className="min-h-11 rounded-lg border px-3 text-xs font-semibold">Non fait</button></div>
            </div>;
          })}
          {planned.length+other.length===0&&<p className="text-sm text-gray-700">Aucun acte prévu pour cet animal. Tu peux en ajouter un ci-dessous.</p>}
          <label className="block text-xs font-semibold">Ajouter uniquement pour cet animal
            <select onChange={e=>{const next=e.target.value as Etape;if(next)setExtras(p=>({...p,[animal.id]:[...new Set([...(p[animal.id]||[]),next])]}));e.target.value="";}} defaultValue="" className="mt-1 w-full rounded-lg border bg-white p-3 text-sm"><option value="" disabled>+ Action individuelle…</option>{TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select>
          </label>
          <button type="button" onClick={nextAnimal} className="w-full rounded-xl bg-green-800 p-4 text-base font-black text-white">Animal suivant : saisir un nouveau numéro →</button>
          {notice&&<p className="text-xs text-green-800">{notice}</p>}
        </div>}
        <div className="rounded-xl border bg-white p-3"><button type="button" onClick={()=>setHistorique(p=>!p)} className="flex w-full items-center justify-between text-sm font-bold">Suivi de la simulation <ChevronRight size={16}/></button>{historique&&<div className="mt-2 space-y-2">{Object.entries(records).map(([id,list])=><div key={id} className="border-t pt-2 text-xs"><b>{animaux.find(a=>a.id===id)?.nutrav||id}</b>{list.map(item=><p key={item.rule}>{item.rule} : {item.result==="fait"?(item.valeur||"fait"):"non fait"}</p>)}</div>)}{Object.keys(records).length===0&&<p className="text-xs text-gray-500">Aucun acte simulé pour le moment.</p>}</div>}</div>
      </>}
    </>}
  </section>;
}
