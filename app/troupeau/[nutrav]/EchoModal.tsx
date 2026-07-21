"use client";

import { useState, useMemo } from "react";
import { addDays, differenceInDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { X, ScanLine } from "lucide-react";
import { VELAGE_IMMINENT_COLORS } from "@/lib/utils";

const DUREE_GESTATION = 285;
const today = new Date().toISOString().slice(0, 10);

interface Props {
  nutrav: string;
  saillieId: string;
  saillieDate: string; // ISO string
  onClose: () => void;
  onDone: () => void;
}

export default function EchoModal({ nutrav, saillieId, saillieDate, onClose, onDone }: Props) {
  const joursDepuisSaillie = differenceInDays(new Date(), new Date(saillieDate));

  const [date, setDate] = useState(today);
  const [resultat, setResultat] = useState<"PLEINE" | "VIDE">("PLEINE");
  const [joursGestation, setJoursGestation] = useState(Math.max(1, joursDepuisSaillie));
  const [remarque, setRemarque] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const dateVelagePrevue = useMemo(() => {
    if (resultat !== "PLEINE" || !date) return null;
    return addDays(new Date(date), DUREE_GESTATION - joursGestation);
  }, [date, resultat, joursGestation]);

  const joursRestants = dateVelagePrevue
    ? differenceInDays(dateVelagePrevue, new Date())
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/echographies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saillieId,
          date,
          resultat,
          joursGestation: resultat === "PLEINE" ? joursGestation : undefined,
          remarque: remarque.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
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
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => { if (e.currentTarget === e.target) onClose(); }}
    >
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <ScanLine size={18} className="text-yellow-600" />
            Résultat échographie — {nutrav}
          </h3>
          <button onClick={onClose}>
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date de l&apos;écho</label>
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
            {date && (
              <p className="text-xs text-gray-400 mt-1">
                Saillie le {format(new Date(saillieDate), "d MMM yyyy", { locale: fr })} ·{" "}
                {differenceInDays(new Date(date), new Date(saillieDate))} j après la saillie
              </p>
            )}
          </div>

          {/* Résultat */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Résultat</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setResultat("PLEINE")}
                className={`py-3 rounded-xl text-sm font-bold border-2 transition-colors ${
                  resultat === "PLEINE"
                    ? "bg-green-500 text-white border-green-500"
                    : "border-gray-200 text-gray-600 hover:border-green-300"
                }`}
              >
                ✓ Pleine
              </button>
              <button
                type="button"
                onClick={() => setResultat("VIDE")}
                className={`py-3 rounded-xl text-sm font-bold border-2 transition-colors ${
                  resultat === "VIDE"
                    ? "bg-red-500 text-white border-red-500"
                    : "border-gray-200 text-gray-600 hover:border-red-300"
                }`}
              >
                ✗ Vide
              </button>
            </div>
          </div>

          {/* Stade gestation (si pleine) */}
          {resultat === "PLEINE" && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Stade de gestation (jours)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={284}
                  value={joursGestation}
                  onChange={(e) => setJoursGestation(Math.max(1, Math.min(284, parseInt(e.target.value) || 1)))}
                  className="w-24 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-green-400"
                />
                <span className="text-sm text-gray-500">jours de gestation</span>
              </div>

              {/* Aperçu date vêlage */}
              {dateVelagePrevue && (
                <div className={`mt-2 px-3 py-2.5 rounded-xl text-sm ${
                  joursRestants !== null && joursRestants <= 21
                    ? `${VELAGE_IMMINENT_COLORS.surface} border ${VELAGE_IMMINENT_COLORS.border}`
                    : "bg-green-50 border border-green-100"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Vêlage prévu</span>
                    <span className="font-bold text-gray-800">
                      {format(dateVelagePrevue, "d MMM yyyy", { locale: fr })}
                    </span>
                  </div>
                  {joursRestants !== null && (
                    <p className={`text-xs mt-0.5 ${joursRestants <= 21 ? `${VELAGE_IMMINENT_COLORS.text} font-semibold` : "text-gray-400"}`}>
                      {joursRestants > 0 ? `Dans ${joursRestants} jours` : "Terme dépassé"}
                      {joursRestants <= 21 && joursRestants > 0 && " — Imminent ⚠"}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Remarque */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Remarque (optionnel)</label>
            <textarea
              value={remarque}
              onChange={(e) => setRemarque(e.target.value)}
              placeholder="Ex: jumeaux suspectés, mauvaise qualité…"
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={saving || !date}
            className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-bold text-sm disabled:opacity-50 transition-colors"
          >
            {saving ? "Enregistrement…" : "Enregistrer l'écho"}
          </button>
        </form>
      </div>
    </div>
  );
}
