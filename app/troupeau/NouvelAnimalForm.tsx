"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

const CATEGORIES = [
  { value: "vache", label: "Vache", desc: "Femelle adulte (déjà vêlée)" },
  { value: "genisse", label: "Génisse / Veau ♀", desc: "Femelle n'ayant pas encore vêlé" },
  { value: "male", label: "Mâle", desc: "Veau ou taurillon" },
];

export default function NouvelAnimalForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categorie, setCategorie] = useState("genisse");
  const [nutrav, setNutrav] = useState("");
  const [nunati, setNunati] = useState("");
  const [nobovi, setNobovi] = useState("");
  const [danais, setDanais] = useState("");
  const [mereNutrav, setMereNutrav] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/animaux", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nutrav, nunati, nobovi, danais, categorie, mereNutrav }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur lors de la création");
        setLoading(false);
        return;
      }
      router.push(`/troupeau/${data.nutrav}`);
    } catch {
      setError("Erreur réseau");
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Nouvel animal</h3>
        <a href="/troupeau" className="text-gray-400 hover:text-gray-600">
          <X size={18} />
        </a>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Catégorie */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategorie(c.value)}
                className={`p-2.5 rounded-lg border text-left transition-colors ${
                  categorie === c.value
                    ? "border-green-600 bg-green-50 text-green-800"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <div className="font-semibold text-xs">{c.label}</div>
                <div className="text-xs text-gray-500 mt-0.5 leading-tight">{c.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* N° Travail + N° National */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">N° Travail *</label>
            <input
              type="text"
              value={nutrav}
              onChange={(e) => setNutrav(e.target.value)}
              placeholder="ex: 0094"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">N° National *</label>
            <input
              type="text"
              value={nunati}
              onChange={(e) => setNunati(e.target.value)}
              placeholder="ex: FR1234567890"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Nom + Date de naissance */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nom / surnom</label>
            <input
              type="text"
              value={nobovi}
              onChange={(e) => setNobovi(e.target.value)}
              placeholder="optionnel"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Date de naissance *</label>
            <input
              type="date"
              value={danais}
              onChange={(e) => setDanais(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Mère (optionnel) */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            N° Travail de la mère <span className="text-gray-400 font-normal">(optionnel)</span>
          </label>
          <input
            type="text"
            value={mereNutrav}
            onChange={(e) => setMereNutrav(e.target.value)}
            placeholder="ex: 0047"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-700 text-white font-semibold py-2.5 rounded-lg hover:bg-green-800 active:bg-green-900 transition-colors disabled:opacity-50"
        >
          {loading ? "Création en cours…" : "Créer l'animal"}
        </button>
      </form>
    </div>
  );
}
