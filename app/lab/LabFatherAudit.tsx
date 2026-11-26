"use client";
import {useState} from "react";
import {auditReturnHref} from "@/lib/father-audit-navigation";
export default function LabFatherAudit(){
 const [ids,setIds]=useState(["demo-1","demo-2","demo-3"]);
 const [filter,setFilter]=useState("à contrôler");
 const [editing,setEditing]=useState<string|null>(null);
 const [father,setFather]=useState("");
 const [notice,setNotice]=useState("");
 function finish(save:boolean){
  if(!editing)return;
  const links=auditReturnHref("/lab?filtre="+encodeURIComponent(filter),ids,editing,true);
  const target=save?links.successReturnTo:links.returnTo;
  if(save){setIds(rows=>rows.filter(id=>id!==editing));setNotice("Père validé");}
  setEditing(null);
  requestAnimationFrame(()=>{const el=document.getElementById(new URL(target,"https://cesam.local").hash.slice(1));el?.scrollIntoView({block:"center"});el?.focus({preventScroll:true});});
 }
 return <section className="space-y-3 rounded-xl border bg-white p-4" aria-label="Contrôle fictif des filiations">
 <h2 className="font-bold">Contrôle fictif des filiations</h2>
 <label>Filtre de vérification<select value={filter} onChange={e=>setFilter(e.target.value)}><option>à contrôler</option><option>tous</option></select></label>
 <p>{ids.length} filiations fictives restantes</p>
 {editing?<div><p>Vêlage fictif {editing}</p><label>Père à valider<select value={father} onChange={e=>setFather(e.target.value)}><option value="">Choisir</option><option value="A">Père fictif A</option></select></label><button type="button" disabled={!father} onClick={()=>finish(true)}>Valider le père fictif</button><button type="button" onClick={()=>finish(false)}>Annuler le contrôle</button></div>:ids.map(id=><div key={id} id={"filiation-"+id} tabIndex={-1} className="rounded border p-3"><button type="button" onClick={()=>{setEditing(id);setFather("");setNotice("");}}>Vérifier {id}</button></div>)}
 <p id="filiations-fin" tabIndex={-1}>{notice}</p></section>;
}
