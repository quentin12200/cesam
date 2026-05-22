"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

const QUALIFICATIFS = ["NORMAL", "DIFFICILE", "CESARIENNE", "MORT_NEE", "AVORTEMENT"];

export default function VelageFormWrapper() {
  const [showForm, setShowForm] = useState(false);
  const [vacheNutrav, setVacheNutrav] = useState("");
  const [veauNutrav, setVeauNutrav] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [qualificatif, setQualificatif] = useState("NORMAL");
  const [capteur, setCapteur] = useState<string>("");
  const [pereNom, setPereNom] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/velages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vacheNutrav,
          veauNutrav: veauNutrav || undefined,
          date,
          qualificatif,
          capteur: capteur ? parseInt(capteur, 10) : undefined,
          pereNom: pereNom || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Erreur");
      }
      setMessage("Vélage enregistré !");
      setShowForm(false);
      setVacheNutrav("");
      setVeauNutrav("");
      setQualificatif("NORMAL");
    } catch (err) {
      setMessage("Erreur: " + String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {message && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          {message}
          <button onClick={() => setMessage(null)} className="text-green-600 font-bold ml-2">×</button>
        </div>
      )}

      <button
        onClick={() => setShowForm(true)}
        className="w-full flex items-center justify-center gap-2 bg-pink-500 text-white py-3 rounded-xl font-medium"
      >
        <Plus size={18} /> Enregistrer un vélage
      </button>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">Enregistrer un vélage</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 text-2xl">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NUTRAV de la vache</label>
                <input
                  type="text"
                  value={vacheNutrav}
                  onChange={(e) => setVacheNutrav(e.target.value.toUpperCase())}
                  placeholder="ex: 0042"
                  required
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NUTRAV du veau (optionnel)</label>
                <input
                  type="text"
                  value={veauNutrav}
                  onChange={(e) => setVeauNutrav(e.target.value.toUpperCase())}
                  placeholder="ex: 0166"
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date du vélage</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Qualificatif</label>
                <div className="grid grid-cols-2 gap-2">
                  {QUALIFICATIFS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQualificatif(q)}
                      className={`py-2 rounded-lg text-sm font-medium border-2 transition-colors ${qualificatif === q
                        ? q === "NORMAL" ? "bg-green-500 text-white border-green-500"
                          : q === "DIFFICILE" ? "bg-orange-400 text-white border-orange-400"
                          : "bg-red-500 text-white border-red-500"
                        : "border-gray-200 text-gray-700"
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capteur utilisé (optionnel)</label>
                <select
                  value={capteur}
                  onChange={(e) => setCapteur(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
                >
                  <option value="">Aucun capteur</option>
                  <option value="1">Capteur 1</option>
                  <option value="2">Capteur 2</option>
                  <option value="3">Capteur 3</option>
                  <option value="4">Capteur 4</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom du père (optionnel)</label>
                <input
                  type="text"
                  value={pereNom}
                  onChange={(e) => setPereNom(e.target.value)}
                  placeholder="ex: BALOO"
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-pink-500 text-white py-3 rounded-xl font-medium disabled:opacity-50"
              >
                {saving ? "Enregistrement..." : "Enregistrer le vélage"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
