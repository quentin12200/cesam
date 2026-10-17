"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RapportMhe2026 } from "@/lib/mhe-2026-import";

export default function Mhe2026Sync() {
  const router = useRouter();
  const [rapport, setRapport] = useState<RapportMhe2026 | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [applique, setApplique] = useState(false);

  async function executer(appliquer: boolean) {
    setChargement(true);
    setErreur(null);
    if (!appliquer) { setRapport(null); setApplique(false); }
    try {
      const response = await fetch("/api/protocoles/import-mhe-2026", appliquer
        ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "IMPORT_MHE_2026" }) }
        : { method: "GET", cache: "no-store" });
      const result = await response.json().catch(() => ({ error: "Réponse invalide du serveur." }));
      if (!response.ok) throw new Error(result.error || "Synchronisation impossible.");
      setRapport(result as RapportMhe2026);
      setApplique(appliquer);
      if (appliquer) router.refresh();
    } catch (error) {
      setErreur(error instanceof Error ? error.message : "Erreur réseau.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3" aria-label="Synchroniser MHE 2026">
      <div>
        <h3 className="font-semibold text-slate-800">Synchroniser MHE 2026</h3>
        <p className="text-sm text-slate-600">Historique HEPIZOVAC validé : 54 animaux, 108 actes attendus. Analysez avant d’appliquer.</p>
      </div>
      <button type="button" disabled={chargement} onClick={() => void executer(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium disabled:opacity-50">{chargement ? "Chargement…" : "Analyser"}</button>
      {erreur && <p role="alert" className="text-sm text-red-700">{erreur}</p>}
      {rapport && (
        <div className="space-y-2 text-sm text-slate-700" aria-live="polite">
          <p>{applique ? "Synchronisation appliquée." : "Analyse seule : aucune donnée modifiée."}</p>
          <p>Animaux : {rapport.animauxTrouves}/{rapport.animauxAttendus} trouvés · {rapport.animauxAbsents} absents. Actes : {rapport.actesAttendus} attendus · {rapport.dejaCorrects} déjà corrects · {applique ? rapport.rattaches : rapport.aRattacher} {applique ? "rattachés" : "à rattacher"} · {applique ? rapport.crees : rapport.aCreer} {applique ? "créés" : "à créer"} · {rapport.conflits} conflits.</p>
          {rapport.absents.length > 0 && <p>Absents : {rapport.absents.join(", ")}</p>}
          {rapport.exemplesConflits.length > 0 && <p>Conflits : {rapport.exemplesConflits.join(" ; ")}</p>}
          {!applique && <button type="button" disabled={chargement} onClick={() => void executer(true)} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-50">Appliquer la synchronisation</button>}
        </div>
      )}
    </section>
  );
}
