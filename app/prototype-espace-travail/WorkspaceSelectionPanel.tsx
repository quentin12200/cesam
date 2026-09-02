import {
  ArrowRightLeft,
  Baby,
  ChevronRight,
  HeartPulse,
  History,
  Scale,
  ScanLine,
  Stethoscope,
  Syringe,
  Truck,
  X,
} from "lucide-react";
import type {
  WorkspaceAction,
  WorkspaceActivity,
  WorkspaceAnimal,
} from "./types";

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
  onSelectRelatedMothers: (onlyEchoDue: boolean, replace: boolean) => void;
};

const ACTION_GROUPS: Array<{
  title: string;
  actions: Array<{
    id: WorkspaceAction;
    label: string;
    icon: typeof Baby;
    tone: string;
  }>;
}> = [
  {
    title: "Sanitaire",
    actions: [
      { id: "treatment", label: "Traitement", icon: Stethoscope, tone: "bg-rose-50 text-rose-950 ring-rose-200" },
      { id: "vaccination", label: "Vaccination", icon: Syringe, tone: "bg-fuchsia-50 text-fuchsia-950 ring-fuchsia-200" },
    ],
  },
  {
    title: "Reproduction",
    actions: [
      { id: "echo", label: "Échographie", icon: ScanLine, tone: "bg-amber-50 text-amber-950 ring-amber-200" },
    ],
  },
  {
    title: "Troupeau",
    actions: [
      { id: "weaning", label: "Sevrage", icon: Baby, tone: "bg-blue-50 text-blue-950 ring-blue-200" },
      { id: "move", label: "Changer de lot", icon: ArrowRightLeft, tone: "bg-cyan-50 text-cyan-950 ring-cyan-200" },
    ],
  },
  {
    title: "Mesures et sortie",
    actions: [
      { id: "weight", label: "Pesée", icon: Scale, tone: "bg-slate-100 text-slate-950 ring-slate-200" },
      { id: "sale", label: "Sortie / vente", icon: Truck, tone: "bg-violet-50 text-violet-950 ring-violet-200" },
    ],
  },
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
  onSelectRelatedMothers,
}: WorkspaceSelectionPanelProps) {
  const count = selectedAnimals.length;

  return (
    <div className="space-y-3">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-green-800">Sélection active</p>
            <h2 className="mt-0.5 text-xl font-black text-slate-950">
              {count} animal{count > 1 ? "aux" : ""}
            </h2>
            {hiddenSelectedCount > 0 && (
              <p className="mt-1 text-xs font-bold text-amber-800">
                dont {hiddenSelectedCount} hors de la vue actuelle
              </p>
            )}
          </div>
          {count > 0 && (
            <button type="button" onClick={onClear} className="min-h-9 rounded-lg px-2 text-xs font-black text-slate-500 hover:bg-slate-100 hover:text-slate-900">
              Vider
            </button>
          )}
        </div>

        {count ? (
          <div className="max-h-32 overflow-y-auto px-3 py-2">
            <div className="flex flex-wrap gap-1.5">
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
          </div>
        ) : (
          <div className="px-4 py-5 text-sm text-slate-500">
            Sélectionnez les animaux une seule fois, puis enchaînez vos actions.
          </div>
        )}
      </section>

      {relatedMothers.length > 0 && (
        <section className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3 shadow-sm">
          <div className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-950">
              <HeartPulse size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-wide text-amber-800">Mères des veaux sélectionnés</p>
              <p className="mt-0.5 text-sm font-black text-amber-950">
                {relatedMothers.length} retrouvée{relatedMothers.length > 1 ? "s" : ""}
                {relatedEchoMothers.length > 0 && ` · ${relatedEchoMothers.length} écho à faire`}
              </p>
              <p className="mt-1 text-xs font-semibold text-amber-900">
                {relatedMothers.map((mother) => mother.nutrav).join(" · ")}
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-1.5">
            <button
              type="button"
              onClick={() => onSelectRelatedMothers(false, false)}
              className="flex min-h-10 w-full items-center justify-between rounded-lg bg-white px-3 text-xs font-black text-amber-950 ring-1 ring-inset ring-amber-300 hover:bg-amber-100"
            >
              Ajouter les {relatedMothers.length} mères<ChevronRight size={16} />
            </button>
            {relatedEchoMothers.length > 0 && (
              <button
                type="button"
                onClick={() => onSelectRelatedMothers(true, true)}
                className="flex min-h-10 w-full items-center justify-between rounded-lg bg-amber-950 px-3 text-xs font-black text-white hover:bg-amber-900"
              >
                Garder les {relatedEchoMothers.length} à échographier<ChevronRight size={16} />
              </button>
            )}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="px-1 pb-2 text-sm font-black text-slate-950">Actions</h2>
        <div className="space-y-3">
          {ACTION_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="mb-1.5 px-1 text-[10px] font-black uppercase tracking-wide text-slate-500">{group.title}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {group.actions.map((action) => {
                  const Icon = action.icon;
                  const compatibleCount = compatibleCounts[action.id];
                  return (
                    <button
                      type="button"
                      key={action.id}
                      disabled={!compatibleCount}
                      onClick={() => onAction(action.id)}
                      className={`flex min-h-16 flex-col items-start justify-between rounded-lg p-2.5 text-left ring-1 ring-inset transition ${action.tone} disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      <Icon size={18} strokeWidth={2.3} />
                      <span>
                        <strong className="block text-xs font-black leading-tight">{action.label}</strong>
                        <span className="text-[10px] font-bold opacity-70">
                          {count ? `${compatibleCount} sur ${count}` : "Sélection requise"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {activity.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <h2 className="flex items-center gap-2 px-1 pb-2 text-sm font-black text-slate-950"><History size={16} /> Travail récent</h2>
          <ol className="space-y-2">
            {activity.slice(0, 4).map((item) => (
              <li key={item.id} className="rounded-lg bg-slate-50 px-2.5 py-2 text-xs">
                <strong className="block text-slate-900">{item.label}</strong>
                <span className="font-semibold text-slate-500">
                  {item.time} · {item.animalIds.length} animal{item.animalIds.length > 1 ? "aux" : ""}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
