"use client";

import { useEffect, useRef, useState } from "react";
import { Baby, Heart, HeartPulse, Pill, Plus, Scale, Scan, Syringe, X, Pencil, Check } from "lucide-react";

type ActionId = "velage" | "chaleur" | "saillie" | "echographie" | "vaccination" | "traitement" | "pesee";
type Action = { id: ActionId; label: string; color: string; icon: typeof Baby };
const ACTIONS: Action[] = [
  { id: "velage", label: "Vêlage", color: "#EAA5BA", icon: Baby },
  { id: "chaleur", label: "Chaleurs", color: "#F5C7D5", icon: Heart },
  { id: "saillie", label: "Saillie / IA", color: "#DB8FB5", icon: HeartPulse },
  { id: "echographie", label: "Échographie", color: "#F0D06C", icon: Scan },
  { id: "vaccination", label: "Vaccination", color: "#80CDA2", icon: Syringe },
  { id: "traitement", label: "Traitement", color: "#83B8EE", icon: Pill },
  { id: "pesee", label: "Pesée", color: "#B5A5E8", icon: Scale },
];

export type AccueilRadialMenuProps = {
  onAction: (action: ActionId) => void;
  onSaveNote: (content: string) => Promise<void>;
};

/** Prototype isolé : aucune écriture en base sans callback fourni par le parent. */
export default function AccueilRadialMenu({ onAction, onSaveNote }: AccueilRadialMenuProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  useEffect(() => {
    if (!open) { setEditing(false); setError(""); }
  }, [open]);

  async function save() {
    if (!note.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await onSaveNote(note.trim());
      setNote("");
      setEditing(false);
      setOpen(false);
    } catch {
      setError("La note n'a pas été enregistrée. Réessaie.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative flex flex-col items-center gap-2">
      {open && (
        <div className="w-full max-w-[360px] rounded-3xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="relative mx-auto aspect-square w-full max-w-[330px]" aria-label="Menu circulaire des actions">
            {ACTIONS.map((action, index) => {
              const angles = [-145, -95, -45, -180, 0, 145, 45];
              const radians = angles[index] * Math.PI / 180;
              const left = 50 + 39 * Math.cos(radians);
              const top = 50 + 39 * Math.sin(radians);
              return (
                <div key={action.id} className="absolute w-[76px] -translate-x-1/2 -translate-y-1/2" style={{ left: `${left}%`, top: `${top}%` }}>
                  <ActionButton action={action} onClick={() => { onAction(action.id); setOpen(false); }} />
                </div>
              );
            })}
            <div className="absolute left-1/2 top-1/2 flex h-[132px] w-[132px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-amber-200 bg-amber-50 p-3 text-center">
              {editing ? (
                <>
                  <label htmlFor="accueil-note-rapide" className="text-xs font-semibold">Note rapide</label>
                  <textarea id="accueil-note-rapide" ref={inputRef} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Écris ici…" rows={2} className="mt-1 w-full resize-none rounded-lg border border-amber-200 bg-white p-1 text-sm" />
                  <button type="button" disabled={saving || !note.trim()} onClick={() => void save()} className="mt-1 flex items-center gap-1 rounded-lg bg-amber-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"><Check size={14} /> OK</button>
                </>
              ) : (
                <button type="button" onClick={() => setEditing(true)} className="flex h-full w-full flex-col items-center justify-center gap-1 text-sm font-semibold text-amber-900"><Pencil size={20} /> Écrire une note</button>
              )}
            </div>
          </div>
          {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
        </div>
      )}
      <button type="button" aria-label={open ? "Fermer les actions rapides" : "Ouvrir les actions rapides"} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
        {open ? <X size={30} /> : <Plus size={30} />}
      </button>
    </div>
  );
}

function ActionButton({ action, onClick }: { action: Action; onClick: () => void }) {
  const Icon = action.icon;
  return <button type="button" onClick={onClick} className="flex min-h-[70px] w-full flex-col items-center justify-center gap-1 rounded-xl p-1 text-center text-[11px] font-semibold leading-tight text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
    <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: action.color }}><Icon size={23} /></span>
    <span>{action.label}</span>
  </button>;
}
