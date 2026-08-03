"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { VELAGE_IMMINENT_COLORS, type EtatGestation } from "@/lib/utils";
import ReproductionListBadge from "@/app/components/ReproductionListBadge";

interface SearchResult {
  nutrav: string;
  nom: string | null;
  ageLabel: string;
  categorie: string;
  etatGestation: string | null;
  mheVendable: boolean;
  mheRaison: string;
  dernierPoids: number | null;
}

const ETAT_COLORS: Record<string, string> = {
  VERT: "bg-green-500",
  ROSE: VELAGE_IMMINENT_COLORS.fill,
  JAUNE: "bg-yellow-400",
  ROUGE: "bg-red-500",
  GRIS: "bg-gray-400",
};

const ETAT_LABELS: Record<string, string> = {
  VERT: "Gestante",
  ROSE: "Imminente",
  JAUNE: "À écho",
  ROUGE: "Vide",
  GRIS: "En attente",
};

export default function QuickSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data);
      setOpen(data.length > 0);
      setSelected(-1);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 280);
  }

  function handleSelect(nutrav: string) {
    setQuery("");
    setResults([]);
    setOpen(false);
    router.push(`/troupeau/${nutrav}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, -1));
    } else if (e.key === "Enter" && selected >= 0) {
      handleSelect(results[selected].nutrav);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative mt-2">
      {/* Input */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length > 0 && results.length > 0 && setOpen(true)}
          placeholder="N° animal ou nom…"
          className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-10 py-3 text-sm shadow focus:outline-none focus:ring-2 focus:ring-green-500"
          autoComplete="off"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Dropdown résultats */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
          {loading && (
            <div className="px-4 py-3 text-sm text-gray-400">Recherche…</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-400">Aucun résultat</div>
          )}
          {!loading && results.map((r, i) => (
            <button
              key={r.nutrav}
              onClick={() => handleSelect(r.nutrav)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-50 last:border-0 transition-colors ${
                i === selected ? "bg-green-50" : "hover:bg-gray-50"
              }`}
            >
              {/* NUTRAV badge */}
              <span className="bg-green-700 text-white font-bold font-mono text-base px-3 py-1.5 rounded-lg min-w-[4rem] text-center flex-shrink-0">
                {r.nutrav}
              </span>

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-800 text-sm">
                    {r.nom ?? <span className="text-gray-400 italic">Sans nom</span>}
                  </span>
                  <span className="text-xs text-gray-500">{r.categorie}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-gray-400">{r.ageLabel}</span>
                  {r.etatGestation && (
                    <ReproductionListBadge
                      etat={r.etatGestation as EtatGestation}
                      fallbackLabel={ETAT_LABELS[r.etatGestation] ?? r.etatGestation}
                      gestationDays={null}
                      className={r.etatGestation === "VERT" ? "" : ETAT_COLORS[r.etatGestation] ?? "bg-gray-400"}
                    />
                  )}
                  {r.dernierPoids && (
                    <span className="text-xs text-gray-500">{r.dernierPoids} kg</span>
                  )}
                </div>
              </div>

              {/* MHE badge */}
              <div className="flex-shrink-0 text-right">
                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                  r.mheVendable
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-600"
                }`}>
                  {r.mheVendable ? "✓ MHE" : "✗ MHE"}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
