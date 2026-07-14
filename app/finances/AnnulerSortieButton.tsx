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
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Supprimer la sortie de l'animal ${nutrav} ? L'animal redeviendra actif.`)) return;
    setLoading(true);
    try {
      await fetch(`/api/sorties/${sortieId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="shrink-0 p-1.5 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40"
      title="Supprimer cette sortie"
    >
      <Trash2 size={15} />
      <span className="sr-only">Supprimer cette sortie</span>
    </button>
  );
}

