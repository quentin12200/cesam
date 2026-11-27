"use client";
import {useState} from "react";
import BouclageButton from "../troupeau/[nutrav]/BouclageButton";
export default function LabBouclage(){
 const [done,setDone]=useState(false);
 return <section aria-label="Bouclage fictif" className="rounded-xl border p-3">
 <h2>Identification fictive</h2>
 {done?<p role="status">Boucle posée (simulation)</p>:<BouclageButton nutrav="DEMO-BOUCLE" onConfirm={async()=>setDone(true)}/>}
 </section>;
}
