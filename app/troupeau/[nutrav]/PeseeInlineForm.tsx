"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Save } from "lucide-react";

export default function PeseeInlineForm({ nutrav, initialOpen = false, initialPoids = "" }: { nutrav: string; initialOpen?: boolean; initialPoids?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [poids, setPoids] = useState(initialPoids);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!poids) return;
    setSaving(true);
    try {
      await fetch("/api/pesees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nutrav, date, poids: parseFloat(poids) }),
      });
      setOpen(false);
      setPoids("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm text-blue-700 font-medium hover:text-blue-900"
      >
        <Plus size={16} />
        Ajouter une pesée
      </button>
    );
  }

  return (
    <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-blue-800">Nouvelle pesée</span>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>
      <div className="flex gap-2 items-center">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-sm"
        />
        <div className="relative w-28">
          <input
            type="number"
            value={poids}
            onChange={(e) => setPoids(e.target.value)}
            placeholder="Poids"
            step="0.5"
            min="0"
            className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm pr-7"
            autoFocus
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">kg</span>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !poids}
          className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-1"
        >
          <Save size={15} />
        </button>
      </div>
    </div>
  );
}
