"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scissors } from "lucide-react";
import { formatAge, formatDate } from "@/lib/utils";

export default function SevrageButton({
  nutrav,
  sevreFait,
  danais,
  dateSevrage,
}: {
  nutrav: string;
  sevreFait: boolean;
  danais?: string;
  dateSevrage?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  if (sevreFait) {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
        <Scissors size={11} />
        {dateSevrage && danais
          ? `Sevré le ${formatDate(new Date(dateSevrage))} à ${formatAge(new Date(danais), new Date(dateSevrage))}`
          : "Sevré"}
      </span>
    );
  }

  async function handleSevrer() {
    if (!window.confirm("Marquer ce veau sevré ? Sa mère sera également marquée tarie à la date d’aujourd’hui.")) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/animaux/${nutrav}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sevreFait: true }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Enregistrement impossible.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Enregistrement impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        onClick={handleSevrer}
        disabled={loading}
        className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium hover:bg-orange-200 transition-colors disabled:opacity-50"
      >
        <Scissors size={11} />
        {loading ? "..." : "Marquer sevré"}
      </button>
      {error && <span className="text-[11px] font-semibold text-red-700">{error}</span>}
    </span>
  );
}
