"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  endpoint: string;
  label?: string;
  confirmLabel?: string;
}

export default function DeleteHistoriqueButton({
  endpoint,
  label = "🗑 Supprimer",
  confirmLabel = "Supprimer ?",
}: Props) {
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erreur serveur");
        return;
      }
      router.refresh();
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  if (error) {
    return (
      <div className="flex items-center gap-1 mt-1">
        <span className="text-xs text-red-600">{error}</span>
        <button onClick={() => { setError(null); setConfirm(false); }} className="text-xs text-gray-400 ml-1">✕</button>
      </div>
    );
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-1 mt-1.5">
        <span className="text-xs text-gray-500">{confirmLabel}</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-md font-semibold disabled:opacity-50"
        >
          {loading ? "…" : "Oui"}
        </button>
        <button
          onClick={() => setConfirm(false)}
          className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-md"
        >
          Non
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      className="text-xs text-gray-300 hover:text-red-500 transition-colors mt-1.5"
    >
      {label}
    </button>
  );
}
