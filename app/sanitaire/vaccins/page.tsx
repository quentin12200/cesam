export const dynamic = "force-dynamic";

import Link from "next/link";
import { CalendarDays, PackageOpen, Printer } from "lucide-react";
import { getPreparationsVaccinales } from "@/lib/vaccine-preparation-data";
import StatutsAConfirmer from "./StatutsAConfirmer";

const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });

function statutClasse(statut: string): string {
  if (statut === "EN_RETARD") return "border-red-300 bg-red-50 text-red-800";
  if (statut === "A_FAIRE") return "border-green-300 bg-green-50 text-green-800";
  if (statut === "A_PREVOIR") return "border-amber-300 bg-amber-50 text-amber-800";
  return "border-gray-200 bg-gray-50 text-gray-500";
}

function statutLabel(statut: string): string {
  return ({ EN_RETARD: "En retard", A_FAIRE: "À faire", A_PREVOIR: "À prévoir", TROP_TOT: "Trop tôt" } as Record<string, string>)[statut] ?? statut;
}

export default async function VaccinsPage() {
  const groupes = await getPreparationsVaccinales();

  return (
    <main className="mx-auto max-w-5xl space-y-3 p-3 pb-24 sm:space-y-4 sm:p-4">
      <header>
        <h1 className="text-2xl font-black text-gray-900">Vaccins</h1>
        <p className="text-sm text-gray-500">Qui vacciner, quand et avec quelle injection.</p>
      </header>

      <nav className="grid grid-cols-3 rounded-xl bg-gray-100 p-1 text-center text-xs font-semibold sm:text-sm">
        <Link href="/sanitaire/vaccins" className="rounded-lg bg-white px-1 py-2.5 text-green-800 shadow-sm sm:px-2">À préparer</Link>
        <Link href="/config/protocoles" className="rounded-lg px-1 py-2.5 text-gray-600 sm:px-2">Protocoles</Link>
        <Link href="#stock" className="rounded-lg px-1 py-2.5 text-gray-600 sm:px-2">Stock / flacons</Link>
      </nav>

      {groupes.length === 0 && <section className="rounded-xl bg-white p-8 text-center text-sm text-gray-500 shadow-sm">Aucun protocole vaccinal actif.</section>}
      {groupes.map((groupe) => {
        const visibles = groupe.lignes.filter((ligne) => ligne.statut !== "TROP_TOT");
        const aDuTravail = visibles.length > 0;
        const aSeulementInitialiser = !aDuTravail && groupe.aConfirmer.length > 0;

        return (
          <section key={groupe.protocoleId} className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className={`border-b ${aSeulementInitialiser ? "p-3" : "flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4"}`}>
              <div className="min-w-0 flex-1">
                <h2 className="break-words text-base font-black leading-tight text-gray-900 sm:text-lg">{groupe.vaccin}</h2>
                <p className="mt-1 text-sm text-gray-600"><b>{groupe.aFaire}</b> à faire · <b>{groupe.bientot}</b> bientôt · <b>{groupe.enRetard}</b> en retard</p>
              </div>
              {aDuTravail && (
                <Link href={`/sanitaire/vaccins/impression?protocole=${groupe.protocoleId}`} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-3 text-sm font-semibold text-gray-800 sm:w-auto">
                  <Printer size={17} /> Préparer / imprimer
                </Link>
              )}
            </div>

            {groupe.aConfirmer.length > 0 && <StatutsAConfirmer protocoleId={groupe.protocoleId} animaux={groupe.aConfirmer} />}
            {visibles.length === 0 && groupe.aConfirmer.length === 0 ? <p className="p-4 text-center text-sm text-gray-500">Rien à préparer pour le moment.</p> : visibles.length > 0 ? (
              <div className="divide-y">
                {visibles.map((ligne) => (
                  <article key={`${ligne.animalId}-${ligne.injection}`} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 p-3 sm:grid-cols-[1.1fr_1fr_1.35fr_1.5fr_.8fr] sm:items-center sm:gap-2">
                    <div className="min-w-0"><span aria-hidden="true" className="mr-2 text-lg text-gray-400">☐</span><b className="font-mono text-base text-gray-950">{ligne.nutrav}</b>{ligne.nom && <span className="ml-2 text-sm text-gray-500">{ligne.nom}</span>}</div>
                    <div className="col-span-2 text-sm sm:col-auto"><span className="text-xs text-gray-400 sm:hidden">Injection · </span><b className="text-gray-800">{ligne.injection}</b></div>
                    <div className="col-span-2 text-xs text-gray-600 sm:col-auto"><span className="inline-flex items-center gap-1"><CalendarDays size={13} /> {ligne.repere}</span><span className="ml-2 whitespace-nowrap">{dateCourte.format(ligne.dateMin)} → {dateCourte.format(ligne.dateMax)}</span></div>
                    <div className="hidden text-xs text-gray-500 sm:block">{ligne.groupe}</div>
                    <div className="col-span-2 mt-1 flex items-center justify-between gap-2 sm:col-auto sm:mt-0 sm:block"><span className="text-xs font-semibold text-gray-700">{ligne.dose}</span><span className={`rounded-full border px-2 py-1 text-[11px] font-bold sm:ml-2 ${statutClasse(ligne.statut)}`}>{statutLabel(ligne.statut)}</span></div>
                  </article>
                ))}
              </div>
            ) : null}

            {(groupe.termines > 0 || groupe.lignes.some((ligne) => ligne.statut === "TROP_TOT")) && (
              <details className="border-t px-4 py-2.5 text-xs text-gray-500">
                <summary className="cursor-pointer">{groupe.termines} terminé(s) · {groupe.lignes.filter((ligne) => ligne.statut === "TROP_TOT").length} trop tôt</summary>
              </details>
            )}
          </section>
        );
      })}

      <section id="stock" className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 font-bold text-gray-900"><PackageOpen size={18} /> Stock / flacons</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {groupes.filter((groupe) => groupe.dosesNecessaires > 0).map((groupe) => (
            <div key={groupe.protocoleId} className="rounded-xl border p-3 text-sm">
              <b>{groupe.vaccin}</b><p className="mt-1 text-gray-600">{groupe.dosesNecessaires} dose(s) nécessaire(s)</p>
              <p className="text-xs text-gray-500">{!groupe.conditionnementRenseigne ? "Impossible de calculer — conditionnement non renseigné" : <>{groupe.flacons.reliquatUtilise > 0 ? `${groupe.flacons.reliquatUtilise} dose(s) de reliquat valide · ` : ""}{groupe.flacons.dosesParConditionnement ? `${groupe.flacons.nombre} × ${groupe.flacons.dosesParConditionnement} doses` : groupe.flacons.reliquatUtilise >= groupe.dosesNecessaires ? "Reliquat suffisant" : "Conditionnement insuffisant"}</>}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
