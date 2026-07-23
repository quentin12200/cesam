"use client";

import { useMemo, useState } from "react";
import { addDays, differenceInDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { ScanLine, X } from "lucide-react";
import { VELAGE_IMMINENT_COLORS } from "@/lib/utils";

const DUREE_GESTATION = 285;
const today = new Date().toISOString().slice(0, 10);

interface Props {
  nutrav: string;
  saillieId?: string | null;
  saillieDate?: string | null;
  initialMode?: "PLANIFIER" | "ENREGISTRER";
  onClose: () => void;
  onDone: () => void;
}

export default function EchoModal({
  nutrav,
  saillieId,
  saillieDate,
  initialMode = "PLANIFIER",
  onClose,
  onDone,
}: Props) {
  const joursDepuisSaillie = saillieDate ? differenceInDays(new Date(), new Date(saillieDate)) : 1;
  const [mode, setMode] = useState<"PLANIFIER" | "ENREGISTRER">(initialMode);
  const [date, setDate] = useState(today);
  const [resultat, setResultat] = useState<"PLEINE" | "VIDE">("PLEINE");
  const [joursGestation, setJoursGestation] = useState(Math.max(1, joursDepuisSaillie));
  const [observation, setObservation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const dateVelagePrevue = useMemo(() => {
    if (mode !== "ENREGISTRER" || resultat !== "PLEINE" || !date) return null;
    return addDays(new Date(date), DUREE_GESTATION - joursGestation);
  }, [date, joursGestation, mode, resultat]);
  const joursRestants = dateVelagePrevue ? differenceInDays(dateVelagePrevue, new Date()) : null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (mode === "ENREGISTRER" && !saillieId) {
      setError("Aucune saillie ou IA n’est disponible pour enregistrer cette échographie.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(
        mode === "PLANIFIER" ? `/api/animaux/${nutrav}/echo-request` : "/api/echographies",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mode === "PLANIFIER" ? {
            datePlanification: date,
            saillieId: saillieId ?? null,
            observation: observation.trim() || undefined,
            motif: "CONTROLE_SUPPLEMENTAIRE",
          } : {
            saillieId,
            date,
            resultat,
            joursGestation: resultat === "PLEINE" ? joursGestation : undefined,
            remarque: observation.trim() || undefined,
          }),
        }
      );
      if (!response.ok) {
        const data = await response.json();
        setError(data.error ?? "Erreur serveur");
        return;
      }
      onDone();
    } catch {
      setError("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-sm sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-bold text-gray-900"><ScanLine size={18} className="text-yellow-600" />Échographie — {nutrav}</h3>
          <button type="button" onClick={onClose} className="inline-flex size-10 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset>
            <legend className="mb-1.5 text-xs font-bold text-gray-700">Que voulez-vous faire ?</legend>
            <div className="grid gap-2">
              <button type="button" onClick={() => setMode("PLANIFIER")} className={`min-h-11 rounded-xl border-2 px-3 text-left text-sm font-bold ${mode === "PLANIFIER" ? "border-yellow-500 bg-yellow-50 text-yellow-900" : "border-gray-200 text-gray-600"}`}>Ajouter à la liste des vaches à échographier</button>
              <button type="button" onClick={() => setMode("ENREGISTRER")} className={`min-h-11 rounded-xl border-2 px-3 text-left text-sm font-bold ${mode === "ENREGISTRER" ? "border-yellow-500 bg-yellow-50 text-yellow-900" : "border-gray-200 text-gray-600"}`}>Enregistrer une échographie</button>
            </div>
          </fieldset>

          <div className="rounded-xl bg-gray-50 px-3 py-2 text-sm"><span className="text-gray-500">Animal</span><strong className="float-right font-mono text-gray-900">{nutrav}</strong></div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{mode === "PLANIFIER" ? "Date de planification" : "Date de l’échographie"}</label>
            <input type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} required className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
            {saillieDate && <p className="mt-1 text-xs text-gray-400">Tentative associée : {format(new Date(saillieDate), "d MMM yyyy", { locale: fr })}</p>}
          </div>

          {mode === "ENREGISTRER" && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">Résultat</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setResultat("PLEINE")} className={`min-h-11 rounded-xl border-2 text-sm font-bold ${resultat === "PLEINE" ? "border-green-500 bg-green-500 text-white" : "border-gray-200 text-gray-600"}`}>✓ Pleine</button>
                  <button type="button" onClick={() => setResultat("VIDE")} className={`min-h-11 rounded-xl border-2 text-sm font-bold ${resultat === "VIDE" ? "border-red-500 bg-red-500 text-white" : "border-gray-200 text-gray-600"}`}>× Vide</button>
                </div>
              </div>

              {resultat === "PLEINE" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Stade de gestation (jours)</label>
                  <div className="flex items-center gap-3">
                    <input type="number" min={1} max={284} value={joursGestation} onChange={(event) => setJoursGestation(Math.max(1, Math.min(284, Number(event.target.value) || 1)))} className="w-24 rounded-xl border border-gray-200 px-3 py-2.5 text-center text-sm font-bold" />
                    <span className="text-sm text-gray-500">jours de gestation</span>
                  </div>
                  {dateVelagePrevue && (
                    <div className={`mt-2 rounded-xl border px-3 py-2.5 text-sm ${joursRestants !== null && joursRestants <= 21 ? `${VELAGE_IMMINENT_COLORS.surface} ${VELAGE_IMMINENT_COLORS.border}` : "border-green-100 bg-green-50"}`}>
                      <div className="flex justify-between"><span className="text-gray-600">Vêlage prévu</span><strong>{format(dateVelagePrevue, "d MMM yyyy", { locale: fr })}</strong></div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Observation (facultative)</label>
            <textarea value={observation} onChange={(event) => setObservation(event.target.value)} rows={2} className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
          </div>

          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
          <button type="submit" disabled={saving || !date} className="min-h-12 w-full rounded-xl bg-yellow-500 px-4 text-sm font-bold text-white hover:bg-yellow-600 disabled:opacity-50">
            {saving ? "Enregistrement…" : mode === "PLANIFIER" ? "Ajouter à la liste" : "Enregistrer l’écho"}
          </button>
        </form>
      </div>
    </div>
  );
}
