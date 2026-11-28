import {NextResponse} from "next/server";
import {prisma} from "@/lib/prisma";
import {optionsPharmacie,trouverReference,referenceProche,cleOption,type TypePharmacie} from "@/lib/pharmacie-referentiels";
const types:TypePharmacie[]=["DCI","CATEGORIE","VOIE"];
async function data(){const [meds,refs]=await Promise.all([prisma.medicament.findMany({select:{dci:true,categorie:true,voie:true}}),prisma.valeurReferentielPreconisation.findMany()]);return {meds,refs};}
export async function GET(){const {meds,refs}=await data();return NextResponse.json(Object.fromEntries(types.map(t=>[t,optionsPharmacie(t,meds,refs)])));}
export async function POST(request:Request){
 const body=await request.json();const type=body.type as TypePharmacie;
 if(!types.includes(type)||typeof body.libelle!=="string")return NextResponse.json({error:"Valeur invalide"},{status:400});
 const label=body.libelle.normalize("NFC").trim().replace(/\s+/g," ");
 if(!label||label.length>160)return NextResponse.json({error:"Nom invalide"},{status:400});
 const {meds,refs}=await data();const opts=optionsPharmacie(type,meds,refs);const exact=trouverReference(type,label,opts);
 if(exact)return NextResponse.json({option:exact,existant:true});
 const proches=referenceProche(type,label,opts);if(proches.length&&!body.confirmerDistinct)return NextResponse.json({error:"Valeurs proches : vérifiez avant création.",proches},{status:409});
 const code=cleOption(type,label).normalize("NFC").toUpperCase().replace(/[^A-Z0-9]+/g,"_").replace(/^_|_$/g,"");
 if(!code)return NextResponse.json({error:"Nom invalide"},{status:400});
 const row=await prisma.valeurReferentielPreconisation.upsert({where:{type_code:{type,code}},create:{type,code,libelle:label},update:{}});
 if(!row.actif)return NextResponse.json({error:"Cette valeur existe mais est archivée."},{status:409});
 return NextResponse.json({option:{value:type==="VOIE"?row.code:row.libelle,label:row.libelle}});
}
