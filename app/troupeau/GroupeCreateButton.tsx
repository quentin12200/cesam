"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

export default function GroupeCreateButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nom, setNom] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!nom.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/groupes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: nom.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur");
        return;
      }
      setNom("");
      setOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-green-700 font-medium hover:underline mt-1.5"
      >
        <Plus size={12} />
        Créer un groupe
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <input
        autoFocus
        type="text"
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        placeholder="Nom du groupe..."
        className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
        onKeyDown={(e) => {
          if (e.key === "Enter") handleCreate();
          if (e.key === "Escape") { setOpen(false); setNom(""); }
        }}
      />
      <button
        onClick={handleCreate}
        disabled={!nom.trim() || loading}
        className="bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
      >
        {loading ? "…" : "Créer"}
      </button>
      <button
        onClick={() => { setOpen(false); setNom(""); }}
        className="text-gray-400 hover:text-gray-600"
      >
        <X size={14} />
      </button>
      {error && <p className="w-full text-xs text-red-500">{error}</p>}
    </div>
  );
}
