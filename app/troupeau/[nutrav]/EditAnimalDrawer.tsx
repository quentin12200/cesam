"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Save } from "lucide-react";

interface EditAnimalDrawerProps {
  nutrav: string;
  nobovi: string | null;
  danais: string; // ISO string
  statut: string;
  estGenisse: boolean;
  sexbov: string;
  notes: string | null;
  boucleFaite: boolean;
}

export default function EditAnimalDrawer({
  nutrav, nobovi, danais, statut, estGenisse, sexbov, notes, boucleFaite,
}: EditAnimalDrawerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    nobovi:      nobovi ?? "",
    danais:      danais.split("T")[0],
    statut,
    estGenisse,
    notes:       notes ?? "",
    boucleFaite,
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/animaux/${nutrav}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Bouton édition dans le header */}
      <button
        onClick={() => setOpen(true)}
        className="ml-auto p-2 bg-white rounded-lg shadow text-green-700 hover:bg-green-50"
        title="Modifier"
      >
        <Pencil size={18} />
      </button>

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-gray-800">Modifier la fiche</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>
            )}

            {/* Nom */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
              <input
                type="text"
                value={form.nobovi}
                onChange={(e) => set("nobovi", e.target.value)}
                placeholder="Ex: MINNIE"
                className="w-full border border-gray-200 rounded-lg p-2.5 text-sm uppercase"
              />
            </div>

            {/* Date de naissance */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de naissance</label>
              <input
                type="date"
                value={form.danais}
                onChange={(e) => set("danais", e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
              />
            </div>

            {/* Statut */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
              <div className="flex gap-2">
                {["ACTIF", "SORTI", "MORT", "VENDU"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set("statut", s)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border-2 transition-colors ${
                      form.statut === s
                        ? s === "ACTIF" ? "bg-green-500 text-white border-green-500"
                          : "bg-red-500 text-white border-red-500"
                        : "border-gray-200 text-gray-600"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Génisse (femelles seulement) */}
            {sexbov === "F" && (
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Génisse (pas encore vêlé)</label>
                <button
                  type="button"
                  onClick={() => set("estGenisse", !form.estGenisse)}
                  className={`w-12 h-6 rounded-full transition-colors ${form.estGenisse ? "bg-green-500" : "bg-gray-200"}`}
                >
                  <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.estGenisse ? "translate-x-6" : "translate-x-0"}`} />
                </button>
              </div>
            )}

            {/* Boucle faite */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Boucle posée</label>
              <button
                type="button"
                onClick={() => set("boucleFaite", !form.boucleFaite)}
                className={`w-12 h-6 rounded-full transition-colors ${form.boucleFaite ? "bg-green-500" : "bg-gray-200"}`}
              >
                <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.boucleFaite ? "translate-x-6" : "translate-x-0"}`} />
              </button>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={3}
                placeholder="Observations, traitements, particularités..."
                className="w-full border border-gray-200 rounded-lg p-2.5 text-sm resize-none"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-green-700 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save size={18} />
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
