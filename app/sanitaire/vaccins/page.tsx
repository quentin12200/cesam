export const dynamic = "force-dynamic";

import Link from "next/link";
import { PackageOpen } from "lucide-react";
import { getPreparationsVaccinales } from "@/lib/vaccine-preparation-data";
import PreparationVaccinCard from "./PreparationVaccinCard";

const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });

function achatConseille(achats: Array<{ doses: number; nombre: number }>, perte: number, conservationConnue: boolean): string {
  if (achats.length === 0) return "Aucun achat nécessaire";
  const formats = achats.map((achat) => `${achat.nombre} × ${achat.doses} doses`).join(" + ");
  if (perte <= 0) return formats;
  return `${formats} · ${perte} dose(s) ${conservationConnue ? "restante(s)" : "perdue(s)"}`;
}

export default async function VaccinsPage() {
  const groupes = await getPreparationsVaccinales();
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4 pb-24">
      <header><h1 className="text-2xl font-black text-gray-900">Vaccins</h1><p className="text-sm text-gray-500">Le travail à préparer, vaccin par vaccin.</p></header>
      <nav className="grid grid-cols-3 rounded-xl bg-gray-100 p-1 text-center text-sm font-semibold">
        <Link href="/sanitaire/vaccins" className="rounded-lg bg-white px-2 py-2.5 text-green-800 shadow-sm">À préparer</Link>
        <Link href="/config/protocoles" className="rounded-lg px-2 py-2.5 text-gray-600">Protocoles</Link>
        <Link href="#stock" className="rounded-lg px-2 py-2.5 text-gray-600">Stock / flacons</Link>
      </nav>
      {groupes.length === 0 && <section className="rounded-xl bg-white p-8 text-center text-sm text-gray-500 shadow-sm">Aucun protocole vaccinal actif.</section>}
      {groupes.map((groupe) => <PreparationVaccinCard key={groupe.protocoleId} groupe={{
        ...groupe,
        lignes: groupe.lignes.map((ligne) => ({ ...ligne, dateMin: ligne.dateMin.toISOString(), dateMax: ligne.dateMax.toISOString() })),
        flacons: { ...groupe.flacons, prochaineLimite: groupe.flacons.prochaineLimite?.toISOString() ?? null },
      }} />)}
      <section id="stock" className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 font-bold text-gray-900"><PackageOpen size={18} /> Stock / flacons</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {groupes.map((groupe) => (
            <div key={groupe.protocoleId} className="rounded-xl border p-3 text-sm">
              <b>{groupe.vaccin}</b>
              <dl className="mt-2 grid grid-cols-2 gap-1 text-xs">
                <dt className="text-gray-500">Stock Pharmacie</dt><dd className="text-right font-semibold">{groupe.stockPharmacie}</dd>
                <dt className="text-gray-500">Flacons ouverts</dt><dd className="text-right font-semibold">{groupe.flacons.ouverts}</dd>
                <dt className="text-gray-500">Doses restantes</dt><dd className="text-right font-semibold">{groupe.flacons.dosesRestantes}</dd>
                <dt className="text-gray-500">Prochaine limite</dt><dd className="text-right font-semibold">{groupe.flacons.prochaineLimite ? dateCourte.format(groupe.flacons.prochaineLimite) : "—"}</dd>
                <dt className="text-gray-500">Besoin à venir</dt><dd className="text-right font-semibold">{groupe.dosesNecessaires} doses</dd>
                <dt className="text-gray-500">Achat conseillé</dt><dd className="text-right font-semibold">{groupe.conditionnementRenseigne ? achatConseille(groupe.flacons.achats, groupe.flacons.perte, groupe.flacons.conservationConnue) : "Impossible de calculer — conditionnement non renseigné"}</dd>
              </dl>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
