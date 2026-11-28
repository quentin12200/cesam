import {prisma} from "@/lib/prisma";
import {optionsPharmacie,trouverReference,type TypePharmacie} from "@/lib/pharmacie-referentiels";
export async function verifierReferences(input:{dci?:unknown;categorie?:unknown;voie?:unknown},previous?:{dci:string|null;categorie:string;voie:string|null}){
 const [meds,refs]=await Promise.all([prisma.medicament.findMany({select:{dci:true,categorie:true,voie:true}}),prisma.valeurReferentielPreconisation.findMany()]);
 const output:{dci?:string|null;categorie?:string;voie?:string|null}={};
 for(const [field,type] of [["dci","DCI"],["categorie","CATEGORIE"],["voie","VOIE"]] as const){
  const value=input[field];if(value===undefined||value===previous?.[field])continue;
  if(value===null||value===""){if(field==="categorie")return {error:"Choisissez une catégorie."};output[field]=null;continue;}
  if(typeof value!=="string")return {error:"Valeur de référentiel invalide."};
  const found=trouverReference(type as TypePharmacie,value,optionsPharmacie(type as TypePharmacie,meds,refs));
  if(!found)return {error:"Choisissez une valeur existante ou ajoutez-la au référentiel avant validation."};
  output[field]=found.value;
 }
 return {output};
}
