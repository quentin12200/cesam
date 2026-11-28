"use client";
import {useState} from "react";
import MedicamentReferenceSelect from "../pharmacie/MedicamentReferenceSelect";
import {optionsPharmacie,trouverReference,referenceProche,type TypePharmacie,type OptionPharmacie} from "@/lib/pharmacie-referentiels";
const fixtures=[{dci:"Substance démo",categorie:"Catégorie démo",voie:"SC"}];
export default function LabPharmacieReferences(){
 const [values,setValues]=useState<Record<TypePharmacie,string>>({DCI:"",CATEGORIE:"",VOIE:""});
 const [added,setAdded]=useState<Record<TypePharmacie,OptionPharmacie[]>>({DCI:[],CATEGORIE:[],VOIE:[]});
 return <section aria-label="Référentiels fictifs" className="space-y-2 rounded-xl border p-3"><h2>Référentiels fictifs</h2>{(["DCI","CATEGORIE","VOIE"] as const).map(type=>{const opts=[...optionsPharmacie(type,fixtures,[]),...added[type]];return <MedicamentReferenceSelect key={type} type={type} label={type==="DCI"?"Substance fictive":type==="CATEGORIE"?"Catégorie fictive":"Voie fictive"} value={values[type]} onChange={v=>setValues(prev=>({...prev,[type]:v}))} simulation={{options:opts,add:async(label,confirm)=>{const exact=trouverReference(type,label,opts);if(exact)return {option:exact};const proches=referenceProche(type,label,opts);if(proches.length&&!confirm)return {error:"Valeur proche",proches};const o={value:label,label};setAdded(prev=>({...prev,[type]:[...prev[type],o]}));return {option:o};}}}/>})}<output aria-label="Nouvelles valeurs fictives">{Object.values(added).flat().length}</output></section>;
}
