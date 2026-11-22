"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "mois" | "annee" | "periode" | "selection";
export default function ChoixImpression({ annee, mois, q, duInitial, auInitial, type = "tous" }: {
  annee: number; mois: number | null; q: string; duInitial?: string; auInitial?: string; type?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("periode");
  const [du, setDu] = useState(duInitial ?? `${annee}-01-01`);
  const [au, setAu] = useState(auInitial ?? `${annee}-12-31`);
  const [erreur, setErreur] = useState("");
  const ouvrir = () => {
    if (mode === "periode" && (!du || !au || du > au)) {
      setErreur("Choisissez deux dates valides, dans l'ordre chronologique.");
      return;
    }
    if (mode === "selection" && !q.trim()) {
      setErreur("Effectuez d&apos;abord une recherche pour imprimer ses résultats.");
      return;
    }
    setErreur("");
    const params = new URLSearchParams({ impression: mode, annee: String(annee), mois: String(mois ?? "tous") });
    if (mode === "periode") { params.set("printDu", du); params.set("printAu", au); }
    if (q.trim()) params.set("q", q);
    if (type !== "tous") params.set("type", type);
    router.push(`/sanitaire/carnet?${params.toString()}#apercu-impression`);
  };
  return <section className="mb-4 rounded-xl border border-green-200 bg-white p-4 print:hidden">
    <h2 className="font-bold text-green-950">Choisir la période à imprimer</h2>
    <div className="mt-3 flex flex-wrap gap-3">
      {([
        ["mois", "Mois affiché"], ["annee", "Année complète"], ["periode", "Dates personnalisées"], ["selection", "Résultats de recherche"]
      ] as const).map(([valeur, libelle]) =>
        <label key={valeur} className="flex items-center gap-2 text-sm"><input type="radio" name="modeImpression" checked={mode === valeur} onChange={() => { setMode(valeur); setErreur(""); }} />{libelle}</label>
      )}
    </div>
    {mode === "periode" && <div className="mt-3 flex flex-wrap gap-3">
      <label className="text-sm">Du <input aria-label="Début de période" type="date" value={du} onChange={(e) => setDu(e.target.value)} className="ml-2 rounded border p-2" /></label>
      <label className="text-sm">Au <input aria-label="Fin de période" type="date" value={au} onChange={(e) => setAu(e.target.value)} className="ml-2 rounded border p-2" /></label>
    </div>}
    {erreur && <p role="alert" className="mt-2 text-sm text-red-700">{erreur}</p>}
    <button type="button" onClick={ouvrir} className="mt-3 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white">Préparer l&apos;impression</button>
    <p className="mt-2 text-xs text-gray-600">Vérifiez l'aperçu, puis utilisez « Imprimer la sélection » pour votre classeur papier.</p>
  </section>;
}
