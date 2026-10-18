"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, ClipboardList, Plus, Users, Zap } from "lucide-react";

type Animal = { id: string; nutrav: string; nobovi: string | null; sexbov: string };
type Mode = "choix" | "rapide" | "collectif" | "combinee";
const actes = ["Pesée", "Vaccination", "Antiparasitaire", "Traitement", "Échographie", "Parage"];
const destinations: Record<string,string> = {
  "Vêlage": "/velage?nouveau=1",
  "Pesée": "/troupeau/pesee",
  "Événement sanitaire": "/sanitaire/nouvel-evenement",
  "Saillie / IA": "/reproduction",
  "Échographie": "/reproduction",
  "Chaleur": "/reproduction",
  "Vaccination": "/sanitaire/vaccins",
  "Antiparasitaire": "/sanitaire/nouvel-evenement",
  "Traitement": "/sanitaire/nouvel-evenement",
  "Parage": "/parage",
};

export default function LabCreatePanel({ animaux }: { animaux: Animal[] }) {
  const [mode,setMode]=useState<Mode>("choix");
  const [action,setAction]=useState<string|null>(null);
  const [selection,setSelection]=useState<string[]>([]);
  const [recherche,setRecherche]=useState("");
  const [etapes,setEtapes]=useState<string[]>(["Pesée","Vaccination"]);
  const [position,setPosition]=useState(0);
  const [effectuees,setEffectuees]=useState<Record<string,string[]>>({});
  const choisis=animaux.filter(a=>selection.includes(a.id));
  const animal=choisis[position] || null;
  const matches=animaux.filter(a=>(a.nutrav+" "+(a.nobovi||"")).toLowerCase().includes(recherche.toLowerCase())).slice(0,15);
  function choisirMode(m:Mode){setMode(m);setAction(null);setRecherche("");}
  function toggleAnimal(id:string){setSelection(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);setPosition(0);}
  function toggleEtape(label:string){setEtapes(p=>p.includes(label)?p.filter(x=>x!==label):[...p,label]);}
  return <section className="space-y-3">
    {mode!=="choix"&&<button type="button" className="flex min-h-10 items-center gap-2 text-sm font-bold text-green-800" onClick={()=>choisirMode("choix")}><ChevronLeft size={16}/> Choisir un autre mode</button>}
    {mode==="choix"&&<>
      <h2 className="text-xl font-black">Créer une intervention</h2>
      <p className="text-sm text-gray-600">Un animal, un groupe ou plusieurs actes pendant un passage à la contention.</p>
      <div className="space-y-2">
        {[
          {id:"rapide" as Mode,title:"Action rapide",desc:"Un vêlage, une pesée, une saillie…",Icon:Zap},
          {id:"collectif" as Mode,title:"Travail collectif",desc:"Un même acte pour plusieurs bovins",Icon:Users},
          {id:"combinee" as Mode,title:"Séance combinée",desc:"Pesée + vaccin + traitement + écho, animal par animal",Icon:ClipboardList}
        ].map(x=><button type="button" key={x.id} onClick={()=>choisirMode(x.id)} className="flex min-h-20 w-full items-center gap-3 rounded-xl border bg-white p-4 text-left"><x.Icon size={25} className="shrink-0 text-green-700"/><span className="flex-1"><b className="block">{x.title}</b><span className="text-xs text-gray-500">{x.desc}</span></span><ChevronRight size={18}/></button>)}
      </div>
    </>}
    {mode==="rapide"&&<>
      <h2 className="text-lg font-bold">Action rapide</h2>
      <div className="grid grid-cols-2 gap-2">{["Vêlage","Pesée","Événement sanitaire","Saillie / IA","Échographie","Chaleur"].map(label=><button type="button" key={label} onClick={()=>setAction(label)} className="min-h-16 rounded-xl border bg-white p-3 text-sm font-semibold">{label}</button>)}</div>
      {action&&<div className="space-y-2 rounded-xl border border-green-300 bg-green-50 p-4"><b>{action}</b><p className="text-sm">Cette action existe dans CESAM. Le lien ouvre son module actuel, hors du LAB : tu pourras alors enregistrer de vrais actes.</p><Link href={destinations[action]} className="block rounded-lg bg-green-700 p-3 text-center text-sm font-bold text-white">Ouvrir dans CESAM</Link></div>}
    </>}
    {mode==="collectif"&&<>
      <h2 className="text-lg font-bold">Travail collectif</h2>
      <p className="text-sm text-gray-600">Choisis une intervention. Les parcours collectifs déjà développés restent les seuls à enregistrer les actes.</p>
      <div className="grid grid-cols-2 gap-2">{["Vaccination","Échographie","Traitement","Antiparasitaire","Pesée","Parage"].map(label=><button type="button" key={label} onClick={()=>setAction(label)} className="min-h-16 rounded-xl border bg-white p-3 text-sm font-semibold">{label}</button>)}</div>
      {action&&<div className="space-y-2 rounded-xl border border-green-300 bg-green-50 p-4"><b>{action}</b><p className="text-sm">Ouvre le module existant pour travailler sur plusieurs animaux, selon les possibilités de ce parcours.</p><Link href={destinations[action]} className="block rounded-lg bg-green-700 p-3 text-center text-sm font-bold text-white">Ouvrir dans CESAM</Link></div>}
    </>}
    {mode==="combinee"&&<>
      <h2 className="text-lg font-bold">Séance combinée</h2>
      <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900"><b>Démonstration uniquement.</b> Les cases cochées ne sont ni enregistrées ni envoyées aux fiches sanitaires. Ce n'est pas encore une vraie séance CESAM.</p>
      <h3 className="font-bold">1. Choisir les opérations</h3>
      <div className="grid grid-cols-2 gap-2">{actes.map(label=><button type="button" key={label} onClick={()=>toggleEtape(label)} aria-pressed={etapes.includes(label)} className={etapes.includes(label)?"flex min-h-12 items-center gap-2 rounded-xl border border-green-600 bg-green-50 p-3 text-sm font-semibold":"flex min-h-12 items-center gap-2 rounded-xl border bg-white p-3 text-sm font-semibold"}><span className="flex h-5 w-5 items-center justify-center rounded border border-green-600">{etapes.includes(label)&&<Check size={14}/>}</span>{label}</button>)}</div>
      <h3 className="font-bold">2. Choisir les animaux</h3>
      <input aria-label="Chercher les animaux de la séance" placeholder="Numéro ou nom…" value={recherche} onChange={e=>setRecherche(e.target.value)} className="w-full rounded-xl border bg-white p-3 text-base"/>
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border bg-white p-2">{matches.map(a=><button type="button" key={a.id} onClick={()=>toggleAnimal(a.id)} aria-pressed={selection.includes(a.id)} className="flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-left text-sm hover:bg-green-50"><span>{a.nutrav} · {a.nobovi||"Sans nom"}</span><span>{selection.includes(a.id)?"✓":<Plus size={15}/>}</span></button>)}</div>
      <p className="text-xs text-gray-500">{selection.length} animal(aux) sélectionné(s) · {etapes.length} opération(s)</p>
      {animal&&etapes.length>0&&<div className="space-y-3 rounded-2xl border-2 border-green-500 bg-green-50 p-4">
        <p className="text-xs font-bold text-green-800">3. Passage {position+1} sur {choisis.length} — simulation</p>
        <h3 className="text-xl font-black">{animal.nutrav} · {animal.nobovi||"Sans nom"}</h3>
        <div className="space-y-2">{etapes.map(label=><button type="button" key={label} onClick={()=>setEffectuees(p=>{const previous=p[animal.id]||[];return {...p,[animal.id]:previous.includes(label)?previous.filter(x=>x!==label):[...previous,label]};})} className="flex min-h-12 w-full items-center justify-between rounded-lg bg-white p-3 text-sm font-semibold"><span>{label}</span><span className="text-green-700">{(effectuees[animal.id]||[]).includes(label)?"✓ Simulé":"○"}</span></button>)}</div>
        <div className="flex gap-2"><button type="button" disabled={position===0} onClick={()=>setPosition(p=>Math.max(0,p-1))} className="flex-1 rounded-lg border bg-white p-3 text-sm font-bold disabled:opacity-40">← Précédent</button><button type="button" disabled={position>=choisis.length-1} onClick={()=>setPosition(p=>p+1)} className="flex-1 rounded-lg bg-green-700 p-3 text-sm font-bold text-white disabled:opacity-40">Suivant →</button></div>
      </div>}
      <p className="text-xs text-gray-500">Objectif : une fois la véritable intégration conçue, enchaîner les actes sans changer de formulaire ni resélectionner le bovin.</p>
    </>}
  </section>;
}
