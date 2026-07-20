"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

interface Props {
  nutrav: string;
  canCancel: boolean;
}

export default function EchoStatusBadge({ nutrav, canCancel }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function cancelEchoPlanning(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (!window.confirm("Retirer cet animal de la liste À échographier ?")) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/animaux/${nutrav}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aEchographier: false }),
      });

      if (!response.ok) {
        window.alert("Impossible de retirer l’animal de la liste À échographier.");
        return;
      }

      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex items-center rounded-full bg-yellow-400 pl-2 text-xs font-semibold text-black">
      À échographier
      {canCancel && (
        <button
          type="button"
          onClick={cancelEchoPlanning}
          disabled={loading}
          aria-label="Retirer de la liste À échographier"
          title="Retirer de la liste À échographier"
          className="ml-0.5 inline-flex size-8 items-center justify-center rounded-full text-yellow-950 transition-colors hover:bg-yellow-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-700 disabled:opacity-50"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
