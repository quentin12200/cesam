export const dynamic = "force-dynamic";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { canonicalName } from "@/lib/bull-identity";

export default async function LegacyCalvingFatherAudit() {
  const [bulls, calvings] = await Promise.all([
    prisma.taureau.findMany({ select: { id: true, nopere: true, nupere: true } }),
    prisma.velage.findMany({
      where: { OR: [{ pereNom: { not: null } }, { pereNunati: { not: null } }] },
      select: { id: true, date: true, pereNom: true, pereNunati: true, vache: { select: { nutrav: true } },
        veau: { select: { nutrav: true, taureauId: true } } },
      orderBy: { date: "desc" },
    }),
  ]);
  const rows = calvings.map(v => {
    const byNumber = v.pereNunati ? bulls.filter(b => b.nupere === v.pereNunati) : [];
    const name = canonicalName(v.pereNom);
    const byName = name ? bulls.filter(b => canonicalName(b.nopere) === name) : [];
    const matches = byNumber.length ? byNumber : byName;
    const linked = v.veau?.taureauId ?? null;
    const status = linked ? "Filiation déjà liée : vérifier avant toute correction" :
      matches.length === 1 ? "Candidat unique — validation humaine obligatoire" :
      matches.length > 1 ? "Plusieurs candidats — ambigu" : "Aucune correspondance fiable";
    return { ...v, matches, status, linked };
  }).filter(v => !v.linked || (v.matches.length === 1 && v.matches[0].id !== v.linked));
  return <main className="mx-auto max-w-5xl p-4 space-y-4">
    <Link href="/taureaux/controle" className="underline text-green-700">Retour au contrôle des pères</Link>
    <h1 className="text-xl font-bold">Diagnostic des anciens pères de vêlage</h1>
    <p className="text-sm text-amber-800">Lecture seule : aucune attribution automatique. Une correspondance de nom n’est pas une preuve de filiation. Pour corriger, ouvrir le vêlage et sélectionner explicitement la fiche du père après vérification.</p>
    <div className="overflow-x-auto"><table className="w-full text-sm border-collapse"><thead><tr>{["Date", "Mère", "Veau", "Ancienne saisie", "Diagnostic", "Action"].map(h => <th key={h} className="p-2 border text-left">{h}</th>)}</tr></thead><tbody>
    {rows.map(v => <tr key={v.id}><td className="border p-2">{v.date.toLocaleDateString("fr-FR")}</td><td className="border p-2">{v.vache.nutrav}</td><td className="border p-2">{v.veau?.nutrav ?? "—"}</td><td className="border p-2">{v.pereNom ?? "—"} / {v.pereNunati ?? "—"}</td><td className="border p-2">{v.status}{v.matches.length > 0 && <span className="block text-xs">{v.matches.map(b => `${b.nopere ?? "Sans nom"} (${b.nupere})`).join(", ")}</span>}</td><td className="border p-2"><Link className="underline text-green-700" href={`/velage?modifier=${v.id}`}>Vérifier</Link></td></tr>)}
    </tbody></table></div>
    {rows.length === 0 && <p>Aucune ancienne saisie à examiner dans cette sélection.</p>}
  </main>;
}
