"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, ChevronDown, Search, Settings2, SlidersHorizontal, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getActiveTroupeauFilters,
  normalizeTroupeauFilters,
  resetTroupeauSearchParams,
  TROUPEAU_CATEGORY_OPTIONS,
  TROUPEAU_HEALTH_OPTIONS,
  TROUPEAU_REPRODUCTION_OPTIONS,
  TROUPEAU_WEANING_OPTIONS,
  updateTroupeauSearchParams,
  type TroupeauFilterParams,
} from "@/lib/troupeau-filters";
import GroupeCreateButton from "./GroupeCreateButton";

interface Props {
  total: number;
  groups: { id: string; nom: string }[];
  params: TroupeauFilterParams;
}

interface FilterChoice {
  value: string;
  label: string;
}

const SEX_OPTIONS: FilterChoice[] = [
  { value: "F", label: "♀ Femelles" },
  { value: "M", label: "♂ Mâles" },
];

type ShortcutKey = "calves" | "heifers" | "females" | "smallHeifers" | "dry" | "echo" | "bulls";

const SHORTCUTS: { key: ShortcutKey; label: string; filters: Partial<TroupeauFilterParams> }[] = [
  { key: "calves", label: "Veaux", filters: { categorie: "VEAU_M" } },
  { key: "heifers", label: "Velles", filters: { categorie: "VELLE" } },
  { key: "females", label: "Femelles", filters: { sexe: "F" } },
  { key: "smallHeifers", label: "Petites génisses", filters: { categorie: "PETITE_GENISSE" } },
  { key: "dry", label: "Taries", filters: { tarie: "oui" } },
  { key: "echo", label: "À écho", filters: { repro: "A_ECO" } },
  { key: "bulls", label: "Taureaux", filters: { categorie: "TAUREAU" } },
];

const DEFAULT_SHORTCUTS: ShortcutKey[] = ["calves", "heifers", "females", "dry", "echo"];
const SHORTCUTS_STORAGE_KEY = "cesam:troupeau-shortcuts:v1";

function filterUrl(params: URLSearchParams): string {
  const query = params.toString();
  return `/troupeau${query ? `?${query}` : ""}`;
}

function DesktopSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: string;
  options: readonly FilterChoice[];
  onChange: (value?: string) => void;
}) {
  return (
    <label className="relative shrink-0">
      <span className="sr-only">{label}</span>
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || undefined)}
        className={`h-10 appearance-none rounded-lg border py-2 pl-3 pr-8 text-sm font-medium outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100 ${
          value ? "border-green-600 bg-green-50 text-green-800" : "border-gray-200 bg-white text-gray-700"
        }`}
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-3 text-gray-400" size={16} />
    </label>
  );
}

function MobileChoices({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: string;
  options: readonly FilterChoice[];
  onChange: (value?: string) => void;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</h3>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className={`min-h-10 rounded-full border px-3 text-sm font-medium ${
            !value ? "border-green-700 bg-green-700 text-white" : "border-gray-200 bg-white text-gray-700"
          }`}
        >
          Tous
        </button>
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              type="button"
              key={option.value}
              onClick={() => onChange(active ? undefined : option.value)}
              className={`flex min-h-10 items-center gap-1 rounded-full border px-3 text-sm font-medium ${
                active ? "border-green-700 bg-green-700 text-white" : "border-gray-200 bg-white text-gray-700"
              }`}
            >
              {active && <Check size={14} />}
              {option.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function TroupeauFilters({ total, groups, params }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = normalizeTroupeauFilters(params);
  const [query, setQuery] = useState(params.q ?? "");
  const [visibleShortcuts, setVisibleShortcuts] = useState<ShortcutKey[]>(DEFAULT_SHORTCUTS);
  const [shortcutSettingsOpen, setShortcutSettingsOpen] = useState(false);
  const mobileOpen = searchParams.get("filtres") === "1";
  const active = getActiveTroupeauFilters(filters, groups);

  useEffect(() => setQuery(params.q ?? ""), [params.q]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(SHORTCUTS_STORAGE_KEY) ?? "null");
      if (Array.isArray(stored)) {
        setVisibleShortcuts(stored.filter((key): key is ShortcutKey => SHORTCUTS.some((shortcut) => shortcut.key === key)));
      }
    } catch {
      setVisibleShortcuts(DEFAULT_SHORTCUTS);
    }
  }, []);

  useEffect(() => {
    const nextQuery = query.trim();
    if (nextQuery === (filters.q ?? "")) return;
    const timer = window.setTimeout(() => {
      const next = updateTroupeauSearchParams(new URLSearchParams(searchParams.toString()), "q", nextQuery || undefined);
      router.replace(filterUrl(next), { scroll: false });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [filters.q, query, router, searchParams]);

  function navigate(next: URLSearchParams) {
    router.push(filterUrl(next), { scroll: false });
  }

  function setFilter(key: keyof TroupeauFilterParams, value?: string) {
    navigate(updateTroupeauSearchParams(new URLSearchParams(searchParams.toString()), key, value));
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilter("q", query.trim() || undefined);
  }

  function openMobile() {
    const next = new URLSearchParams(searchParams.toString());
    next.set("filtres", "1");
    navigate(next);
  }

  function closeMobile() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("filtres");
    navigate(next);
  }

  function reset() {
    navigate(resetTroupeauSearchParams(new URLSearchParams(searchParams.toString())));
  }

  function shortcutActive(shortcut: (typeof SHORTCUTS)[number]) {
    return Object.entries(shortcut.filters).every(([key, value]) => {
      if (key === "sexe" && value === "F" && filters.categorie) {
        return !["VEAU_M", "TAUREAU"].includes(filters.categorie);
      }
      return filters[key as keyof TroupeauFilterParams] === value;
    });
  }

  function toggleShortcut(shortcut: (typeof SHORTCUTS)[number]) {
    let next = new URLSearchParams(searchParams.toString());
    const activeShortcut = shortcutActive(shortcut);
    for (const [key, value] of Object.entries(shortcut.filters)) {
      next = updateTroupeauSearchParams(next, key as keyof TroupeauFilterParams, activeShortcut ? undefined : value);
    }
    navigate(next);
  }

  function toggleShortcutVisibility(key: ShortcutKey) {
    const next = visibleShortcuts.includes(key) ? visibleShortcuts.filter((item) => item !== key) : [...visibleShortcuts, key];
    setVisibleShortcuts(next);
    localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(next));
  }

  const search = (
    <form onSubmit={submitSearch} className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute left-3 top-2.5 text-gray-400" size={18} />
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="N° travail, nom ou N° national…"
        className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
      />
    </form>
  );

  return (
    <div className="space-y-2">
      <div className="hidden items-center gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-sm lg:flex">
        {search}
        <DesktopSelect label="Sexe" value={filters.sexe} options={SEX_OPTIONS} onChange={(value) => setFilter("sexe", value)} />
        <DesktopSelect label="Catégorie" value={filters.categorie} options={TROUPEAU_CATEGORY_OPTIONS} onChange={(value) => setFilter("categorie", value)} />
        <DesktopSelect label="Repro" value={filters.repro} options={TROUPEAU_REPRODUCTION_OPTIONS} onChange={(value) => setFilter("repro", value)} />
        <DesktopSelect label="Sevrage" value={filters.sevrage} options={TROUPEAU_WEANING_OPTIONS} onChange={(value) => setFilter("sevrage", value)} />
        <DesktopSelect label="Santé" value={filters.sanitaire} options={TROUPEAU_HEALTH_OPTIONS} onChange={(value) => setFilter("sanitaire", value)} />
        <details className="relative shrink-0">
          <summary className="flex h-10 cursor-pointer list-none items-center gap-1 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700">
            + Plus <ChevronDown size={15} />
          </summary>
          <div className="absolute right-0 z-40 mt-2 w-72 space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-xl">
            <DesktopSelect label="Groupe / lot" value={filters.groupe} options={groups.map((group) => ({ value: group.id, label: group.nom }))} onChange={(value) => setFilter("groupe", value)} />
            <DesktopSelect label="Tarissement de la mère" value={filters.tarie} options={[{ value: "oui", label: "Tarie" }, { value: "non", label: "Non tarie" }]} onChange={(value) => setFilter("tarie", value)} />
            <DesktopSelect label="Tri" value={filters.tri} options={[{ value: "age_asc", label: "Plus jeunes" }, { value: "age_desc", label: "Plus âgés" }, { value: "velage_asc", label: "Vêlage le plus ancien" }, { value: "velage_desc", label: "Vêlage le plus récent" }]} onChange={(value) => setFilter("tri", value)} />
            <GroupeCreateButton />
          </div>
        </details>
      </div>

      <div className="flex gap-2 lg:hidden">
        {search}
        <button
          type="button"
          onClick={openMobile}
          className={`flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold shadow-sm ${
            active.length ? "bg-green-700 text-white" : "border border-gray-200 bg-white text-gray-700"
          }`}
        >
          <SlidersHorizontal size={17} />
          Filtres{active.length ? ` · ${active.length}` : ""}
        </button>
      </div>

      <div className="lg:hidden">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1" aria-label="Raccourcis de filtres">
          {SHORTCUTS.filter((shortcut) => visibleShortcuts.includes(shortcut.key)).map((shortcut) => {
            const isActive = shortcutActive(shortcut);
            return <button key={shortcut.key} type="button" onClick={() => toggleShortcut(shortcut)} aria-pressed={isActive} className={`min-h-9 shrink-0 rounded-full border px-3 text-xs font-semibold ${isActive ? "border-green-700 bg-green-700 text-white" : "border-gray-200 bg-white text-gray-700"}`}>
              {isActive ? "✓ " : ""}{shortcut.label}
            </button>;
          })}
          <button type="button" onClick={() => setShortcutSettingsOpen((open) => !open)} className="grid min-h-9 min-w-9 shrink-0 place-items-center rounded-full border border-gray-200 bg-white text-gray-600" aria-label="Personnaliser les raccourcis" aria-expanded={shortcutSettingsOpen}>
            <Settings2 size={15} />
          </button>
        </div>
        {shortcutSettingsOpen && <div className="mt-1 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <p className="mb-2 text-xs font-bold text-gray-700">Raccourcis visibles</p>
          <div className="flex flex-wrap gap-2">{SHORTCUTS.map((shortcut) => <button key={shortcut.key} type="button" onClick={() => toggleShortcutVisibility(shortcut.key)} className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${visibleShortcuts.includes(shortcut.key) ? "border-green-700 bg-green-50 text-green-800" : "border-gray-200 text-gray-500"}`}>
            {visibleShortcuts.includes(shortcut.key) ? "✓ " : ""}{shortcut.label}
          </button>)}</div>
        </div>}
      </div>

      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Filtres actifs">
          {active.map((item) => (
            <button
              type="button"
              key={item.key}
              onClick={() => setFilter(item.key, undefined)}
              className="flex min-h-8 items-center gap-1 rounded-full bg-green-100 px-2.5 text-xs font-semibold text-green-800"
            >
              {item.label} <X size={13} />
            </button>
          ))}
          <button type="button" onClick={reset} className="min-h-8 px-2 text-xs font-semibold text-gray-500 underline">
            Réinitialiser
          </button>
        </div>
      )}

      <p className="text-xs font-medium text-gray-500">{total} {total > 1 ? "animaux" : "animal"}</p>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filtres du troupeau">
          <button type="button" aria-label="Fermer les filtres" onClick={closeMobile} className="absolute inset-0 bg-black/35" />
          <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-gray-50 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
              <div>
                <h2 className="font-bold text-gray-900">Filtres</h2>
                <p className="text-xs text-gray-500">{active.length} actif{active.length > 1 ? "s" : ""}</p>
              </div>
              <button type="button" onClick={closeMobile} className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100" aria-label="Fermer">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-5 p-4">
              <MobileChoices label="Sexe" value={filters.sexe} options={SEX_OPTIONS} onChange={(value) => setFilter("sexe", value)} />
              <MobileChoices label="Catégorie" value={filters.categorie} options={TROUPEAU_CATEGORY_OPTIONS} onChange={(value) => setFilter("categorie", value)} />
              <MobileChoices label="Reproduction" value={filters.repro} options={TROUPEAU_REPRODUCTION_OPTIONS} onChange={(value) => setFilter("repro", value)} />
              <MobileChoices label="Sevrage" value={filters.sevrage} options={TROUPEAU_WEANING_OPTIONS} onChange={(value) => setFilter("sevrage", value)} />
              <MobileChoices label="Santé" value={filters.sanitaire} options={TROUPEAU_HEALTH_OPTIONS} onChange={(value) => setFilter("sanitaire", value)} />
              <details className="rounded-xl border border-gray-200 bg-white p-3">
                <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between font-semibold text-gray-800">
                  Plus de filtres <ChevronDown size={18} />
                </summary>
                <div className="mt-4 space-y-5">
                  <MobileChoices label="Groupe / lot" value={filters.groupe} options={groups.map((group) => ({ value: group.id, label: group.nom }))} onChange={(value) => setFilter("groupe", value)} />
                  <MobileChoices label="Tarissement de la mère" value={filters.tarie} options={[{ value: "oui", label: "Tarie" }, { value: "non", label: "Non tarie" }]} onChange={(value) => setFilter("tarie", value)} />
                  <MobileChoices label="Tri" value={filters.tri} options={[{ value: "age_asc", label: "Plus jeunes" }, { value: "age_desc", label: "Plus âgés" }, { value: "velage_asc", label: "Vêlage le plus ancien" }, { value: "velage_desc", label: "Vêlage le plus récent" }]} onChange={(value) => setFilter("tri", value)} />
                  <GroupeCreateButton />
                </div>
              </details>
            </div>
            <div className="sticky bottom-0 flex gap-2 border-t border-gray-200 bg-white p-3">
              <button type="button" onClick={reset} className="min-h-12 rounded-xl border border-gray-300 px-4 text-sm font-semibold text-gray-700">
                Réinitialiser
              </button>
              <button type="button" onClick={closeMobile} className="min-h-12 flex-1 rounded-xl bg-green-700 px-4 text-sm font-bold text-white shadow">
                Voir les {total} {total > 1 ? "animaux" : "animal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
