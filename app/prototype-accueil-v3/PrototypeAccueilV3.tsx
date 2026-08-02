"use client";

import Image from "next/image";
import {
  Baby, BellRing, ChevronDown, ChevronRight, ClipboardCheck, Dna, GripVertical,
  HeartHandshake, HeartPulse, LayoutGrid, LogOut, Menu, Mic, NotebookPen, Pill,
  Plus, Scale, ScanLine, Scissors, Search, Settings, Stethoscope, Tag,
  Thermometer, Trash2, X,
} from "lucide-react";
import {
  useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType,
  type PointerEvent as ReactPointerEvent,
} from "react";
import HoofPrintIcon from "@/components/HoofPrintIcon";
import {
  ALL_PROTOTYPE_ACTIONS, DEFAULT_FAVORITES, MAX_FAVORITES, PROTOTYPE_CATEGORIES,
  PROTOTYPE_EXIT_REASONS, addFavorite, filterPrototypeAnimals,
  getSortableAutoScrollDelta, removeFavorite, reorderActions,
  type PrototypeAction, type PrototypeCategory,
} from "./prototype-data";

type IconType = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
type CategoryActions = Record<PrototypeCategory["id"], PrototypeAction[]>;

const ICONS: Record<string, IconType> = {
  thermometer: Thermometer, heart: HeartPulse, stethoscope: Stethoscope,
  hoof: HoofPrintIcon, scale: Scale, echo: ClipboardCheck, baby: Baby, pill: Pill,
  scan: ScanLine, tag: Tag, scissors: Scissors, dna: Dna, plus: Plus,
  logout: LogOut, grid: LayoutGrid,
};

const NEWS = [
  { id: "session", title: "Pesée en cours", info: "12 animaux", action: "Reprendre", icon: Scale, tone: "green" },
  { id: "missing", title: "Veaux jamais pesés", info: "4 animaux de 10 mois ou plus", action: "Voir", icon: BellRing, tone: "amber" },
  { id: "heat", title: "Retour en chaleur détecté", info: "Vache 6393 · aujourd’hui", action: "Enregistrer", icon: HeartPulse, tone: "rose" },
  { id: "weaning", title: "Sevrage à prévoir", info: "3 veaux concernés", action: "Consulter", icon: Scissors, tone: "blue" },
] as const;

const NEWS_TONES = {
  green: "border-l-green-700 bg-green-50 text-green-950",
  amber: "border-l-amber-600 bg-amber-50 text-amber-950",
  rose: "border-l-rose-600 bg-rose-50 text-rose-950",
  blue: "border-l-blue-700 bg-blue-50 text-blue-950",
};

const ACTION_TONES: Record<PrototypeAction["tone"], string> = {
  rose: "bg-rose-50 text-rose-900 ring-rose-200",
  fuchsia: "bg-fuchsia-50 text-fuchsia-900 ring-fuchsia-200",
  blue: "bg-blue-50 text-blue-950 ring-blue-200",
  amber: "bg-amber-50 text-amber-950 ring-amber-200",
  green: "bg-green-50 text-green-950 ring-green-300",
  cyan: "bg-cyan-50 text-cyan-950 ring-cyan-200",
  violet: "bg-violet-50 text-violet-950 ring-violet-200",
  slate: "bg-slate-50 text-slate-950 ring-slate-300",
  red: "bg-red-50 text-red-950 ring-red-200",
};

const ACTION_LIST_ACCENTS: Record<PrototypeAction["tone"], string> = {
  rose: "border-l-rose-500", fuchsia: "border-l-fuchsia-500",
  blue: "border-l-blue-600", amber: "border-l-amber-500",
  green: "border-l-green-700", cyan: "border-l-cyan-600",
  violet: "border-l-violet-600", slate: "border-l-slate-600",
  red: "border-l-red-600",
};

const NAV_ITEMS = ["Accueil", "Troupeau", "Reproduction", "Sanitaire", "Finances"];
const MENU_ITEMS = [
  { label: "Paramètres", icon: Settings },
  { label: "Soutien et ressources", icon: HeartHandshake },
  { label: "Se déconnecter", icon: LogOut },
];
function initialCategoryActions(): CategoryActions {
  return Object.fromEntries(PROTOTYPE_CATEGORIES.map((item) => [item.id, item.actions])) as CategoryActions;
}

export default function PrototypeAccueilV3() {
  const [activeNav, setActiveNav] = useState("Accueil");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [category, setCategory] = useState<PrototypeCategory["id"]>("reproduction");
  const [categoryActions, setCategoryActions] = useState(initialCategoryActions);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [categoryOrdering, setCategoryOrdering] = useState(false);
  const [favoritesEditorOpen, setFavoritesEditorOpen] = useState(false);
  const [favorites, setFavorites] = useState(DEFAULT_FAVORITES);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [exitOpen, setExitOpen] = useState(false);

  const activeCategory = PROTOTYPE_CATEGORIES.find((item) => item.id === category)!;
  const animals = useMemo(() => filterPrototypeAnimals(query), [query]);

  function simulate(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 2600);
  }

  function activateAction(action: PrototypeAction) {
    if (action.id === "sortir-animal") setExitOpen(true);
    else simulate(action.intention);
  }

  function selectNavigation(item: string) {
    setActiveNav(item);
    setMobileMenu(false);
    simulate(`${item} · navigation simulée`);
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#f3f5f2] text-slate-950">
      <PrototypeHeader
        activeNav={activeNav} mobileMenu={mobileMenu} query={query} searchOpen={searchOpen}
        animals={animals} onNavigate={selectNavigation} onMobileMenu={setMobileMenu}
        onQuery={setQuery} onSearchOpen={setSearchOpen} onSimulate={simulate}
      />

      <main className="mx-auto w-full max-w-6xl px-3 py-3 sm:px-5 sm:py-5">
        <NewsSection onSimulate={simulate} />

        <section className="mt-5" aria-labelledby="daily-title">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 id="daily-title" className="text-lg font-black">Actions rapides</h2>
            <button type="button" onClick={() => setFavoritesEditorOpen(true)} className="min-h-11 rounded-md px-3 text-sm font-bold text-green-800 hover:bg-white">Modifier les actions rapides</button>
          </div>
          <ReorderableGrid scope="favorites-home" items={favorites} editing={false} onEditing={() => setFavoritesEditorOpen(true)} onReorder={setFavorites} onAction={activateAction} prominent />
        </section>

        <section className="mt-5" aria-labelledby="other-title">
          <div className="flex items-center justify-between gap-3"><h2 id="other-title" className="text-lg font-black">Autres actions</h2><button type="button" onClick={() => setCategoryOrdering((active) => !active)} className={`min-h-10 rounded-md px-3 text-sm font-bold ${categoryOrdering ? "bg-slate-950 text-white" : "text-green-800 hover:bg-white"}`}>{categoryOrdering ? "Terminer" : "Modifier l’ordre"}</button></div>
          <div className="mt-2 grid grid-cols-2 gap-1 rounded-md bg-slate-200 p-1 sm:grid-cols-4" role="tablist" aria-label="Catégories d’actions">
            {PROTOTYPE_CATEGORIES.map((item) => <button key={item.id} type="button" role="tab" aria-selected={category === item.id} onClick={() => setCategory(item.id)} className={`min-h-10 rounded px-2 text-sm font-bold ${category === item.id ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`}>{item.label}</button>)}
          </div>
          <div aria-label={`Actions ${activeCategory.label}`}>
            <ReorderableGrid scope={`category-${category}`} items={categoryActions[category]} editing={categoryOrdering} onEditing={() => setCategoryOrdering(true)} onReorder={(items) => setCategoryActions((current) => ({ ...current, [category]: items }))} onAction={activateAction} />
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-md bg-white shadow-sm">
          <button type="button" onClick={() => setOverviewOpen((open) => !open)} className="flex min-h-14 w-full items-center justify-between px-4 text-left" aria-expanded={overviewOpen}>
            <span><strong className="block font-black">Aperçu de l’élevage</strong><span className="text-xs text-slate-500">Quelques repères, quand vous en avez besoin</span></span>
            <ChevronDown className={`transition-transform ${overviewOpen ? "rotate-180" : ""}`} />
          </button>
          {overviewOpen && <div className="grid grid-cols-2 border-t border-slate-100 sm:grid-cols-4">{[["Animaux présents", "186"], ["Vaches pleines", "82 %"], ["Vêlages proches", "6"], ["Soins à prévoir", "9"]].map(([label, value]) => <div key={label} className="border-b border-r border-slate-100 p-4 last:border-r-0"><strong className="text-2xl font-black text-green-800">{value}</strong><span className="mt-1 block text-xs font-semibold text-slate-600">{label}</span></div>)}</div>}
        </section>

        <button type="button" onClick={() => simulate("Soutien et ressources · accès simulé")} className="mt-5 flex min-h-14 w-full items-center gap-3 rounded-md border-l-4 border-green-700 bg-white px-4 text-left shadow-sm">
          <HeartHandshake size={23} className="text-green-800" /><span className="min-w-0 flex-1"><strong className="block text-sm">Soutien et ressources</strong><span className="block text-xs text-slate-500">Aide et soutien psychologique</span></span><ChevronRight size={20} className="text-slate-400" />
        </button>
      </main>

      {feedback && <div role="status" className="fixed bottom-4 left-1/2 z-50 w-max max-w-[calc(100%-24px)] -translate-x-1/2 rounded-md bg-slate-950 px-4 py-3 text-center text-sm font-bold text-white shadow-xl">{feedback}</div>}
      {favoritesEditorOpen && <FavoritesEditor favorites={favorites} onChange={setFavorites} onClose={() => setFavoritesEditorOpen(false)} onAction={activateAction} />}
      {exitOpen && <ExitDialog onClose={() => setExitOpen(false)} onSelect={(reason) => { setExitOpen(false); simulate(`${reason} · sortie simulée`); }} />}
    </div>
  );
}

function PrototypeHeader({ activeNav, mobileMenu, query, searchOpen, animals, onNavigate, onMobileMenu, onQuery, onSearchOpen, onSimulate }: {
  activeNav: string; mobileMenu: boolean; query: string; searchOpen: boolean;
  animals: ReturnType<typeof filterPrototypeAnimals>; onNavigate: (item: string) => void;
  onMobileMenu: (open: boolean) => void; onQuery: (value: string) => void;
  onSearchOpen: (open: boolean) => void; onSimulate: (message: string) => void;
}) {
  return <header className="sticky top-0 z-30 border-b border-green-900 bg-green-800 text-white shadow-sm">
    <div className="mx-auto flex h-14 max-w-6xl items-center gap-1.5 px-2 sm:h-16 sm:gap-2 sm:px-5">
      <button type="button" onClick={() => onNavigate("Accueil")} className="flex shrink-0 items-center gap-2" aria-label="Accueil du prototype"><Image src="/logo-cesam.jpg" alt="CESAM" width={34} height={34} className="rounded-md border border-white/40" /><span className="hidden text-sm font-black xl:block">CESAM</span></button>
      <nav className="hidden items-stretch self-stretch lg:flex" aria-label="Navigation du prototype">{NAV_ITEMS.map((item) => <button key={item} type="button" onClick={() => onNavigate(item)} className={`px-3 text-sm font-bold ${activeNav === item ? "bg-white text-green-900" : "text-green-50 hover:bg-green-700"}`}>{item}</button>)}</nav>
      <div className="relative ml-auto min-w-0 flex-1 sm:max-w-xs">
        <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input value={query} onFocus={() => onSearchOpen(true)} onChange={(event) => { onQuery(event.target.value); onSearchOpen(true); }} placeholder="Rechercher un animal" aria-label="Rechercher rapidement un animal" className="h-11 w-full rounded-md bg-white pl-9 pr-3 text-sm font-semibold text-slate-950 outline-none ring-2 ring-transparent focus:ring-amber-400" />
        {searchOpen && <div className="fixed left-2 right-2 top-16 overflow-hidden rounded-md border border-slate-200 bg-white text-slate-950 shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-full sm:min-w-64"><div className="flex items-center justify-between border-b px-3 py-2 text-xs font-bold text-slate-500">Animaux fictifs<button type="button" onClick={() => onSearchOpen(false)} aria-label="Fermer la recherche" className="p-1"><X size={15} /></button></div>{animals.map((animal) => <button key={animal.number} type="button" onClick={() => { onSearchOpen(false); onSimulate(`Fiche ${animal.number} · consultation simulée`); }} className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-slate-100 px-3 text-left last:border-0 hover:bg-green-50"><span><strong className="font-black">{animal.number}</strong><span className="ml-2 text-sm">{animal.name}</span></span><span className="text-xs text-slate-500">{animal.detail}</span></button>)}{animals.length === 0 && <p className="p-4 text-center text-sm text-slate-500">Aucun résultat fictif</p>}</div>}
      </div>
      <button type="button" onClick={() => onSimulate("Dictée d’action · interaction simulée")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-green-700" aria-label="Dicter une action ou un événement" title="Dicter une action"><Mic size={21} /></button>
      <button type="button" onClick={() => onSimulate("Note vocale libre · interaction simulée")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-green-700" aria-label="Enregistrer une note vocale libre" title="Note vocale libre"><NotebookPen size={21} /></button>
      <button type="button" onClick={() => onMobileMenu(!mobileMenu)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-green-700" aria-label={mobileMenu ? "Fermer le menu" : "Ouvrir le menu"}>{mobileMenu ? <X /> : <Menu />}</button>
    </div>
    {mobileMenu && <div className="border-t border-green-700 bg-green-800 px-3 py-2"><nav className="grid grid-cols-2 gap-1 sm:grid-cols-5 lg:hidden" aria-label="Navigation mobile du prototype">{NAV_ITEMS.map((item) => <button key={item} type="button" onClick={() => onNavigate(item)} className={`min-h-11 rounded px-2 text-sm font-bold ${activeNav === item ? "bg-white text-green-900" : "text-white hover:bg-green-700"}`}>{item}</button>)}</nav><div className="grid grid-cols-1 gap-1 border-t border-green-700 pt-2 lg:ml-auto lg:max-w-xs lg:border-0 lg:pt-0">{MENU_ITEMS.map((item) => { const Icon = item.icon; return <button key={item.label} type="button" onClick={() => { onMobileMenu(false); onSimulate(`${item.label} · interaction simulée`); }} className="flex min-h-11 items-center gap-3 rounded px-3 text-left text-sm font-bold text-white hover:bg-green-700"><Icon size={19} />{item.label}</button>; })}</div></div>}
  </header>;
}

function NewsSection({ onSimulate }: { onSimulate: (message: string) => void }) {
  return <section aria-labelledby="news-title"><div className="mb-2 flex items-center justify-between"><h2 id="news-title" className="text-lg font-black">Actualités</h2><span className="text-xs font-bold text-slate-500">4 à regarder</span></div><div className="grid gap-1.5 lg:grid-cols-2">{NEWS.map((item) => { const Icon = item.icon; return <article key={item.id} className={`flex min-h-14 items-center gap-2 rounded-md border-l-4 px-2.5 py-1.5 shadow-sm ${NEWS_TONES[item.tone]}`}><Icon size={18} className="shrink-0" /><span className="min-w-0 flex-1"><strong className="block text-sm font-black leading-4">{item.title}</strong><span className="block truncate text-xs opacity-75">{item.info}</span></span><button type="button" onClick={() => onSimulate(`${item.action} · interaction simulée`)} className="min-h-11 shrink-0 rounded-md bg-slate-950 px-3 text-xs font-black text-white">{item.action}</button></article>; })}</div></section>;
}

function ReorderableGrid({ scope, items, editing, onEditing, onReorder, onAction, onRemove, prominent = false, layout = "grid" }: {
  scope: string; items: PrototypeAction[]; editing: boolean; onEditing: () => void;
  onReorder: (items: PrototypeAction[]) => void; onAction: (action: PrototypeAction) => void;
  onRemove?: (action: PrototypeAction) => void; prominent?: boolean; layout?: "grid" | "list";
}) {
  const draggedId = useRef<string | null>(null);
  const activePointerId = useRef<number | null>(null);
  const cardNodes = useRef(new Map<string, HTMLDivElement>());
  const previousRects = useRef(new Map<string, DOMRect>());
  const itemsRef = useRef(items);
  const onReorderRef = useRef(onReorder);
  const scrollContainer = useRef<HTMLElement | null>(null);
  const scrollStep = useRef(0);
  const scrollFrame = useRef<number | null>(null);
  const lastPointer = useRef({ x: 0, y: 0 });
  const moveDragRef = useRef<(x: number, y: number) => void>(() => {});
  const finishDragRef = useRef<(commit: boolean) => void>(() => {});
  const [draftItems, setDraftItems] = useState<PrototypeAction[] | null>(null);
  const [preview, setPreview] = useState<{
    action: PrototypeAction; x: number; y: number; offsetX: number; offsetY: number;
    width: number; height: number;
  } | null>(null);
  const renderedItems = draftItems ?? items;

  if (!draggedId.current) itemsRef.current = items;
  onReorderRef.current = onReorder;

  useLayoutEffect(() => {
    for (const [id, node] of cardNodes.current) {
      const previous = previousRects.current.get(id);
      if (!previous) continue;
      const current = node.getBoundingClientRect();
      const x = previous.left - current.left;
      const y = previous.top - current.top;
      if (x || y) {
        node.animate(
          [{ transform: `translate(${x}px, ${y}px)` }, { transform: "translate(0, 0)" }],
          { duration: 180, easing: "ease-out" }
        );
      }
    }
    previousRects.current.clear();
  }, [renderedItems]);

  useEffect(() => {
    function pointerMove(event: PointerEvent) {
      if (event.pointerId === activePointerId.current) moveDragRef.current(event.clientX, event.clientY);
    }
    function pointerUp(event: PointerEvent) {
      if (event.pointerId === activePointerId.current) finishDragRef.current(true);
    }
    function pointerCancel(event: PointerEvent) {
      if (event.pointerId === activePointerId.current) finishDragRef.current(false);
    }
    document.addEventListener("pointermove", pointerMove);
    document.addEventListener("pointerup", pointerUp);
    document.addEventListener("pointercancel", pointerCancel);
    return () => {
      document.removeEventListener("pointermove", pointerMove);
      document.removeEventListener("pointerup", pointerUp);
      document.removeEventListener("pointercancel", pointerCancel);
      if (scrollFrame.current !== null) window.cancelAnimationFrame(scrollFrame.current);
    };
  }, []);

  function rememberPositions() {
    previousRects.current = new Map(
      [...cardNodes.current].map(([id, node]) => [id, node.getBoundingClientRect()])
    );
  }

  function startDrag(action: PrototypeAction, event: ReactPointerEvent<HTMLButtonElement>) {
    const card = cardNodes.current.get(action.id);
    if (!card) return;
    const rect = card.getBoundingClientRect();
    draggedId.current = action.id;
    activePointerId.current = event.pointerId;
    itemsRef.current = items;
    setDraftItems(items);
    scrollContainer.current = findScrollContainer(card);
    lastPointer.current = { x: event.clientX, y: event.clientY };
    setPreview({
      action, x: event.clientX, y: event.clientY,
      offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top,
      width: rect.width, height: rect.height,
    });
  }

  function updateTarget(clientX: number, clientY: number) {
    if (!draggedId.current) return;
    const target = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-reorder-id]");
    if (!target || target.dataset.reorderScope !== scope || !target.dataset.reorderId || target.dataset.reorderId === draggedId.current) return;
    rememberPositions();
    const next = reorderActions(itemsRef.current, draggedId.current, target.dataset.reorderId);
    if (next === itemsRef.current) return;
    itemsRef.current = next;
    setDraftItems(next);
  }

  function runAutoScroll() {
    if (scrollFrame.current !== null || scrollStep.current === 0) return;
    function tick() {
      const container = scrollContainer.current;
      if (!container || scrollStep.current === 0 || !draggedId.current) {
        scrollFrame.current = null;
        return;
      }
      const previousTop = container.scrollTop;
      container.scrollTop += scrollStep.current;
      if (container.scrollTop !== previousTop) updateTarget(lastPointer.current.x, lastPointer.current.y);
      scrollFrame.current = window.requestAnimationFrame(tick);
    }
    scrollFrame.current = window.requestAnimationFrame(tick);
  }

  moveDragRef.current = (clientX, clientY) => {
    if (!draggedId.current) return;
    lastPointer.current = { x: clientX, y: clientY };
    setPreview((current) => current ? { ...current, x: clientX, y: clientY } : current);
    updateTarget(clientX, clientY);
    const container = scrollContainer.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      scrollStep.current = getSortableAutoScrollDelta(clientY, rect.top, rect.bottom);
      runAutoScroll();
    }
  };

  finishDragRef.current = (commit) => {
    if (!draggedId.current) return;
    const finalItems = itemsRef.current;
    draggedId.current = null;
    activePointerId.current = null;
    scrollStep.current = 0;
    if (scrollFrame.current !== null) window.cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = null;
    scrollContainer.current = null;
    setPreview(null);
    setDraftItems(null);
    if (commit) onReorderRef.current(finalItems);
  };

  function moveWithKeyboard(actionId: string, direction: -1 | 1) {
    const index = renderedItems.findIndex((item) => item.id === actionId);
    const target = renderedItems[index + direction];
    if (!target) return;
    rememberPositions();
    onReorder(reorderActions(renderedItems, actionId, target.id));
  }

  return <div data-reorder-layout={layout} className={`mt-2 gap-2 ${layout === "list" ? "flex flex-col" : `grid ${prominent ? "grid-cols-3" : "grid-cols-2 rounded-md bg-white p-2 shadow-sm sm:grid-cols-3 lg:grid-cols-5"}`}`}>
    {renderedItems.map((action) => <div key={action.id} ref={(node) => { if (node) cardNodes.current.set(action.id, node); else cardNodes.current.delete(action.id); }} data-reorder-id={action.id} data-reorder-scope={scope} className={`relative min-w-0 rounded-md ${preview?.action.id === action.id ? "outline-2 outline-dashed outline-slate-500" : ""}`}>
      <div className={preview?.action.id === action.id ? "opacity-20" : "opacity-100"}>
        <ActionButton action={action} onClick={() => onAction(action)} onLongPress={onEditing} disabled={editing} prominent={prominent} extraEditingSpace={Boolean(onRemove)} layout={layout} />
      </div>
      {editing && onRemove && <button type="button" disabled={renderedItems.length === 1} onClick={() => onRemove(action)} className="absolute bottom-2 right-14 z-10 flex h-11 w-11 items-center justify-center rounded-md border border-red-200 bg-white text-red-700 shadow disabled:opacity-30" aria-label={`Retirer ${action.label}`}><Trash2 size={18} /></button>}
      {editing && <button type="button" onPointerDown={(event) => startDrag(action, event)} onKeyDown={(event) => { if (event.key === "ArrowLeft" || event.key === "ArrowUp") { event.preventDefault(); moveWithKeyboard(action.id, -1); } if (event.key === "ArrowRight" || event.key === "ArrowDown") { event.preventDefault(); moveWithKeyboard(action.id, 1); } }} className="absolute inset-y-2 right-2 flex w-11 touch-none items-center justify-center rounded-md border-2 border-slate-400 bg-white text-slate-800 shadow" aria-label={`Déplacer ${action.label}`}><GripVertical size={23} /></button>}
    </div>)}
    {preview && <div aria-hidden="true" className="pointer-events-none fixed z-[90] scale-[1.02] opacity-95 shadow-2xl" style={{ left: preview.x - preview.offsetX, top: preview.y - preview.offsetY, width: preview.width, height: preview.height }}><ActionSurface action={preview.action} prominent={prominent} floating layout={layout} /></div>}
  </div>;
}

function findScrollContainer(element: HTMLElement): HTMLElement | null {
  let current = element.parentElement;
  while (current) {
    const overflowY = window.getComputedStyle(current).overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && current.scrollHeight > current.clientHeight) return current;
    current = current.parentElement;
  }
  return null;
}

function ActionButton({ action, onClick, onLongPress, disabled, prominent = false, extraEditingSpace = false, layout = "grid" }: {
  action: PrototypeAction; onClick: () => void; onLongPress: () => void; disabled: boolean;
  prominent?: boolean; extraEditingSpace?: boolean; layout?: "grid" | "list";
}) {
  const timer = useRef<number | null>(null);
  const start = useRef({ x: 0, y: 0 });
  const suppressClick = useRef(false);
  function clearTimer() { if (timer.current) window.clearTimeout(timer.current); timer.current = null; }
  function pointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (disabled) return;
    start.current = { x: event.clientX, y: event.clientY };
    suppressClick.current = false;
    timer.current = window.setTimeout(() => { suppressClick.current = true; onLongPress(); }, 550);
  }
  function pointerMove(event: ReactPointerEvent<HTMLButtonElement>) { if (Math.abs(event.clientX - start.current.x) > 8 || Math.abs(event.clientY - start.current.y) > 8) clearTimer(); }
  function click() { clearTimer(); if (suppressClick.current || disabled) { suppressClick.current = false; return; } onClick(); }
  return <button type="button" disabled={disabled} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={clearTimer} onPointerCancel={clearTimer} onClick={click} className="w-full"><ActionSurface action={action} prominent={prominent} editing={disabled} extraEditingSpace={extraEditingSpace} layout={layout} /></button>;
}

function ActionSurface({ action, prominent = false, editing = false, floating = false, extraEditingSpace = false, layout = "grid" }: { action: PrototypeAction; prominent?: boolean; editing?: boolean; floating?: boolean; extraEditingSpace?: boolean; layout?: "grid" | "list" }) {
  const Icon = ICONS[action.icon] ?? ChevronRight;
  const list = layout === "list";
  return <span className={`flex w-full select-none items-center gap-2 rounded-md px-2.5 text-left font-black ring-1 ${list ? `min-h-16 border-l-4 bg-white text-slate-950 ring-slate-200 ${ACTION_LIST_ACCENTS[action.tone]}` : `min-h-16 ${ACTION_TONES[action.tone]}`} ${prominent ? "min-h-20 flex-col justify-center text-center" : ""} ${editing ? `${extraEditingSpace ? "pr-28" : "pr-14"} ${list ? "" : "ring-2 ring-amber-400"}` : ""} ${floating ? "h-full" : "shadow-sm"}`}><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${list ? ACTION_TONES[action.tone] : "bg-white/80"}`}><Icon size={21} strokeWidth={2.5} /></span><span className="min-w-0 text-sm leading-4">{action.label}</span></span>;
}

function FavoritesEditor({ favorites, onChange, onClose, onAction }: { favorites: PrototypeAction[]; onChange: (items: PrototypeAction[]) => void; onClose: () => void; onAction: (action: PrototypeAction) => void }) {
  const [filter, setFilter] = useState<PrototypeCategory["id"]>("reproduction");
  const selectedIds = new Set(favorites.map((item) => item.id));
  const available = ALL_PROTOTYPE_ACTIONS.filter((action) => action.category === filter && !selectedIds.has(action.id));
  const remainingSlots = MAX_FAVORITES - favorites.length;

  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 sm:items-center sm:p-4" onMouseDown={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="favorites-title" onMouseDown={(event) => event.stopPropagation()} className="flex max-h-[94vh] w-full max-w-2xl flex-col rounded-t-lg bg-white shadow-2xl sm:rounded-lg">
      <div className="flex items-start justify-between border-b border-slate-200 p-4"><div><h2 id="favorites-title" className="text-lg font-black">Modifier les actions rapides</h2><p className="text-sm text-slate-500">{favorites.length}/{MAX_FAVORITES} sélectionnées{remainingSlots > 0 ? ` · ${remainingSlots} place${remainingSlots > 1 ? "s" : ""} restante${remainingSlots > 1 ? "s" : ""}` : ""}</p></div><button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-md" aria-label="Fermer"><X /></button></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-6">
        <h3 className="text-sm font-black">Actions sélectionnées</h3>
        <ReorderableGrid scope="favorites-editor" items={favorites} editing onEditing={() => {}} onReorder={onChange} onAction={onAction} onRemove={(action) => onChange(removeFavorite(favorites, action.id))} layout="list" />

        <div className="mt-6 flex items-center justify-between gap-3"><h3 className="text-sm font-black">Actions disponibles</h3><span className="text-xs font-bold text-slate-500">Maximum {MAX_FAVORITES}</span></div>
        {remainingSlots === 0 && <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm font-bold text-amber-950">Retirez une action pour en ajouter une autre</p>}
        <div className="mt-2 grid grid-cols-2 gap-1 rounded-md bg-slate-100 p-1 sm:grid-cols-4" role="tablist" aria-label="Filtrer les actions disponibles">{PROTOTYPE_CATEGORIES.map((item) => <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} onClick={() => setFilter(item.id)} className={`min-h-11 rounded px-2 text-sm font-bold ${filter === item.id ? "bg-white shadow" : "text-slate-600"}`}>{item.label}</button>)}</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">{available.map((action) => <div key={action.id} className="flex min-h-14 items-center gap-2 rounded-md border border-slate-200 p-2"><div className="min-w-0 flex-1"><ActionSurface action={action} /></div><button type="button" disabled={favorites.length >= MAX_FAVORITES} onClick={() => onChange(addFavorite(favorites, action))} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-green-800 text-white disabled:bg-slate-300" aria-label={`Ajouter ${action.label}`}><Plus size={20} /></button></div>)}</div>
        {available.length === 0 && <p className="mt-3 rounded-md bg-slate-50 p-3 text-center text-sm text-slate-500">Toutes les actions de cette rubrique sont déjà sélectionnées.</p>}
      </div>
      <div className="sticky bottom-0 border-t border-slate-200 bg-white p-3"><button type="button" onClick={onClose} className="min-h-12 w-full rounded-md bg-green-800 px-4 text-sm font-black text-white">Terminer</button></div>
    </section>
  </div>;
}

function ExitDialog({ onClose, onSelect }: { onClose: () => void; onSelect: (reason: string) => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-4" onMouseDown={onClose}><section role="dialog" aria-modal="true" aria-labelledby="exit-title" onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-md rounded-t-lg bg-white p-4 shadow-2xl sm:rounded-lg"><div className="flex items-center justify-between"><div><h2 id="exit-title" className="text-lg font-black">Sortir un animal</h2><p className="text-xs text-slate-500">Simulation des motifs issus de SINal</p></div><button type="button" onClick={onClose} className="p-2" aria-label="Fermer"><X /></button></div><div className="mt-4 space-y-2">{PROTOTYPE_EXIT_REASONS.map((reason) => <button key={reason} type="button" onClick={() => onSelect(reason)} className="flex min-h-12 w-full items-center rounded-md border border-slate-200 px-3 text-left text-sm font-bold hover:bg-slate-50">{reason}</button>)}</div></section></div>;
}
