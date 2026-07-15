"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Eye, EyeOff, GripVertical, LayoutDashboard, RotateCcw, X } from "lucide-react";
import { useUserPreferences } from "@/components/UserPreferencesProvider";

type SectionPreference = { id: string; label: string; visible: boolean };

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

export default function LayoutPersonalizer() {
  const pathname = usePathname();
  const { profile, ready } = useUserPreferences();
  const moduleInfo = MODULES.find((item) => item.test(pathname));
  const [editing, setEditing] = useState(false);
  const [sections, setSections] = useState<SectionPreference[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const defaultOrder = useRef<SectionPreference[]>([]);
  const savedPreference = useRef<SectionPreference[]>([]);
  const rootRef = useRef<HTMLElement | null>(null);

  const discover = useCallback(() => {
    const root = document.querySelector("main > div") as HTMLElement | null;
    if (!root) return [] as SectionPreference[];
    rootRef.current = root;

    const used = new Set<string>();
    const result: SectionPreference[] = [];
    Array.from(root.children).forEach((child, index) => {
      const element = child as HTMLElement;
      if (element.matches("nav,[data-layout-fixed]")) return;
      const explicitId = element.dataset.layoutSection;
      const heading = element.querySelector("h2,h3");
      if (!explicitId && (!heading || heading.tagName === "H2")) return;
      const label =
        element.dataset.layoutLabel ||
        heading?.textContent?.trim().replace(/\s+/g, " ") ||
        `Section ${index + 1}`;
      let id = explicitId || slug(label) || `section-${index + 1}`;
      let suffix = 2;
      while (used.has(id)) id = `${slug(label)}-${suffix++}`;
      used.add(id);
      element.dataset.layoutSection = id;
      element.dataset.layoutLabel = label;
      result.push({ id, label, visible: true });
    });
    return result;
  }, []);

  const apply = useCallback((preference: SectionPreference[], editMode: boolean) => {
    const root = rootRef.current;
    if (!root) return;
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
      preference.forEach((section) => {
        const element = elements.get(section.id);
        if (!element) return;
        root.insertBefore(element, cursor.nextSibling);
        cursor = element;
      });
      marker.remove();
    }

    preference.forEach((section) => {
      const element = elements.get(section.id);
      if (!element) return;
      const mustHide = !editMode && !section.visible;
      element.hidden = mustHide;
      // Les classes d'affichage responsives peuvent prendre le dessus sur
      // l'attribut HTML hidden. Le style important garantit le même résultat
      // sur ordinateur et téléphone, puis est retiré dès que la section redevient visible.
      if (mustHide) {
        element.style.setProperty("display", "none", "important");
      } else {
        element.style.removeProperty("display");
      }
      element.classList.toggle("cesam-section-hidden-draft", editMode && !section.visible);
    });
  }, []);

  useEffect(() => {
    if (!moduleInfo || !ready) return;
    const controller = new AbortController();
    const retryTimers: number[] = [];
    const activeModuleId = moduleInfo.id;

    function mergeAndApply(found: SectionPreference[], remote: SectionPreference[] | null) {
      if (found.length === 0) return;
      defaultOrder.current = found;

      // Compatibilité avec les dispositions enregistrées avant la stabilisation
      // des identifiants des deux sections d'alertes de l'accueil.
      const normalizedRemote = remote?.map((section) => {
        if (activeModuleId !== "accueil") return section;
        if (section.id === "reproduction-velage") {
          return { ...section, id: "accueil-reproduction-velage" };
        }
        if (section.id === "sante-vaccins") {
          return { ...section, id: "accueil-sante-vaccins" };
        }
        return section;
      }) ?? null;

      const remoteMap = new Map(normalizedRemote?.map((section) => [section.id, section]));
      const ordered = [
        ...(normalizedRemote ?? []).filter((section) => found.some((item) => item.id === section.id)),
        ...found.filter((section) => !remoteMap.has(section.id)),
      ].map((section) => ({ ...section, visible: remoteMap.get(section.id)?.visible ?? true }));

      savedPreference.current = ordered;
      setSections(ordered);
      apply(ordered, false);
    }

    const timer = window.setTimeout(async () => {
      let remote: SectionPreference[] | null = null;
      try {
        const response = await fetch(
          `/api/mise-en-page?profil=${encodeURIComponent(profile)}&module=${moduleInfo.id}`,
          { cache: "no-store", signal: controller.signal }
        );
        if (!response.ok) return;
        const data = await response.json();
        remote = Array.isArray(data.sections) ? data.sections : null;
      } catch {
        return;
      }

      // Application immédiate, puis deux nouvelles passes pour les sections
      // rendues plus tard par Suspense ou par un composant client.
      mergeAndApply(discover(), remote);
      [350, 1200].forEach((delay) => {
        retryTimers.push(window.setTimeout(() => mergeAndApply(discover(), remote), delay));
      });
    }, 80);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
      retryTimers.forEach((retry) => window.clearTimeout(retry));
    };
  }, [apply, discover, moduleInfo, profile, ready]);

  if (!moduleInfo || !ready) return null;
  const moduleId = moduleInfo.id;

  function openEditor() {
    const found = discover();
    const current = sections.length ? sections : found;
    setSections(current);
    setEditing(true);
    window.setTimeout(() => apply(current, true), 0);
  }

  function updateSections(next: SectionPreference[]) {
    setSections(next);
    window.setTimeout(() => apply(next, true), 0);
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/mise-en-page", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profil: profile, module: moduleId, sections }),
      });
      if (!response.ok) throw new Error("Enregistrement impossible");
      savedPreference.current = sections;
      apply(sections, false);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    const saved = savedPreference.current.length ? savedPreference.current : defaultOrder.current;
    setSections(saved);
    apply(saved, false);
    setEditing(false);
  }

  function restoreDefault() {
    const restored = defaultOrder.current.map((section) => ({ ...section, visible: true }));
    updateSections(restored);
  }

  function moveBefore(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    const next = [...sections];
    const from = next.findIndex((item) => item.id === draggedId);
    const to = next.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    updateSections(next);
    setDraggedId(null);
    setDropTargetId(null);
  }

  return (
    <>
      {!editing && sections.length > 0 && (
        <button
          type="button"
          onClick={openEditor}
          className="print:hidden fixed right-3 top-[118px] z-20 hidden min-h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 shadow-lg hover:bg-gray-50 md:inline-flex"
        >
          <LayoutDashboard size={16} />
          Modifier la mise en page
        </button>
      )}

      {editing && (
        <aside className="print:hidden fixed inset-x-2 bottom-2 z-[70] mx-auto hidden max-h-[72vh] max-w-lg overflow-y-auto rounded-2xl border border-green-200 bg-white p-4 shadow-2xl md:block">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-gray-900">Modifier la mise en page</h2>
              <p className="text-xs text-gray-500">{moduleInfo.label} · Profil {profile}</p>
            </div>
            <button type="button" onClick={cancel} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100" aria-label="Annuler">
              <X size={18} />
            </button>
          </div>

          <p className="mt-4 text-xs font-bold uppercase tracking-wide text-gray-500">Sections</p>
          <p className="mt-1 text-xs text-gray-400">Faites glisser les lignes. Le trait vert indique l’emplacement exact.</p>
          <div className="mt-2 space-y-2">
            {sections.map((section) => (
              <div
                key={section.id}
                draggable
                onDragStart={() => { setDraggedId(section.id); setDropTargetId(null); }}
                onDragEnd={() => { setDraggedId(null); setDropTargetId(null); }}
                onDragOver={(event) => { event.preventDefault(); if (draggedId !== section.id) setDropTargetId(section.id); }}
                onDrop={() => moveBefore(section.id)}
                className={`relative flex min-h-11 items-center gap-2 rounded-xl border px-2 ${
                  section.visible ? "border-gray-200 bg-white" : "border-gray-200 bg-gray-100 text-gray-400"
                } ${
                  dropTargetId === section.id
                    ? "before:absolute before:-top-[7px] before:left-1 before:right-1 before:h-1 before:rounded-full before:bg-green-600"
                    : ""
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

          <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
            <button type="button" onClick={restoreDefault} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-300 px-3 text-sm font-semibold text-gray-700">
              <RotateCcw size={16} />
              Restaurer par défaut
            </button>
            <button type="button" onClick={cancel} disabled={saving} className="min-h-11 rounded-xl border border-gray-300 px-4 text-sm font-semibold text-gray-700 disabled:opacity-50">
              Annuler
            </button>
            <button type="button" onClick={save} disabled={saving} className="ml-auto min-h-11 rounded-xl bg-green-700 px-4 text-sm font-bold text-white disabled:opacity-50">
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
