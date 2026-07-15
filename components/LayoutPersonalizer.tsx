"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Eye, EyeOff, GripVertical, LayoutDashboard, RotateCcw, X } from "lucide-react";
import { useUserPreferences } from "@/components/UserPreferencesProvider";

type Density = "compacte" | "confortable";
type SectionPreference = { id: string; label: string; visible: boolean };
type LayoutPreference = { density: Density; sections: SectionPreference[] };

const MODULES: { test: (path: string) => boolean; id: string; label: string }[] = [
  { test: (path) => path === "/", id: "accueil", label: "Accueil" },
  { test: (path) => path === "/troupeau", id: "troupeau", label: "Troupeau — Tous" },
  { test: (path) => path === "/reproduction", id: "reproduction", label: "Troupeau — Reproduction" },
  { test: (path) => path === "/velage", id: "velage", label: "Troupeau — Vêlage" },
  { test: (path) => path === "/sanitaire", id: "sanitaire", label: "Sanitaire" },
  { test: (path) => path === "/pharmacie", id: "pharmacie", label: "Pharmacie" },
  { test: (path) => path === "/finances", id: "finances", label: "Finances" },
];

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function storageKey(profile: string, moduleId: string) {
  return `cesam:layout:${profile}:${moduleId}`;
}

export default function LayoutPersonalizer() {
  const pathname = usePathname();
  const { profile, ready } = useUserPreferences();
  const moduleInfo = MODULES.find((item) => item.test(pathname));
  const [editing, setEditing] = useState(false);
  const [sections, setSections] = useState<SectionPreference[]>([]);
  const [density, setDensity] = useState<Density>("confortable");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const defaultOrder = useRef<SectionPreference[]>([]);
  const rootRef = useRef<HTMLElement | null>(null);

  const discover = useCallback(() => {
    const main = document.querySelector("main");
    const root = main?.querySelector(":scope > div") as HTMLElement | null;
    if (!root) return [] as SectionPreference[];
    rootRef.current = root;

    const used = new Set<string>();
    const result: SectionPreference[] = [];
    Array.from(root.children).forEach((child, index) => {
      const element = child as HTMLElement;
      if (element.matches("nav,[data-layout-fixed]")) return;
      const heading = element.querySelector("h2,h3");
      if (!heading) return;
      const label = heading.textContent?.trim().replace(/\s+/g, " ") || `Section ${index + 1}`;
      let id = element.dataset.layoutSection || slug(label) || `section-${index + 1}`;
      let suffix = 2;
      while (used.has(id)) id = `${slug(label)}-${suffix++}`;
      used.add(id);
      element.dataset.layoutSection = id;
      element.dataset.layoutLabel = label;
      result.push({ id, label, visible: true });
    });
    return result;
  }, []);

  const apply = useCallback((preference: LayoutPreference, editMode: boolean) => {
    const root = rootRef.current;
    if (!root) return;
    root.classList.toggle("cesam-density-compact", preference.density === "compacte");
    root.classList.toggle("cesam-layout-editing", editMode);

    const elements = new Map<string, HTMLElement>();
    root.querySelectorAll<HTMLElement>(":scope > [data-layout-section]").forEach((element) => {
      elements.set(element.dataset.layoutSection!, element);
    });

    const first = Array.from(root.children).find((child) => (child as HTMLElement).dataset.layoutSection);
    if (first) {
      const marker = document.createComment("cesam-layout-anchor");
      root.insertBefore(marker, first);
      let cursor: ChildNode = marker;
      preference.sections.forEach((section) => {
        const element = elements.get(section.id);
        if (!element) return;
        root.insertBefore(element, cursor.nextSibling);
        cursor = element;
      });
      marker.remove();
    }

    preference.sections.forEach((section) => {
      const element = elements.get(section.id);
      if (!element) return;
      element.hidden = editMode ? false : !section.visible;
      element.classList.toggle("cesam-section-hidden-draft", editMode && !section.visible);
    });
  }, []);

  useEffect(() => {
    if (!moduleInfo || !ready) return;
    const timer = window.setTimeout(() => {
      const found = discover();
      defaultOrder.current = found;
      const raw = localStorage.getItem(storageKey(profile, moduleInfo.id));
      let saved: LayoutPreference | null = null;
      try { saved = raw ? JSON.parse(raw) as LayoutPreference : null; } catch { saved = null; }

      const savedMap = new Map(saved?.sections.map((section) => [section.id, section]));
      const ordered = [
        ...(saved?.sections ?? []).filter((section) => found.some((item) => item.id === section.id)),
        ...found.filter((section) => !savedMap.has(section.id)),
      ].map((section) => ({ ...section, visible: savedMap.get(section.id)?.visible ?? true }));

      const next = { density: saved?.density ?? "confortable", sections: ordered };
      setSections(next.sections);
      setDensity(next.density);
      apply(next, false);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [apply, discover, moduleInfo?.id, profile, ready]);

  if (!moduleInfo || !ready) return null;

  function currentPreference(): LayoutPreference {
    return { density, sections };
  }

  function openEditor() {
    const found = discover();
    if (sections.length === 0) setSections(found);
    setEditing(true);
    window.setTimeout(() => apply({ density, sections: sections.length ? sections : found }, true), 0);
  }

  function updateSections(next: SectionPreference[]) {
    setSections(next);
    window.setTimeout(() => apply({ density, sections: next }, true), 0);
  }

  function save() {
    localStorage.setItem(storageKey(profile, moduleInfo.id), JSON.stringify(currentPreference()));
    apply(currentPreference(), false);
    setEditing(false);
  }

  function cancel() {
    const raw = localStorage.getItem(storageKey(profile, moduleInfo.id));
    const saved = raw ? JSON.parse(raw) as LayoutPreference : { density: "confortable" as Density, sections: defaultOrder.current };
    setSections(saved.sections);
    setDensity(saved.density);
    apply(saved, false);
    setEditing(false);
  }

  function restoreDefault() {
    const restored = defaultOrder.current.map((section) => ({ ...section, visible: true }));
    setSections(restored);
    setDensity("confortable");
    window.setTimeout(() => apply({ density: "confortable", sections: restored }, true), 0);
  }

  function moveBefore(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    const next = [...sections];
    const from = next.findIndex((item) => item.id === draggedId);
    const to = next.findIndex((item) => item.id === targetId);
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    updateSections(next);
    setDraggedId(null);
  }

  return (
    <>
      {!editing && sections.length > 0 && (
        <button
          type="button"
          onClick={openEditor}
          className="print:hidden fixed right-3 top-[118px] z-20 inline-flex min-h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 shadow-lg hover:bg-gray-50"
        >
          <LayoutDashboard size={16} />
          <span className="hidden sm:inline">Modifier la mise en page</span>
        </button>
      )}

      {editing && (
        <aside className="print:hidden fixed inset-x-2 bottom-2 z-[70] mx-auto max-h-[72vh] max-w-lg overflow-y-auto rounded-2xl border border-green-200 bg-white p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-gray-900">Modifier la mise en page</h2>
              <p className="text-xs text-gray-500">{moduleInfo.label} · Profil {profile}</p>
            </div>
            <button type="button" onClick={cancel} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100" aria-label="Annuler">
              <X size={18} />
            </button>
          </div>

          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Densité</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["compacte", "confortable"] as Density[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setDensity(option);
                    apply({ density: option, sections }, true);
                  }}
                  className={`min-h-10 rounded-xl border text-sm font-bold capitalize ${
                    density === option ? "border-green-700 bg-green-50 text-green-800" : "border-gray-200 text-gray-600"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Sections</p>
            <p className="mt-1 text-xs text-gray-400">Faites glisser les lignes pour modifier leur ordre.</p>
            <div className="mt-2 space-y-2">
              {sections.map((section) => (
                <div
                  key={section.id}
                  draggable
                  onDragStart={() => setDraggedId(section.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => moveBefore(section.id)}
                  className={`flex min-h-11 items-center gap-2 rounded-xl border px-2 ${
                    section.visible ? "border-gray-200 bg-white" : "border-gray-200 bg-gray-100 text-gray-400"
                  }`}
                >
                  <GripVertical size={18} className="cursor-grab text-gray-400" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{section.label}</span>
                  <button
                    type="button"
                    onClick={() => updateSections(sections.map((item) => item.id === section.id ? { ...item, visible: !item.visible } : item))}
                    className="rounded-lg p-2 hover:bg-gray-100"
                    aria-label={section.visible ? "Masquer cette section" : "Réafficher cette section"}
                  >
                    {section.visible ? <Eye size={17} /> : <EyeOff size={17} />}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
            <button type="button" onClick={restoreDefault} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-300 px-3 text-sm font-semibold text-gray-700">
              <RotateCcw size={16} />
              Restaurer par défaut
            </button>
            <button type="button" onClick={cancel} className="min-h-11 rounded-xl border border-gray-300 px-4 text-sm font-semibold text-gray-700">
              Annuler
            </button>
            <button type="button" onClick={save} className="ml-auto min-h-11 rounded-xl bg-green-700 px-4 text-sm font-bold text-white">
              Enregistrer
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
