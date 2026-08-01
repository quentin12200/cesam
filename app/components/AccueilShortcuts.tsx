"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import {
  Baby,
  BarChart3,
  CalendarDays,
  Check,
  Euro,
  FileText,
  HeartPulse,
  GripVertical,
  Pill,
  Plus,
  Scale,
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

type ActionRapide = "chaleur" | "saillie" | "evenement";

export default function AccueilShortcuts({ onAction }: { onAction: (action: ActionRapide) => void }) {
  const { profile, ready } = useUserPreferences();
  const [raccourcis, setRaccourcis] = useState<AccueilShortcutId[]>(DEFAULT_ACCUEIL_SHORTCUTS);
  const [brouillon, setBrouillon] = useState<AccueilShortcutId[]>(DEFAULT_ACCUEIL_SHORTCUTS);
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draggedId, setDraggedId] = useState<AccueilShortcutId | null>(null);
  const [dropTargetId, setDropTargetId] = useState<AccueilShortcutId | "__end__" | null>(null);

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

  function deposerAvant(targetId: AccueilShortcutId | "__end__") {
    if (!draggedId) return;
    setBrouillon((ids) => {
      const next = ids.filter((id) => id !== draggedId);
      const cible = targetId === "__end__" ? next.length : next.indexOf(targetId);
      if (cible < 0) return ids;
      next.splice(cible, 0, draggedId);
      return next;
    });
    setDraggedId(null);
    setDropTargetId(null);
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

  function afficherAction(id: AccueilShortcutId, fermer?: () => void) {
    const item = SHORTCUTS[id];
    const Icon = item.icon;
    if (item.visual) {
      return <QuickActionButton key={id} action={item.visual} onClick={() => { fermer?.(); onAction(id as ActionRapide); }} className="min-h-14 w-full flex-col gap-0.5 px-1 py-1 text-center text-xs leading-tight [&_svg]:h-4 [&_svg]:w-4" />;
    }
    return (
      <Link key={id} href={item.href!} onClick={fermer} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-1 text-center text-xs font-semibold leading-tight shadow-sm transition active:scale-[0.97] ${item.className}`}>
        <Icon size={16} className="shrink-0" />
        <span className="w-full whitespace-normal">{item.label}</span>
      </Link>
    );
  }

  const mobileActions = raccourcis.slice(0, raccourcis.length > 5 ? 4 : 5);
  const desktopActions = raccourcis.slice(0, raccourcis.length > 11 ? 10 : 11);
  const weighingShortcut = (
    <Link href="/troupeau/pesee" className="flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-green-300 bg-green-50 px-1 py-1 text-center text-xs font-semibold leading-tight text-green-900 shadow-sm transition active:scale-[0.97]">
      <Scale size={16} className="shrink-0" />
      <span className="w-full whitespace-normal">Pesée rapide</span>
    </Link>
  );

  return (
    <section data-layout-section="accueil-actions-rapides" data-layout-label="Actions rapides" className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-gray-800">Actions rapides</h2>
        <button type="button" onClick={ouvrir} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 text-[11px] font-medium text-gray-600 hover:bg-gray-50">
          <Plus size={15} /> Gérer
        </button>
      </div>

      {raccourcis.length === 0 ? (
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          {weighingShortcut}
          <button type="button" onClick={ouvrir} className="min-h-14 rounded-lg border border-dashed border-gray-300 bg-white text-xs font-medium text-gray-500">
            + Ajouter une action
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1.5 sm:hidden">
            {mobileActions.map((id) => afficherAction(id))}
            {weighingShortcut}
            {raccourcis.length > 5 && <button type="button" onClick={() => setShowAll(true)} className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg border border-gray-200 bg-white px-1 text-xs font-semibold text-gray-700 shadow-sm"><Plus size={16} />Plus</button>}
          </div>
          <div className="hidden grid-cols-6 gap-1.5 sm:grid">
            {desktopActions.map((id) => afficherAction(id))}
            {weighingShortcut}
            {raccourcis.length > 11 && <button type="button" onClick={() => setShowAll(true)} className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg border border-gray-200 bg-white px-1 text-xs font-semibold text-gray-700 shadow-sm"><Plus size={16} />Plus</button>}
          </div>
        </>
      )}

      {error && !open && <p className="text-xs text-red-600">{error}</p>}

      {showAll && (
        <SelectionModal title="Toutes mes actions" onClose={() => setShowAll(false)}>
          <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
            {raccourcis.map((id) => afficherAction(id, () => setShowAll(false)))}
          </div>
        </SelectionModal>
      )}

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
                <p className="text-xs text-gray-400">Faites glisser les lignes. Le trait vert indique l’emplacement exact.</p>
                {brouillon.map((id) => {
                  const item = SHORTCUTS[id];
                  const Icon = item.icon;
                  return (
                    <div
                      key={id}
                      data-shortcut-drop={id}
                      draggable
                      onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDraggedId(id); setDropTargetId(null); }}
                      onDragEnd={() => { setDraggedId(null); setDropTargetId(null); }}
                      onDragOver={(event) => { event.preventDefault(); if (draggedId !== id) setDropTargetId(id); }}
                      onDrop={(event) => { event.preventDefault(); deposerAvant(id); }}
                      className={`relative flex min-h-12 items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-2 ${draggedId === id ? "opacity-50" : ""} ${dropTargetId === id ? "before:absolute before:-top-[7px] before:left-1 before:right-1 before:h-1 before:rounded-full before:bg-green-600" : ""}`}
                    >
                      <GripVertical
                        size={18}
                        className="shrink-0 cursor-grab touch-none text-gray-400 active:cursor-grabbing"
                        onTouchStart={() => { setDraggedId(id); setDropTargetId(null); }}
                        onTouchMove={(event) => {
                          event.preventDefault();
                          const touch = event.touches[0];
                          const cible = document.elementFromPoint(touch.clientX, touch.clientY)?.closest<HTMLElement>("[data-shortcut-drop]")?.dataset.shortcutDrop;
                          if (cible && cible !== id) setDropTargetId(cible as AccueilShortcutId | "__end__");
                        }}
                        onTouchEnd={() => { if (dropTargetId) deposerAvant(dropTargetId); else { setDraggedId(null); setDropTargetId(null); } }}
                      />
                      <Icon size={17} className="shrink-0 text-green-700" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">{item.label}</span>
                      <button type="button" onClick={() => retirer(id)} className="inline-flex h-10 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-red-600 hover:bg-red-50"><Check size={15} /> Retirer</button>
                    </div>
                  );
                })}
                <div
                  data-shortcut-drop="__end__"
                  onDragOver={(event) => { event.preventDefault(); setDropTargetId("__end__"); }}
                  onDrop={(event) => { event.preventDefault(); deposerAvant("__end__"); }}
                  className={`relative h-2 ${dropTargetId === "__end__" ? "after:absolute after:bottom-0 after:left-1 after:right-1 after:h-1 after:rounded-full after:bg-green-600" : ""}`}
                  aria-hidden="true"
                />
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
