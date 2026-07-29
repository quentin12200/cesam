"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scissors } from "lucide-react";
import { formatAge, formatDate } from "@/lib/utils";

export default function SevrageButton({
  animalId,
  nutrav,
  sevreFait,
  danais,
  dateSevrage,
}: {
  animalId: string;
  nutrav: string;
  sevreFait: boolean;
  danais?: string;
  dateSevrage?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const recentlyWeaned = Boolean(
    sevreFait &&
      dateSevrage &&
      Date.now() - new Date(dateSevrage).getTime() < 12 * 60 * 60 * 1000
  );

  if (sevreFait) {
    return (
      <span className="inline-flex flex-col items-start gap-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
          <Scissors size={11} />
          {dateSevrage && danais
            ? `Sevré le ${formatDate(new Date(dateSevrage))} à ${formatAge(new Date(danais), new Date(dateSevrage))}`
            : "Sevré"}
        </span>
        {recentlyWeaned && (
          <button
            type="button"
            onClick={() => void changeWeaning("UNDO_WEANING")}
            disabled={loading}
            className="text-[11px] font-semibold text-amber-700 underline underline-offset-2 disabled:opacity-50"
          >
            {loading ? "…" : "Annuler"}
          </button>
        )}
        {error && (
          <span className="text-[11px] font-semibold text-red-700">{error}</span>
        )}
      </span>
    );
  }

  async function changeWeaning(action: "WEAN_ONLY" | "UNDO_WEANING") {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/sevrage-tarissement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calfId: animalId,
          action,
          ...(action === "WEAN_ONLY"
            ? { date: new Date().toISOString() }
            : {}),
        }),
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
        onClick={() => void changeWeaning("WEAN_ONLY")}
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
