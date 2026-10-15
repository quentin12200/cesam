"use client";

import { useState, useRef, useEffect, useId, useCallback } from "react";
import { useRouter } from "next/navigation";
import { flushSync } from "react-dom";
import { Search, X } from "lucide-react";
import { VELAGE_IMMINENT_COLORS, type EtatGestation } from "@/lib/utils";
import ReproductionListBadge from "@/app/components/ReproductionListBadge";
import NutravBadge from "@/app/components/NutravBadge";

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
  const [error, setError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const cancelSearch = useCallback(() => {
    requestIdRef.current += 1;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    controllerRef.current?.abort();
  }, []);

  const clearSearch = useCallback(() => {
    cancelSearch();
    setQuery("");
    setResults([]);
    setOpen(false);
    setLoading(false);
    setError("");
    setSelected(-1);
  }, [cancelSearch]);

  const dismiss = useCallback(() => {
    clearSearch();
    setMobileOpen(false);
  }, [clearSearch]);

  async function search(q: string, requestId: number) {
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Invalid search response");
      if (requestId !== requestIdRef.current) return;
      setResults(data);
    } catch {
      if (requestId !== requestIdRef.current) return;
      setResults([]);
      setError("Recherche indisponible. Réessayez.");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    cancelSearch();
    setQuery(val);
    setResults([]);
    setSelected(-1);
    setError("");
    setOpen(Boolean(val.trim()));
    setLoading(Boolean(val.trim()));
    if (val.trim()) {
      const requestId = requestIdRef.current;
      debounceRef.current = setTimeout(() => void search(val.trim(), requestId), 280);
    }
  }

  function handleSelect(nutrav: string) {
    dismiss();
    router.push(`/troupeau/${nutrav}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      dismiss();
      triggerRef.current?.focus();
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, -1));
    } else if (e.key === "Enter" && selected >= 0 && results[selected]) {
      handleSelect(results[selected].nutrav);
    }
  }

  // Close on outside click
  useEffect(() => {
    function handleClick(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        dismiss();
      }
    }
    document.addEventListener("pointerdown", handleClick);
    return () => {
      document.removeEventListener("pointerdown", handleClick);
      cancelSearch();
    };
  }, [cancelSearch, dismiss]);

  useEffect(() => {
    if (selected >= 0) document.getElementById(`${listId}-${selected}`)?.scrollIntoView({ block: "nearest" });
  }, [listId, selected]);

  return (
    <div ref={containerRef} data-global-search-open={open || mobileOpen ? "" : undefined} className="ml-auto md:relative md:mx-auto md:w-full md:max-w-md md:min-w-0 md:flex-1">
      <button
        ref={triggerRef}
        type="button"
        aria-label={mobileOpen ? "Fermer la recherche animal" : "Rechercher un animal"}
        aria-expanded={mobileOpen}
        aria-controls={`${listId}-search`}
        onClick={() => {
          if (mobileOpen) {
            dismiss();
          } else {
            // Keep focus inside the tap event so mobile keyboards open too.
            flushSync(() => setMobileOpen(true));
            inputRef.current?.focus();
          }
        }}
        className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-green-600 md:hidden"
      >
        {mobileOpen ? <X size={20} /> : <Search size={20} />}
      </button>
      <div id={`${listId}-search`} className={`${mobileOpen ? "block" : "hidden"} absolute inset-x-0 top-full z-50 border-b border-green-800 bg-green-700 p-3 shadow-lg md:static md:block md:border-0 md:bg-transparent md:p-0 md:shadow-none`}>
      {/* Input */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim().length > 0 && setOpen(true)}
          role="combobox"
          aria-label="Ouvrir une fiche animal : numéro, nom ou numéro national"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={selected >= 0 ? `${listId}-${selected}` : undefined}
          placeholder="N° animal, nom ou N° national…"
          className="h-11 w-full bg-white text-gray-900 border border-gray-200 rounded-xl pl-9 pr-11 text-sm shadow focus:outline-none focus:ring-2 focus:ring-green-500"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            aria-label="Effacer la recherche"
            onClick={() => { clearSearch(); inputRef.current?.focus(); }}
            className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Dropdown résultats */}
      {open && (
        <div className="absolute left-3 right-3 top-full z-50 max-h-[min(65dvh,32rem)] overflow-y-auto overscroll-contain bg-white text-gray-900 rounded-xl shadow-xl border border-gray-100 md:left-0 md:right-0 md:mt-1.5">
          <div role="status" aria-live="polite">
          {loading && (
            <div className="px-4 py-3 text-sm text-gray-400">Recherche…</div>
          )}
          {!loading && error && <div className="px-4 py-3 text-sm text-red-700">{error}</div>}
          {!loading && !error && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-400">Aucun résultat</div>
          )}
          </div>
          <div id={listId} role="listbox" aria-label="Animaux trouvés" aria-busy={loading}>
          {!loading && !error && results.map((r, i) => (
            <button
              key={r.nutrav}
              id={`${listId}-${i}`}
              type="button"
              role="option"
              aria-selected={i === selected}
              tabIndex={-1}
              onClick={() => handleSelect(r.nutrav)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-50 last:border-0 transition-colors ${
                i === selected ? "bg-green-50" : "hover:bg-gray-50"
              }`}
            >
              {/* NUTRAV badge */}
              <NutravBadge nutrav={r.nutrav} />

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
        </div>
      )}
      </div>
    </div>
  );
}
