"use client";
import { useEffect, useRef, useState } from "react";
import { Baby, Heart, HeartPulse, Plus, Scale, Scan, Syringe, X, Pencil, Check, Stethoscope, Tag, ClipboardPlus, Footprints, ListChecks } from "lucide-react";

export type ActionId = "velage" | "chaleur" | "saillie" | "echographie" | "vaccination" | "traitement" | "pesee" | "bouclage" | "sanitaire" | "parage" | "liste_velages";
type Action = { id: ActionId; label: string; color: string; icon: typeof Baby; next?: "repro" | "health" };
const ROOT: Action[] = [
  { id: "velage", label: "Vêlage", color: "#EAA5BA", icon: Baby },
  { id: "saillie", label: "Reproduction", color: "#DB8FB5", icon: HeartPulse, next: "repro" },
  { id: "sanitaire", label: "Sanitaire", color: "#83B8EE", icon: Stethoscope, next: "health" },
  { id: "pesee", label: "Pesée rapide", color: "#B5A5E8", icon: Scale },
  { id: "bouclage", label: "Bouclage", color: "#E9BA7C", icon: Tag },
];
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
  const [level, setLevel] = useState<"root" | "repro" | "health">("root");
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  function back() { if (level !== "root") setLevel("root"); else setOpen(false); }
  useEffect(() => { if (!open) { setEditing(false); setError(""); setLevel("root"); } }, [open]);
  async function save() {
    if (!note.trim() || saving) return;
    setSaving(true); setError("");
    try { await onSaveNote(note.trim()); setNote(""); setEditing(false); setOpen(false); }
    catch { setError("La note n'a pas été enregistrée. Réessaie."); }
    finally { setSaving(false); }
  }
  const actions = level === "root" ? ROOT : level === "repro" ? REPRO : HEALTH;
  return (
    <div className="relative flex flex-col items-center gap-2">
      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-3">
          <button type="button" aria-label="Revenir au cercle précédent" onClick={back} className="absolute inset-0 bg-slate-800/35 backdrop-blur-sm" />
          <div role="dialog" aria-label={level === "root" ? "Actions rapides" : level === "repro" ? "Reproduction" : "Sanitaire"} className="relative z-10 w-full max-w-[360px] rounded-3xl border border-white/70 bg-white/95 p-3 shadow-2xl">
            {animalNumero && <p className="text-center text-sm font-semibold text-green-800">Animal sélectionné : {animalNumero} · démonstration</p>}
            <div className="relative mx-auto aspect-square w-full max-w-[330px]">
              {actions.map((action, index) => {
                const angle = actions.length === 3 ? [-90, 30, 150][index] : actions.length === 4 ? [-90, 0, 90, 180][index] : [-90, -18, 54, 126, 198][index];
                const rad = angle * Math.PI / 180;
                const left = 50 + 36 * Math.cos(rad), top = 50 + 36 * Math.sin(rad);
                return (
                  <div key={action.id} className="absolute w-[90px] -translate-x-1/2 -translate-y-1/2" style={{ left: `${left}%`, top: `${top}%` }}>
                    <button type="button" onClick={() => { if (action.next) setLevel(action.next); else { onAction(action.id); setOpen(false); } }} className="flex min-h-[84px] w-full flex-col items-center justify-center gap-1 text-center text-[11px] font-semibold leading-tight text-slate-800">
                      <span className="flex h-14 w-14 items-center justify-center rounded-full shadow-sm" style={{ backgroundColor: action.color }}><action.icon size={25} /></span>
                      <span>{action.label}</span>
                    </button>
                  </div>
                );
              })}
              <div className="absolute left-1/2 top-1/2 flex h-[125px] w-[125px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-amber-200 bg-amber-50 p-2 text-center">
                {level !== "root" ? (
                  <button type="button" onClick={back} className="flex h-full w-full flex-col items-center justify-center text-sm font-semibold text-slate-700">
                    <span>{level === "health" ? "Sanitaire" : "Reproduction"}</span><span className="mt-1 text-xs font-normal">Toucher autour pour revenir</span>
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
            </div>
            {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
            <button type="button" onClick={back} className="mx-auto mt-2 flex items-center gap-1 rounded-full px-4 py-2 text-sm text-slate-600"><X size={16}/> {level === "root" ? "Fermer" : "Retour"}</button>
          </div>
        </div>
      )}
      {!inputActive && <button type="button" aria-label="Ouvrir les actions rapides" aria-expanded={open} onClick={() => { setOpen(true); setLevel("root"); }} className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl ring-4 ring-white/80"><Plus size={30}/></button>}
    </div>
  );
}
