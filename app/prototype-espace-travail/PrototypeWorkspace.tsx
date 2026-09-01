"use client";

import {
  Baby,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Filter,
  Home,
  LayoutList,
  Menu,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  DEMO_SCENARIO_CALF_IDS,
  DEMO_SCENARIO_ECHO_MOTHER_IDS,
  DEMO_SCENARIO_MOTHER_IDS,
  DEMO_SCENARIO_WEANING_IDS,
} from "./demo-data";
import type {
  WorkspaceAction,
  WorkspaceAnimal,
  WorkspaceSort,
  WorkspaceView,
} from "./types";
import WorkspaceActionModal from "./WorkspaceActionModal";
import WorkspaceAnimalList from "./WorkspaceAnimalList";
import WorkspaceSelectionPanel from "./WorkspaceSelectionPanel";
import { ACTION_LABELS, compatibleAnimals } from "./workspace-utils";

type PrototypeWorkspaceProps = {
  initialAnimals: WorkspaceAnimal[];
};

const VIEWS: Array<{
  id: WorkspaceView;
  label: string;
  icon: typeof Users;
}> = [
  { id: "all", label: "Tout le troupeau", icon: Users },
  { id: "young", label: "Veaux et velles", icon: Baby },
  { id: "cows", label: "Vaches", icon: LayoutList },
  { id: "heifers", label: "Génisses", icon: Users },
  { id: "weaning", label: "À sevrer", icon: ClipboardList },
];

export default function PrototypeWorkspace({
  initialAnimals,
}: PrototypeWorkspaceProps) {
  const [view, setView] = useState<WorkspaceView>("young");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<WorkspaceSort>("number");
  const [group, setGroup] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [treatedIds, setTreatedIds] = useState<Set<string>>(new Set());
  const [weanedIds, setWeanedIds] = useState<Set<string>>(new Set());
  const [echoedIds, setEchoedIds] = useState<Set<string>>(new Set());
  const [activeAction, setActiveAction] = useState<WorkspaceAction | null>(null);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [mobileViewsOpen, setMobileViewsOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [activity, setActivity] = useState<string[]>([]);

  const animalById = useMemo(
    () => new Map(initialAnimals.map((animal) => [animal.id, animal])),
    [initialAnimals],
  );

  const groups = useMemo(
    () =>
      Array.from(
        new Set(
          initialAnimals
            .map((animal) => animal.groupName)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b, "fr")),
    [initialAnimals],
  );

  const filteredAnimals = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fr");
    const filtered = initialAnimals.filter((animal) => {
      const inView =
        view === "all" ||
        (view === "young" && (animal.kind === "VEAU" || animal.kind === "VELLE")) ||
        (view === "cows" && animal.kind === "VACHE") ||
        (view === "heifers" && animal.kind === "GENISSE") ||
        (view === "weaning" && animal.weaningDue && !weanedIds.has(animal.id));
      const inGroup = group === "all" || animal.groupName === group;
      const matchesQuery =
        !normalizedQuery ||
        animal.nutrav.toLocaleLowerCase("fr").includes(normalizedQuery) ||
        animal.name?.toLocaleLowerCase("fr").includes(normalizedQuery) ||
        animal.motherNutrav?.includes(normalizedQuery) ||
        animal.calfNutrav?.includes(normalizedQuery);

      return inView && inGroup && Boolean(matchesQuery);
    });

    return filtered.toSorted((a, b) => {
      if (sort === "youngest") {
        return new Date(b.birthDate).getTime() - new Date(a.birthDate).getTime();
      }
      if (sort === "oldest") {
        return new Date(a.birthDate).getTime() - new Date(b.birthDate).getTime();
      }
      return a.nutrav.localeCompare(b.nutrav, "fr", { numeric: true });
    });
  }, [group, initialAnimals, query, sort, view, weanedIds]);

  const selectedAnimals = useMemo(
    () =>
      initialAnimals.filter((animal) => selectedIds.has(animal.id)).toSorted((a, b) =>
        a.nutrav.localeCompare(b.nutrav, "fr", { numeric: true }),
      ),
    [initialAnimals, selectedIds],
  );

  const visibleSelectedCount = filteredAnimals.filter((animal) =>
    selectedIds.has(animal.id),
  ).length;
  const hiddenSelectedCount = selectedIds.size - visibleSelectedCount;

  const treatmentCompatible = compatibleAnimals(
    "treatment",
    selectedAnimals,
    treatedIds,
  );
  const weaningCompatible = compatibleAnimals(
    "weaning",
    selectedAnimals,
    weanedIds,
  );
  const echoCompatible = compatibleAnimals("echo", selectedAnimals, echoedIds);

  const relatedMothers = useMemo(() => {
    const relatedIds = new Set(
      initialAnimals
        .filter((animal) => weanedIds.has(animal.id))
        .map((animal) => animal.motherId)
        .filter((value): value is string => Boolean(value)),
    );
    return initialAnimals.filter((animal) => relatedIds.has(animal.id));
  }, [initialAnimals, weanedIds]);

  const relatedEchoMothers = relatedMothers.filter(
    (animal) => animal.echoDue && !echoedIds.has(animal.id),
  );

  const actionCompatibleAnimals = activeAction
    ? compatibleAnimals(
        activeAction,
        selectedAnimals,
        activeAction === "treatment"
          ? treatedIds
          : activeAction === "weaning"
            ? weanedIds
            : echoedIds,
      )
    : [];

  const scenarioStep = getScenarioStep({
    selectedIds,
    treatedIds,
    weanedIds,
    echoedIds,
  });

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

  function toggleAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      const allSelected =
        filteredAnimals.length > 0 &&
        filteredAnimals.every((animal) => next.has(animal.id));
      filteredAnimals.forEach((animal) => {
        if (allSelected) next.delete(animal.id);
        else next.add(animal.id);
      });
      return next;
    });
  }

  function openAction(action: WorkspaceAction) {
    const completed =
      action === "treatment"
        ? treatedIds
        : action === "weaning"
          ? weanedIds
          : echoedIds;
    const compatible = compatibleAnimals(action, selectedAnimals, completed);

    if (!compatible.length) {
      showFeedback("Aucun animal compatible dans la sélection.");
      return;
    }
    setMobilePanelOpen(false);
    setActiveAction(action);
  }

  function completeAction() {
    if (!activeAction || !actionCompatibleAnimals.length) return;
    const ids = actionCompatibleAnimals.map((animal) => animal.id);

    if (activeAction === "treatment") {
      setTreatedIds((current) => new Set([...current, ...ids]));
    } else if (activeAction === "weaning") {
      setWeanedIds((current) => new Set([...current, ...ids]));
    } else {
      setEchoedIds((current) => new Set([...current, ...ids]));
    }

    const message = `${ACTION_LABELS[activeAction]} simulé · ${ids.length} animal${ids.length > 1 ? "aux" : ""}`;
    setActivity((current) => [message, ...current].slice(0, 4));
    setActiveAction(null);
    showFeedback(`${message}. La sélection est conservée.`);
  }

  function selectRelatedMothers(onlyEchoDue: boolean) {
    const mothers = onlyEchoDue ? relatedEchoMothers : relatedMothers;
    setSelectedIds(new Set(mothers.map((animal) => animal.id)));
    setView("cows");
    setGroup("all");
    setQuery("");
    setMobilePanelOpen(false);
    showFeedback(
      `${mothers.length} mère${mothers.length > 1 ? "s" : ""} sélectionnée${mothers.length > 1 ? "s" : ""}.`,
    );
  }

  function resetScenario() {
    setView("young");
    setGroup("all");
    setQuery("");
    setSelectedIds(new Set());
    setTreatedIds(new Set());
    setWeanedIds(new Set());
    setEchoedIds(new Set());
    setActivity([]);
    setActiveAction(null);
    setMobilePanelOpen(false);
    showFeedback("Scénario remis au début.");
  }

  function runScenarioStep() {
    if (scenarioStep.id === "select-calves") {
      setSelectedIds(new Set(DEMO_SCENARIO_CALF_IDS));
      setView("young");
      setGroup("all");
      setQuery("");
      showFeedback("15 veaux sélectionnés. Cette sélection reste active.");
    } else if (scenarioStep.id === "treat") {
      openAction("treatment");
    } else if (scenarioStep.id === "restrict-weaning") {
      setSelectedIds(new Set(DEMO_SCENARIO_WEANING_IDS));
      setView("young");
      showFeedback("Sélection ajustée : 8 veaux à sevrer.");
    } else if (scenarioStep.id === "wean") {
      openAction("weaning");
    } else if (scenarioStep.id === "select-mothers") {
      const mothers = DEMO_SCENARIO_ECHO_MOTHER_IDS.map((id) => animalById.get(id)).filter(
        (animal): animal is WorkspaceAnimal => Boolean(animal),
      );
      setSelectedIds(new Set(mothers.map((animal) => animal.id)));
      setView("cows");
      setGroup("all");
      setQuery("");
      showFeedback("3 mères à échographier sélectionnées automatiquement.");
    } else if (scenarioStep.id === "echo") {
      openAction("echo");
    }
  }

  const selectionPanel = (
    <WorkspaceSelectionPanel
      selectedAnimals={selectedAnimals}
      hiddenSelectedCount={hiddenSelectedCount}
      treatmentCompatibleCount={treatmentCompatible.length}
      weaningCompatibleCount={weaningCompatible.length}
      echoCompatibleCount={echoCompatible.length}
      relatedMothers={relatedMothers}
      relatedEchoMothers={relatedEchoMothers}
      onRemove={toggleAnimal}
      onClear={() => setSelectedIds(new Set())}
      onAction={openAction}
      onSelectRelatedMothers={selectRelatedMothers}
    />
  );

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#f2f4f1] text-slate-950">
      <WorkspaceHeader />

      <main className="mx-auto w-full max-w-[1500px] px-3 pb-28 pt-3 sm:px-5 sm:pt-5 lg:pb-8">
        <PrototypeNotice />

        <ScenarioGuide
          step={scenarioStep}
          activity={activity}
          onContinue={runScenarioStep}
          onReset={resetScenario}
        />

        <div className="mt-4 grid items-start gap-4 lg:grid-cols-[210px_minmax(0,1fr)_330px]">
          <aside className="hidden lg:block">
            <ViewNavigation
              animals={initialAnimals}
              activeView={view}
              onView={setView}
            />
          </aside>

          <section className="min-w-0" aria-labelledby="workspace-title">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-green-800">
                  Espace de travail
                </p>
                <h1 id="workspace-title" className="text-2xl font-black tracking-tight sm:text-3xl">
                  Troupeau
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-600">
                  Je trouve, je sélectionne, puis j’enchaîne plusieurs actions sans recommencer.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileViewsOpen((open) => !open)}
                className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black shadow-sm lg:hidden"
                aria-expanded={mobileViewsOpen}
              >
                <Filter size={17} />
                Vues
                <ChevronDown size={16} className={mobileViewsOpen ? "rotate-180" : ""} />
              </button>
            </div>

            {mobileViewsOpen && (
              <div className="mb-3 lg:hidden">
                <ViewNavigation
                  animals={initialAnimals}
                  activeView={view}
                  onView={(nextView) => {
                    setView(nextView);
                    setMobileViewsOpen(false);
                  }}
                />
              </div>
            )}

            <div className="mb-3 grid gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:grid-cols-[minmax(0,1fr)_170px_190px]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <span className="sr-only">Rechercher un animal</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Numéro, nom, mère ou veau…"
                  className="min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-9 text-sm font-semibold outline-none focus:border-green-700 focus:bg-white focus:ring-2 focus:ring-green-100"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200"
                    aria-label="Effacer la recherche"
                  >
                    <X size={16} />
                  </button>
                )}
              </label>

              <label className="relative block">
                <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <span className="sr-only">Trier les animaux</span>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as WorkspaceSort)}
                  className="min-h-11 w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-8 text-sm font-bold outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
                >
                  <option value="number">Numéro</option>
                  <option value="youngest">Plus jeunes</option>
                  <option value="oldest">Plus âgés</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              </label>

              <label className="relative block">
                <Users className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <span className="sr-only">Filtrer par lot</span>
                <select
                  value={group}
                  onChange={(event) => setGroup(event.target.value)}
                  className="min-h-11 w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-8 text-sm font-bold outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
                >
                  <option value="all">Tous les lots</option>
                  {groups.map((groupName) => (
                    <option key={groupName} value={groupName}>
                      {groupName}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              </label>
            </div>

            {hiddenSelectedCount > 0 && (
              <div className="mb-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950">
                La sélection est conservée : {hiddenSelectedCount} animal{hiddenSelectedCount > 1 ? "aux" : ""} sélectionné{hiddenSelectedCount > 1 ? "s" : ""} hors de cette vue.
              </div>
            )}

            <WorkspaceAnimalList
              animals={filteredAnimals}
              selectedIds={selectedIds}
              treatedIds={treatedIds}
              weanedIds={weanedIds}
              echoedIds={echoedIds}
              onToggle={toggleAnimal}
              onSelectAllVisible={toggleAllVisible}
            />
          </section>

          <aside className="sticky top-[76px] hidden lg:block" aria-label="Sélection et actions">
            {selectionPanel}
          </aside>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-[105] border-t border-slate-200 bg-white/95 p-2 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMobilePanelOpen(true)}
          className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-4 text-left ${
            selectedIds.size
              ? "bg-green-800 text-white"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-white/15 font-black">
            {selectedIds.size}
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-sm font-black">
              {selectedIds.size
                ? `${selectedIds.size} animal${selectedIds.size > 1 ? "aux" : ""} sélectionné${selectedIds.size > 1 ? "s" : ""}`
                : "Sélection et actions"}
            </strong>
            <span className="block truncate text-xs font-semibold opacity-75">
              {selectedAnimals.length
                ? selectedAnimals.map((animal) => animal.nutrav).join(" · ")
                : "Toujours visible pendant le travail"}
            </span>
          </span>
          <ChevronRight size={20} />
        </button>
      </div>

      {mobilePanelOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-950/45 lg:hidden">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setMobilePanelOpen(false)}
            aria-label="Fermer le panneau d’actions"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-[#f2f4f1] p-3 pb-6 shadow-2xl">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="h-1 w-12 rounded-full bg-slate-300" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setMobilePanelOpen(false)}
                className="flex size-10 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm"
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
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
        <div
          role="status"
          className="fixed bottom-20 left-1/2 z-[140] w-max max-w-[calc(100%-24px)] -translate-x-1/2 rounded-xl bg-slate-950 px-4 py-3 text-center text-sm font-black text-white shadow-xl lg:bottom-5"
        >
          {feedback}
        </div>
      )}
    </div>
  );
}

function WorkspaceHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-[1500px] items-center gap-3 px-3 sm:px-5">
        <div className="flex size-10 items-center justify-center rounded-xl bg-green-800 text-lg font-black text-white">
          C
        </div>
        <strong className="text-lg font-black tracking-tight">CESAM</strong>
        <span className="hidden rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-violet-900 sm:inline-flex">
          Prototype espace de travail
        </span>
        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Navigation principale simulée">
          <HeaderNav icon={Home} label="Accueil" />
          <HeaderNav icon={Users} label="Troupeau" active />
          <HeaderNav icon={WalletCards} label="Finances" />
        </nav>
        <button type="button" className="ml-auto flex size-11 items-center justify-center rounded-xl border border-slate-200 md:hidden" aria-label="Menu simulé">
          <Menu size={21} />
        </button>
      </div>
    </header>
  );
}

function HeaderNav({
  icon: Icon,
  label,
  active = false,
}: {
  icon: typeof Home;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-black ${
        active ? "bg-green-50 text-green-900" : "text-slate-500 hover:bg-slate-50"
      }`}
    >
      <Icon size={17} />
      {label}
    </button>
  );
}

function PrototypeNotice() {
  return (
    <div className="flex gap-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-violet-950 sm:px-4">
      <Sparkles className="mt-0.5 shrink-0" size={18} />
      <p className="text-xs font-semibold leading-5 sm:text-sm">
        <strong>Maquette cliquable.</strong> Les animaux sont fictifs et aucune action n’est enregistrée dans CESAM.
      </p>
    </div>
  );
}

type ScenarioStep = ReturnType<typeof getScenarioStep>;

function ScenarioGuide({
  step,
  activity,
  onContinue,
  onReset,
}: {
  step: ScenarioStep;
  activity: string[];
  onContinue: () => void;
  onReset: () => void;
}) {
  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-green-200 bg-white shadow-sm">
      <div className="grid gap-3 p-3 sm:p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="flex min-w-0 gap-3">
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-full font-black ${step.done ? "bg-green-700 text-white" : "bg-green-100 text-green-900"}`}>
            {step.done ? <Check size={21} /> : step.number}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide text-green-800">
              Essai guidé · 15 traités → 8 sevrés → 3 mères
            </p>
            <h2 className="mt-0.5 font-black text-slate-950">{step.title}</h2>
            <p className="mt-0.5 text-sm text-slate-600">{step.detail}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onReset}
            className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-black text-slate-600 hover:bg-slate-50"
            aria-label="Recommencer le scénario"
          >
            <RotateCcw size={16} />
            <span className="hidden min-[360px]:inline">Recommencer</span>
          </button>
          {!step.done && (
            <button
              type="button"
              onClick={onContinue}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-green-800 px-4 text-sm font-black text-white hover:bg-green-900 md:flex-none"
            >
              {step.action}
              <ChevronRight size={17} />
            </button>
          )}
        </div>
      </div>
      {activity.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600">
          {activity.map((item) => (
            <span key={item} className="inline-flex items-center gap-1.5">
              <Check size={13} className="text-green-700" />
              {item}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function ViewNavigation({
  animals,
  activeView,
  onView,
}: {
  animals: WorkspaceAnimal[];
  activeView: WorkspaceView;
  onView: (view: WorkspaceView) => void;
}) {
  const countForView = (view: WorkspaceView) => {
    if (view === "young") return animals.filter((animal) => animal.kind === "VEAU" || animal.kind === "VELLE").length;
    if (view === "cows") return animals.filter((animal) => animal.kind === "VACHE").length;
    if (view === "heifers") return animals.filter((animal) => animal.kind === "GENISSE").length;
    if (view === "weaning") return animals.filter((animal) => animal.weaningDue).length;
    return animals.length;
  };

  return (
    <nav className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="Vues du troupeau">
      <p className="px-3 pb-2 pt-1 text-xs font-black uppercase tracking-wide text-slate-500">
        Mes vues
      </p>
      <div className="space-y-1">
        {VIEWS.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeView;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onView(item.id)}
              className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-black ${
                active
                  ? "bg-green-800 text-white"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Icon size={17} />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <span className={`text-xs ${active ? "text-green-100" : "text-slate-400"}`}>
                {countForView(item.id)}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
        <strong className="block text-slate-900">Principe</strong>
        Une vue filtre la liste, mais ne vide jamais votre sélection.
      </div>
    </nav>
  );
}

function getScenarioStep({
  selectedIds,
  treatedIds,
  weanedIds,
  echoedIds,
}: {
  selectedIds: Set<string>;
  treatedIds: Set<string>;
  weanedIds: Set<string>;
  echoedIds: Set<string>;
}) {
  const allSelected = (ids: string[]) => ids.every((id) => selectedIds.has(id));
  const exactlySelected = (ids: string[]) =>
    selectedIds.size === ids.length && allSelected(ids);
  const allCompleted = (ids: string[], completed: Set<string>) =>
    ids.every((id) => completed.has(id));

  if (!allSelected(DEMO_SCENARIO_CALF_IDS)) {
    return {
      id: "select-calves" as const,
      number: 1,
      title: "Constituer le groupe de travail",
      detail: "Sélectionnez les 15 veaux du lot une seule fois.",
      action: "Sélectionner les 15",
      done: false,
    };
  }
  if (!allCompleted(DEMO_SCENARIO_CALF_IDS, treatedIds)) {
    return {
      id: "treat" as const,
      number: 2,
      title: "Traiter les 15 veaux",
      detail: "Le formulaire s’ouvre par-dessus la liste, puis la sélection reste en place.",
      action: "Ouvrir Traitement",
      done: false,
    };
  }
  if (!exactlySelected(DEMO_SCENARIO_WEANING_IDS)) {
    return {
      id: "restrict-weaning" as const,
      number: 3,
      title: "Garder seulement les 8 à sevrer",
      detail: "On ajuste le groupe existant sans rechercher les numéros une deuxième fois.",
      action: "Garder les 8",
      done: false,
    };
  }
  if (!allCompleted(DEMO_SCENARIO_WEANING_IDS, weanedIds)) {
    return {
      id: "wean" as const,
      number: 4,
      title: "Sevrer les 8 veaux",
      detail: "L’action s’applique au groupe visible et conserve encore la sélection.",
      action: "Ouvrir Sevrage",
      done: false,
    };
  }
  if (!exactlySelected(DEMO_SCENARIO_ECHO_MOTHER_IDS)) {
    return {
      id: "select-mothers" as const,
      number: 5,
      title: "CESAM signale les mères liées",
      detail: `${DEMO_SCENARIO_MOTHER_IDS.length} mères sont retrouvées sans recherche ; 3 ont une échographie à faire.`,
      action: "Sélectionner les 3 mères",
      done: false,
    };
  }
  if (!allCompleted(DEMO_SCENARIO_ECHO_MOTHER_IDS, echoedIds)) {
    return {
      id: "echo" as const,
      number: 6,
      title: "Échographier les 3 mères",
      detail: "Le rappel apparaît exactement au moment où il devient utile.",
      action: "Ouvrir Échographie",
      done: false,
    };
  }
  return {
    id: "done" as const,
    number: 6,
    title: "Parcours terminé sans refaire une sélection",
    detail: "15 traitements, 8 sevrages et 3 échographies simulés depuis le même espace de travail.",
    action: "",
    done: true,
  };
}
