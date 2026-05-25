"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scissors } from "lucide-react";

export default function SevrageButton({ nutrav, sevreFait }: { nutrav: string; sevreFait: boolean }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (sevreFait) {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
        <Scissors size={11} /> Sevré
      </span>
    );
  }

  async function handleSevrer() {
    setLoading(true);
    await fetch(`/api/animaux/${nutrav}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sevreFait: true }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={handleSevrer}
      disabled={loading}
      className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium hover:bg-orange-200 transition-colors disabled:opacity-50"
    >
      <Scissors size={11} />
      {loading ? "..." : "Marquer sevré"}
    </button>
  );
}
