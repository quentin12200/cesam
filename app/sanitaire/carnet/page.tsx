import BackButton from "@/app/components/BackButton";
import Link from "next/link";
import PrintButton from "@/app/components/PrintButton";
import { prisma } from "@/lib/prisma";
import { getActesSanitairesReels, getCarnetSanitaireRows, getEvenementsCarnetRows } from "@/lib/carnet-sanitaire";
import { construireCarnetUnique, filtrerCarnetUnique } from "@/lib/carnet-unique";
import { dansImpression, periodeValide, type PeriodeImpression } from "@/lib/carnet-periode-impression";
import { formatDate } from "@/lib/utils";
import ChoixImpression from "./ChoixImpression";
import ImportHistoriqueButton from "./ImportHistoriqueButton";
export const dynamic = "force-dynamic";
type Params={q?:string;annee?:string;mois?:string;type?:string;tri?:string;direction?:string;impression?:string;printDu?:string;printAu?:string};
export default async function CarnetSanitairePage({searchParams}:{searchParams:Promise<Params>}){
 const p=await searchParams,now=new Date(),annee=/^\d{4}$/.test(p.annee??"")?Number(p.annee):now.getFullYear();
 const mois=p.mois==="tous"?null:/^([1-9]|1[0-2])$/.test(p.mois??"")?Number(p.mois):(p.annee?null:now.getMonth()+1);
 const mode:PeriodeImpression|null=["mois","annee","periode","selection"].includes(p.impression??"")?p.impression as PeriodeImpression:null;
 const choix={mode:mode??"mois",annee,mois,du:p.printDu,au:p.printAu};
 const [actes,rows,evenements,config]=await Promise.all([getActesSanitairesReels(),getCarnetSanitaireRows(),getEvenementsCarnetRows(),prisma.exploitationConfig.findUnique({where:{id:"singleton"}}).catch(()=>null)]);
 const tout=construireCarnetUnique(rows,evenements,actes);
 const base=mode==="selection"?tout:mode?periodeValide(choix)?tout.filter(l=>dansImpression(l.date,choix)):[]:tout.filter(l=>l.date.getFullYear()===annee&&(mois===null||l.date.getMonth()+1===mois));
 const affiches=filtrerCarnetUnique(base,p.q??"",undefined,undefined,p.type??"tous");
 const cle=p.tri??"date",asc=p.direction==="asc";
 const triables=[...affiches].sort((a,b)=>{const va=cle==="animal"?a.animalNutrav:cle==="produit"?a.produit:cle==="type"?a.type:cle==="executant"?a.executant??"":cle==="ordonnance"?a.ordonnance??"":a.date.getTime();const vb=cle==="animal"?b.animalNutrav:cle==="produit"?b.produit:cle==="type"?b.type:cle==="executant"?b.executant??"":cle==="ordonnance"?b.ordonnance??"":b.date.getTime();const c=typeof va==="number"&&typeof vb==="number"?va-vb:String(va).localeCompare(String(vb),"fr",{numeric:true});return asc?c:-c;});
 const lienTri=(c:string)=>{const s=new URLSearchParams();for(const [k,v] of Object.entries(p))if(v)s.set(k,v);s.set("tri",c);s.set("direction",cle===c&&asc?"desc":"asc");return "/sanitaire/carnet?"+s.toString();};
 const entete=(c:string,t:string)=><th className="px-2 py-3 text-left whitespace-nowrap"><Link href={lienTri(c)} className="hover:underline">{t} {cle===c?(asc?"↑":"↓"):"↕"}</Link></th>;
 const total=triables.length;
 return <div className="mx-auto max-w-[1800px] p-3 sm:p-5">
  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden"><BackButton label="Retour"/><div className="flex items-center gap-2"><ImportHistoriqueButton/>{mode&&periodeValide(choix)&&<PrintButton label="🖨️ Imprimer la sélection"/>}</div></div>
  <div className="mb-5 print:hidden"><h1 className="text-3xl font-extrabold text-green-950">✚ Carnet sanitaire</h1><p className="text-sm text-slate-600">Vaccinations, traitements, événements, symptômes et commentaires — un seul tableau.</p></div>
  <form action="/sanitaire/carnet" method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4 print:hidden">
   <label className="min-w-[240px] flex-1 text-sm font-semibold">Recherche universelle<input name="q" type="search" defaultValue={p.q??""} placeholder="Animal, médicament, symptôme, ordonnance…" className="mt-1 w-full rounded-lg border p-3 font-normal"/></label>
   <label className="text-sm font-semibold">Année<select name="annee" defaultValue={String(annee)} className="mt-1 block rounded-lg border p-3">{Array.from({length:12},(_,i)=>now.getFullYear()-i).map(y=><option key={y} value={y}>{y}</option>)}</select></label>
   <label className="text-sm font-semibold">Mois<select name="mois" defaultValue={mois===null?"tous":String(mois)} className="mt-1 block rounded-lg border p-3"><option value="tous">Toute l&apos;année</option>{Array.from({length:12},(_,i)=><option key={i} value={i+1}>{new Date(2020,i,1).toLocaleDateString("fr-FR",{month:"long"})}</option>)}</select></label>
   <label className="text-sm font-semibold">Type<select name="type" defaultValue={p.type??"tous"} className="mt-1 block rounded-lg border p-3"><option value="tous">Tous</option><option>Vaccination</option><option>Traitement</option><option>Événement</option></select></label>
   <button type="submit" className="rounded-lg bg-green-700 px-5 py-3 font-semibold text-white">Afficher</button>
   <Link href="/sanitaire/carnet" className="py-3 text-sm underline">Effacer</Link>
  </form>
  <div className="mb-4 print:hidden"><ChoixImpression annee={annee} mois={mois} q={p.q??""} type={p.type??"tous"}/>{mode&&<p className="mt-2 text-sm font-semibold text-green-900" role="status">Sélection prête : {total} lignes. Utilisez « Imprimer la sélection » en haut de page.</p>}</div>
  <div className="mb-4 flex flex-wrap gap-3 print:hidden">
   <div className="rounded-xl border bg-white px-5 py-3"><strong className="text-xl">{total}</strong><p className="text-xs text-slate-600">Lignes affichées</p></div>
   {(["Vaccination","Traitement","Événement"] as const).map(t=><div key={t} className="rounded-xl border bg-white px-5 py-3"><strong className="text-xl">{triables.filter(l=>l.type===t).length}</strong><p className="text-xs text-slate-600">{t}s</p></div>)}
  </div>
  <div className="mb-3 hidden print:block"><h1 className="text-xl font-bold">Carnet sanitaire — {config?.raisonSociale??"Exploitation"}</h1><p>IPG : {config?.ipg??"—"} · Édité le {now.toLocaleDateString("fr-FR")} · {total} lignes</p>{mode==="periode"&&<p>Du {p.printDu} au {p.printAu}</p>}</div>
  <div className="space-y-2 sm:hidden print:hidden">
   {triables.map(l=><article key={l.id} className="rounded-xl border bg-white p-3 shadow-sm">
    <div className="flex items-center justify-between gap-2"><span className="font-bold text-green-900">{l.animalNutrav} · {l.animalNom??"Animal"}</span><span className="text-xs text-slate-600">{formatDate(l.date)}</span></div>
    <div className="mt-1 text-sm font-semibold">{l.type} · {l.produit}</div>
    <p className="mt-1 text-xs text-slate-700">{[l.dose||"Dose non renseignée",l.voie,l.executant].filter(Boolean).join(" · ")}</p>
    {l.commentaire&&<p className="mt-2 rounded bg-slate-50 p-2 text-sm">{l.commentaire}</p>}
    <details className="mt-2 text-xs"><summary className="cursor-pointer font-semibold text-green-800">Informations complètes</summary><p className="mt-2">N° national : {l.animalNational||"—"} · Ordonnance : {l.ordonnance||"—"}</p><p>Prescripteur : {l.prescripteur||"—"} · Motif : {l.motif||"—"}</p><p>Remise lait : {l.restrictionLait??(l.remiseLait?formatDate(l.remiseLait):"—")} · Viande : {l.restrictionViande??(l.remiseViande?formatDate(l.remiseViande):"—")}</p><p>Statut : {l.statut}</p></details>
   </article>)}
  </div>
  <div className="hidden overflow-x-auto rounded-xl border bg-white shadow-sm sm:block print:block print:overflow-visible">
   <table className="w-full min-w-[1450px] border-collapse text-xs print:min-w-0 print:text-[7px]"><thead className="bg-green-100 text-green-950 print:table-header-group"><tr>{entete("date","Date")}{entete("animal","N° travail")}<th className="px-2 text-left">N° national</th><th className="px-2 text-left">Nom</th>{entete("type","Type")}{entete("produit","Produit / motif")}<th className="px-2 text-left">Dose</th><th className="px-2 text-left">Voie</th>{entete("ordonnance","Ordonnance")}<th className="px-2 text-left">Prescripteur</th>{entete("executant","Exécutant")}<th className="px-2 text-left">Symptômes / commentaires</th><th className="px-2 text-left">Remise lait</th><th className="px-2 text-left">Remise viande</th><th className="px-2 text-left">Statut</th></tr></thead>
   <tbody>{triables.map(l=><tr key={l.id} className="border-t border-slate-200 align-top even:bg-slate-50 hover:bg-green-50 print:break-inside-avoid"><td className="whitespace-nowrap px-2 py-2">{formatDate(l.date)}</td><td className="px-2 font-bold text-green-800"><Link href={`/troupeau/${encodeURIComponent(l.animalNutrav)}`}>{l.animalNutrav}</Link></td><td className="px-2">{l.animalNational||"—"}</td><td className="px-2">{l.animalNom||"—"}</td><td className="px-2 font-semibold">{l.type}</td><td className="px-2">{l.produit}</td><td className="px-2">{l.dose||"Non renseignée"}</td><td className="px-2">{l.voie||"—"}</td><td className="px-2">{l.ordonnance||"—"}</td><td className="px-2">{l.prescripteur||"—"}</td><td className="px-2">{l.executant||"—"}</td><td className="min-w-[220px] max-w-[380px] whitespace-normal break-words px-3 py-2 leading-relaxed print:min-w-0 print:max-w-[220px]">{[l.motif&&l.type!=="Vaccination"?l.motif:"",l.commentaire].filter(Boolean).join(" · ")||"—"}</td><td className="px-2">{l.restrictionLait??(l.remiseLait?formatDate(l.remiseLait):"—")}</td><td className="px-2">{l.restrictionViande??(l.remiseViande?formatDate(l.remiseViande):"—")}</td><td className="px-2">{l.statut}</td></tr>)}</tbody></table>
   {!total&&<p className="p-8 text-center text-slate-600">Aucun enregistrement pour cette sélection.</p>}
  </div>
  <style>{`@media print{nav,.print\\:hidden{display:none!important}@page{size:A3 landscape;margin:9mm}thead{display:table-header-group}tr{break-inside:avoid}body{color:#111}}`}</style>
 </div>;
}
