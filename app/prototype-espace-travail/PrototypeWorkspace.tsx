"use client";

import {
  Baby,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Filter,
  Home,
  LayoutList,
  Menu,
  ScanLine,
  Search,
  Sparkles,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  WorkspaceAction,
  WorkspaceActivity,
  WorkspaceAnimal,
  WorkspaceCompletedState,
  WorkspaceRow,
  WorkspaceSort,
  WorkspaceView,
} from "./types";
import WorkspaceActionModal from "./WorkspaceActionModal";
import WorkspaceAnimalList from "./WorkspaceAnimalList";
import WorkspaceBulkBar from "./WorkspaceBulkBar";
import WorkspaceSelectionPanel from "./WorkspaceSelectionPanel";
import {
  ACTION_LABELS,
  animalActionsDue,
  buildWorkspaceRows,
  compatibleAnimals,
  EMPTY_COMPLETED_STATE,
} from "./workspace-utils";

type PrototypeWorkspaceProps = {
  initialAnimals: WorkspaceAnimal[];
};

type TaskFilter = "all" | "treatment" | "vaccination" | "echo" | "weaning" | "weight";

type StoredWorkspace = {
  selectedIds: string[];
  completed: WorkspaceCompletedState;
  activity: WorkspaceActivity[];
  view: WorkspaceView;
  sort: WorkspaceSort;
  group: string;
  taskFilter: TaskFilter;
};

const WORKSPACE_KEY = "cesam:prototype-workspace:v3";
const ALL_ACTIONS: WorkspaceAction[] = [
  "treatment",
  "vaccination",
  "echo",
  "weaning",
  "move",
  "weight",
  "sale",
];
const VIEWS: Array<{ id: WorkspaceView; label: string; icon: typeof Users }> = [
  { id: "today", label: "Travail du jour", icon: ClipboardCheck },
  { id: "young-related", label: "Veaux + mères", icon: Baby },
  { id: "cows", label: "Vaches + veaux", icon: LayoutList },
  { id: "reproduction", label: "Reproduction", icon: ScanLine },
  { id: "weaning", label: "À sevrer", icon: Baby },
  { id: "all", label: "Tout le troupeau", icon: Users },
];

export default function PrototypeWorkspace({ initialAnimals }: PrototypeWorkspaceProps) {
  const [view, setView] = useState<WorkspaceView>("weaning");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<WorkspaceSort>("primary-number");
  const [group, setGroup] = useState("all");
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [completed, setCompleted] = useState<WorkspaceCompletedState>(EMPTY_COMPLETED_STATE);
  const [activity, setActivity] = useState<WorkspaceActivity[]>([]);
  const [activeAction, setActiveAction] = useState<WorkspaceAction | null>(null);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [mobileViewsOpen, setMobileViewsOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const validIds = useMemo(() => new Set(initialAnimals.map((animal) => animal.id)), [initialAnimals]);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(WORKSPACE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<StoredWorkspace>;
        if (Array.isArray(saved.selectedIds)) {
          setSelectedIds(new Set(saved.selectedIds.filter((id) => validIds.has(id))));
        }
        if (saved.completed) setCompleted(normalizeCompleted(saved.completed, validIds));
        if (Array.isArray(saved.activity)) setActivity(saved.activity.slice(0, 12));
        if (VIEWS.some((item) => item.id === saved.view)) setView(saved.view as WorkspaceView);
        if (isWorkspaceSort(saved.sort)) setSort(saved.sort);
        if (typeof saved.group === "string") setGroup(saved.group);
        if (isTaskFilter(saved.taskFilter)) setTaskFilter(saved.taskFilter);
      }
    } catch {
      window.localStorage.removeItem(WORKSPACE_KEY);
    } finally {
      setHydrated(true);
    }
  }, [validIds]);

  useEffect(() => {
    if (!hydrated) return;
    const snapshot: StoredWorkspace = {
      selectedIds: Array.from(selectedIds),
      completed,
      activity,
      view,
      sort,
      group,
      taskFilter,
    };
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(snapshot));
  }, [activity, completed, group, hydrated, selectedIds, sort, taskFilter, view]);

  const groups = useMemo(
    () => Array.from(new Set(initialAnimals.map((animal) => animal.groupName).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b, "fr")),
    [initialAnimals],
  );

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fr");
    const baseRows = buildWorkspaceRows(view, initialAnimals, completed);
    const filtered = baseRows.filter((row) => {
      const matchesGroup = group === "all" || row.primary.groupName === group || row.related?.groupName === group;
      const searchable = [row.primary.nutrav, row.primary.name, row.related?.nutrav, row.related?.name].filter(Boolean).join(" ").toLocaleLowerCase("fr");
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      const dueActions = [
        ...animalActionsDue(row.primary),
        ...(row.related ? animalActionsDue(row.related) : []),
      ];
      const matchesTask = taskFilter === "all" || dueActions.includes(taskFilter);
      return matchesGroup && matchesQuery && matchesTask;
    });

    return filtered.toSorted((a, b) => compareRows(a, b, sort));
  }, [completed, group, initialAnimals, query, sort, taskFilter, view]);

  const selectedAnimals = useMemo(
    () => initialAnimals.filter((animal) => selectedIds.has(animal.id)).toSorted((a, b) => a.nutrav.localeCompare(b.nutrav, "fr", { numeric: true })),
    [initialAnimals, selectedIds],
  );
  const visibleAnimalIds = useMemo(() => new Set(rows.flatMap((row) => row.related ? [row.primary.id, row.related.id] : [row.primary.id])), [rows]);
  const visibleSelectedCount = selectedAnimals.filter((animal) => visibleAnimalIds.has(animal.id)).length;
  const hiddenSelectedCount = selectedAnimals.length - visibleSelectedCount;

  const compatibleByAction = useMemo(() => {
    return Object.fromEntries(
      ALL_ACTIONS.map((action) => [
        action,
        compatibleAnimals(action, selectedAnimals, new Set(completed[action])),
      ]),
    ) as Record<WorkspaceAction, WorkspaceAnimal[]>;
  }, [completed, selectedAnimals]);
  const compatibleCounts = Object.fromEntries(
    ALL_ACTIONS.map((action) => [action, compatibleByAction[action].length]),
  ) as Record<WorkspaceAction, number>;

  const relatedMothers = useMemo(() => {
    const ids = new Set(selectedAnimals.map((animal) => animal.motherId).filter((id): id is string => Boolean(id)));
    return initialAnimals.filter((animal) => ids.has(animal.id)).toSorted((a, b) => a.nutrav.localeCompare(b.nutrav, "fr", { numeric: true }));
  }, [initialAnimals, selectedAnimals]);
  const relatedEchoMothers = relatedMothers.filter((mother) => mother.echoDue && !completed.echo.includes(mother.id));
  const actionCompatibleAnimals = activeAction ? compatibleByAction[activeAction] : [];

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 2800);
  }

  function toggleAnimal(animalId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(animalId)) next.delete(animalId);
      else next.add(animalId);
      return next;
    });
  }

  function toggleVisibleAnimals() {
    const visibleIds = rows.map((row) => row.primary.id);
    const allSelected = visibleIds.every((id) => selectedIds.has(id));
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of visibleIds) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
    showFeedback(allSelected ? `${rows.length} animaux retirés.` : `${rows.length} animaux sélectionnés.`);
  }

  function openAction(action: WorkspaceAction) {
    if (!compatibleByAction[action].length) {
      showFeedback(action === "echo" ? "Sélectionnez au moins une vache ou une génisse." : action === "weaning" ? "Sélectionnez au moins un veau." : "Sélectionnez d’abord les animaux.");
      return;
    }
    setMobilePanelOpen(false);
    setActiveAction(action);
  }

  function completeAction() {
    if (!activeAction || !actionCompatibleAnimals.length) return;
    const ids = actionCompatibleAnimals.map((animal) => animal.id);
    const label = `${ACTION_LABELS[activeAction]} · ${ids.length} animal${ids.length > 1 ? "aux" : ""}`;
    const item: WorkspaceActivity = {
      id: `${Date.now()}-${activeAction}`,
      action: activeAction,
      label,
      animalIds: ids,
      time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    };
    setCompleted((current) => ({ ...current, [activeAction]: Array.from(new Set([...current[activeAction], ...ids])) }));
    setActivity((current) => [item, ...current].slice(0, 12));
    setActiveAction(null);
    showFeedback(`${label}. La sélection est conservée.`);
  }

  function showRelatedMothers() {
    const motherIds = relatedMothers.map((mother) => mother.id);
    setSelectedIds((current) => new Set([...current, ...motherIds]));
    setView("cows");
    setSort("primary-number");
    setGroup("all");
    setTaskFilter("all");
    setQuery("");
    setMobilePanelOpen(false);
    showFeedback(`${relatedMothers.length} mère${relatedMothers.length > 1 ? "s" : ""} affichée${relatedMothers.length > 1 ? "s" : ""}, triée${relatedMothers.length > 1 ? "s" : ""} par numéro.`);
  }

  function selectEchoMothers() {
    setSelectedIds(new Set(relatedEchoMothers.map((mother) => mother.id)));
    setView("reproduction");
    setSort("primary-number");
    setGroup("all");
    setTaskFilter("all");
    setQuery("");
    setMobilePanelOpen(false);
    showFeedback(`${relatedEchoMothers.length} mère${relatedEchoMothers.length > 1 ? "s" : ""} à échographier sélectionnée${relatedEchoMothers.length > 1 ? "s" : ""}.`);
  }

  const selectionPanel = (
    <WorkspaceSelectionPanel
      selectedAnimals={selectedAnimals}
      hiddenSelectedCount={hiddenSelectedCount}
      compatibleCounts={compatibleCounts}
      relatedMothers={relatedMothers}
      relatedEchoMothers={relatedEchoMothers}
      activity={activity}
      onRemove={toggleAnimal}
      onClear={() => setSelectedIds(new Set())}
      onAction={openAction}
      onShowMothers={showRelatedMothers}
      onSelectEchoMothers={selectEchoMothers}
    />
  );

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#f2f4f1] text-slate-950">
      <WorkspaceHeader />

      <main className="mx-auto w-full max-w-[1800px] px-3 pb-28 pt-3 sm:px-5 sm:pt-5 lg:pb-8">
        <PrototypeNotice />

        <div className="mt-4 grid items-start gap-4 lg:grid-cols-[200px_minmax(0,1fr)_300px]">
          <aside className="hidden lg:block">
            <ViewNavigation animals={initialAnimals} completed={completed} activeView={view} onView={setView} />
          </aside>

          <section className="min-w-0" aria-labelledby="workspace-title">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-green-800">Espace de travail général</p>
                <h1 id="workspace-title" className="text-2xl font-black tracking-tight sm:text-3xl">Troupeau</h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-600">
                  Triez directement le tableau, sélectionnez les animaux, puis lancez l’action au même endroit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileViewsOpen((open) => !open)}
                className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black shadow-sm lg:hidden"
                aria-expanded={mobileViewsOpen}
              >
                <Filter size={17} /> Vues <ChevronDown size={16} className={mobileViewsOpen ? "rotate-180" : ""} />
              </button>
            </div>

            {mobileViewsOpen && (
              <div className="mb-3 lg:hidden">
                <ViewNavigation
                  animals={initialAnimals}
                  completed={completed}
                  activeView={view}
                  onView={(nextView) => {
                    setView(nextView);
                    setMobileViewsOpen(false);
                  }}
                />
              </div>
            )}

            <div className="mb-3 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
              <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_180px_180px]">
                <SearchInput query={query} onQuery={setQuery} />
                <SelectControl icon={Users} label="Lot" value={group} onChange={setGroup}>
                  <option value="all">Tous les lots</option>
                  {groups.map((groupName) => <option key={groupName} value={groupName}>{groupName}</option>)}
                </SelectControl>
                <SelectControl icon={Filter} label="Travail" value={taskFilter} onChange={(value) => setTaskFilter(value as TaskFilter)}>
                  <option value="all">Toutes les tâches</option>
                  <option value="weaning">À sevrer</option>
                  <option value="echo">Écho à faire</option>
                  <option value="treatment">Traitement</option>
                  <option value="vaccination">Vaccination</option>
                  <option value="weight">Pesée</option>
                </SelectControl>
              </div>
            </div>

            <WorkspaceBulkBar
              selectedAnimals={selectedAnimals}
              hiddenSelectedCount={hiddenSelectedCount}
              compatibleCounts={compatibleCounts}
              relatedMothers={relatedMothers}
              relatedEchoMothers={relatedEchoMothers}
              onClear={() => setSelectedIds(new Set())}
              onAction={openAction}
              onShowMothers={showRelatedMothers}
              onSelectEchoMothers={selectEchoMothers}
            />

            <WorkspaceAnimalList
              rows={rows}
              view={view}
              selectedIds={selectedIds}
              completed={completed}
              sort={sort}
              onToggle={toggleAnimal}
              onToggleVisible={toggleVisibleAnimals}
              onSort={setSort}
            />
          </section>

          <aside className="hidden lg:block" aria-label="Sélection et actions">{selectionPanel}</aside>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-[105] border-t border-slate-200 bg-white/95 p-2 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMobilePanelOpen(true)}
          className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-4 text-left ${selectedIds.size ? "bg-green-800 text-white" : "bg-slate-100 text-slate-700"}`}
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-white/15 font-black">{selectedIds.size}</span>
          <span className="min-w-0 flex-1">
            <strong className="block text-sm font-black">{selectedIds.size ? `${selectedIds.size} animal${selectedIds.size > 1 ? "aux" : ""} sélectionné${selectedIds.size > 1 ? "s" : ""}` : "Sélection et actions"}</strong>
            <span className="block truncate text-xs font-semibold opacity-75">
              {selectedAnimals.length ? selectedAnimals.map((animal) => animal.nutrav).join(" · ") : "Le groupe reste actif entre les actions"}
            </span>
          </span>
          <ChevronRight size={20} />
        </button>
      </div>

      {mobilePanelOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-950/45 lg:hidden">
          <button type="button" className="absolute inset-0" onClick={() => setMobilePanelOpen(false)} aria-label="Fermer le panneau d’actions" />
          <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-[#f2f4f1] p-3 pb-6 shadow-2xl">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="h-1 w-12 rounded-full bg-slate-300" aria-hidden="true" />
              <button type="button" onClick={() => setMobilePanelOpen(false)} className="flex size-10 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm" aria-label="Fermer"><X size={20} /></button>
            </div>
            {selectionPanel}
          </div>
        </div>
      )}

      {activeAction && (
        <WorkspaceActionModal
          action={activeAction}
          selectedCount={selectedAnimals.length}
          compatibleAnimals={actionCompatibleAnimals}
          onClose={() => setActiveAction(null)}
          onConfirm={completeAction}
        />
      )}

      {feedback && (
        <div role="status" className="fixed bottom-20 left-1/2 z-[140] w-max max-w-[calc(100%-24px)] -translate-x-1/2 rounded-xl bg-slate-950 px-4 py-3 text-center text-sm font-black text-white shadow-xl lg:bottom-5">
          {feedback}
        </div>
      )}
    </div>
  );
}

function SearchInput({ query, onQuery }: { query: string; onQuery: (query: string) => void }) {
  return (
    <label className="relative block">
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
      <span className="sr-only">Rechercher un animal</span>
      <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Numéro du veau, de la mère…" className="min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-9 text-sm font-semibold outline-none focus:border-green-700 focus:bg-white focus:ring-2 focus:ring-green-100" />
      {query && (
        <button type="button" onClick={() => onQuery("")} className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200" aria-label="Effacer la recherche"><X size={16} /></button>
      )}
    </label>
  );
}

function SelectControl({
  icon: Icon,
  label,
  value,
  onChange,
  children,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative block">
      <Icon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-8 text-sm font-bold outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100">{children}</select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
    </label>
  );
}

function WorkspaceHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-[1800px] items-center gap-3 px-3 sm:px-5">
        <div className="flex size-10 items-center justify-center rounded-xl bg-green-800 text-lg font-black text-white">C</div>
        <strong className="text-lg font-black tracking-tight">CESAM</strong>
        <span className="hidden rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-violet-900 sm:inline-flex">Prototype espace de travail</span>
        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Navigation principale simulée">
          <HeaderNav icon={Home} label="Accueil" />
          <HeaderNav icon={Users} label="Troupeau" active />
          <HeaderNav icon={WalletCards} label="Finances" />
        </nav>
        <button type="button" className="ml-auto flex size-11 items-center justify-center rounded-xl border border-slate-200 md:hidden" aria-label="Menu simulé"><Menu size={21} /></button>
      </div>
    </header>
  );
}

function HeaderNav({ icon: Icon, label, active = false }: { icon: typeof Home; label: string; active?: boolean }) {
  return (
    <button type="button" className={`flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-black ${active ? "bg-green-50 text-green-900" : "text-slate-500 hover:bg-slate-50"}`}>
      <Icon size={17} />{label}
    </button>
  );
}

function PrototypeNotice() {
  return (
    <div className="flex gap-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-violet-950 sm:px-4">
      <Sparkles className="mt-0.5 shrink-0" size={18} />
      <p className="text-xs font-semibold leading-5 sm:text-sm"><strong>Maquette cliquable.</strong> Les animaux sont fictifs ; votre sélection et le travail simulé restent visibles sur cet appareil, mais rien n’est enregistré dans CESAM.</p>
    </div>
  );
}

function ViewNavigation({
  animals,
  completed,
  activeView,
  onView,
}: {
  animals: WorkspaceAnimal[];
  completed: WorkspaceCompletedState;
  activeView: WorkspaceView;
  onView: (view: WorkspaceView) => void;
}) {
  return (
    <nav className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="Vues du troupeau">
      <p className="px-3 pb-2 pt-1 text-xs font-black uppercase tracking-wide text-slate-500">Mes vues</p>
      <div className="space-y-1">
        {VIEWS.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeView;
          return (
            <button key={item.id} type="button" onClick={() => onView(item.id)} className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-black ${active ? "bg-green-800 text-white" : "text-slate-700 hover:bg-slate-50"}`}>
              <Icon size={17} />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <span className={`text-xs ${active ? "text-green-100" : "text-slate-400"}`}>{buildWorkspaceRows(item.id, animals, completed).length}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
        <strong className="block text-slate-900">Comme un tableau dynamique</strong>
        Une vue filtre les lignes. Les titres du tableau trient les numéros, les mères et l’âge.
      </div>
    </nav>
  );
}

function compareRows(a: WorkspaceRow, b: WorkspaceRow, sort: WorkspaceSort): number {
  if (sort === "priority") {
    const aPriority = Math.max(a.primary.priority, a.related?.priority ?? 0);
    const bPriority = Math.max(b.primary.priority, b.related?.priority ?? 0);
    if (aPriority !== bPriority) return bPriority - aPriority;
  }
  if (sort === "related-number") {
    return (a.related?.nutrav ?? "").localeCompare(b.related?.nutrav ?? "", "fr", { numeric: true });
  }
  if (sort === "youngest") return new Date(b.primary.birthDate).getTime() - new Date(a.primary.birthDate).getTime();
  if (sort === "oldest") return new Date(a.primary.birthDate).getTime() - new Date(b.primary.birthDate).getTime();
  return a.primary.nutrav.localeCompare(b.primary.nutrav, "fr", { numeric: true });
}

function normalizeCompleted(saved: WorkspaceCompletedState, validIds: Set<string>): WorkspaceCompletedState {
  return Object.fromEntries(
    ALL_ACTIONS.map((action) => [action, Array.isArray(saved[action]) ? saved[action].filter((id) => validIds.has(id)) : []]),
  ) as WorkspaceCompletedState;
}

function isWorkspaceSort(value: unknown): value is WorkspaceSort {
  return ["priority", "primary-number", "related-number", "youngest", "oldest"].includes(String(value));
}

function isTaskFilter(value: unknown): value is TaskFilter {
  return ["all", "treatment", "vaccination", "echo", "weaning", "weight"].includes(String(value));
}
