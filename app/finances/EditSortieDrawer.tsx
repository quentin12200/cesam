"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Pencil, AlertTriangle } from "lucide-react";
import { CAUSES_MORTALITE, CAUSES_MORTALITE_LABELS } from "@/lib/utils";

interface Sortie {
  id: string;
  date: string;
  type: string;
  acheteur: string | null;
  poids: number | null;
  poidsVif: number | null;
  rendementCarcasse: number | null;
  prixKilo: number | null;
  prixDefinitifHT: number | null;
  prixPrevuHT: number | null;
  notes: string | null;
  causeMortalite: string | null;
  animalId: string;
  animal: { nutrav: string; nobovi: string | null };
}

interface AttenteInfo {
  enAttente: boolean;
  enAttenteViande: boolean;
  enAttenteLait: boolean;
  dateFinAttenteViande: string | null;
  dateFinAttenteLait: string | null;
  medicamentNom: string | null;
}

const TYPE_OPTIONS = [
  { value: "ELEVAGE", label: "Vente vif" },
  { value: "BOUCHERIE", label: "Boucherie" },
  { value: "ENGRAISSEMENT", label: "Engraissement" },
  { value: "MORT", label: "Mort" },
];

export default function EditSortieDrawer({ sortie }: { sortie: Sortie }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(new Date(sortie.date).toISOString().slice(0, 10));
  const [type, setType] = useState(sortie.type);
  const [acheteur, setAcheteur] = useState(sortie.acheteur ?? "");
  const [poids, setPoids] = useState(sortie.poids?.toString() ?? "");
  const [poidsVif, setPoidsVif] = useState(sortie.poidsVif?.toString() ?? "");
  const [rendementCarcasse, setRendementCarcasse] = useState(sortie.rendementCarcasse?.toString() ?? "55");
  const [prixKilo, setPrixKilo] = useState(sortie.prixKilo?.toString() ?? "");
  const [prixDefinitifHT, setPrixDefinitifHT] = useState(sortie.prixDefinitifHT?.toString() ?? "");
  const [notes, setNotes] = useState(sortie.notes ?? "");
  const [causeMortalite, setCauseMortalite] = useState(sortie.causeMortalite ?? "");
  const [attenteInfo, setAttenteInfo] = useState<AttenteInfo | null>(null);
  const [confirmeAttente, setConfirmeAttente] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/traitements/attente?animalId=${sortie.animalId}`)
      .then((r) => r.json())
      .then(setAttenteInfo)
      .catch(() => setAttenteInfo(null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const hasFinancials = type === "ELEVAGE" || type === "BOUCHERIE";

  const poidsCarcasseCalc =
    type === "BOUCHERIE" && poidsVif && rendementCarcasse
      ? (parseFloat(poidsVif) * parseFloat(rendementCarcasse) / 100).toFixed(1)
      : null;

  const poidsEffectif = type === "BOUCHERIE" ? (poids || poidsCarcasseCalc || "") : poids;
  const prixCalc = prixKilo && poidsEffectif ? (parseFloat(prixKilo) * parseFloat(poidsEffectif)).toFixed(2) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (type === "BOUCHERIE" && attenteInfo?.enAttenteViande && !confirmeAttente) {
      setError("Cet animal est encore en délai d'attente viande — coche la case de confirmation pour valider quand même");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sorties/${sortie.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          type,
          acheteur: acheteur || null,
          poids: poids ? parseFloat(poids) : (poidsCarcasseCalc ? parseFloat(poidsCarcasseCalc) : null),
          poidsVif: type === "BOUCHERIE" && poidsVif ? parseFloat(poidsVif) : null,
          rendementCarcasse: type === "BOUCHERIE" && rendementCarcasse ? parseFloat(rendementCarcasse) : null,
          prixKilo: prixKilo ? parseFloat(prixKilo) : null,
          prixDefinitifHT: prixDefinitifHT ? parseFloat(prixDefinitifHT) : null,
          notes: notes || null,
          causeMortalite: type === "MORT" ? causeMortalite || null : null,
          confirmeAttente,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Erreur serveur");
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1 transition-colors"
        title="Modifier cette sortie"
      >
        <Pencil size={13} />
        Modifier
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div>
                <h3 className="font-semibold text-gray-800">Modifier la sortie</h3>
                <p className="text-xs text-gray-500">
                  {sortie.animal.nutrav} — {sortie.animal.nobovi ?? "Sans nom"}
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {attenteInfo?.enAttente && (
                <div className="bg-orange-50 border border-orange-300 rounded-lg p-3 text-sm">
                  <div className="flex items-start gap-2 text-orange-800 font-medium">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>
                      Cet animal est encore en délai d&apos;attente
                      {attenteInfo.enAttenteViande && attenteInfo.dateFinAttenteViande && ` viande jusqu'au ${new Date(attenteInfo.dateFinAttenteViande).toLocaleDateString("fr-FR")}`}
                      {attenteInfo.enAttenteViande && attenteInfo.enAttenteLait ? " et" : ""}
                      {attenteInfo.enAttenteLait && attenteInfo.dateFinAttenteLait && ` lait jusqu'au ${new Date(attenteInfo.dateFinAttenteLait).toLocaleDateString("fr-FR")}`}
                      {attenteInfo.medicamentNom && ` (${attenteInfo.medicamentNom})`}.
                    </span>
                  </div>
                  {type === "BOUCHERIE" && attenteInfo.enAttenteViande && (
                    <label className="flex items-start gap-2 mt-2 text-orange-900">
                      <input type="checkbox" checked={confirmeAttente} onChange={(e) => setConfirmeAttente(e.target.checked)} className="mt-0.5" />
                      <span className="text-xs">Je confirme être informé du délai d&apos;attente et je valide quand même cette sortie boucherie.</span>
                    </label>
                  )}
                </div>
              )}

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type de sortie</label>
                <div className="grid grid-cols-2 gap-2">
                  {TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setType(opt.value)}
                      className={`p-2 rounded-lg border text-sm font-medium transition-all ${
                        type === opt.value
                          ? "border-green-600 bg-green-50 text-green-800"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Cause mortalité */}
              {type === "MORT" && (
                <div>
                  <label className="block text-sm font-medium text-red-700 mb-1">Cause de mortalité</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CAUSES_MORTALITE.map((cause) => (
                      <button
                        key={cause}
                        type="button"
                        onClick={() => setCauseMortalite(cause)}
                        className={`p-2 rounded-lg border text-sm font-medium transition-all ${
                          causeMortalite === cause
                            ? "border-red-600 bg-red-50 text-red-800"
                            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        {CAUSES_MORTALITE_LABELS[cause] ?? cause}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Champs financiers */}
              {hasFinancials && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Acheteur</label>
                    <input
                      type="text"
                      value={acheteur}
                      onChange={(e) => setAcheteur(e.target.value)}
                      placeholder="Nom du maquignon / abattoir…"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  {/* Rendement carcasse (boucherie uniquement) */}
                  {type === "BOUCHERIE" && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-3">
                      <p className="text-xs font-medium text-orange-700">Calcul rendement carcasse</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Poids vif (kg)</label>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={poidsVif}
                            onChange={(e) => setPoidsVif(e.target.value)}
                            placeholder="ex: 700"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Rendement (%)</label>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="100"
                            value={rendementCarcasse}
                            onChange={(e) => setRendementCarcasse(e.target.value)}
                            placeholder="ex: 55"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                          />
                        </div>
                      </div>
                      {poidsCarcasseCalc && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-600">Poids carcasse calculé :</span>
                          <span className="font-bold text-orange-700">{poidsCarcasseCalc} kg</span>
                          <button
                            type="button"
                            onClick={() => setPoids(poidsCarcasseCalc)}
                            className="text-xs text-orange-600 underline hover:text-orange-800"
                          >
                            Utiliser
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {type === "BOUCHERIE" ? "Poids carcasse (kg)" : "Poids vif (kg)"}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={poids}
                        onChange={(e) => setPoids(e.target.value)}
                        placeholder={poidsCarcasseCalc ?? "ex: 280"}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {type === "BOUCHERIE" ? "Prix / kg carcasse (€)" : "Prix / kg (€)"}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={prixKilo}
                        onChange={(e) => setPrixKilo(e.target.value)}
                        placeholder="ex: 3.20"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  </div>

                  {prixCalc && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                      <span className="text-gray-600">Prix calculé : </span>
                      <span className="font-bold text-green-700 text-base">
                        {parseFloat(prixCalc).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prix définitif HT (€) <span className="text-gray-400 font-normal">— après facture</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={prixDefinitifHT}
                      onChange={(e) => setPrixDefinitifHT(e.target.value)}
                      placeholder={prixCalc ?? "ex: 850.00"}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Informations complémentaires…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {loading ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
