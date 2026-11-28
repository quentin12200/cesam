"use client";
import {useState} from "react";
import {lireDose,normaliserUniteDose,doseValide} from "@/lib/dose-units";
import TraitementDraftRow, {type TraitementDraft} from "../sanitaire/nouvel-evenement/TraitementDraftRow";
import type {MedicamentOption} from "../sanitaire/nouvel-evenement/MedicamentPicker";
const med: MedicamentOption = {id:"demo-med",nom:"TOLFINE",dci:"Substance fictive incohérente",categorie:"AUTRE",voie:"IM",dosagePourKg:null,uniteDosage:"ml",delaiAttenteViandeJ:null,delaiAttenteLaitJ:null,preconisations:["IM","IV"].map((voie,i)=>({id:"demo-"+i,indicationMotif:"Simulation uniquement",dose:1,unite:"unité fictive",doseBase:"base fictive",voie,frequence:null,dureeValeur:2,dureeUnite:"jours fictifs",delaiAttenteViandeJ:null,delaiAttenteLaitTraites:null,statut:"IMPORTE"}))};
export default function LabTraitement(){
 const [draft,setDraft]=useState<TraitementDraft>({key:"demo",medicament:med,voie:"IM",executant:"Démo",dose:"",uniteDosage:"ml",motif:"",doseUnique:true,frequence:"",dureeJours:""});
 return <section aria-label="Traitement fictif" className="rounded-xl border p-2"><h2 className="font-bold">Traitement fictif — aucune prescription</h2><TraitementDraftRow simulation draft={draft} medicaments={[med]} intervenants={[{id:"demo",nom:"Démo"}]} onChange={setDraft} onRemove={()=>{}} onIntervenantAdded={()=>{}} removable={false}/><output aria-label="Dose fictive normalisée">{doseValide(draft.dose,draft.uniteDosage) && lireDose(draft.dose)!==null ? `${lireDose(draft.dose)} ${normaliserUniteDose(draft.uniteDosage)}` : "Dose à renseigner ou invalide"}</output></section>;
}
