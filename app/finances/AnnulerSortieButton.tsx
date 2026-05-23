"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function AnnulerSortieButton({
  sortieId,
  nutrav,
}: {
  sortieId: string;
  nutrav: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await fetch(`/api/sorties/${sortieId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-xs text-gray-500">Annuler {nutrav} ?</span>
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="text-xs font-semibold px-2 py-1 bg-red-600 text-white rounded-lg disabled:opacity-50"
        >
          {loading ? "…" : "Oui"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded-lg"
        >
          Non
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="shrink-0 p-1.5 text-gray-300 hover:text-red-500 transition-colors"
      title="Annuler cette sortie"
    >
      <Trash2 size={14} />
    </button>
  );
}
