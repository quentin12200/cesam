"use client";
import { useEffect, useRef, useState } from "react";
import { Baby, Heart, HeartPulse, Plus, Scale, Scan, Syringe, X, Pencil, Check, Stethoscope, Tag, ClipboardPlus, Footprints, ListChecks, Scissors, Settings2, MoreHorizontal, ArrowUp, ArrowDown } from "lucide-react";

export type ActionId = "velage" | "chaleur" | "saillie" | "echographie" | "vaccination" | "traitement" | "pesee" | "bouclage" | "sanitaire" | "parage" | "liste_velages" | "sevrage";
type Action = { id: ActionId | "autres"; label: string; color: string; icon: typeof Baby; next?: "repro" | "health" | "other" };
const CATALOG: Action[] = [
  { id: "velage", label: "Vêlage", color: "#EAA5BA", icon: Baby },
  { id: "saillie", label: "Saillie / IA", color: "#DB8FB5", icon: HeartPulse },
  { id: "sanitaire", label: "Sanitaire", color: "#83B8EE", icon: Stethoscope, next: "health" },
  { id: "pesee", label: "Pesée rapide", color: "#B5A5E8", icon: Scale },
  { id: "bouclage", label: "Bouclage", color: "#E9BA7C", icon: Tag },
  { id: "sevrage", label: "Sevrage", color: "#9BC9A4", icon: Scissors },
  { id: "chaleur", label: "Chaleurs", color: "#F5C7D5", icon: Heart },
  { id: "echographie", label: "Échographie", color: "#F0D06C", icon: Scan },
  { id: "vaccination", label: "Tableau vaccinal", color: "#80CDA2", icon: Syringe },
  { id: "traitement", label: "Événement sanitaire", color: "#83B8EE", icon: ClipboardPlus },
  { id: "parage", label: "Parage", color: "#A7D8B4", icon: Footprints },
  { id: "liste_velages", label: "Liste des vêlages", color: "#E9A5BA", icon: ListChecks },
];
const DEFAULT_SHORTCUTS: ActionId[] = ["velage", "saillie", "sanitaire", "pesee", "bouclage"];
const OTHER: Action = { id: "autres", label: "Autres", color: "#A7D8B4", icon: MoreHorizontal, next: "other" };
const REPRO: Action[] = [
  { id: "chaleur", label: "Chaleurs", color: "#F5C7D5", icon: Heart },
  { id: "saillie", label: "Saillie / IA", color: "#DB8FB5", icon: HeartPulse },
  { id: "echographie", label: "Échographie", color: "#F0D06C", icon: Scan },
  { id: "liste_velages", label: "Liste des vêlages", color: "#E9A5BA", icon: ListChecks },
];
const HEALTH: Action[] = [
  { id: "traitement", label: "Événement sanitaire", color: "#83B8EE", icon: ClipboardPlus },
  { id: "vaccination", label: "Tableau vaccinal", color: "#80CDA2", icon: Syringe },
  { id: "parage", label: "Parage", color: "#A7D8B4", icon: Footprints },
];
export type AccueilRadialMenuProps = {
  onAction: (action: ActionId) => void;
  animalNumero?: string | null;
  onSaveNote: (content: string) => Promise<void>;
};
/** Prototype isolé : callbacks de démonstration, aucune écriture directe en base. */
export default function AccueilRadialMenu({ onAction, onSaveNote, animalNumero }: AccueilRadialMenuProps) {
  const [open, setOpen] = useState(false);
  const [inputActive, setInputActive] = useState(false);
  useEffect(() => {
    function onFocus(event: FocusEvent) { const el = event.target; if (el instanceof HTMLElement && el.matches("input, textarea, select, [contenteditable=true]")) setInputActive(true); }
    function onBlur() { setTimeout(() => { const el = document.activeElement; setInputActive(el instanceof HTMLElement && el.matches("input, textarea, select, [contenteditable=true]")); }, 0); }
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    return () => { document.removeEventListener("focusin", onFocus); document.removeEventListener("focusout", onBlur); };
  }, []);
  const [level, setLevel] = useState<"root" | "repro" | "health" | "other">("root");
  const [customizing, setCustomizing] = useState(false);
  const [shortcuts, setShortcuts] = useState<ActionId[]>(DEFAULT_SHORTCUTS);
  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem("cesam-lab-radial-shortcuts-v1") || "null");
      if (Array.isArray(stored) && stored.length === 5 && new Set(stored).size === 5 && stored.every(id => CATALOG.some(a => a.id === id))) setShortcuts(stored);
    } catch { /* Réinitialisation silencieuse de la démo */ }
  }, []);
  function updateShortcuts(next: ActionId[]) {
    setShortcuts(next);
    try { window.localStorage.setItem("cesam-lab-radial-shortcuts-v1", JSON.stringify(next)); } catch { /* Le menu reste utilisable sans stockage */ }
  }
  function moveShortcut(index: number, offset: number) {
    const next = [...shortcuts]; const target = index + offset;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updateShortcuts(next);
  }
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  function back() { if (customizing) { setCustomizing(false); return; } if (level !== "root") setLevel("root"); else setOpen(false); }
  useEffect(() => { if (!open) { setEditing(false); setError(""); setLevel("root"); setCustomizing(false); } }, [open]);
  async function save() {
    if (!note.trim() || saving) return;
    setSaving(true); setError("");
    try { await onSaveNote(note.trim()); setNote(""); setEditing(false); setOpen(false); }
    catch { setError("La note n'a pas été enregistrée. Réessaie."); }
    finally { setSaving(false); }
  }
  const actions: Action[] = level === "root" ? [...shortcuts.map(id => CATALOG.find(a => a.id === id)!), OTHER] : level === "other" ? CATALOG.filter(a => !shortcuts.includes(a.id) && a.id !== "sanitaire") : level === "repro" ? REPRO : HEALTH;
  return (
    <div className="relative flex flex-col items-center gap-2">
      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-3">
          <button type="button" aria-label="Revenir au cercle précédent" onClick={back} className="absolute inset-0 bg-slate-800/35 backdrop-blur-sm" />
          <div role="dialog" aria-label={level === "root" ? "Actions rapides" : level === "repro" ? "Reproduction" : level === "other" ? "Autres interventions" : "Sanitaire"} className="relative z-10 w-full max-w-[360px] p-3">
            {animalNumero && <p className="mx-auto mb-2 w-fit rounded-full bg-white/85 px-3 py-1 text-center text-sm font-semibold text-green-800 shadow-sm">Animal sélectionné : {animalNumero} · démonstration</p>}
            {level === "root" && <button type="button" onClick={() => setCustomizing(v => !v)} className="mx-auto mb-1 flex items-center gap-1 rounded-full bg-slate-900/70 px-3 py-2 text-xs font-semibold text-white"><Settings2 size={15}/> {customizing ? "Terminer" : "Personnaliser mes raccourcis"}</button>}
            {customizing ? <div className="max-h-[65dvh] space-y-2 overflow-y-auto rounded-2xl bg-white/95 p-3 text-slate-800">
              <p className="text-xs">Choisis cinq actions et leur ordre. Les préférences restent sur cet appareil uniquement.</p>
              {shortcuts.map((id, index) => <div key={index} className="flex items-center gap-1">
                <span className="w-5 text-sm font-bold">{index + 1}</span>
                <select aria-label={`Raccourci ${index + 1}`} className="min-w-0 flex-1 rounded-lg border p-2 text-sm" value={id} onChange={e => { const next = [...shortcuts]; const selected = e.target.value as ActionId; const previous = next.indexOf(selected); if (previous >= 0) next[previous] = id; next[index] = selected; updateShortcuts(next); }}>
                  {CATALOG.map(action => <option key={action.id} value={action.id}>{action.label}</option>)}
                </select>
                <button type="button" aria-label={`Monter ${index + 1}`} disabled={index === 0} onClick={() => moveShortcut(index, -1)} className="rounded-lg bg-slate-100 p-2 disabled:opacity-30"><ArrowUp size={17}/></button>
                <button type="button" aria-label={`Descendre ${index + 1}`} disabled={index === 4} onClick={() => moveShortcut(index, 1)} className="rounded-lg bg-slate-100 p-2 disabled:opacity-30"><ArrowDown size={17}/></button>
              </div>)}
              <button type="button" onClick={() => updateShortcuts([...DEFAULT_SHORTCUTS])} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold">Réinitialiser</button>
            </div> : level === "other" ? <div className="max-h-[65dvh] overflow-y-auto rounded-2xl bg-slate-900/80 p-3">
              <h3 className="mb-2 text-center text-sm font-bold text-white">Autres interventions</h3>
              <div className="grid grid-cols-2 gap-2">
                {actions.map(action => <button key={action.id} type="button" onClick={() => { if (action.next) setLevel(action.next); else { onAction(action.id as ActionId); setOpen(false); } }} className="flex min-h-14 items-center gap-2 rounded-xl bg-white/95 p-2 text-left text-xs font-semibold text-slate-800">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: action.color }}><action.icon size={19}/></span>{action.label}
                </button>)}
              </div>
            </div> : <div className="relative mx-auto aspect-square w-full max-w-[330px]">
              {actions.map((action, index) => {
                const angle = actions.length > 6 ? (index * 360 / actions.length - 90) : actions.length === 6 ? [-90, -30, 30, 90, 150, 210][index] : actions.length === 3 ? [-90, 30, 150][index] : actions.length === 4 ? [-90, 0, 90, 180][index] : [-90, -18, 54, 126, 198][index];
                const rad = angle * Math.PI / 180;
                const left = 50 + 36 * Math.cos(rad), top = 50 + 36 * Math.sin(rad);
                return (
                  <div key={action.id} className="absolute w-[90px] -translate-x-1/2 -translate-y-1/2" style={{ left: `${left}%`, top: `${top}%` }}>
                    <button type="button" onClick={() => { if (action.next) setLevel(action.next); else { onAction(action.id as ActionId); setOpen(false); } }} className="flex min-h-[84px] w-full flex-col items-center justify-center gap-1 text-center text-[11px] font-semibold leading-tight text-white drop-shadow-md">
                      <span className="flex h-14 w-14 items-center justify-center rounded-full shadow-lg" style={{ backgroundColor: action.color }}><action.icon size={25} /></span>
                      <span>{action.label}</span>
                    </button>
                  </div>
                );
              })}
              <div className="absolute left-1/2 top-1/2 flex h-[125px] w-[125px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-amber-200 bg-amber-50 p-2 text-center">
                {level !== "root" ? (
                  <button type="button" onClick={back} className="flex h-full w-full flex-col items-center justify-center text-sm font-semibold text-slate-700">
                    <span>{level === "health" ? "Sanitaire" : level === "other" ? "Autres" : "Reproduction"}</span><span className="mt-1 text-xs font-normal">Toucher autour pour revenir</span>
                  </button>
                ) : editing ? (
                  <>
                    <label htmlFor="accueil-note-rapide" className="text-xs font-semibold">Note rapide</label>
                    <textarea id="accueil-note-rapide" ref={inputRef} value={note} onChange={e => setNote(e.target.value)} placeholder="Écris ici…" rows={2} className="mt-1 w-full resize-none rounded-lg border border-amber-200 bg-white p-1 text-sm" />
                    <button type="button" disabled={saving || !note.trim()} onClick={() => void save()} className="mt-1 flex items-center gap-1 rounded-lg bg-amber-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"><Check size={14} /> OK</button>
                  </>
                ) : (
                  <button type="button" onClick={() => setEditing(true)} className="flex h-full w-full flex-col items-center justify-center gap-1 text-sm font-semibold text-amber-900"><Pencil size={20} /> Écrire une note</button>
                )}
              </div>
            </div>}
            {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
            <button type="button" onClick={back} className="mx-auto mt-2 flex items-center gap-1 rounded-full bg-slate-900/65 px-4 py-2 text-sm font-semibold text-white"><X size={16}/> {level === "root" && !customizing ? "Fermer" : "Retour"}</button>
          </div>
        </div>
      )}
      {!inputActive && <button type="button" aria-label="Ouvrir les actions rapides" aria-expanded={open} onClick={() => { setOpen(true); setLevel("root"); }} className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl ring-4 ring-white/80"><Plus size={30}/></button>}
    </div>
  );
}
