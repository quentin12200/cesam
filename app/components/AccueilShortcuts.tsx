"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Baby,
  BarChart3,
  CalendarDays,
  Check,
  Euro,
  FileText,
  HeartPulse,
  Pill,
  Plus,
  Stethoscope,
  Tags,
  Users,
} from "lucide-react";
import HoofPrintIcon from "@/components/HoofPrintIcon";
import SelectionModal from "@/components/SelectionModal";
import { useUserPreferences } from "@/components/UserPreferencesProvider";
import {
  ACCUEIL_SHORTCUT_IDS,
  DEFAULT_ACCUEIL_SHORTCUTS,
  MAX_ACCUEIL_SHORTCUTS,
  normaliserAccueilShortcuts,
  type AccueilShortcutId,
} from "@/lib/accueil-shortcuts";

type ShortcutIcon = ComponentType<{ size?: number; className?: string }>;

interface ShortcutDefinition {
  label: string;
  href: string;
  icon: ShortcutIcon;
  className: string;
}

const SHORTCUTS: Record<AccueilShortcutId, ShortcutDefinition> = {
  parage: { label: "Parage", href: "/parage", icon: HoofPrintIcon, className: "border-green-200 bg-green-50 text-green-800" },
  troupeau: { label: "Troupeau", href: "/troupeau", icon: Users, className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  reproduction: { label: "Reproduction", href: "/reproduction", icon: HeartPulse, className: "border-pink-200 bg-pink-50 text-pink-800" },
  velage: { label: "Vêlage", href: "/velage", icon: Baby, className: "border-rose-200 bg-rose-50 text-rose-800" },
  sanitaire: { label: "Sanitaire", href: "/sanitaire", icon: Stethoscope, className: "border-blue-200 bg-blue-50 text-blue-800" },
  pharmacie: { label: "Pharmacie", href: "/pharmacie", icon: Pill, className: "border-cyan-200 bg-cyan-50 text-cyan-800" },
  ordonnances: { label: "Ordonnances", href: "/ordonnances", icon: FileText, className: "border-indigo-200 bg-indigo-50 text-indigo-800" },
  finances: { label: "Finances", href: "/finances", icon: Euro, className: "border-teal-200 bg-teal-50 text-teal-800" },
  "calendrier-gestation": { label: "Gestation", href: "/reproduction/calendrier", icon: CalendarDays, className: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800" },
  "carnet-sanitaire": { label: "Carnet sanitaire", href: "/sanitaire/carnet", icon: FileText, className: "border-sky-200 bg-sky-50 text-sky-800" },
  identification: { label: "Identification", href: "/troupeau/identification", icon: Tags, className: "border-orange-200 bg-orange-50 text-orange-800" },
  taureaux: { label: "Taureaux", href: "/taureaux", icon: BarChart3, className: "border-gray-200 bg-gray-50 text-gray-800" },
};

function deplacer(ids: AccueilShortcutId[], index: number, direction: -1 | 1) {
  const cible = index + direction;
  if (cible < 0 || cible >= ids.length) return ids;
  const next = [...ids];
  [next[index], next[cible]] = [next[cible], next[index]];
  return next;
}

export default function AccueilShortcuts() {
  const { profile, ready } = useUserPreferences();
  const [raccourcis, setRaccourcis] = useState<AccueilShortcutId[]>(DEFAULT_ACCUEIL_SHORTCUTS);
  const [brouillon, setBrouillon] = useState<AccueilShortcutId[]>(DEFAULT_ACCUEIL_SHORTCUTS);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready) return;
    let active = true;
    setLoading(true);
    fetch(`/api/raccourcis-accueil?profil=${encodeURIComponent(profile)}`)
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;
        const ids = normaliserAccueilShortcuts(data.raccourcis);
        setRaccourcis(ids);
        setBrouillon(ids);
      })
      .catch(() => active && setError("Impossible de charger les raccourcis"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [profile, ready]);

  const nonSelectionnes = useMemo(
    () => ACCUEIL_SHORTCUT_IDS.filter((id) => !brouillon.includes(id)),
    [brouillon]
  );

  function ouvrir() {
    setBrouillon(raccourcis);
    setError("");
    setOpen(true);
  }

  function ajouter(id: AccueilShortcutId) {
    if (brouillon.length >= MAX_ACCUEIL_SHORTCUTS) return;
    setBrouillon((ids) => [...ids, id]);
  }

  function retirer(id: AccueilShortcutId) {
    setBrouillon((ids) => ids.filter((value) => value !== id));
  }

  async function enregistrer() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/raccourcis-accueil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profil: profile, raccourcis: brouillon }),
      });
      if (!response.ok) throw new Error();
      setRaccourcis(brouillon);
      setOpen(false);
    } catch {
      setError("Impossible d’enregistrer les raccourcis");
    } finally {
      setSaving(false);
    }
  }

  if (!ready || loading) {
    return <div className="h-16 animate-pulse rounded-lg bg-gray-100" aria-label="Chargement des raccourcis" />;
  }

  return (
    <section data-layout-section="accueil-raccourcis" data-layout-label="Mes raccourcis" className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-gray-800">Mes raccourcis</h2>
        <button type="button" onClick={ouvrir} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50">
          <Plus size={15} /> Gérer
        </button>
      </div>

      {raccourcis.length === 0 ? (
        <button type="button" onClick={ouvrir} className="min-h-14 w-full rounded-lg border border-dashed border-gray-300 bg-white text-sm font-medium text-gray-500">
          + Ajouter un raccourci
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {raccourcis.map((id) => {
            const item = SHORTCUTS[id];
            const Icon = item.icon;
            return (
              <Link key={id} href={item.href} className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border px-1.5 py-2 text-center text-xs font-semibold shadow-sm transition active:scale-[0.97] ${item.className}`}>
                <Icon size={20} className="shrink-0" />
                <span className="w-full truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}

      {error && !open && <p className="text-xs text-red-600">{error}</p>}

      {open && (
        <SelectionModal
          title="Mes raccourcis"
          onClose={() => setOpen(false)}
          controls={<p className="px-4 py-2 text-xs text-gray-500">{brouillon.length} / {MAX_ACCUEIL_SHORTCUTS} raccourcis sélectionnés</p>}
          footer={(
            <div className="flex items-center justify-end gap-2 p-3">
              <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700">Annuler</button>
              <button type="button" disabled={saving} onClick={() => void enregistrer()} className="min-h-11 rounded-lg bg-green-700 px-4 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          )}
        >
          <div className="space-y-4 p-4">
            {brouillon.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase text-gray-500">Sélectionnés</h3>
                {brouillon.map((id, index) => {
                  const item = SHORTCUTS[id];
                  const Icon = item.icon;
                  return (
                    <div key={id} className="flex min-h-12 items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-2">
                      <Icon size={17} className="shrink-0 text-green-700" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">{item.label}</span>
                      <button type="button" disabled={index === 0} onClick={() => setBrouillon((ids) => deplacer(ids, index, -1))} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 disabled:opacity-25" aria-label={`Monter ${item.label}`} title="Monter"><ArrowUp size={16} /></button>
                      <button type="button" disabled={index === brouillon.length - 1} onClick={() => setBrouillon((ids) => deplacer(ids, index, 1))} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 disabled:opacity-25" aria-label={`Descendre ${item.label}`} title="Descendre"><ArrowDown size={16} /></button>
                      <button type="button" onClick={() => retirer(id)} className="inline-flex h-10 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-red-600 hover:bg-red-50"><Check size={15} /> Retirer</button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase text-gray-500">Disponibles</h3>
              {nonSelectionnes.map((id) => {
                const item = SHORTCUTS[id];
                const Icon = item.icon;
                const limiteAtteinte = brouillon.length >= MAX_ACCUEIL_SHORTCUTS;
                return (
                  <button key={id} type="button" disabled={limiteAtteinte} onClick={() => ajouter(id)} className="flex min-h-12 w-full items-center gap-3 rounded-lg border border-gray-200 px-3 text-left hover:bg-gray-50 disabled:opacity-40">
                    <Icon size={18} className="shrink-0 text-gray-500" />
                    <span className="flex-1 text-sm font-medium text-gray-800">{item.label}</span>
                    <Plus size={16} className="text-green-700" />
                  </button>
                );
              })}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </SelectionModal>
      )}
    </section>
  );
}
