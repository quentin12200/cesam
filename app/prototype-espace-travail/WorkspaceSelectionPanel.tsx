import {
  Baby,
  Check,
  ChevronRight,
  HeartPulse,
  ScanLine,
  Stethoscope,
  X,
} from "lucide-react";
import type { WorkspaceAction, WorkspaceAnimal } from "./types";

type WorkspaceSelectionPanelProps = {
  selectedAnimals: WorkspaceAnimal[];
  hiddenSelectedCount: number;
  treatmentCompatibleCount: number;
  weaningCompatibleCount: number;
  echoCompatibleCount: number;
  relatedMothers: WorkspaceAnimal[];
  relatedEchoMothers: WorkspaceAnimal[];
  onRemove: (animalId: string) => void;
  onClear: () => void;
  onAction: (action: WorkspaceAction) => void;
  onSelectRelatedMothers: (onlyEchoDue: boolean) => void;
};

export default function WorkspaceSelectionPanel({
  selectedAnimals,
  hiddenSelectedCount,
  treatmentCompatibleCount,
  weaningCompatibleCount,
  echoCompatibleCount,
  relatedMothers,
  relatedEchoMothers,
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
            <p className="text-xs font-black uppercase tracking-wide text-green-800">
              Sélection active
            </p>
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
            <button
              type="button"
              onClick={onClear}
              className="min-h-9 rounded-lg px-2 text-xs font-black text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
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
                  {animal.nutrav}
                  <X size={13} />
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

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="px-1 pb-2 text-sm font-black text-slate-950">Actions</h2>
        <div className="space-y-2">
          <ActionButton
            icon={Stethoscope}
            title="Traitement"
            detail={
              count
                ? `${treatmentCompatibleCount} compatible${treatmentCompatibleCount > 1 ? "s" : ""} sur ${count}`
                : "Sélection requise"
            }
            tone="rose"
            disabled={!treatmentCompatibleCount}
            onClick={() => onAction("treatment")}
          />
          <ActionButton
            icon={Baby}
            title="Sevrage"
            detail={
              count
                ? `${weaningCompatibleCount} compatible${weaningCompatibleCount > 1 ? "s" : ""} sur ${count}`
                : "Sélection requise"
            }
            tone="blue"
            disabled={!weaningCompatibleCount}
            onClick={() => onAction("weaning")}
          />
          <ActionButton
            icon={ScanLine}
            title="Échographie"
            detail={
              count
                ? `${echoCompatibleCount} compatible${echoCompatibleCount > 1 ? "s" : ""} sur ${count}`
                : "Sélection requise"
            }
            tone="amber"
            disabled={!echoCompatibleCount}
            onClick={() => onAction("echo")}
          />
        </div>
      </section>

      {relatedMothers.length > 0 && (
        <section className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 shadow-sm">
          <div className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-950">
              <HeartPulse size={21} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-wide text-amber-800">
                À ne pas oublier
              </p>
              <h2 className="mt-0.5 font-black text-amber-950">
                {relatedMothers.length} mère{relatedMothers.length > 1 ? "s" : ""} liée{relatedMothers.length > 1 ? "s" : ""}
              </h2>
              <p className="mt-1 text-sm font-semibold text-amber-900">
                {relatedEchoMothers.length} ont une échographie à faire.
              </p>
            </div>
          </div>
          {relatedEchoMothers.length > 0 && (
            <button
              type="button"
              onClick={() => onSelectRelatedMothers(true)}
              className="mt-3 flex min-h-11 w-full items-center justify-between rounded-lg bg-amber-950 px-3 text-sm font-black text-white hover:bg-amber-900"
            >
              Sélectionner les {relatedEchoMothers.length} à échographier
              <ChevronRight size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onSelectRelatedMothers(false)}
            className="mt-1.5 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg px-3 text-xs font-black text-amber-950 hover:bg-amber-100"
          >
            Voir les {relatedMothers.length} mères
          </button>
        </section>
      )}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  title,
  detail,
  tone,
  disabled,
  onClick,
}: {
  icon: typeof Check;
  title: string;
  detail: string;
  tone: "rose" | "blue" | "amber";
  disabled: boolean;
  onClick: () => void;
}) {
  const tones = {
    rose: "bg-rose-50 text-rose-950 ring-rose-200",
    blue: "bg-blue-50 text-blue-950 ring-blue-200",
    amber: "bg-amber-50 text-amber-950 ring-amber-200",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-14 w-full items-center gap-3 rounded-lg px-3 text-left ring-1 ring-inset transition ${tones[tone]} disabled:cursor-not-allowed disabled:opacity-45`}
    >
      <Icon size={22} strokeWidth={2.2} />
      <span className="min-w-0 flex-1">
        <strong className="block text-sm font-black">{title}</strong>
        <span className="block text-xs font-semibold opacity-70">{detail}</span>
      </span>
      <ChevronRight size={18} />
    </button>
  );
}
