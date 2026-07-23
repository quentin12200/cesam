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
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function cancelEchoPlanning(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    setLoading(true);
    try {
      const response = await fetch(`/api/animaux/${nutrav}/echo-request`, { method: "DELETE" });

      if (!response.ok) {
        window.alert("Impossible de retirer l’animal de la liste À échographier.");
        return;
      }

      router.refresh();
      setConfirmOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (<>
    <span className="inline-flex items-center rounded-full bg-yellow-400 pl-2 text-xs font-semibold text-black">
      Écho à faire
      {canCancel && (
        <button
          type="button"
          onClick={(event) => { event.preventDefault(); event.stopPropagation(); setConfirmOpen(true); }}
          disabled={loading}
          aria-label="Retirer de la liste À échographier"
          title="Retirer de la liste À échographier"
          className="ml-0.5 inline-flex size-8 items-center justify-center rounded-full text-yellow-950 transition-colors hover:bg-yellow-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-700 disabled:opacity-50"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </span>
    {confirmOpen && (
      <span
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-echo-title"
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-3 sm:items-center"
        onClick={(event) => { event.preventDefault(); event.stopPropagation(); }}
      >
        <span className="block w-full max-w-sm rounded-2xl bg-white p-4 text-left shadow-xl">
          <strong id="remove-echo-title" className="block text-base text-gray-900">
            Retirer cette vache de la liste à échographier ?
          </strong>
          <span className="mt-2 block text-sm font-normal leading-5 text-gray-600">
            Elle ne sera plus proposée pour cette tentative, sauf si vous l’ajoutez de nouveau manuellement.
          </span>
          <span className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirmOpen(false)} className="min-h-11 rounded-xl border border-gray-300 px-3 text-sm font-bold text-gray-700">
              Garder dans la liste
            </button>
            <button type="button" onClick={cancelEchoPlanning} disabled={loading} className="min-h-11 rounded-xl bg-red-600 px-3 text-sm font-bold text-white disabled:opacity-50">
              Retirer
            </button>
          </span>
        </span>
      </span>
    )}
  </>);
}
