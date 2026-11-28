"use client";
import {useState} from "react";
import {simulateBirth,type DemoBirth,type DemoCalf} from "@/lib/lab-calving";
const freshCalf=():DemoCalf=>({status:"VIVANT",sex:"F",number:""});
const initial=():DemoBirth=>({date:"2026-11-25",calves:[freshCalf()],father:"INCONNU",observedFather:"",laterBreeding:false});
export default function LabCalvingPanel(){
 const [input,setInput]=useState<DemoBirth>(initial);
 const [result,setResult]=useState<ReturnType<typeof simulateBirth>|null>(null);
 const [error,setError]=useState("");
 const update=(patch:Partial<DemoBirth>)=>{setInput(x=>({...x,...patch}));setResult(null);setError("");};
 const calf=(i:number,patch:Partial<DemoCalf>)=>{setInput(x=>({...x,calves:x.calves.map((c,j)=>i===j?{...c,...patch}:c)}));setResult(null);setError("");};
 const reset=()=>{setInput(initial());setResult(null);setError("");};
 return <section className="space-y-3 rounded-xl border bg-white p-4" aria-labelledby="demo-calving-title">
 <h2 id="demo-calving-title" className="text-lg font-black">Simulation vêlage et reproduction</h2>
 <p className="text-sm text-slate-600">Mère fictive 6999 · statut initial Gestante. Aucun enregistrement réel.</p>
 <label className="block text-sm">Date du vêlage<input className="block w-full rounded border p-2" type="date" value={input.date} onChange={e=>update({date:e.target.value})}/></label>
 <label className="block text-sm">Nombre de veaux<select className="block w-full rounded border p-2" value={input.calves.length} onChange={e=>update({calves:Number(e.target.value)===2?[input.calves[0],input.calves[1]??freshCalf()]:[input.calves[0]]})}><option value={1}>Un veau</option><option value={2}>Jumeaux</option></select></label>
 {input.calves.map((c,i)=><fieldset key={i} className="space-y-2 rounded border p-3"><legend className="font-bold">Veau {i+1}</legend>
 <label className="block text-sm">État du veau {i+1}<select className="block w-full rounded border p-2" value={c.status} onChange={e=>calf(i,{status:e.target.value as DemoCalf["status"]})}><option value="VIVANT">Vivant</option><option value="MORT_NE">Mort-né</option></select></label>
 <label className="block text-sm">Sexe du veau {i+1}<select className="block w-full rounded border p-2" value={c.sex} onChange={e=>calf(i,{sex:e.target.value as DemoCalf["sex"]})}><option value="F">Femelle</option><option value="M">Mâle</option></select></label>
 {c.status==="VIVANT"&&<label className="block text-sm">Numéro du veau {i+1}<input className="block w-full rounded border p-2" inputMode="numeric" value={c.number} onChange={e=>calf(i,{number:e.target.value})}/></label>}
 </fieldset>)}
 <label className="block text-sm">Père déclaré<select className="block w-full rounded border p-2" value={input.father} onChange={e=>update({father:e.target.value})}><option value="INCONNU">Inconnu</option><option value="DEMO-PERE-A">Père fictif A</option><option value="DEMO-PERE-B">Père fictif B</option></select></label>
 <label className="block text-sm">Père issu de la gestation<select className="block w-full rounded border p-2" value={input.observedFather} onChange={e=>update({observedFather:e.target.value})}><option value="">Non renseigné</option><option value="DEMO-PERE-A">Père fictif A</option><option value="DEMO-PERE-B">Père fictif B</option></select></label>
 <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={input.laterBreeding} onChange={e=>update({laterBreeding:e.target.checked})}/>Cycle de reproduction postérieur au vêlage</label>
 <button type="button" className="min-h-11 w-full rounded bg-blue-800 p-3 font-bold text-white" onClick={()=>{try{setResult(simulateBirth(input));setError("");}catch(e){setResult(null);setError(e instanceof Error?e.message:"Simulation impossible");}}}>Simuler le vêlage</button>
 {error&&<p role="alert" className="text-red-800">{error}</p>}
 {result&&<div role="status" className="space-y-1 rounded bg-green-50 p-3"><p>Naissances : {result.births}</p><p>Fiches animales simulées : {result.living}</p><p>Mort-nés : {result.stillborn}</p><p>Boucles consommées : {result.loops}</p><p>{result.reset?"Statut manuel de la mère réinitialisé":"Cycle ultérieur préservé"}</p>{result.calves.map((c,i)=><p key={i}>Veau {i+1} : {c.animalId?"fiche fictive "+c.number:"historique uniquement"} · Père : {c.fatherNational??"inconnu"}</p>)}</div>}
 <button type="button" className="min-h-11 rounded border px-3" onClick={reset}>Réinitialiser la simulation vêlage</button>
 </section>;
}
