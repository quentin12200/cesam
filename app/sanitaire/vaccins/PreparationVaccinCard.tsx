"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, ChevronDown, Printer, Syringe } from "lucide-react";
import type { GroupePreparationVaccin, LignePreparationVaccin } from "@/lib/vaccine-preparation-data";
import { nutravsSelectionnes } from "@/lib/vaccination-session";
import StatutsAConfirmer from "./StatutsAConfirmer";

const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
const sections = [
  { statut: "A_FAIRE", titre: "À faire", couleur: "border-green-500", texte: "text-green-700" },
  { statut: "A_PREVOIR", titre: "Bientôt", couleur: "border-amber-500", texte: "text-amber-700" },
  { statut: "EN_RETARD", titre: "En retard", couleur: "border-red-500", texte: "text-red-700" },
] as const;

export type GroupePreparationVaccinClient = Omit<GroupePreparationVaccin, "lignes" | "flacons"> & {
  lignes: Array<Omit<LignePreparationVaccin, "dateMin" | "dateMax"> & { dateMin: string; dateMax: string }>;
  flacons: Omit<GroupePreparationVaccin["flacons"], "prochaineLimite"> & { prochaineLimite: string | null };
};

function achatConseille(groupe: GroupePreparationVaccinClient): string {
  if (!groupe.conditionnementRenseigne) return "Impossible de calculer — conditionnement non renseigné";
  if (groupe.flacons.achats.length > 0) {
    const formats = groupe.flacons.achats.map((achat) => `${achat.nombre} × ${achat.doses} doses`).join(" + ");
    if (groupe.flacons.perte <= 0) return formats;
    return `${formats} · ${groupe.flacons.perte} dose(s) ${groupe.flacons.conservationConnue ? "restante(s)" : "perdue(s)"}`;
  }
  return groupe.flacons.reliquatUtilise >= groupe.dosesNecessaires ? "Aucun achat nécessaire" : "À confirmer";
}

export default function PreparationVaccinCard({ groupe }: { groupe: GroupePreparationVaccinClient }) {
  const router = useRouter();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const lignes = groupe.lignes.filter((ligne) => ["A_FAIRE", "A_PREVOIR", "EN_RETARD"].includes(ligne.statut));

  function basculer(animalId: string) {
    setSelection((actuelle) => {
      const suivante = new Set(actuelle);
      if (suivante.has(animalId)) suivante.delete(animalId);
      else suivante.add(animalId);
      return suivante;
    });
  }

  function faireSeance() {
    if (selection.size === 0) {
      if (detailsRef.current) detailsRef.current.open = true;
      detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    const nutravs = nutravsSelectionnes(lignes, selection);
    const params = new URLSearchParams({
      animaux: nutravs.join(","),
      protocole: groupe.protocoleId,
      vaccination: "1",
    });
    if (groupe.medicamentId) params.set("medicament", groupe.medicamentId);
    router.push(`/sanitaire/nouvel-evenement?${params.toString()}`);
  }

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <details ref={detailsRef} className="group">
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
          {lignes.length > 0 && <div className="mb-3 flex gap-2"><button type="button" onClick={() => setSelection(new Set(lignes.map((ligne) => ligne.animalId)))} className="min-h-10 rounded-lg border bg-white px-3 text-xs font-semibold">Tout sélectionner</button><button type="button" onClick={() => setSelection(new Set())} className="min-h-10 rounded-lg border bg-white px-3 text-xs font-semibold">Tout désélectionner</button></div>}
          {sections.map((section) => {
            const lignesSection = lignes.filter((ligne) => ligne.statut === section.statut);
            if (lignesSection.length === 0) return null;
            return (
              <div key={section.statut} className="mb-3 last:mb-0">
                <h3 className={`mb-1.5 text-sm font-black ${section.texte}`}>{section.titre} · {lignesSection.length}</h3>
                <div className="divide-y rounded-xl border bg-white">
                  {lignesSection.map((ligne) => (
                    <label key={`${ligne.animalId}-${ligne.injection}`} className={`grid cursor-pointer grid-cols-[1.5rem_1fr] gap-2 border-l-4 p-2.5 ${section.couleur} sm:grid-cols-[1.5rem_1.2fr_1fr_1.4fr_.9fr] sm:items-center`}>
                      <input type="checkbox" checked={selection.has(ligne.animalId)} onChange={() => basculer(ligne.animalId)} className="h-5 w-5 accent-green-700" />
                      <div><p><b className="font-mono text-sm text-gray-950">{ligne.nutrav}</b>{ligne.nom && <span className="ml-2 text-sm text-gray-600">{ligne.nom}</span>}</p>{ligne.mere && <p className="text-xs text-gray-500">{ligne.mere}</p>}</div>
                      <p className="text-sm font-semibold text-gray-800">{ligne.injection}</p>
                      <p className="text-xs text-gray-600"><span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {ligne.repere}</span><br />Fenêtre {dateCourte.format(new Date(ligne.dateMin))} → {dateCourte.format(new Date(ligne.dateMax))}</p>
                      <p className="text-xs text-gray-700">{ligne.dose} · {ligne.voie}<br /><span className={`font-bold ${section.texte}`}>{section.titre}</span></p>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
          {lignes.length === 0 && groupe.aConfirmer.length === 0 && <p className="py-5 text-center text-sm text-gray-500">Rien à préparer pour ce vaccin.</p>}
        </div>
      </details>

      <div className="grid grid-cols-2 gap-2 border-t p-3">
        <Link href={`/sanitaire/vaccins/impression?protocole=${groupe.protocoleId}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-300 px-3 text-center text-sm font-semibold text-gray-800"><Printer size={17} /> Préparer / imprimer</Link>
        <button type="button" onClick={faireSeance} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-green-700 px-3 text-center text-sm font-semibold text-white"><Syringe size={17} /> Faire la séance{selection.size > 0 ? ` (${selection.size})` : ""}</button>
      </div>
    </section>
  );
}
