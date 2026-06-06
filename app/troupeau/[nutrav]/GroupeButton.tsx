"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Layers, X, Plus, Check, Trash2 } from "lucide-react";

interface Groupe {
  id: string;
  nom: string;
  couleur: string | null;
}

interface Props {
  nutrav: string;
  groupeId: string | null;
  groupeNom: string | null;
  groupes: Groupe[];
}

export default function GroupeButton({ nutrav, groupeId, groupeNom, groupes }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newNom, setNewNom] = useState("");
  const [localGroupes, setLocalGroupes] = useState(groupes);
  const [currentId, setCurrentId] = useState(groupeId);

  async function assign(gId: string | null) {
    setLoading(true);
    try {
      await fetch(`/api/animaux/${nutrav}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupeId: gId }),
      });
      setCurrentId(gId);
      setOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function createAndAssign() {
    if (!newNom.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/groupes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: newNom.trim() }),
      });
      const data = await res.json();
      if (data.groupe) {
        const updated = [...localGroupes, data.groupe].sort((a, b) =>
          a.nom.localeCompare(b.nom)
        );
        setLocalGroupes(updated);
        setNewNom("");
        setShowCreate(false);
        await assign(data.groupe.id);
      }
    } finally {
      setLoading(false);
    }
  }

  async function deleteGroupe(gId: string, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/groupes?id=${gId}`, { method: "DELETE" });
    setLocalGroupes((prev) => prev.filter((g) => g.id !== gId));
    if (currentId === gId) {
      setCurrentId(null);
      router.refresh();
    }
  }

  const currentNom = localGroupes.find((g) => g.id === currentId)?.nom ?? groupeNom;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
          currentId
            ? "bg-blue-50 border-blue-200 text-blue-700"
            : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
        }`}
      >
        <Layers size={14} />
        {currentNom ?? "Groupe / Lot"}
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
          onClick={(e) => {
            if (e.currentTarget === e.target) setOpen(false);
          }}
        >
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl p-5 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Groupe / Lot</h3>
              <button onClick={() => setOpen(false)}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="space-y-2">
              {/* Sans groupe */}
              <button
                onClick={() => assign(null)}
                disabled={loading}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                  !currentId
                    ? "bg-gray-100 border-gray-300"
                    : "border-gray-100 hover:bg-gray-50"
                }`}
              >
                {!currentId && <Check size={14} className="text-green-600 shrink-0" />}
                <span className="text-sm text-gray-500 italic">Aucun groupe</span>
              </button>

              {/* Groupes existants */}
              {localGroupes.map((g) => (
                <div
                  key={g.id}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors ${
                    currentId === g.id
                      ? "bg-blue-50 border-blue-200"
                      : "border-gray-100 hover:bg-gray-50"
                  }`}
                >
                  <button
                    className="flex-1 flex items-center gap-2 text-left"
                    onClick={() => assign(g.id)}
                    disabled={loading}
                  >
                    {currentId === g.id && (
                      <Check size={14} className="text-blue-600 shrink-0" />
                    )}
                    <span className="text-sm font-medium text-gray-800">{g.nom}</span>
                  </button>
                  <button
                    onClick={(e) => deleteGroupe(g.id, e)}
                    className="text-gray-300 hover:text-red-400 p-0.5 rounded shrink-0 transition-colors"
                    title="Supprimer ce groupe"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}

              {/* Créer un groupe */}
              {showCreate ? (
                <div className="border border-green-200 rounded-lg p-3 bg-green-50">
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={newNom}
                      onChange={(e) => setNewNom(e.target.value)}
                      placeholder="Nom du groupe…"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") createAndAssign();
                        if (e.key === "Escape") setShowCreate(false);
                      }}
                    />
                    <button
                      onClick={createAndAssign}
                      disabled={!newNom.trim() || loading}
                      className="bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {loading ? "…" : "Créer"}
                    </button>
                  </div>
                  <button
                    onClick={() => setShowCreate(false)}
                    className="text-xs text-gray-400 mt-2 hover:text-gray-600"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreate(true)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 border-dashed border-gray-200 text-gray-500 text-sm hover:border-green-300 hover:text-green-700 transition-colors"
                >
                  <Plus size={14} />
                  Nouveau groupe
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
