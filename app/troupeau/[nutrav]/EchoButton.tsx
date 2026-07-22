"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanLine } from "lucide-react";
import EchoModal from "./EchoModal";

interface Props {
  nutrav: string;
  aEchographier: boolean;
  saillieId?: string | null;
  saillieDate?: string | null;
  prominent?: boolean;
}

export default function EchoButton({ nutrav, aEchographier, saillieId, saillieDate, prominent = false }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      await fetch(`/api/animaux/${nutrav}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aEchographier: !aEchographier }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  // Animal marqué à écho ET a une saillie active → bouton "Saisir l'écho"
  if (aEchographier && saillieId && saillieDate) {
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          className={`flex items-center justify-center gap-1.5 rounded-lg border font-semibold transition-colors shadow-sm bg-yellow-400 border-yellow-500 text-yellow-900 hover:bg-yellow-500 ${prominent ? "min-h-11 px-4 py-2 text-sm" : "px-2.5 py-1.5 text-xs animate-pulse"}`}
        >
          <ScanLine size={12} />
          Saisir l&apos;écho
        </button>
        {showModal && (
          <EchoModal
            nutrav={nutrav}
            saillieId={saillieId}
            saillieDate={saillieDate}
            onClose={() => setShowModal(false)}
            onDone={() => { setShowModal(false); router.refresh(); }}
          />
        )}
      </>
    );
  }

  // Animal marqué à écho mais sans saillie (ou pas encore marqué) → simple toggle
  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 border font-medium transition-colors shadow-sm ${
        aEchographier
          ? "bg-yellow-100 border-yellow-400 text-yellow-800 hover:bg-yellow-200"
          : "bg-white border-gray-200 text-gray-600 hover:border-yellow-400 hover:text-yellow-700"
      }`}
    >
      <ScanLine size={12} />
      {aEchographier ? "✓ À échographier" : "Envoyer à écho"}
    </button>
  );
}
