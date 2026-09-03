import {
  ArrowRightLeft,
  Baby,
  ChevronDown,
  History,
  Scale,
  ScanLine,
  Stethoscope,
  Syringe,
  Truck,
  X,
} from "lucide-react";
import type { WorkspaceAction, WorkspaceActivity, WorkspaceAnimal } from "./types";

type WorkspaceSelectionPanelProps = {
  selectedAnimals: WorkspaceAnimal[];
  hiddenSelectedCount: number;
  compatibleCounts: Record<WorkspaceAction, number>;
  relatedMothers: WorkspaceAnimal[];
  relatedEchoMothers: WorkspaceAnimal[];
  activity: WorkspaceActivity[];
  onRemove: (animalId: string) => void;
  onClear: () => void;
  onAction: (action: WorkspaceAction) => void;
  onShowMothers: () => void;
  onSelectEchoMothers: () => void;
};

const ACTIONS: Array<{
  id: WorkspaceAction;
  label: string;
  icon: typeof Baby;
  tone: string;
}> = [
  { id: "treatment", label: "Traitement", icon: Stethoscope, tone: "bg-rose-50 text-rose-950 ring-rose-200" },
  { id: "vaccination", label: "Vaccination", icon: Syringe, tone: "bg-fuchsia-50 text-fuchsia-950 ring-fuchsia-200" },
  { id: "echo", label: "Échographie", icon: ScanLine, tone: "bg-amber-50 text-amber-950 ring-amber-200" },
  { id: "weaning", label: "Sevrage", icon: Baby, tone: "bg-blue-50 text-blue-950 ring-blue-200" },
  { id: "move", label: "Changer de lot", icon: ArrowRightLeft, tone: "bg-cyan-50 text-cyan-950 ring-cyan-200" },
  { id: "weight", label: "Pesée", icon: Scale, tone: "bg-slate-100 text-slate-950 ring-slate-200" },
  { id: "sale", label: "Sortie / vente", icon: Truck, tone: "bg-violet-50 text-violet-950 ring-violet-200" },
];

export default function WorkspaceSelectionPanel({
  selectedAnimals,
  hiddenSelectedCount,
  compatibleCounts,
  relatedMothers,
  relatedEchoMothers,
  activity,
  onRemove,
  onClear,
  onAction,
  onShowMothers,
  onSelectEchoMothers,
}: WorkspaceSelectionPanelProps) {
  const count = selectedAnimals.length;

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-2">
          <p className="text-xs font-black uppercase tracking-wide text-green-800">Actions rapides</p>
          <h2 className="text-lg font-black text-slate-950">Que voulez-vous faire ?</h2>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">
            {count ? `Appliqué à votre sélection de ${count} animal${count > 1 ? "aux" : ""}.` : "Cochez d’abord les animaux dans le tableau."}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {ACTIONS.map(({ id, label, icon: Icon, tone }) => {
            const compatibleCount = compatibleCounts[id];
            return (
              <button
                type="button"
                key={id}
                disabled={!compatibleCount}
                onClick={() => onAction(id)}
                className={`flex min-h-16 flex-col items-start justify-between rounded-lg p-2.5 text-left ring-1 ring-inset transition ${tone} disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <Icon size={18} strokeWidth={2.3} />
                <span>
                  <strong className="block text-xs font-black leading-tight">{label}</strong>
                  <span className="text-[10px] font-bold opacity-70">{getActionHint(id, count, compatibleCount)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {relatedMothers.length > 0 && (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-3 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-amber-800">Mères liées</p>
          <p className="mt-0.5 text-sm font-black text-amber-950">
            {relatedMothers.length} mère{relatedMothers.length > 1 ? "s" : ""}
            {relatedEchoMothers.length > 0 ? ` · ${relatedEchoMothers.length} à échographier` : ""}
          </p>
          <p className="mt-1 line-clamp-2 text-xs font-semibold text-amber-900">{relatedMothers.map((mother) => mother.nutrav).join(" · ")}</p>
          <div className="mt-2 grid gap-1.5">
            <button type="button" onClick={onShowMothers} className="min-h-10 rounded-lg bg-white px-3 text-xs font-black text-amber-950 ring-1 ring-inset ring-amber-300 hover:bg-amber-100">
              Voir les mères triées par numéro
            </button>
            {relatedEchoMothers.length > 0 && (
              <button type="button" onClick={onSelectEchoMothers} className="min-h-10 rounded-lg bg-amber-950 px-3 text-xs font-black text-white hover:bg-amber-900">
                Sélectionner les {relatedEchoMothers.length} à échographier
              </button>
            )}
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <details open={count > 0}>
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-3 text-sm font-black text-slate-950">
            <span className="flex size-7 items-center justify-center rounded-full bg-green-100 text-xs text-green-950">{count}</span>
            <span className="min-w-0 flex-1">Animaux sélectionnés</span>
            {hiddenSelectedCount > 0 && <span className="text-[10px] text-amber-800">{hiddenSelectedCount} hors vue</span>}
            <ChevronDown size={16} />
          </summary>
          {count ? (
            <div className="border-t border-slate-100 px-3 py-2">
              <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                {selectedAnimals.map((animal) => (
                  <button
                    type="button"
                    key={animal.id}
                    onClick={() => onRemove(animal.id)}
                    className="inline-flex min-h-8 items-center gap-1 rounded-full bg-green-50 px-2.5 text-xs font-black text-green-950 ring-1 ring-inset ring-green-200 hover:bg-red-50 hover:text-red-900 hover:ring-red-200"
                    aria-label={`Retirer ${animal.nutrav} de la sélection`}
                  >
                    {animal.nutrav}<X size={13} />
                  </button>
                ))}
              </div>
              <button type="button" onClick={onClear} className="mt-2 min-h-9 w-full rounded-lg text-xs font-black text-slate-500 hover:bg-slate-100 hover:text-slate-900">Vider la sélection</button>
            </div>
          ) : (
            <p className="border-t border-slate-100 px-3 py-3 text-xs text-slate-500">1. Choisissez une vue · 2. Cochez les animaux · 3. Lancez une action.</p>
          )}
        </details>
      </section>

      {activity.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <h2 className="flex items-center gap-2 px-1 pb-2 text-sm font-black text-slate-950"><History size={16} /> Travail récent</h2>
          <ol className="space-y-2">
            {activity.slice(0, 4).map((item) => (
              <li key={item.id} className="rounded-lg bg-slate-50 px-2.5 py-2 text-xs">
                <strong className="block text-slate-900">{item.label}</strong>
                <span className="font-semibold text-slate-500">{item.time} · {item.animalIds.length} animal{item.animalIds.length > 1 ? "aux" : ""}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function getActionHint(action: WorkspaceAction, selectedCount: number, compatibleCount: number) {
  if (!selectedCount) return "Sélection requise";
  if (!compatibleCount) {
    if (action === "echo") return "Vaches uniquement";
    if (action === "weaning") return "Veaux uniquement";
    return "Indisponible";
  }
  if (compatibleCount < selectedCount) {
    if (action === "echo") return `${compatibleCount} femelle${compatibleCount > 1 ? "s" : ""}`;
    if (action === "weaning") return `${compatibleCount} veau${compatibleCount > 1 ? "x" : ""}`;
  }
  return "Sur la sélection";
}
