import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
export const dynamic = "force-dynamic";
export default async function StillbornHistoryPage({params}: {params: Promise<{id:string}>}) {
  const {id} = await params;
  const calf = await prisma.veauVelage.findFirst({where:{id,statut:"MORT_NE"},include:{velage:{include:{vache:{select:{nutrav:true,nobovi:true,numeroNational:true}},gestation:{include:{saillie:{include:{taureau:true}}}}}}}});
  if (!calf) notFound();
  const v = calf.velage;
  const father = v.gestation?.saillie.taureau;
  return <div className="mx-auto max-w-2xl space-y-3 p-3 pb-24">
    <Link href={`/troupeau/${v.vache.nutrav}?onglet=reproduction#historique-velages`} className="inline-flex min-h-11 items-center text-green-800 font-semibold underline">Retour à la mère</Link>
    <header className="rounded-xl bg-white p-4 shadow"><span className="rounded bg-gray-200 px-2 py-1 text-sm font-bold">Mort-né · Historique</span><h1 className="mt-2 text-xl font-bold break-words">{calf.nom ?? calf.nutrav ?? "Veau sans numéro"}</h1><p className="text-sm">Naissance : {formatDate(v.date)}</p></header>
    <section className="rounded-xl bg-white p-4 shadow space-y-2"><h2 className="font-bold">Identité</h2><p>Numéro de travail : {calf.nutrav ?? "Non attribué"}</p><p className="break-words">Numéro national : {calf.nunati ?? "Non attribué"}</p><p>Sexe : {calf.sexe === "M" ? "Mâle" : calf.sexe === "F" ? "Femelle" : "Non renseigné"}</p></section>
    <section className="rounded-xl bg-white p-4 shadow space-y-2"><h2 className="font-bold">Filiation &amp; vêlage</h2><Link href={`/troupeau/${v.vache.nutrav}`} className="inline-flex min-h-11 items-center text-green-800 underline">Mère : {v.vache.nutrav} · {v.vache.nobovi ?? "Sans nom"}</Link><p>Père enregistré : {v.pereNom ?? father?.nopere ?? "Non renseigné"} · {v.pereNunati ?? father?.nupere ?? "Numéro non renseigné"}</p>{father && (!v.pereNunati || v.pereNunati === father.nupere) && <Link href={`/taureaux/${father.id}`} className="inline-flex min-h-11 items-center text-green-800 underline">Fiche du père lié à la gestation</Link>}<p>{v.qualificatif} · {v.nombreVeaux} veau(x)</p>{v.notes && <p className="break-words">{v.notes}</p>}</section>
    <p className="text-sm text-gray-600">Fiche historique, hors cheptel vivant et hors suivi sanitaire ou pesées.</p>
  </div>;
}
