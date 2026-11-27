import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { detectFindings, type Finding } from "@/lib/coulisses-diagnostics";
export const dynamic = "force-dynamic";
export default async function DiagnosticsPage(){
 const [animals,calves,weights,treatments]=await Promise.all([
  prisma.animal.findMany({select:{id:true,nutrav:true,statut:true,danais:true,mereId:true,sexbov:true,reproductionEtatManuel:true,reproductionEtatModifieAt:true,velagesVache:{orderBy:{date:"desc"},take:1,select:{date:true}},sortie:{select:{type:true}}}}),
  prisma.veauVelage.findMany({select:{id:true,statut:true,animalId:true,velage:{select:{vacheId:true,vache:{select:{nutrav:true}}}},animal:{select:{nutrav:true,mereId:true,statut:true}}}}),
  prisma.pesee.findMany({select:{id:true,poids:true,date:true,animal:{select:{nutrav:true,danais:true}}}}),
  prisma.traitement.findMany({where:{ordonnanceAAssocier:true},select:{id:true,ordonnanceAAssocier:true,ordonnanceId:true,ordonnanceNumero:true,animal:{select:{nutrav:true}}}}),
 ]);
 const findings=detectFindings(animals,calves,weights,treatments);
 const domains:Finding["domain"][]=["Reproduction","Filiation","Pesées","Sanitaire","Effectifs"];
 return <main className="mx-auto max-w-4xl space-y-3 p-3 pb-24">
 <Link href="/config/coulisses" prefetch={false} className="inline-flex min-h-11 items-center font-semibold text-green-800 underline">Retour aux Coulisses</Link>
 <header className="rounded-xl border border-amber-200 bg-amber-50 p-4"><h1 className="text-xl font-black">Diagnostics du troupeau</h1><p className="mt-2 text-sm">Lecture seule · {findings.length} signalement(s) à vérifier. Aucun correctif automatique. Les contrôles couvrent uniquement les règles indiquées ci-dessous ; zéro signalement ne garantit pas l’absence de toute erreur.</p></header>
 {domains.map(domain=>{const rows=findings.filter(f=>f.domain===domain);return <section key={domain} className="min-w-0 rounded-xl border bg-white p-3"><h2 className="font-bold">{domain} · {rows.length}</h2>{rows.length===0?<p className="text-sm text-gray-600">Aucun signalement pour les règles actives.</p>:<ul className="mt-2 divide-y">{rows.map((f,i)=><li key={f.id+"-"+i} className="flex flex-wrap items-center gap-2 py-2 text-sm"><span className="font-mono font-bold">{f.animalNumber}</span><span className="min-w-0 flex-1 break-words">{f.label}</span></li>)}</ul>}</section>})}
 <p className="text-sm text-gray-600">Les signalements sont des indices à vérifier, pas des décisions de correction. Les numéros sont affichés pour retrouver les dossiers dans CESAM ; aucune fiche n’est ouverte automatiquement.</p>
 </main>
}
