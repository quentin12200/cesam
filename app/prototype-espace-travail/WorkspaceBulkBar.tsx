import { Baby, Scale, ScanLine, Stethoscope, Syringe, X } from "lucide-react";
import type { WorkspaceAction, WorkspaceAnimal } from "./types";

type WorkspaceBulkBarProps = {
  selectedAnimals: WorkspaceAnimal[];
  hiddenSelectedCount: number;
  compatibleCounts: Record<WorkspaceAction, number>;
  relatedMothers: WorkspaceAnimal[];
  relatedEchoMothers: WorkspaceAnimal[];
  onClear: () => void;
  onAction: (action: WorkspaceAction) => void;
  onShowMothers: () => void;
  onSelectEchoMothers: () => void;
};

const MAIN_ACTIONS: Array<{
  id: WorkspaceAction;
  label: string;
  icon: typeof Baby;
}> = [
  { id: "treatment", label: "Traitement", icon: Stethoscope },
  { id: "vaccination", label: "Vaccination", icon: Syringe },
  { id: "echo", label: "Échographie", icon: ScanLine },
  { id: "weaning", label: "Sevrage", icon: Baby },
  { id: "weight", label: "Pesée", icon: Scale },
];

export default function WorkspaceBulkBar({
  selectedAnimals,
  hiddenSelectedCount,
  compatibleCounts,
  relatedMothers,
  relatedEchoMothers,
  onClear,
  onAction,
  onShowMothers,
  onSelectEchoMothers,
}: WorkspaceBulkBarProps) {
  if (!selectedAnimals.length) return null;

  return (
    <section className="mb-3 overflow-hidden rounded-xl border border-green-800 bg-green-900 text-white shadow-md" aria-label="Actions sur les animaux sélectionnés">
      <div className="flex flex-wrap items-center gap-2 p-2.5 sm:p-3">
        <div className="min-w-40 flex-1">
          <p className="text-sm font-black">
            {selectedAnimals.length} {selectedAnimals.length > 1 ? "animaux sélectionnés" : "animal sélectionné"}
          </p>
          <p className="truncate text-xs font-semibold text-green-100">
            {selectedAnimals.slice(0, 8).map((animal) => animal.nutrav).join(" · ")}
            {selectedAnimals.length > 8 ? ` · +${selectedAnimals.length - 8}` : ""}
            {hiddenSelectedCount > 0 ? ` · ${hiddenSelectedCount} hors de cette vue` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {MAIN_ACTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              disabled={!compatibleCounts[id]}
              onClick={() => onAction(id)}
              className="flex min-h-10 items-center gap-1.5 rounded-lg bg-white px-2.5 text-xs font-black text-green-950 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Icon size={15} />{label}
            </button>
          ))}
          <button type="button" onClick={onClear} className="flex size-10 items-center justify-center rounded-lg text-green-100 hover:bg-white/10 hover:text-white" aria-label="Vider la sélection">
            <X size={18} />
          </button>
        </div>
      </div>

      {relatedMothers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-green-700 bg-green-950/50 px-3 py-2 text-xs">
          <strong className="mr-auto">
            {relatedMothers.length} mère{relatedMothers.length > 1 ? "s" : ""} liée{relatedMothers.length > 1 ? "s" : ""}
            {relatedEchoMothers.length > 0 ? ` · ${relatedEchoMothers.length} à échographier` : ""}
          </strong>
          <button type="button" onClick={onShowMothers} className="min-h-8 rounded-lg bg-white/10 px-2.5 font-black hover:bg-white/20">
            Voir les mères triées
          </button>
          {relatedEchoMothers.length > 0 && (
            <button type="button" onClick={onSelectEchoMothers} className="min-h-8 rounded-lg bg-amber-300 px-2.5 font-black text-amber-950 hover:bg-amber-200">
              Sélectionner les {relatedEchoMothers.length} à échographier
            </button>
          )}
        </div>
      )}
    </section>
  );
}
