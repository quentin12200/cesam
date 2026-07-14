"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { CAUSES_MORTALITE, CAUSES_MORTALITE_LABELS } from "@/lib/utils";

export type SortieType = "ELEVAGE" | "BOUCHERIE" | "MORT";

export interface SortieAnimalOption {
  id: string;
  nutrav: string;
  nobovi: string | null;
  sexbov?: string;
}

export interface SortieEditorValues {
  animalId: string;
  date: string;
  type: SortieType;
  acheteur: string | null;
  poids: number | null;
  prixKilo: number | null;
  prixDefinitifHT: number | null;
  notes: string | null;
  causeMortalite: string | null;
  confirmeAttente: boolean;
}

interface InitialValues {
  animalId?: string;
  date: string;
  type: string;
  acheteur?: string | null;
  poids?: number | null;
  prixKilo?: number | null;
  prixDefinitifHT?: number | null;
  notes?: string | null;
  causeMortalite?: string | null;
}

interface AttenteInfo {
  enAttente: boolean;
  enAttenteViande: boolean;
  enAttenteLait: boolean;
  dateFinAttenteViande: string | null;
  dateFinAttenteLait: string | null;
  medicamentNom: string | null;
}

interface Props {
  title: string;
  initial: InitialValues;
  animalLabel?: string;
  animals?: SortieAnimalOption[];
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (values: SortieEditorValues) => Promise<void>;
  onDelete?: () => Promise<void>;
}

const TYPE_OPTIONS: Array<{ value: SortieType; label: string }> = [
  { value: "ELEVAGE", label: "Vente vif" },
  { value: "BOUCHERIE", label: "Boucherie" },
  { value: "MORT", label: "Mort" },
];

function nombreInitial(value: number | null | undefined) {
  return value == null ? "" : String(Math.round(value * 100) / 100);
}

export default function SortieEditorModal({
  title,
  initial,
  animalLabel,
  animals,
  submitLabel = "Enregistrer",
  onClose,
  onSubmit,
  onDelete,
}: Props) {
  const [animalId, setAnimalId] = useState(initial.animalId ?? "");
  const [date, setDate] = useState(initial.date);
  const [type, setType] = useState(initial.type === "ENGRAISSEMENT" ? "" : initial.type);
  const [acheteur, setAcheteur] = useState(initial.acheteur ?? "");
  const [poids, setPoids] = useState(nombreInitial(initial.poids));
  const [prixKilo, setPrixKilo] = useState(nombreInitial(initial.prixKilo));
  const [prixDefinitifHT, setPrixDefinitifHT] = useState(nombreInitial(initial.prixDefinitifHT));
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [causeMortalite, setCauseMortalite] = useState(initial.causeMortalite ?? "");
  const [causesPersonnalisees, setCausesPersonnalisees] = useState<string[]>([]);
  const [attenteInfo, setAttenteInfo] = useState<AttenteInfo | null>(null);
  const [confirmeAttente, setConfirmeAttente] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasFinancials = type === "ELEVAGE" || type === "BOUCHERIE";
  const montantCalcule = useMemo(() => {
    if (!poids || !prixKilo) return null;
    const montant = parseFloat(poids) * parseFloat(prixKilo);
    return Number.isFinite(montant) ? Math.round(montant * 100) / 100 : null;
  }, [poids, prixKilo]);
  const montantFormate = montantCalcule?.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  useEffect(() => {
    setConfirmeAttente(false);
    if (!animalId) {
      setAttenteInfo(null);
      return;
    }
    fetch(`/api/traitements/attente?animalId=${animalId}`)
      .then((r) => r.json())
      .then(setAttenteInfo)
      .catch(() => setAttenteInfo(null));
  }, [animalId]);

  useEffect(() => {
    if (type !== "MORT") return;
    fetch("/api/sorties/causes")
      .then((r) => r.json())
      .then((causes: string[]) => {
        const predefinies = new Set<string>(CAUSES_MORTALITE);
        setCausesPersonnalisees(causes.filter((cause) => !predefinies.has(cause)));
      })
      .catch(() => {});
  }, [type]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if ((animals && !animalId) || !date || !TYPE_OPTIONS.some((option) => option.value === type)) {
      setError("Animal, date et type sont obligatoires");
      return;
    }
    if (type === "MORT" && !causeMortalite) {
      setError("La cause de mortalité est obligatoire");
      return;
    }
    if (type === "BOUCHERIE" && attenteInfo?.enAttenteViande && !confirmeAttente) {
      setError("Cet animal est encore en délai d'attente viande. Coche la confirmation pour continuer.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSubmit({
        animalId,
        date,
        type: type as SortieType,
        acheteur: hasFinancials && acheteur ? acheteur : null,
        poids: hasFinancials && poids ? parseFloat(poids) : null,
        prixKilo: hasFinancials && prixKilo ? parseFloat(prixKilo) : null,
        prixDefinitifHT: hasFinancials && prixDefinitifHT ? Math.round(parseFloat(prixDefinitifHT) * 100) / 100 : null,
        notes: notes || null,
        causeMortalite: type === "MORT" ? causeMortalite : null,
        confirmeAttente,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setLoading(false);
    }
  }

  async function supprimer() {
    if (!onDelete || !confirm("Supprimer cette sortie ?")) return;
    setLoading(true);
    setError(null);
    try {
      await onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-t-xl sm:rounded-lg shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-800">{title}</h3>
            {animalLabel && <p className="text-xs text-gray-500 truncate">{animalLabel}</p>}
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Fermer">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={submit} className="p-4 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}

          {animals && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Animal *</label>
              <select value={animalId} onChange={(e) => setAnimalId(e.target.value)} required
                className="w-full min-h-11 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="">Sélectionner un animal…</option>
                {animals.map((animal) => (
                  <option key={animal.id} value={animal.id}>
                    {animal.nutrav} — {animal.nobovi ?? "Sans nom"}{animal.sexbov ? ` (${animal.sexbov})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {attenteInfo?.enAttente && (
            <div className="bg-orange-50 border border-orange-300 rounded-lg p-3 text-sm">
              <div className="flex items-start gap-2 text-orange-800 font-medium">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>
                  Délai d&apos;attente en cours
                  {attenteInfo.dateFinAttenteViande && ` pour la viande jusqu'au ${new Date(attenteInfo.dateFinAttenteViande).toLocaleDateString("fr-FR")}`}
                  {attenteInfo.medicamentNom && ` (${attenteInfo.medicamentNom})`}.
                </span>
              </div>
              {type === "BOUCHERIE" && attenteInfo.enAttenteViande && (
                <label className="flex items-start gap-2 mt-2 text-orange-900">
                  <input type="checkbox" checked={confirmeAttente} onChange={(e) => setConfirmeAttente(e.target.checked)} className="mt-0.5" />
                  <span className="text-xs">Je confirme être informé du délai et je valide cette sortie.</span>
                </label>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type de sortie</label>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map((option) => (
                <button key={option.value} type="button" onClick={() => setType(option.value)}
                  className={`min-h-12 px-2 rounded-lg border text-sm font-medium transition-colors ${type === option.value ? "border-green-600 bg-green-50 text-green-800" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"}`}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
              className="w-full min-h-11 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>

          {hasFinancials && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Acheteur</label>
                <input value={acheteur} onChange={(e) => setAcheteur(e.target.value)}
                  className="w-full min-h-11 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {type === "BOUCHERIE" ? "Poids carcasse (kg)" : "Poids vif (kg)"}
                  </label>
                  <input type="number" min="0" step="0.1" value={poids} onChange={(e) => setPoids(e.target.value)}
                    className="w-full min-h-11 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {type === "BOUCHERIE" ? "Prix / kg carcasse (€)" : "Prix / kg (€)"}
                  </label>
                  <input type="number" min="0" step="0.01" value={prixKilo} onChange={(e) => setPrixKilo(e.target.value)}
                    className="w-full min-h-11 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
              {montantFormate && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                  <span className="text-gray-600">Prix calculé : </span>
                  <span className="font-bold text-green-700 text-base">{montantFormate} € HT</span>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prix définitif HT (€)</label>
                <input type="number" min="0" step="0.01" value={prixDefinitifHT} onChange={(e) => setPrixDefinitifHT(e.target.value)}
                  placeholder={montantCalcule?.toFixed(2) ?? ""}
                  className="w-full min-h-11 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </>
          )}

          {type === "MORT" && (
            <div>
              <label className="block text-sm font-medium text-red-700 mb-1">Cause de mortalité *</label>
              <select value={causeMortalite} onChange={(e) => setCauseMortalite(e.target.value)}
                className="w-full min-h-11 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                <option value="">Sélectionner…</option>
                {CAUSES_MORTALITE.map((cause) => <option key={cause} value={cause}>{CAUSES_MORTALITE_LABELS[cause] ?? cause}</option>)}
                {causesPersonnalisees.map((cause) => <option key={cause} value={cause}>{cause}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>

          <div className="flex gap-3 pt-2">
            {onDelete && (
              <button type="button" onClick={supprimer} disabled={loading}
                className="min-h-11 px-3 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50">
                Supprimer
              </button>
            )}
            <button type="button" onClick={onClose} className="min-h-11 flex-1 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium">Annuler</button>
            <button type="submit" disabled={loading} className="min-h-11 flex-1 bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {loading ? "Enregistrement…" : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

