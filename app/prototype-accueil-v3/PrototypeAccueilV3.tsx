"use client";

import Image from "next/image";
import {
  Baby, BellRing, ChevronDown, ChevronRight, ClipboardCheck, Dna, GripVertical,
  HeartHandshake, HeartPulse, LayoutGrid, LogOut, Menu, Pill, Plus, Scale,
  ScanLine, Scissors, Search, Settings, Stethoscope, Tag, Thermometer, Users, X,
} from "lucide-react";
import {
  useMemo, useRef, useState, type ComponentType, type PointerEvent as ReactPointerEvent,
} from "react";
import HoofPrintIcon from "@/components/HoofPrintIcon";
import {
  DEFAULT_FAVORITES, PROTOTYPE_CATEGORIES, PROTOTYPE_EXIT_REASONS,
  filterPrototypeAnimals, reorderActions,
  type PrototypeAction, type PrototypeCategory,
} from "./prototype-data";

type IconType = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
type CategoryActions = Record<PrototypeCategory["id"], PrototypeAction[]>;

const ICONS: Record<string, IconType> = {
  chaleur: Thermometer, saillie: HeartPulse, "nouvel-evenement": Stethoscope,
  parage: HoofPrintIcon, "pesee-rapide": Scale, echographie: ClipboardCheck,
  velage: Baby, pharmacie: Pill, "scanner-ordonnance": ScanLine,
  identification: Tag, sevrage: Scissors, genealogie: Dna, "ajouter-animal": Plus,
  "sortir-animal": LogOut, "seances-pesee": LayoutGrid,
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

const FAVORITE_TONES = [
  "bg-rose-50 text-rose-900 ring-rose-200", "bg-fuchsia-50 text-fuchsia-900 ring-fuchsia-200",
  "bg-blue-50 text-blue-950 ring-blue-200", "bg-amber-50 text-amber-950 ring-amber-200",
  "bg-green-50 text-green-950 ring-green-300",
];

const NAV_ITEMS = ["Accueil", "Troupeau", "Reproduction", "Sanitaire", "Finances"];
function initialCategoryActions(): CategoryActions {
  return Object.fromEntries(PROTOTYPE_CATEGORIES.map((item) => [item.id, item.actions])) as CategoryActions;
}

export default function PrototypeAccueilV3() {
  const [activeNav, setActiveNav] = useState("Accueil");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [openNews, setOpenNews] = useState<string | null>("session");
  const [category, setCategory] = useState<PrototypeCategory["id"]>("reproduction");
  const [categoryActions, setCategoryActions] = useState(initialCategoryActions);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [ordering, setOrdering] = useState(false);
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

      <main className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-5 sm:py-7">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase text-green-800">Prototype accueil V3</p>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">Bonjour Céline</h1>
            <p className="mt-1 text-sm text-slate-600">Vendredi 1 août · l’essentiel de l’élevage</p>
          </div>
          <span className="hidden rounded-md bg-white px-3 py-2 text-xs font-bold text-slate-500 shadow-sm sm:block">Données de démonstration</span>
        </div>

        <NewsSection openNews={openNews} onOpen={setOpenNews} onSimulate={simulate} />

        <section className="mt-7" aria-labelledby="daily-title">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div><h2 id="daily-title" className="text-lg font-black">Actions quotidiennes</h2><p className="text-xs text-slate-500">Toujours à portée de main</p></div>
            <button type="button" onClick={() => setOrdering((active) => !active)} className={`min-h-10 rounded-md px-3 text-sm font-bold ${ordering ? "bg-slate-950 text-white" : "text-green-800 hover:bg-white"}`}>{ordering ? "Terminer" : "Modifier l’ordre"}</button>
          </div>
          <ReorderableGrid scope="favorites" items={favorites} editing={ordering} onEditing={() => setOrdering(true)} onReorder={setFavorites} onAction={activateAction} prominent />
        </section>

        <section className="mt-7" aria-labelledby="other-title">
          <div className="flex items-center justify-between gap-3"><h2 id="other-title" className="text-lg font-black">Autres actions</h2>{ordering && <span className="rounded bg-amber-100 px-2 py-1 text-xs font-black text-amber-950">Modifier l’ordre</span>}</div>
          <div className="mt-2 flex gap-1 overflow-x-auto rounded-md bg-slate-200 p-1" role="tablist" aria-label="Catégories d’actions">
            {PROTOTYPE_CATEGORIES.map((item) => <button key={item.id} type="button" role="tab" aria-selected={category === item.id} onClick={() => setCategory(item.id)} className={`min-h-10 shrink-0 flex-1 rounded px-3 text-sm font-bold ${category === item.id ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`}>{item.label}</button>)}
          </div>
          <div aria-label={`Actions ${activeCategory.label}`}>
            <ReorderableGrid scope={`category-${category}`} items={categoryActions[category]} editing={ordering} onEditing={() => setOrdering(true)} onReorder={(items) => setCategoryActions((current) => ({ ...current, [category]: items }))} onAction={activateAction} />
          </div>
        </section>

        <section className="mt-7 overflow-hidden rounded-md bg-white shadow-sm">
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
    <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-3 sm:px-5">
      <button type="button" onClick={() => onNavigate("Accueil")} className="flex shrink-0 items-center gap-2" aria-label="Accueil du prototype"><Image src="/logo-cesam.jpg" alt="CESAM" width={38} height={38} className="rounded-md border border-white/40" /><span className="hidden text-sm font-black sm:block">CESAM</span></button>
      <nav className="hidden items-stretch self-stretch lg:flex" aria-label="Navigation du prototype">{NAV_ITEMS.map((item) => <button key={item} type="button" onClick={() => onNavigate(item)} className={`px-3 text-sm font-bold ${activeNav === item ? "bg-white text-green-900" : "text-green-50 hover:bg-green-700"}`}>{item}</button>)}</nav>
      <div className="relative ml-auto min-w-0 flex-1 sm:max-w-xs">
        <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input value={query} onFocus={() => onSearchOpen(true)} onChange={(event) => { onQuery(event.target.value); onSearchOpen(true); }} placeholder="Rechercher un animal" aria-label="Rechercher rapidement un animal" className="h-11 w-full rounded-md bg-white pl-9 pr-3 text-sm font-semibold text-slate-950 outline-none ring-2 ring-transparent focus:ring-amber-400" />
        {searchOpen && <div className="absolute right-0 top-12 w-full min-w-64 overflow-hidden rounded-md border border-slate-200 bg-white text-slate-950 shadow-xl"><div className="flex items-center justify-between border-b px-3 py-2 text-xs font-bold text-slate-500">Animaux fictifs<button type="button" onClick={() => onSearchOpen(false)} aria-label="Fermer la recherche" className="p-1"><X size={15} /></button></div>{animals.map((animal) => <button key={animal.number} type="button" onClick={() => { onSearchOpen(false); onSimulate(`Fiche ${animal.number} · consultation simulée`); }} className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-slate-100 px-3 text-left last:border-0 hover:bg-green-50"><span><strong className="font-black">{animal.number}</strong><span className="ml-2 text-sm">{animal.name}</span></span><span className="text-xs text-slate-500">{animal.detail}</span></button>)}{animals.length === 0 && <p className="p-4 text-center text-sm text-slate-500">Aucun résultat fictif</p>}</div>}
      </div>
      <button type="button" onClick={() => onSimulate("Paramètres · interaction simulée")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-green-700" aria-label="Paramètres"><Settings size={22} /></button>
      <button type="button" onClick={() => onMobileMenu(!mobileMenu)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-green-700 lg:hidden" aria-label={mobileMenu ? "Fermer le menu" : "Ouvrir le menu"}>{mobileMenu ? <X /> : <Menu />}</button>
    </div>
    {mobileMenu && <nav className="grid grid-cols-2 gap-px border-t border-green-700 bg-green-700 px-3 py-2 sm:grid-cols-5" aria-label="Navigation mobile du prototype">{NAV_ITEMS.map((item) => <button key={item} type="button" onClick={() => onNavigate(item)} className={`min-h-11 px-2 text-sm font-bold ${activeNav === item ? "bg-white text-green-900" : "text-white"}`}>{item}</button>)}</nav>}
  </header>;
}

function NewsSection({ openNews, onOpen, onSimulate }: { openNews: string | null; onOpen: (id: string | null) => void; onSimulate: (message: string) => void }) {
  return <section aria-labelledby="news-title"><div className="mb-2 flex items-center justify-between"><h2 id="news-title" className="text-lg font-black">Actualités</h2><span className="text-xs font-bold text-slate-500">4 à regarder</span></div><div className="grid gap-2 lg:grid-cols-2">{NEWS.map((item) => { const Icon = item.icon; const open = openNews === item.id; return <article key={item.id} className={`overflow-hidden rounded-md border-l-4 shadow-sm ${NEWS_TONES[item.tone]}`}><button type="button" onClick={() => onOpen(open ? null : item.id)} className="flex min-h-16 w-full items-center gap-3 px-3 text-left" aria-expanded={open}><Icon size={22} className="shrink-0" /><span className="min-w-0 flex-1"><strong className="block text-sm font-black">{item.title}</strong><span className="block truncate text-xs opacity-75">{item.info}</span></span><ChevronDown size={19} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} /></button>{open && <div className="flex items-center justify-between gap-3 border-t border-black/10 bg-white/60 px-3 py-2"><p className="text-xs font-semibold">Situation fictive détectée.</p><button type="button" onClick={() => onSimulate(`${item.action} · interaction simulée`)} className="min-h-10 rounded-md bg-slate-950 px-4 text-sm font-black text-white">{item.action}</button></div>}</article>; })}</div></section>;
}

function ReorderableGrid({ scope, items, editing, onEditing, onReorder, onAction, prominent = false }: {
  scope: string; items: PrototypeAction[]; editing: boolean; onEditing: () => void;
  onReorder: (items: PrototypeAction[]) => void; onAction: (action: PrototypeAction) => void; prominent?: boolean;
}) {
  const draggedId = useRef<string | null>(null);
  function startDrag(id: string, event: ReactPointerEvent<HTMLButtonElement>) { draggedId.current = id; event.currentTarget.setPointerCapture(event.pointerId); }
  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!draggedId.current) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-reorder-id]");
    if (!target || target.dataset.reorderScope !== scope || !target.dataset.reorderId) return;
    onReorder(reorderActions(items, draggedId.current, target.dataset.reorderId));
  }
  function stopDrag() { draggedId.current = null; }

  return <div className={`mt-2 grid grid-cols-2 gap-2 ${prominent ? "sm:grid-cols-5" : "rounded-md bg-white p-2 shadow-sm sm:grid-cols-3 lg:grid-cols-5"}`}>
    {items.map((action, index) => <div key={action.id} data-reorder-id={action.id} data-reorder-scope={scope} className="relative min-w-0">
      <ActionButton action={action} onClick={() => onAction(action)} onLongPress={onEditing} disabled={editing} tone={prominent ? FAVORITE_TONES[index] : undefined} prominent={prominent} />
      {editing && <button type="button" onPointerDown={(event) => startDrag(action.id, event)} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag} className="absolute inset-y-2 right-2 flex w-11 touch-none items-center justify-center rounded-md border-2 border-slate-400 bg-white text-slate-800 shadow" aria-label={`Déplacer ${action.label}`}><GripVertical size={23} /></button>}
    </div>)}
  </div>;
}

function ActionButton({ action, onClick, onLongPress, disabled, tone = "bg-white text-slate-900 ring-slate-200", prominent = false }: {
  action: PrototypeAction; onClick: () => void; onLongPress: () => void; disabled: boolean; tone?: string; prominent?: boolean;
}) {
  const Icon = ICONS[action.id] ?? ChevronRight;
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
  return <button type="button" disabled={disabled} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={clearTimer} onPointerCancel={clearTimer} onClick={click} className={`flex min-h-20 w-full select-none items-center gap-3 rounded-md px-3 text-left font-black shadow-sm ring-1 ${tone} ${prominent ? "sm:min-h-24 sm:flex-col sm:justify-center sm:text-center" : "hover:bg-slate-50"} ${disabled ? "pr-14 ring-2 ring-amber-400" : ""}`}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/80"><Icon size={22} strokeWidth={2.5} /></span><span className="min-w-0 text-sm leading-5">{action.label}</span></button>;
}

function ExitDialog({ onClose, onSelect }: { onClose: () => void; onSelect: (reason: string) => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-4" onMouseDown={onClose}><section role="dialog" aria-modal="true" aria-labelledby="exit-title" onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-md rounded-t-lg bg-white p-4 shadow-2xl sm:rounded-lg"><div className="flex items-center justify-between"><div><h2 id="exit-title" className="text-lg font-black">Sortir un animal</h2><p className="text-xs text-slate-500">Simulation des motifs issus de SINal</p></div><button type="button" onClick={onClose} className="p-2" aria-label="Fermer"><X /></button></div><div className="mt-4 space-y-2">{PROTOTYPE_EXIT_REASONS.map((reason) => <button key={reason} type="button" onClick={() => onSelect(reason)} className="flex min-h-12 w-full items-center rounded-md border border-slate-200 px-3 text-left text-sm font-bold hover:bg-slate-50">{reason}</button>)}</div></section></div>;
}
