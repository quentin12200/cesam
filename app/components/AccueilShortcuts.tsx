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
import QuickActionButton from "@/components/QuickActionButton";
import { ACTION_VISUALS, type ActionVisualKey } from "@/components/action-visuals";
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
  href?: string;
  icon: ShortcutIcon;
  className: string;
  visual?: ActionVisualKey;
}

const SHORTCUTS: Record<AccueilShortcutId, ShortcutDefinition> = {
  chaleur: { label: ACTION_VISUALS.chaleur.label, icon: ACTION_VISUALS.chaleur.icon, className: ACTION_VISUALS.chaleur.className, visual: "chaleur" },
  saillie: { label: ACTION_VISUALS.saillieIA.label, icon: ACTION_VISUALS.saillieIA.icon, className: ACTION_VISUALS.saillieIA.className, visual: "saillieIA" },
  evenement: { label: ACTION_VISUALS.evenementSanitaire.label, icon: ACTION_VISUALS.evenementSanitaire.icon, className: ACTION_VISUALS.evenementSanitaire.className, visual: "evenementSanitaire" },
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

type ActionRapide = "chaleur" | "saillie" | "evenement";

export default function AccueilShortcuts({ onAction }: { onAction: (action: ActionRapide) => void }) {
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

  const nombreColonnes = raccourcis.length <= 4 ? raccourcis.length : Math.ceil(raccourcis.length / 2);

  return (
    <section data-layout-section="accueil-actions-rapides" data-layout-label="Actions rapides" className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-gray-800">Actions rapides</h2>
        <button type="button" onClick={ouvrir} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50">
          <Plus size={15} /> Gérer
        </button>
      </div>

      {raccourcis.length === 0 ? (
        <button type="button" onClick={ouvrir} className="min-h-14 w-full rounded-lg border border-dashed border-gray-300 bg-white text-sm font-medium text-gray-500">
          + Ajouter une action
        </button>
      ) : (
        <div
          className="grid gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]"
          style={{
            gridTemplateColumns: `repeat(${nombreColonnes}, minmax(8.5rem, 1fr))`,
            minWidth: `max(100%, ${nombreColonnes * 8.5}rem)`,
          }}
        >
          {raccourcis.map((id) => {
            const item = SHORTCUTS[id];
            const Icon = item.icon;
            if (item.visual) {
              return <QuickActionButton key={id} action={item.visual} onClick={() => onAction(id as ActionRapide)} className="min-h-16 w-full flex-col text-center leading-tight" />;
            }
            return (
              <Link key={id} href={item.href!} className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-center text-xs font-semibold leading-tight shadow-sm transition active:scale-[0.97] ${item.className}`}>
                <Icon size={20} className="shrink-0" />
                <span className="w-full whitespace-normal">{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}

      {error && !open && <p className="text-xs text-red-600">{error}</p>}

      {open && (
        <SelectionModal
          title="Actions rapides"
          onClose={() => setOpen(false)}
          controls={<p className="px-4 py-2 text-xs text-gray-500">{brouillon.length} action{brouillon.length > 1 ? "s" : ""} sélectionnée{brouillon.length > 1 ? "s" : ""}</p>}
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
