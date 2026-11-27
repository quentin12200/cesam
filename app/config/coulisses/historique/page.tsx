import Link from "next/link";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
const PAGE_SIZE = 30;
export default async function HistoryPage({searchParams}:{searchParams:Promise<{page?:string;etat?:string}>}){
 const params=await searchParams;
 const requested=Number(params.page??1);
 const etat=params.etat==="annulees"?"annulees":params.etat==="actives"?"actives":"toutes";
 const where=etat==="annulees"?{reverted:true}:etat==="actives"?{reverted:false}:{};
 const count=await prisma.actionLog.count({where});
 const pages=Math.max(1,Math.ceil(count/PAGE_SIZE));
 const page=Number.isSafeInteger(requested)?Math.max(1,Math.min(requested,pages)):1;
 const rows=await prisma.actionLog.findMany({where,orderBy:[{createdAt:"desc"},{id:"desc"}],skip:(page-1)*PAGE_SIZE,take:PAGE_SIZE,select:{id:true,type:true,description:true,createdAt:true,reverted:true,revertedAt:true}});
 const href=(p:number,e:string)=>`/config/coulisses/historique?page=${p}&etat=${e}`;
 const date=(d:Date)=>new Intl.DateTimeFormat("fr-FR",{dateStyle:"short",timeStyle:"short",timeZone:"Europe/Paris"}).format(d);
 return <main className="mx-auto max-w-4xl space-y-3 p-3 pb-24">
 <Link href="/config/coulisses" prefetch={false} className="inline-flex min-h-11 items-center text-sm font-semibold text-green-800 underline">Retour aux Coulisses</Link>
 <header className="rounded-xl border border-amber-200 bg-amber-50 p-4"><h1 className="text-xl font-black">Historique des modifications</h1><p className="mt-2 text-sm">Lecture seule · Actions effectivement journalisées par CESAM. Certaines modifications ne sont pas enregistrées dans ce journal. L’auteur et les valeurs après modification ne sont pas disponibles pour toutes les actions. Aucune annulation depuis cette page.</p></header>
 <nav aria-label="Filtrer les actions" className="flex flex-wrap gap-2">{[["toutes","Toutes"],["actives","Non annulées"],["annulees","Annulées"]].map(([value,label])=><Link key={value} href={href(1,value)} prefetch={false} aria-current={etat===value?"page":undefined} className={`inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-semibold ${etat===value?"bg-green-800 text-white":"bg-white text-gray-800"}`}>{label}</Link>)}</nav>
 <p className="text-sm text-gray-600">{count} action(s) journalisée(s) · Page {page}/{pages}</p>
 <section className="divide-y rounded-xl border bg-white">{rows.length===0?<p className="p-4 text-sm text-gray-600">Aucune action journalisée pour ce filtre.</p>:rows.map(row=><article key={row.id} className="min-w-0 space-y-1 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><time className="text-sm text-gray-600" dateTime={row.createdAt.toISOString()}>{date(row.createdAt)}</time><span className="rounded bg-gray-100 px-2 py-1 text-xs font-bold">{row.reverted?"Annulation enregistrée":"Non annulée"}</span></div><p className="break-words font-semibold">{row.description}</p><p className="break-all text-xs text-gray-600">{row.type}</p>{row.revertedAt&&<p className="text-sm text-gray-600">Annulation : {date(row.revertedAt)}</p>}</article>)}</section>
 <nav aria-label="Pagination" className="flex flex-wrap justify-between gap-2">{page>1&&<Link href={href(page-1,etat)} prefetch={false} className="inline-flex min-h-11 items-center rounded border px-3 font-semibold">Précédent</Link>}{page<pages&&<Link href={href(page+1,etat)} prefetch={false} className="inline-flex min-h-11 items-center rounded border px-3 font-semibold">Suivant</Link>}</nav>
 </main>
}
