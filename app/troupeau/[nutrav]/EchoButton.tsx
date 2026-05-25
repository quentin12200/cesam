"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanLine } from "lucide-react";

interface Props {
  nutrav: string;
  aEchographier: boolean;
}

export default function EchoButton({ nutrav, aEchographier }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

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
