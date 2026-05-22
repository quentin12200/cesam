"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

const VACCINS = [
  "NASALGEN",
  "NASALGEN_RAPPEL",
  "NASYM",
  "NASYM_RAPPEL",
  "HIPRABOVIS",
  "HIPRABOVIS_RAPPEL",
  "MHE",
  "CRYPTO",
  "ROTAVEC",
  "IBR",
  "AUTRE",
];

export default function VaccinationFormWrapper() {
  const [showForm, setShowForm] = useState(false);
  const [nutrav, setNutrav] = useState("");
  const [vaccin, setVaccin] = useState("NASALGEN");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [voie, setVoie] = useState("IM");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/vaccinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nutrav, vaccin, date, voie }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Erreur");
      }
      setMessage("Vaccination enregistrée !");
      setShowForm(false);
      setNutrav("");
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
        className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white py-3 rounded-xl font-medium"
      >
        <Plus size={18} /> Enregistrer une vaccination
      </button>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">Enregistrer une vaccination</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 text-2xl">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NUTRAV de l&apos;animal</label>
                <input
                  type="text"
                  value={nutrav}
                  onChange={(e) => setNutrav(e.target.value.toUpperCase())}
                  placeholder="ex: 0042"
                  required
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vaccin</label>
                <select
                  value={vaccin}
                  onChange={(e) => setVaccin(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
                >
                  {VACCINS.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Voie d&apos;administration</label>
                <select
                  value={voie}
                  onChange={(e) => setVoie(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
                >
                  <option value="IM">IM (intramusculaire)</option>
                  <option value="SC">SC (sous-cutané)</option>
                  <option value="IN">IN (intranasale)</option>
                  <option value="IV">IV (intraveineuse)</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-purple-600 text-white py-3 rounded-xl font-medium disabled:opacity-50"
              >
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
