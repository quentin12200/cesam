export const dynamic = "force-dynamic";

import Link from "next/link";
import { CalendarDays, ChevronDown, PackageOpen, Printer, Syringe } from "lucide-react";
import { getPreparationsVaccinales, type GroupePreparationVaccin } from "@/lib/vaccine-preparation-data";
import StatutsAConfirmer from "./StatutsAConfirmer";

const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });

function achatConseille(groupe: GroupePreparationVaccin): string {
  if (!groupe.conditionnementRenseigne) return "Impossible de calculer — conditionnement non renseigné";
  if (groupe.flacons.nombre > 0 && groupe.flacons.dosesParConditionnement) {
    return `${groupe.flacons.nombre} × ${groupe.flacons.dosesParConditionnement} doses`;
  }
  return groupe.flacons.reliquatUtilise >= groupe.dosesNecessaires ? "Aucun achat nécessaire" : "À confirmer";
}

const sections = [
  { statut: "A_FAIRE", titre: "À faire", couleur: "border-green-500", texte: "text-green-700" },
  { statut: "A_PREVOIR", titre: "Bientôt", couleur: "border-amber-500", texte: "text-amber-700" },
  { statut: "EN_RETARD", titre: "En retard", couleur: "border-red-500", texte: "text-red-700" },
] as const;

export default async function VaccinsPage() {
  const groupes = await getPreparationsVaccinales();

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4 pb-24">
      <header>
        <h1 className="text-2xl font-black text-gray-900">Vaccins</h1>
        <p className="text-sm text-gray-500">Le travail à préparer, vaccin par vaccin.</p>
      </header>

      <nav className="grid grid-cols-3 rounded-xl bg-gray-100 p-1 text-center text-sm font-semibold">
        <Link href="/sanitaire/vaccins" className="rounded-lg bg-white px-2 py-2.5 text-green-800 shadow-sm">À préparer</Link>
        <Link href="/config/protocoles" className="rounded-lg px-2 py-2.5 text-gray-600">Protocoles</Link>
        <Link href="#stock" className="rounded-lg px-2 py-2.5 text-gray-600">Stock / flacons</Link>
      </nav>

      {groupes.length === 0 && <section className="rounded-xl bg-white p-8 text-center text-sm text-gray-500 shadow-sm">Aucun protocole vaccinal actif.</section>}
      {groupes.map((groupe) => (
        <section key={groupe.protocoleId} className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <details className="group">
            <summary className="cursor-pointer list-none p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-xl font-black text-gray-950">{groupe.vaccin}</h2>
                  <p className="mt-1 text-sm text-gray-700"><b>{groupe.aFaire}</b> à faire · <b>{groupe.bientot}</b> bientôt · <b className={groupe.enRetard > 0 ? "text-red-700" : ""}>{groupe.enRetard}</b> en retard</p>
                </div>
                <span className="flex items-center gap-1 text-xs font-semibold text-gray-500">Voir les animaux <ChevronDown size={16} className="transition group-open:rotate-180" /></span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                <p><span className="block text-xs text-gray-400">Dose</span><b>{groupe.dose}</b></p>
                <p><span className="block text-xs text-gray-400">Voie</span><b>{groupe.voie}</b></p>
                <p><span className="block text-xs text-gray-400">Besoin total</span><b>{groupe.dosesNecessaires} doses</b></p>
                <p><span className="block text-xs text-gray-400">Achat conseillé</span><b>{achatConseille(groupe)}</b></p>
              </div>
              <p className="mt-2 text-xs text-gray-500">Reliquat utilisable : <b>{groupe.flacons.reliquatUtilise} dose(s)</b>{groupe.aConfirmer.length > 0 ? ` · ${groupe.aConfirmer.length} statut(s) à préciser` : ""}</p>
            </summary>

            <div className="border-t bg-gray-50 p-3 sm:p-4">
              {groupe.aConfirmer.length > 0 && <div className="mb-3 overflow-hidden rounded-xl border bg-white"><StatutsAConfirmer protocoleId={groupe.protocoleId} animaux={groupe.aConfirmer} /></div>}
              {sections.map((section) => {
                const lignes = groupe.lignes.filter((ligne) => ligne.statut === section.statut);
                if (lignes.length === 0) return null;
                return (
                  <div key={section.statut} className="mb-3 last:mb-0">
                    <h3 className={`mb-1.5 text-sm font-black ${section.texte}`}>{section.titre} · {lignes.length}</h3>
                    <div className="divide-y rounded-xl border bg-white">
                      {lignes.map((ligne) => (
                        <article key={`${ligne.animalId}-${ligne.injection}`} className={`grid gap-1 border-l-4 p-2.5 ${section.couleur} sm:grid-cols-[1.2fr_1fr_1.4fr_.9fr] sm:items-center`}>
                          <p><b className="font-mono text-sm text-gray-950">{ligne.nutrav}</b>{ligne.nom && <span className="ml-2 text-sm text-gray-600">{ligne.nom}</span>}</p>
                          <p className="text-sm font-semibold text-gray-800">{ligne.injection}</p>
                          <p className="text-xs text-gray-600"><span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {ligne.repere}</span><br />Fenêtre {dateCourte.format(ligne.dateMin)} → {dateCourte.format(ligne.dateMax)}</p>
                          <p className="text-xs text-gray-700">{ligne.dose} · {ligne.voie}<br /><span className={`font-bold ${section.texte}`}>{section.titre}</span></p>
                        </article>
                      ))}
                    </div>
                  </div>
                );
              })}
              {groupe.aFaire + groupe.bientot + groupe.enRetard === 0 && groupe.aConfirmer.length === 0 && <p className="py-5 text-center text-sm text-gray-500">Rien à préparer pour ce vaccin.</p>}
            </div>
          </details>

          <div className="grid grid-cols-2 gap-2 border-t p-3">
            <Link href={`/sanitaire/vaccins/impression?protocole=${groupe.protocoleId}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-300 px-3 text-center text-sm font-semibold text-gray-800"><Printer size={17} /> Préparer / imprimer</Link>
            <Link href="/sanitaire" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-green-700 px-3 text-center text-sm font-semibold text-white"><Syringe size={17} /> Faire la séance</Link>
          </div>
        </section>
      ))}

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
                <dt className="text-gray-500">Achat conseillé</dt><dd className="text-right font-semibold">{achatConseille(groupe)}</dd>
              </dl>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
