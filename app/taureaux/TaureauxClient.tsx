"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus } from "lucide-react";

interface Taureau {
  id: string;
  nupere: string;
  nopere: string | null;
  present: boolean;
  _count: { saillies: number };
}

export default function TaureauxClient({ initialTaureaux }: { initialTaureaux: Taureau[] }) {
  const router = useRouter();
  const [taureaux, setTaureaux] = useState(initialTaureaux);
  const [nopere, setNopere] = useState("");
  const [nupere, setNupere] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/taureaux", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nupere, nopere }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setNopere("");
      setNupere("");
      router.refresh();
    } catch {
      setError("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch("/api/taureaux", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setTaureaux((prev) => prev.filter((t) => t.id !== id));
    } catch {
      setError("Erreur réseau");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Liste */}
      <div className="bg-white rounded-xl shadow divide-y divide-gray-100">
        {taureaux.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">Aucun taureau enregistré</p>
        )}
        {taureaux.map((t) => (
          <div key={t.id} className="flex items-center gap-3 px-4 py-3">
            <div className="bg-green-700 text-white font-bold font-mono text-sm px-2.5 py-1 rounded-lg min-w-[4rem] text-center">
              {t.nupere}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-800">{t.nopere ?? <span className="text-gray-400 italic">Sans nom</span>}</div>
              <div className="text-xs text-gray-400">{t._count.saillies} saillie{t._count.saillies > 1 ? "s" : ""} enregistrée{t._count.saillies > 1 ? "s" : ""}</div>
            </div>
            <button
              onClick={() => handleDelete(t.id)}
              disabled={deletingId === t.id || t._count.saillies > 0}
              className="p-1.5 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-30"
              title={t._count.saillies > 0 ? "Impossible : lié à des saillies" : "Supprimer"}
            >
              {deletingId === t.id ? "…" : <Trash2 size={15} />}
            </button>
          </div>
        ))}
      </div>

      {/* Formulaire ajout */}
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Ajouter un taureau</h3>
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nom</label>
              <input
                type="text"
                value={nopere}
                onChange={(e) => setNopere(e.target.value)}
                placeholder="ex: Zeus"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Numéro *</label>
              <input
                type="text"
                value={nupere}
                onChange={(e) => setNupere(e.target.value)}
                placeholder="ex: 5482"
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-green-700 text-white font-semibold py-2.5 rounded-lg disabled:opacity-50"
          >
            <Plus size={16} />
            {saving ? "Ajout…" : "Ajouter"}
          </button>
        </form>
      </div>
    </div>
  );
}
