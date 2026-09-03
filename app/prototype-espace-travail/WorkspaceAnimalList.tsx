import {
  AlertTriangle,
  Baby,
  Check,
  Scale,
  ScanLine,
  Stethoscope,
  Syringe,
} from "lucide-react";
import type {
  ReproductionStatus,
  WorkspaceCompletedState,
  WorkspaceRow,
  WorkspaceSort,
  WorkspaceView,
} from "./types";
import {
  ACTION_LABELS,
  completedActionsForAnimal,
  formatAge,
  KIND_LABELS,
  REPRODUCTION_LABELS,
} from "./workspace-utils";

type WorkspaceAnimalListProps = {
  rows: WorkspaceRow[];
  view: WorkspaceView;
  selectedIds: Set<string>;
  completed: WorkspaceCompletedState;
  sort: WorkspaceSort;
  onToggle: (animalId: string) => void;
  onToggleVisible: () => void;
  onSort: (sort: WorkspaceSort) => void;
};

export default function WorkspaceAnimalList({
  rows,
  view,
  selectedIds,
  completed,
  sort,
  onToggle,
  onToggleVisible,
  onSort,
}: WorkspaceAnimalListProps) {
  const visibleSelected = rows.filter((row) => selectedIds.has(row.primary.id)).length;
  const allVisibleSelected = rows.length > 0 && visibleSelected === rows.length;
  const labels = getColumnLabels(view);

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center">
        <p className="font-black text-slate-800">Aucun animal dans cette vue</p>
        <p className="mt-1 text-sm text-slate-500">Modifiez les filtres ou choisissez une autre vue.</p>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Tableau de travail des animaux">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 sm:px-4">
        <div>
          <strong className="text-sm font-black text-slate-900">{rows.length} {rows.length > 1 ? "animaux" : "animal"}</strong>
          <span className="ml-2 text-xs font-bold text-slate-500">{visibleSelected} sélectionné{visibleSelected > 1 ? "s" : ""}</span>
        </div>
        <button
          type="button"
          onClick={onToggleVisible}
          aria-pressed={allVisibleSelected}
          className={`min-h-9 rounded-lg px-3 text-xs font-black ring-1 ring-inset ${
            allVisibleSelected
              ? "bg-slate-800 text-white ring-slate-800"
              : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-100"
          }`}
        >
          {allVisibleSelected ? `Retirer les ${rows.length} visibles` : `Sélectionner les ${rows.length} visibles`}
        </button>
      </div>

      <div className="hidden md:block">
        <table className="w-full table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[5%]" />
            <col className="w-[19%]" />
            <col className="w-[12%]" />
            <col className="w-[20%]" />
            <col className="w-[18%]" />
            <col className="w-[26%]" />
          </colgroup>
          <thead className="bg-white text-[11px] uppercase tracking-wide text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="px-2 py-3"><span className="sr-only">Sélection</span></th>
              <SortableHeader label={labels.primary} active={sort === "primary-number"} onClick={() => onSort("primary-number")} />
              <SortableHeader label="Âge" active={sort === "oldest" || sort === "youngest"} onClick={() => onSort(sort === "oldest" ? "youngest" : "oldest")} />
              <SortableHeader label={labels.related} active={sort === "related-number"} onClick={() => onSort("related-number")} />
              <th className="px-2 py-3">{labels.reproduction}</th>
              <th className="px-2 py-3">À savoir</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <DesktopRow key={row.id} row={row} selectedIds={selectedIds} completed={completed} onToggle={onToggle} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-100 md:hidden">
        {rows.map((row) => (
          <MobileRow key={row.id} row={row} selectedIds={selectedIds} completed={completed} onToggle={onToggle} />
        ))}
      </div>
    </section>
  );
}

function getColumnLabels(view: WorkspaceView) {
  if (view === "young-related" || view === "weaning") {
    return { primary: "Veau", related: "Mère", reproduction: "État de la mère" };
  }
  if (view === "cows" || view === "reproduction") {
    return { primary: "Vache", related: "Veau lié", reproduction: "Reproduction" };
  }
  return { primary: "Animal", related: "Animal lié", reproduction: "Reproduction" };
}

function SortableHeader({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <th className="px-2 py-2">
      <button
        type="button"
        onClick={onClick}
        className={`min-h-8 max-w-full rounded-lg px-1.5 text-left text-[11px] font-black uppercase tracking-wide ${active ? "bg-green-50 text-green-900" : "hover:bg-slate-50 hover:text-slate-900"}`}
      >
        {label} <span aria-hidden="true">↕</span>
      </button>
    </th>
  );
}

function DesktopRow({ row, selectedIds, completed, onToggle }: {
  row: WorkspaceRow;
  selectedIds: Set<string>;
  completed: WorkspaceCompletedState;
  onToggle: (animalId: string) => void;
}) {
  const primarySelected = selectedIds.has(row.primary.id);
  const relatedSelected = row.related ? selectedIds.has(row.related.id) : false;
  const reproductionAnimal = row.primary.reproductionStatus !== "NOT_APPLICABLE" ? row.primary : row.related;

  return (
    <tr className={primarySelected ? "bg-green-50/70" : "hover:bg-slate-50/70"}>
      <td className="px-2 py-3 align-top">
        <SelectionBox selected={primarySelected} label={`Sélectionner ${row.primary.nutrav}`} onClick={() => onToggle(row.primary.id)} />
      </td>
      <td className="px-2 py-3 align-top"><AnimalIdentity animal={row.primary} /></td>
      <td className="px-2 py-3 align-top text-sm font-bold text-slate-700">{formatAge(row.primary.birthDate)}</td>
      <td className="px-2 py-3 align-top">
        {row.related ? (
          <div className={`flex min-w-0 items-start gap-2 rounded-xl p-2 ${relatedSelected ? "bg-emerald-100" : "bg-slate-50"}`}>
            <SelectionBox selected={relatedSelected} label={`Sélectionner l’animal lié ${row.related.nutrav}`} onClick={() => onToggle(row.related!.id)} compact />
            <AnimalIdentity animal={row.related} compact />
          </div>
        ) : <span className="text-sm text-slate-400">—</span>}
      </td>
      <td className="px-2 py-3 align-top">
        {reproductionAnimal ? <ReproductionBadge animal={reproductionAnimal} /> : <span className="text-slate-400">—</span>}
      </td>
      <td className="px-2 py-3 align-top"><RowSignals row={row} completed={completed} /></td>
    </tr>
  );
}

function MobileRow({ row, selectedIds, completed, onToggle }: {
  row: WorkspaceRow;
  selectedIds: Set<string>;
  completed: WorkspaceCompletedState;
  onToggle: (animalId: string) => void;
}) {
  const primarySelected = selectedIds.has(row.primary.id);
  const relatedSelected = row.related ? selectedIds.has(row.related.id) : false;
  const reproductionAnimal = row.primary.reproductionStatus !== "NOT_APPLICABLE" ? row.primary : row.related;

  return (
    <article className={`p-3 ${primarySelected ? "bg-green-50/80 shadow-[inset_4px_0_0_#15803d]" : ""}`}>
      <div className="flex items-start gap-2.5">
        <SelectionBox selected={primarySelected} label={`Sélectionner ${row.primary.nutrav}`} onClick={() => onToggle(row.primary.id)} />
        <div className="min-w-0 flex-1">
          <AnimalIdentity animal={row.primary} />
          <p className="mt-0.5 text-xs font-semibold text-slate-500">{formatAge(row.primary.birthDate)}{row.primary.groupName ? ` · ${row.primary.groupName}` : ""}</p>
        </div>
      </div>
      {row.related && (
        <div className={`ml-8 mt-2 flex items-start gap-2 rounded-xl border p-2.5 ${relatedSelected ? "border-emerald-300 bg-emerald-100" : "border-slate-200 bg-slate-50"}`}>
          <SelectionBox selected={relatedSelected} label={`Sélectionner l’animal lié ${row.related.nutrav}`} onClick={() => onToggle(row.related!.id)} compact />
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">{row.primary.motherId ? "Mère associée" : "Veau associé"}</span>
            <AnimalIdentity animal={row.related} compact />
          </div>
          {reproductionAnimal?.id === row.related.id && <ReproductionBadge animal={reproductionAnimal} compact />}
        </div>
      )}
      {reproductionAnimal?.id === row.primary.id && <div className="ml-8 mt-2"><ReproductionBadge animal={reproductionAnimal} /></div>}
      <div className="ml-8 mt-2"><RowSignals row={row} completed={completed} /></div>
    </article>
  );
}

function SelectionBox({ selected, label, onClick, compact = false }: { selected: boolean; label: string; onClick: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      className={`flex shrink-0 items-center justify-center rounded-md border-2 ${compact ? "size-6" : "size-7"} ${selected ? "border-green-700 bg-green-700 text-white" : "border-slate-300 bg-white"}`}
    >
      {selected && <Check size={compact ? 14 : 17} strokeWidth={3} />}
    </button>
  );
}

function AnimalIdentity({ animal, compact = false }: { animal: WorkspaceRow["primary"]; compact?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-baseline gap-1.5">
        <strong className={`${compact ? "text-sm" : "text-base"} font-black text-slate-950`}>{animal.nutrav}</strong>
        {animal.name && <span className="truncate text-xs font-bold text-slate-600">{animal.name}</span>}
      </div>
      <span className="block truncate text-[11px] font-bold text-slate-500">{KIND_LABELS[animal.kind]}{animal.groupName ? ` · ${animal.groupName}` : ""}</span>
    </div>
  );
}

function ReproductionBadge({ animal, compact = false }: { animal: WorkspaceRow["primary"]; compact?: boolean }) {
  const tones: Record<ReproductionStatus, string> = {
    PREGNANT: "bg-green-100 text-green-950 ring-green-300",
    EMPTY: "bg-red-100 text-red-950 ring-red-300",
    TO_CHECK: "bg-amber-100 text-amber-950 ring-amber-300",
    NOT_APPLICABLE: "bg-slate-100 text-slate-600 ring-slate-200",
  };
  const detail = animal.pregnantMonths ? ` · ${animal.pregnantMonths} mois` : "";
  return (
    <span className={`inline-flex max-w-full rounded-full px-2 py-1 font-black ring-1 ring-inset ${compact ? "text-[10px]" : "text-xs"} ${tones[animal.reproductionStatus]}`}>
      <span className="truncate">{REPRODUCTION_LABELS[animal.reproductionStatus]}{detail}</span>
    </span>
  );
}

function RowSignals({ row, completed }: { row: WorkspaceRow; completed: WorkspaceCompletedState }) {
  const mother = row.primary.motherId ? row.related : null;
  const signals: Array<{ label: string; tone: SignalTone; icon: typeof Baby }> = [];

  if (mother?.reproductionStatus === "EMPTY" && row.primary.weaningDue) {
    signals.push({ label: "Mère vide · sevrage à arbitrer", tone: "red", icon: AlertTriangle });
  } else if (mother?.echoDue) {
    signals.push({ label: "Mère à échographier", tone: "amber", icon: ScanLine });
  } else if (row.primary.weaningDue) {
    signals.push({ label: "À sevrer", tone: "blue", icon: Baby });
  }
  if (row.primary.treatmentDue) signals.push({ label: "Traitement prévu", tone: "rose", icon: Stethoscope });
  if (row.primary.vaccinationDue) signals.push({ label: "Vaccin prévu", tone: "amber", icon: Syringe });
  if (row.primary.weightDue) signals.push({ label: "Poids à relever", tone: "slate", icon: Scale });
  if (row.primary.echoDue) signals.push({ label: "Écho à faire", tone: "amber", icon: ScanLine });

  for (const action of completedActionsForAnimal(row.primary.id, completed)) {
    signals.unshift({ label: `${ACTION_LABELS[action]} fait`, tone: "green", icon: Check });
  }

  if (!signals.length) return <span className="text-xs font-semibold text-slate-400">Rien à signaler</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {signals.slice(0, 2).map(({ label, tone, icon }) => <Signal key={label} tone={tone} icon={icon} label={label} />)}
    </div>
  );
}

type SignalTone = "red" | "amber" | "blue" | "rose" | "green" | "slate";

function Signal({ tone, icon: Icon, label }: { tone: SignalTone; icon: typeof Baby; label: string }) {
  const tones: Record<SignalTone, string> = {
    red: "bg-red-100 text-red-950 ring-red-300",
    amber: "bg-amber-100 text-amber-950 ring-amber-300",
    blue: "bg-blue-100 text-blue-950 ring-blue-300",
    rose: "bg-rose-100 text-rose-950 ring-rose-300",
    green: "bg-green-100 text-green-950 ring-green-300",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
  };
  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ring-inset ${tones[tone]}`}>
      <Icon className="shrink-0" size={11} strokeWidth={2.5} />
      <span className="truncate">{label}</span>
    </span>
  );
}
