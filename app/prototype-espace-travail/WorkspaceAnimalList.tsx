import {
  AlertTriangle,
  Baby,
  Check,
  ChevronRight,
  HeartPulse,
  MapPin,
} from "lucide-react";
import type { WorkspaceAnimal } from "./types";
import { formatAge, KIND_LABELS } from "./workspace-utils";

type WorkspaceAnimalListProps = {
  animals: WorkspaceAnimal[];
  selectedIds: Set<string>;
  treatedIds: Set<string>;
  weanedIds: Set<string>;
  echoedIds: Set<string>;
  onToggle: (animalId: string) => void;
  onSelectAllVisible: () => void;
};

export default function WorkspaceAnimalList({
  animals,
  selectedIds,
  treatedIds,
  weanedIds,
  echoedIds,
  onToggle,
  onSelectAllVisible,
}: WorkspaceAnimalListProps) {
  const visibleSelected = animals.filter((animal) =>
    selectedIds.has(animal.id),
  ).length;
  const allVisibleSelected =
    animals.length > 0 && visibleSelected === animals.length;

  if (!animals.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center">
        <p className="font-black text-slate-800">Aucun animal dans cette vue</p>
        <p className="mt-1 text-sm text-slate-500">
          Modifiez la recherche ou choisissez une autre vue.
        </p>
      </div>
    );
  }

  return (
    <section
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      aria-label="Liste des animaux"
    >
      <div className="flex min-h-12 items-center justify-between border-b border-slate-200 bg-slate-50 px-3 sm:px-4">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
          {animals.length} animal{animals.length > 1 ? "aux" : ""}
        </span>
        <button
          type="button"
          onClick={onSelectAllVisible}
          className="min-h-10 rounded-lg px-3 text-sm font-black text-green-800 hover:bg-green-50"
        >
          {allVisibleSelected ? "Désélectionner la vue" : "Tout sélectionner"}
        </button>
      </div>

      <div className="divide-y divide-slate-100">
        {animals.map((animal) => {
          const selected = selectedIds.has(animal.id);
          const treated = treatedIds.has(animal.id);
          const weaned = weanedIds.has(animal.id);
          const echoed = echoedIds.has(animal.id);

          return (
            <button
              key={animal.id}
              type="button"
              onClick={() => onToggle(animal.id)}
              aria-pressed={selected}
              className={`group grid min-h-[78px] w-full grid-cols-[32px_minmax(0,1fr)_22px] items-center gap-2 px-3 py-2.5 text-left transition sm:grid-cols-[36px_minmax(150px,0.8fr)_minmax(190px,1.2fr)_24px] sm:gap-3 sm:px-4 ${
                selected
                  ? "bg-green-50/80 shadow-[inset_4px_0_0_#15803d]"
                  : "hover:bg-slate-50"
              }`}
            >
              <span
                className={`flex size-6 items-center justify-center rounded-md border-2 ${
                  selected
                    ? "border-green-700 bg-green-700 text-white"
                    : "border-slate-300 bg-white"
                }`}
                aria-hidden="true"
              >
                {selected && <Check size={16} strokeWidth={3} />}
              </span>

              <span className="min-w-0">
                <span className="flex min-w-0 items-baseline gap-2">
                  <strong className="text-base font-black text-slate-950">
                    {animal.nutrav}
                  </strong>
                  {animal.name && (
                    <span className="truncate text-sm font-bold text-slate-600">
                      {animal.name}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-slate-500">
                  <span>{KIND_LABELS[animal.kind]}</span>
                  <span>·</span>
                  <span>{formatAge(animal.birthDate)}</span>
                  {animal.groupName && (
                    <span className="inline-flex min-w-0 items-center gap-1 sm:hidden">
                      <MapPin size={12} />
                      <span className="truncate">{animal.groupName}</span>
                    </span>
                  )}
                </span>

                <AnimalSignals animal={animal} treated={treated} weaned={weaned} echoed={echoed} mobile />
              </span>

              <span className="hidden min-w-0 sm:block">
                {animal.groupName && (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                    <MapPin size={13} />
                    <span className="truncate">{animal.groupName}</span>
                  </span>
                )}
                <AnimalSignals animal={animal} treated={treated} weaned={weaned} echoed={echoed} />
              </span>

              <ChevronRight
                size={18}
                className={selected ? "text-green-700" : "text-slate-300"}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AnimalSignals({
  animal,
  treated,
  weaned,
  echoed,
  mobile = false,
}: {
  animal: WorkspaceAnimal;
  treated: boolean;
  weaned: boolean;
  echoed: boolean;
  mobile?: boolean;
}) {
  return (
    <span
      className={`mt-1.5 flex flex-wrap gap-1.5 ${mobile ? "sm:hidden" : ""}`}
    >
      {animal.echoDue && !echoed && (
        <Signal tone="amber" icon={HeartPulse} label="Écho à faire" />
      )}
      {animal.weaningDue && !weaned && (
        <Signal tone="blue" icon={Baby} label="À sevrer" />
      )}
      {animal.saleBlocked && (
        <Signal tone="red" icon={AlertTriangle} label="Ne pas sortir" />
      )}
      {treated && <Signal tone="green" icon={Check} label="Traité aujourd’hui" />}
      {weaned && <Signal tone="green" icon={Check} label="Sevré aujourd’hui" />}
      {echoed && <Signal tone="green" icon={Check} label="Écho enregistrée" />}
      {animal.motherNutrav && (
        <Signal tone="neutral" icon={HeartPulse} label={`Mère ${animal.motherNutrav}`} />
      )}
      {animal.calfNutrav && (
        <Signal tone="neutral" icon={Baby} label={`Veau ${animal.calfNutrav}`} />
      )}
    </span>
  );
}

function Signal({
  tone,
  icon: Icon,
  label,
}: {
  tone: "amber" | "blue" | "red" | "green" | "neutral";
  icon: typeof Check;
  label: string;
}) {
  const tones = {
    amber: "bg-amber-100 text-amber-950 ring-amber-300",
    blue: "bg-blue-100 text-blue-950 ring-blue-300",
    red: "bg-red-100 text-red-950 ring-red-300",
    green: "bg-green-100 text-green-950 ring-green-300",
    neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black ring-1 ring-inset ${tones[tone]}`}
    >
      <Icon size={11} strokeWidth={2.5} />
      {label}
    </span>
  );
}
