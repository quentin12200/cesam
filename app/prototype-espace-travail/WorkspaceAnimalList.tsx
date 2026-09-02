import {
  AlertTriangle,
  Baby,
  Check,
  HeartPulse,
  Scale,
  ScanLine,
  Stethoscope,
  Syringe,
} from "lucide-react";
import type {
  ReproductionStatus,
  WorkspaceAction,
  WorkspaceColumn,
  WorkspaceCompletedState,
  WorkspaceRow,
  WorkspaceSort,
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
  selectedIds: Set<string>;
  completed: WorkspaceCompletedState;
  visibleColumns: WorkspaceColumn[];
  sort: WorkspaceSort;
  onToggle: (animalId: string) => void;
  onAddVisible: () => void;
  onReplaceWithVisible: () => void;
  onSort: (sort: WorkspaceSort) => void;
};

export default function WorkspaceAnimalList({
  rows,
  selectedIds,
  completed,
  visibleColumns,
  sort,
  onToggle,
  onAddVisible,
  onReplaceWithVisible,
  onSort,
}: WorkspaceAnimalListProps) {
  const columns = new Set(visibleColumns);
  const visiblePrimaryIds = rows.map((row) => row.primary.id);
  const visibleSelected = visiblePrimaryIds.filter((id) => selectedIds.has(id)).length;

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center">
        <p className="font-black text-slate-800">Aucun animal dans cette vue</p>
        <p className="mt-1 text-sm text-slate-500">
          Modifiez les filtres ou choisissez une autre vue de travail.
        </p>
      </div>
    );
  }

  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      aria-label="Tableau de travail des animaux"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 sm:px-4">
        <div>
          <strong className="text-sm font-black text-slate-900">
            {rows.length} ligne{rows.length > 1 ? "s" : ""} de travail
          </strong>
          <span className="ml-2 text-xs font-bold text-slate-500">
            {visibleSelected} sélectionnée{visibleSelected > 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onAddVisible}
            className="min-h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-black text-slate-700 hover:bg-slate-100"
          >
            Ajouter la vue
          </button>
          <button
            type="button"
            onClick={onReplaceWithVisible}
            className="min-h-9 rounded-lg bg-green-800 px-2.5 text-xs font-black text-white hover:bg-green-900"
          >
            Garder la vue
          </button>
        </div>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead className="bg-white text-[11px] uppercase tracking-wide text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="w-12 px-3 py-3"><span className="sr-only">Sélection</span></th>
              <SortableHeader
                label="Animal"
                active={sort === "primary-number"}
                onClick={() => onSort("primary-number")}
              />
              {columns.has("age") && (
                <SortableHeader
                  label="Âge"
                  active={sort === "oldest" || sort === "youngest"}
                  onClick={() => onSort(sort === "oldest" ? "youngest" : "oldest")}
                />
              )}
              {columns.has("group") && <th className="px-3 py-3">Lot</th>}
              {columns.has("related") && (
                <SortableHeader
                  label="Animal lié"
                  active={sort === "related-number"}
                  onClick={() => onSort("related-number")}
                />
              )}
              {columns.has("reproduction") && <th className="px-3 py-3">Reproduction</th>}
              {columns.has("alerts") && <th className="min-w-52 px-3 py-3">À voir maintenant</th>}
              {columns.has("work") && <th className="min-w-40 px-3 py-3">Fait dans la séance</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <DesktopRow
                key={row.id}
                row={row}
                selectedIds={selectedIds}
                completed={completed}
                columns={columns}
                onToggle={onToggle}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-100 md:hidden">
        {rows.map((row) => (
          <MobileRow
            key={row.id}
            row={row}
            selectedIds={selectedIds}
            completed={completed}
            onToggle={onToggle}
          />
        ))}
      </div>
    </section>
  );
}

function SortableHeader({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <th className="px-3 py-2">
      <button
        type="button"
        onClick={onClick}
        className={`min-h-8 rounded-lg px-1.5 text-[11px] font-black uppercase tracking-wide ${
          active ? "bg-green-50 text-green-900" : "hover:bg-slate-50 hover:text-slate-900"
        }`}
      >
        {label} ↕
      </button>
    </th>
  );
}

function DesktopRow({
  row,
  selectedIds,
  completed,
  columns,
  onToggle,
}: {
  row: WorkspaceRow;
  selectedIds: Set<string>;
  completed: WorkspaceCompletedState;
  columns: Set<WorkspaceColumn>;
  onToggle: (animalId: string) => void;
}) {
  const primarySelected = selectedIds.has(row.primary.id);
  const relatedSelected = row.related ? selectedIds.has(row.related.id) : false;
  const reproductionAnimal =
    row.primary.reproductionStatus !== "NOT_APPLICABLE" ? row.primary : row.related;

  return (
    <tr className={primarySelected ? "bg-green-50/70" : "hover:bg-slate-50/70"}>
      <td className="px-3 py-3 align-top">
        <SelectionBox
          selected={primarySelected}
          label={`Sélectionner ${row.primary.nutrav}`}
          onClick={() => onToggle(row.primary.id)}
        />
      </td>
      <td className="px-3 py-3 align-top">
        <AnimalIdentity animal={row.primary} />
      </td>
      {columns.has("age") && (
        <td className="whitespace-nowrap px-3 py-3 align-top text-sm font-bold text-slate-700">
          {formatAge(row.primary.birthDate)}
        </td>
      )}
      {columns.has("group") && (
        <td className="px-3 py-3 align-top text-xs font-bold text-slate-600">
          {row.primary.groupName ?? "—"}
        </td>
      )}
      {columns.has("related") && (
        <td className="px-3 py-3 align-top">
          {row.related ? (
            <div className={`flex items-start gap-2 rounded-xl p-2 ${relatedSelected ? "bg-emerald-100" : "bg-slate-50"}`}>
              <SelectionBox
                selected={relatedSelected}
                label={`Sélectionner l’animal lié ${row.related.nutrav}`}
                onClick={() => onToggle(row.related!.id)}
                compact
              />
              <div className="min-w-0">
                <span className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                  {row.primary.motherId ? "Mère" : "Veau lié"}
                </span>
                <AnimalIdentity animal={row.related} compact />
              </div>
            </div>
          ) : (
            <span className="text-sm text-slate-400">—</span>
          )}
        </td>
      )}
      {columns.has("reproduction") && (
        <td className="px-3 py-3 align-top">
          {reproductionAnimal ? <ReproductionBadge animal={reproductionAnimal} /> : <span className="text-slate-400">—</span>}
        </td>
      )}
      {columns.has("alerts") && (
        <td className="px-3 py-3 align-top">
          <RowAlerts row={row} />
        </td>
      )}
      {columns.has("work") && (
        <td className="px-3 py-3 align-top">
          <CompletedBadges row={row} completed={completed} />
        </td>
      )}
    </tr>
  );
}

function MobileRow({
  row,
  selectedIds,
  completed,
  onToggle,
}: {
  row: WorkspaceRow;
  selectedIds: Set<string>;
  completed: WorkspaceCompletedState;
  onToggle: (animalId: string) => void;
}) {
  const primarySelected = selectedIds.has(row.primary.id);
  const relatedSelected = row.related ? selectedIds.has(row.related.id) : false;
  const reproductionAnimal =
    row.primary.reproductionStatus !== "NOT_APPLICABLE" ? row.primary : row.related;

  return (
    <article className={`p-3 ${primarySelected ? "bg-green-50/80 shadow-[inset_4px_0_0_#15803d]" : ""}`}>
      <div className="flex items-start gap-2.5">
        <SelectionBox
          selected={primarySelected}
          label={`Sélectionner ${row.primary.nutrav}`}
          onClick={() => onToggle(row.primary.id)}
        />
        <div className="min-w-0 flex-1">
          <AnimalIdentity animal={row.primary} />
          <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs font-semibold text-slate-500">
            <span>{formatAge(row.primary.birthDate)}</span>
            {row.primary.groupName && <span>· {row.primary.groupName}</span>}
            {row.primary.lastWeightKg && <span>· {row.primary.lastWeightKg} kg</span>}
          </div>
        </div>
      </div>

      {row.related && (
        <div className={`ml-8 mt-2 flex items-start gap-2 rounded-xl border p-2.5 ${
          relatedSelected ? "border-emerald-300 bg-emerald-100" : "border-slate-200 bg-slate-50"
        }`}>
          <SelectionBox
            selected={relatedSelected}
            label={`Sélectionner l’animal lié ${row.related.nutrav}`}
            onClick={() => onToggle(row.related!.id)}
            compact
          />
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">
              {row.primary.motherId ? "Mère associée" : "Veau associé"}
            </span>
            <AnimalIdentity animal={row.related} compact />
          </div>
          {reproductionAnimal && reproductionAnimal.id === row.related.id && (
            <ReproductionBadge animal={reproductionAnimal} compact />
          )}
        </div>
      )}

      {reproductionAnimal && reproductionAnimal.id === row.primary.id && (
        <div className="ml-8 mt-2"><ReproductionBadge animal={reproductionAnimal} /></div>
      )}
      <div className="ml-8 mt-2"><RowAlerts row={row} /></div>
      <div className="ml-8 mt-1.5"><CompletedBadges row={row} completed={completed} /></div>
    </article>
  );
}

function SelectionBox({
  selected,
  label,
  onClick,
  compact = false,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      className={`flex shrink-0 items-center justify-center rounded-md border-2 ${
        compact ? "size-6" : "size-7"
      } ${selected ? "border-green-700 bg-green-700 text-white" : "border-slate-300 bg-white"}`}
    >
      {selected && <Check size={compact ? 14 : 17} strokeWidth={3} />}
    </button>
  );
}

function AnimalIdentity({
  animal,
  compact = false,
}: {
  animal: WorkspaceRow["primary"];
  compact?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-baseline gap-1.5">
        <strong className={`${compact ? "text-sm" : "text-base"} font-black text-slate-950`}>
          {animal.nutrav}
        </strong>
        {animal.name && <span className="truncate text-xs font-bold text-slate-600">{animal.name}</span>}
      </div>
      <span className="block text-[11px] font-bold text-slate-500">
        {KIND_LABELS[animal.kind]} · {animal.sex}
      </span>
    </div>
  );
}

function ReproductionBadge({
  animal,
  compact = false,
}: {
  animal: WorkspaceRow["primary"];
  compact?: boolean;
}) {
  const tones: Record<ReproductionStatus, string> = {
    PREGNANT: "bg-green-100 text-green-950 ring-green-300",
    EMPTY: "bg-red-100 text-red-950 ring-red-300",
    TO_CHECK: "bg-amber-100 text-amber-950 ring-amber-300",
    NOT_APPLICABLE: "bg-slate-100 text-slate-600 ring-slate-200",
  };
  const detail = animal.pregnantMonths ? ` · ${animal.pregnantMonths} mois` : "";

  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 font-black ring-1 ring-inset ${
      compact ? "text-[10px]" : "text-xs"
    } ${tones[animal.reproductionStatus]}`}>
      {REPRODUCTION_LABELS[animal.reproductionStatus]}{detail}
    </span>
  );
}

function RowAlerts({ row }: { row: WorkspaceRow }) {
  const mother = row.primary.motherId ? row.related : null;
  const alerts: Array<{ label: string; tone: "red" | "amber" | "blue" | "rose" | "slate"; icon: typeof Baby }> = [];

  if (row.primary.weaningDue) alerts.push({ label: "À sevrer", tone: "blue", icon: Baby });
  if (row.primary.treatmentDue) alerts.push({ label: "Traitement prévu", tone: "rose", icon: Stethoscope });
  if (row.primary.vaccinationDue) alerts.push({ label: "Vaccin à faire", tone: "amber", icon: Syringe });
  if (row.primary.weightDue) alerts.push({ label: "Poids à relever", tone: "slate", icon: Scale });
  if (row.primary.echoDue || mother?.echoDue) alerts.push({ label: "Écho à faire", tone: "amber", icon: ScanLine });
  if (mother?.reproductionStatus === "EMPTY" && row.primary.weaningDue) {
    alerts.unshift({ label: "Mère vide · arbitrer le sevrage", tone: "red", icon: AlertTriangle });
  }
  if (row.primary.saleBlocked || row.related?.saleBlocked) {
    alerts.unshift({ label: "Ne pas sortir", tone: "red", icon: AlertTriangle });
  }

  if (!alerts.length) return <span className="text-xs font-semibold text-slate-400">Rien à signaler</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {alerts.slice(0, 3).map(({ label, tone, icon: Icon }) => (
        <Signal key={label} tone={tone} icon={Icon} label={label} />
      ))}
    </div>
  );
}

function CompletedBadges({
  row,
  completed,
}: {
  row: WorkspaceRow;
  completed: WorkspaceCompletedState;
}) {
  const primaryDone = completedActionsForAnimal(row.primary.id, completed);
  const relatedDone = row.related ? completedActionsForAnimal(row.related.id, completed) : [];
  if (!primaryDone.length && !relatedDone.length) {
    return <span className="text-xs font-semibold text-slate-400">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {primaryDone.map((action) => (
        <Signal key={`primary-${action}`} tone="green" icon={Check} label={ACTION_LABELS[action]} />
      ))}
      {relatedDone.map((action) => (
        <Signal
          key={`related-${action}`}
          tone="green"
          icon={HeartPulse}
          label={`${ACTION_LABELS[action]} ${row.related!.nutrav}`}
        />
      ))}
    </div>
  );
}

function Signal({
  tone,
  icon: Icon,
  label,
}: {
  tone: "red" | "amber" | "blue" | "rose" | "green" | "slate";
  icon: typeof Baby;
  label: string;
}) {
  const tones = {
    red: "bg-red-100 text-red-950 ring-red-300",
    amber: "bg-amber-100 text-amber-950 ring-amber-300",
    blue: "bg-blue-100 text-blue-950 ring-blue-300",
    rose: "bg-rose-100 text-rose-950 ring-rose-300",
    green: "bg-green-100 text-green-950 ring-green-300",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ring-inset ${tones[tone]}`}>
      <Icon size={11} strokeWidth={2.5} />
      {label}
    </span>
  );
}
