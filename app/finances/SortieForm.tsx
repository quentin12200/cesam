"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CAUSES_MORTALITE, CAUSES_MORTALITE_LABELS } from "@/lib/utils";

interface Animal {
  id: string;
  nutrav: string;
  nobovi: string | null;
  sexbov: string;
}

interface Props {
  animaux: Animal[];
  annee: number;
}

const TYPE_OPTIONS = [
  { value: "ELEVAGE", label: "Vente vif (élevage)", color: "text-green-700" },
  { value: "BOUCHERIE", label: "Boucherie / Carcasse", color: "text-orange-700" },
  { value: "ENGRAISSEMENT", label: "Mise en engraissement", color: "text-blue-700" },
  { value: "MORT", label: "Mort", color: "text-gray-600" },
];

export default function SortieForm({ animaux, annee }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [animalId, setAnimalId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState("ELEVAGE");
  const [acheteur, setAcheteur] = useState("");
  const [prixKilo, setPrixKilo] = useState("");
  const [poids, setPoids] = useState("");
  const [prixDefinitifHT, setPrixDefinitifHT] = useState("");
  const [notes, setNotes] = useState("");
  const [causeMortalite, setCauseMortalite] = useState("");
  const [causeMortaliteCustom, setCauseMortaliteCustom] = useState("");

  const prixCalc =
    prixKilo && poids
      ? (parseFloat(prixKilo) * parseFloat(poids)).toFixed(2)
      : null;

  const hasFinancials = type === "ELEVAGE" || type === "BOUCHERIE";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!animalId || !date || !type) {
      setError("Animal, date et type sont obligatoires");
      return;
    }
    if (type === "MORT" && !causeMortalite) {
      setError("La cause de mortalité est obligatoire");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sorties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animalId,
          date,
          type,
          acheteur: acheteur || null,
          prixKilo: prixKilo ? parseFloat(prixKilo) : null,
          poids: poids ? parseFloat(poids) : null,
          prixDefinitifHT: prixDefinitifHT ? parseFloat(prixDefinitifHT) : null,
          notes: notes || null,
          causeMortalite: type === "MORT"
            ? (causeMortalite === "AUTRE" && causeMortaliteCustom.trim()
                ? causeMortaliteCustom.trim()
                : causeMortalite || null)
            : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erreur serveur");
      }
      router.push(`/finances?annee=${annee}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-4 space-y-4">
      <h3 className="font-semibold text-gray-800">Enregistrer une sortie</h3>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Animal */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Animal *</label>
        <select
          value={animalId}
          onChange={(e) => setAnimalId(e.target.value)}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">Sélectionner un animal...</option>
          {animaux.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nutrav} — {a.nobovi ?? "Sans nom"} ({a.sexbov === "F" ? "F" : "M"})
            </option>
          ))}
        </select>
      </div>

      {/* Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Type de sortie *</label>
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

      {/* Cause mortalité — obligatoire si MORT */}
      {type === "MORT" && (
        <div>
          <label className="block text-sm font-medium text-red-700 mb-1">
            Cause de mortalité *
          </label>
          <div className="grid grid-cols-2 gap-2 mb-2">
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
                {CAUSES_MORTALITE_LABELS[cause]}
              </button>
            ))}
          </div>
          {causeMortalite === "AUTRE" && (
            <input
              type="text"
              value={causeMortaliteCustom}
              onChange={(e) => setCauseMortaliteCustom(e.target.value)}
              placeholder="Préciser la cause..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          )}
        </div>
      )}

      {/* Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Champs financiers (ELEVAGE / BOUCHERIE seulement) */}
      {hasFinancials && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Acheteur</label>
            <input
              type="text"
              value={acheteur}
              onChange={(e) => setAcheteur(e.target.value)}
              placeholder="Nom du maquignon / abattoir..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Poids ({type === "BOUCHERIE" ? "carcasse" : "vif"}) kg
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={poids}
                onChange={(e) => setPoids(e.target.value)}
                placeholder="ex: 280"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prix / kg (€)</label>
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
              placeholder={prixCalc ?? "Laisser vide si non reçu"}
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
          placeholder="Informations complémentaires..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.push(`/finances?annee=${annee}`)}
          className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-2.5 bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
