"use client";

import Link from "next/link";
import {
  FormEvent,
  PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowLeft, Check, ChevronLeft, Lock, Pencil, Scale, Sun, Trash2 } from "lucide-react";
import {
  ageAlertLabel,
  averageWeight,
  clampSwipeOffset,
  fieldAgeInfo,
  fieldAgeAlertSummary,
  hydrateFieldSessionEntries,
  motherNumberLabel,
  needsFieldAnimalDetails,
  nextOpenSwipeId,
  prependSessionEntry,
  removeSessionEntry,
  replaceSessionEntry,
  selectedAverage,
  settleSwipe,
  shouldShowSwipeHint,
  stopSwipeActionPointerDown,
  SWIPE_ACTION_WIDTH,
} from "@/lib/field-weighing";
import type { FieldAnimalDetails, FieldSessionEntry } from "@/lib/field-weighing";
import { parsePriceGroups, sortEntriesByWeight, type PriceGroup } from "@/lib/price-simulation";
import PriceSimulation from "./PriceSimulation";

type StoredSession = {
  startedAt: string;
  entries: FieldSessionEntry[];
  summaryOpen: boolean;
  simulationOpen: boolean;
  priceGroups: PriceGroup[];
};

type WakeLockSentinel = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
};

const STORAGE_KEY = "cesam:field-weighing-session";
const SWIPE_HINT_KEY = "cesam:field-weighing-swipe-hint-used";

function createSession(): StoredSession {
  return {
    startedAt: new Date().toISOString(),
    entries: [],
    summaryOpen: false,
    simulationOpen: false,
    priceGroups: [],
  };
}

function todayLocal() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export default function FieldWeighingSession() {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [nutrav, setNutrav] = useState("");
  const [poids, setPoids] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingInSummary, setEditingInSummary] = useState(false);
  const [openSummaryRowId, setOpenSummaryRowId] = useState<string | null>(null);
  const [swipeHintUsed, setSwipeHintUsed] = useState(false);
  const [error, setError] = useState("");
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const numberRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    try {
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<StoredSession>;
        setSession({
          startedAt: parsed.startedAt ?? new Date().toISOString(),
          entries: parsed.entries ?? [],
          summaryOpen: parsed.summaryOpen ?? false,
          simulationOpen: parsed.simulationOpen ?? false,
          priceGroups: parsePriceGroups(JSON.stringify(parsed.priceGroups ?? [])),
        });
      } else {
        setSession(createSession());
      }
      setSwipeHintUsed(localStorage.getItem(SWIPE_HINT_KEY) === "true");
    } catch {
      setSession(createSession());
    }
  }, []);

  useEffect(() => {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    const entriesToHydrate = session?.entries.filter(needsFieldAnimalDetails) ?? [];
    if (entriesToHydrate.length === 0) return;

    const controller = new AbortController();
    const nutravs = [...new Set(entriesToHydrate.map((entry) => entry.nutrav))];

    async function hydrateAnimalDetails() {
      try {
        const response = await fetch(`/api/animaux?nutravs=${encodeURIComponent(nutravs.join(","))}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const result = await response.json() as { animaux?: FieldAnimalDetails[] };
        if (!Array.isArray(result.animaux)) return;

        setSession((current) => {
          if (!current) return current;
          const entries = hydrateFieldSessionEntries(current.entries, result.animaux ?? []);
          return entries === current.entries ? current : { ...current, entries };
        });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Réhydratation de la séance impossible", error);
        }
      }
    }

    void hydrateAnimalDetails();
    return () => controller.abort();
  }, [session?.entries]);

  useEffect(() => {
    let mounted = true;

    async function requestWakeLock() {
      if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
      try {
        const sentinel = await (
          navigator as Navigator & {
            wakeLock: { request: (type: "screen") => Promise<WakeLockSentinel> };
          }
        ).wakeLock.request("screen");
        if (!mounted) {
          await sentinel.release();
          return;
        }
        wakeLockRef.current = sentinel;
        setWakeLockActive(true);
        sentinel.addEventListener("release", () => setWakeLockActive(false));
      } catch {
        setWakeLockActive(false);
      }
    }

    void requestWakeLock();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && wakeLockRef.current?.released !== false) {
        void requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void wakeLockRef.current?.release();
    };
  }, []);

  const summaryOpen = session?.summaryOpen;
  useEffect(() => {
    if (summaryOpen === false) numberRef.current?.focus();
  }, [summaryOpen]);

  const selected = useMemo(
    () => session?.entries.filter((entry) => entry.selected) ?? [],
    [session?.entries],
  );
  const average = selectedAverage(selected);

  if (!session) {
    return <div className="min-h-[70vh] bg-white" aria-label="Chargement de la séance" />;
  }

  function resetEdit() {
    setEditingId(null);
    setEditingInSummary(false);
    setEditWeight("");
    setError("");
  }

  function resetForm() {
    resetEdit();
    setNutrav("");
    setPoids("");
    requestAnimationFrame(() => numberRef.current?.focus());
  }

  async function saveModification(activeSession: StoredSession, id: string, numericWeight: number) {
    const currentEntry = activeSession.entries.find((entry) => entry.id === id);
    if (!currentEntry) throw new Error("Cette pesée n’est plus dans la séance.");

    const response = await fetch(`/api/pesees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poids: numericWeight, sessionStartedAt: activeSession.startedAt }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "La pesée n’a pas pu être modifiée.");

    const updatedEntry = {
      ...currentEntry,
      poids: result.pesee.poids,
      gmq: result.gmq,
    };
    setSession((current) =>
      current
        ? { ...current, entries: replaceSessionEntry(current.entries, updatedEntry) }
        : current,
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const activeSession = session;
    if (!activeSession) return;

    const cleanNumber = nutrav.trim();
    const numericWeight = Number(poids);

    if (!cleanNumber) {
      setError("Saisissez le numéro de l’animal.");
      numberRef.current?.focus();
      return;
    }
    if (!Number.isInteger(numericWeight) || numericWeight <= 0 || numericWeight > 2000) {
      setError("Saisissez un poids entier valide.");
      weightRef.current?.focus();
      return;
    }
    if (activeSession.entries.some((entry) => entry.nutrav === cleanNumber)) {
      setError(`L’animal ${cleanNumber} est déjà pesé dans cette séance.`);
      setNutrav("");
      setPoids("");
      numberRef.current?.focus();
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/pesees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nutrav: cleanNumber,
          poids: numericWeight,
          date: todayLocal(),
          sessionStartedAt: activeSession.startedAt,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "La pesée n’a pas pu être enregistrée.");

      setSession((current) =>
        current
          ? {
              ...current,
              entries: prependSessionEntry(current.entries, {
                id: result.pesee.id,
                nutrav: result.animal.nutrav,
                mereNutrav: result.animal.mereNutrav,
                birthDate: result.animal.birthDate,
                sexe: result.animal.sexe === "M" ? "M" : "F",
                poids: result.pesee.poids,
                gmq: result.gmq,
                selected: true,
              }),
            }
          : current,
      );
      resetForm();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La pesée n’a pas pu être enregistrée.");
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(entry: FieldSessionEntry) {
    if (editingId && editingId !== entry.id) return;
    setOpenSummaryRowId(null);
    setEditingId(entry.id);
    setEditingInSummary(true);
    setEditWeight(String(entry.poids));
    setError("");
    requestAnimationFrame(() => {
      weightRef.current?.focus();
      weightRef.current?.select();
    });
  }

  async function cancelWeight(entry: FieldSessionEntry) {
    setOpenSummaryRowId(null);
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/pesees/${entry.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "La pesée n’a pas pu être annulée.");
      setSession((current) =>
        current
          ? {
              ...current,
              entries: removeSessionEntry(current.entries, entry.id),
              priceGroups: current.priceGroups
                .map((group) => ({
                  ...group,
                  peseeIds: group.peseeIds.filter((id) => id !== entry.id),
                }))
                .filter((group) => group.peseeIds.length > 0),
            }
          : current,
      );
      if (editingId === entry.id) resetEdit();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La pesée n’a pas pu être annulée.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSummaryEdit() {
    const activeSession = session;
    if (!activeSession || !editingId) return;
    const numericWeight = Number(editWeight);
    if (!Number.isInteger(numericWeight) || numericWeight <= 0 || numericWeight > 2000) {
      setError("Saisissez un poids entier valide.");
      weightRef.current?.focus();
      return;
    }

    setSaving(true);
    setError("");
    try {
      await saveModification(activeSession, editingId, numericWeight);
      resetEdit();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La pesée n’a pas pu être modifiée.");
    } finally {
      setSaving(false);
    }
  }

  function toggle(id: string) {
    setSession((current) =>
      current
        ? {
            ...current,
            entries: current.entries.map((entry) =>
              entry.id === id ? { ...entry, selected: !entry.selected } : entry,
            ),
          }
        : current,
    );
  }

  function handleRowOpen(id: string, open: boolean) {
    setOpenSummaryRowId((current) => nextOpenSwipeId(current, id, open));
    if (open && !swipeHintUsed) {
      setSwipeHintUsed(true);
      localStorage.setItem(SWIPE_HINT_KEY, "true");
    }
  }

  function startNewSession() {
    setSession(createSession());
    setEditingId(null);
    setEditingInSummary(false);
    setOpenSummaryRowId(null);
    setEditWeight("");
    setNutrav("");
    setPoids("");
    setError("");
  }

  const sortedEntries = sortEntriesByWeight(session.entries);
  const males = sortEntriesByWeight(session.entries.filter((entry) => entry.sexe === "M"));
  const females = sortEntriesByWeight(session.entries.filter((entry) => entry.sexe === "F"));
  const maleAverage = averageWeight(males);
  const femaleAverage = averageWeight(females);
  const ageAlerts = fieldAgeAlertSummary(session.entries);

  return (
    <div className="min-h-full bg-white text-black">
      <header className="sticky top-0 z-20 border-b-4 border-black bg-white px-3 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link
            href="/troupeau"
            className="flex min-h-12 min-w-12 items-center justify-center border-2 border-black bg-white"
            aria-label="Retour au troupeau"
          >
            <ArrowLeft size={30} strokeWidth={3} />
          </Link>
          <div className="min-w-0 text-center">
            <h1 className="text-2xl font-black leading-none">PESÉE RAPIDE</h1>
            <p className="mt-1 flex items-center justify-center gap-1 text-sm font-extrabold">
              {wakeLockActive ? <Sun size={18} strokeWidth={3} /> : <Lock size={18} strokeWidth={3} />}
              {wakeLockActive ? "Écran maintenu allumé" : "Maintien d’écran indisponible"}
            </p>
          </div>
          <Scale size={42} strokeWidth={3} aria-hidden="true" />
        </div>
      </header>

      {session.simulationOpen ? (
        <PriceSimulation
          entries={session.entries}
          groups={session.priceGroups}
          onGroupsChange={(priceGroups) =>
            setSession((current) => (current ? { ...current, priceGroups } : current))
          }
          onBack={() =>
            setSession((current) => (current ? { ...current, simulationOpen: false } : current))
          }
        />
      ) : !session.summaryOpen ? (
        <main className="mx-auto max-w-3xl px-3 py-5 pb-24">
          <form onSubmit={submit} className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-xl font-black">NUMÉRO ANIMAL</span>
              <input
                ref={numberRef}
                value={nutrav}
                onChange={(event) => setNutrav(event.target.value)}
                readOnly={editingId !== null}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && nutrav.trim()) {
                    event.preventDefault();
                    weightRef.current?.focus();
                  }
                }}
                inputMode="numeric"
                autoComplete="off"
                className="h-24 w-full border-4 border-black bg-white px-4 text-center text-5xl font-black text-black outline-none focus:ring-4 focus:ring-yellow-400 read-only:bg-yellow-100"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xl font-black">POIDS (KG)</span>
              <input
                ref={weightRef}
                value={poids}
                onChange={(event) => setPoids(event.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                autoComplete="off"
                className="h-24 w-full border-4 border-black bg-white px-4 text-center text-5xl font-black text-black outline-none focus:ring-4 focus:ring-yellow-400"
              />
            </label>

            {error && !editingInSummary && (
              <div role="alert" className="border-4 border-red-700 bg-red-100 p-4 text-lg font-black text-red-900">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="flex min-h-20 w-full items-center justify-center gap-3 border-4 border-black bg-green-600 px-4 text-2xl font-black text-black active:bg-green-400 disabled:bg-yellow-300"
            >
              <Check size={36} strokeWidth={4} />
              {saving ? "ENREGISTREMENT…" : "VALIDER LA PESÉE"}
            </button>
          </form>

          <section className="mt-6">
            <h2 className="border-b-4 border-black pb-2 text-xl font-black">
              PESÉES DE LA SÉANCE — {session.entries.length} {session.entries.length > 1 ? "ANIMAUX" : "ANIMAL"}
            </h2>
            <div className="grid border-x-4 border-b-4 border-black bg-white px-3 py-2 text-base font-black sm:grid-cols-2 sm:gap-4">
              <p>MÂLES : {males.length === 0 ? "aucun" : `${males.length} · moyenne ${maleAverage} kg`}</p>
              <p>FEMELLES : {females.length === 0 ? "aucune" : `${females.length} · moyenne ${femaleAverage} kg`}</p>
            </div>
            {session.entries.length === 0 ? (
              <p className="border-x-4 border-b-4 border-black bg-white p-5 text-center text-lg font-black">
                AUCUNE PESÉE ENREGISTRÉE DANS CETTE SÉANCE
              </p>
            ) : (
              sortedEntries.map((entry, index) => {
                const isEditing = editingInSummary && editingId === entry.id;
                return (
                  <SummaryRow
                    key={entry.id}
                    entry={entry}
                    open={openSummaryRowId === entry.id}
                    disabled={saving || (editingId !== null && !isEditing)}
                    isEditing={isEditing}
                    editWeight={editWeight}
                    error={isEditing ? error : ""}
                    weightRef={isEditing ? weightRef : undefined}
                    showDetails
                    showHint={shouldShowSwipeHint(swipeHintUsed, index)}
                    onOpenChange={(open) => handleRowOpen(entry.id, open)}
                    onToggle={() => {}}
                    onEdit={() => beginEdit(entry)}
                    onEditWeight={setEditWeight}
                    onSave={() => void saveSummaryEdit()}
                    onAbandon={resetEdit}
                    onDelete={() => void cancelWeight(entry)}
                  />
                );
              })
            )}
          </section>

          <button
            type="button"
            disabled={session.entries.length === 0}
            onClick={() => setSession({ ...session, summaryOpen: true })}
            className="mt-6 min-h-16 w-full border-4 border-black bg-black px-4 text-xl font-black text-white disabled:border-neutral-500 disabled:bg-neutral-500"
          >
            FIN DE SÉANCE · {session.entries.length} PESÉ{session.entries.length > 1 ? "ES" : "E"}
          </button>
        </main>
      ) : (
        <main className="mx-auto max-w-3xl px-3 py-5 pb-24">
          <section className="border-4 border-black bg-yellow-300 p-4 text-center">
            <p className="text-lg font-black">LOT SIMULÉ</p>
            <p className="mt-1 text-4xl font-black">{selected.length} sélectionné{selected.length > 1 ? "s" : ""}</p>
            <p className="mt-1 text-3xl font-black">
              Moyenne : {average === null ? "—" : `${average} kg`}
            </p>
            <div className="mt-3 border-t-2 border-black pt-2 text-sm font-black">
              <p>{ageAlerts.approaching} animaux approchent 12 mois</p>
              <p>{ageAlerts.exceeded} animaux ont dépassé 12 mois</p>
            </div>
          </section>

          <button
            type="button"
            onClick={() => setSession({ ...session, simulationOpen: true })}
            className="mt-4 min-h-16 w-full border-4 border-black bg-green-600 px-4 text-xl font-black"
          >
            SIMULER UN PRIX DE VENTE
          </button>

          {error && !editingInSummary && (
            <div role="alert" className="mt-4 border-4 border-red-700 bg-red-100 p-4 text-lg font-black text-red-900">
              {error}
            </div>
          )}

          <SummaryGroup
            title="MÂLES"
            entries={males}
            onToggle={toggle}
            openRowId={openSummaryRowId}
            onOpenRow={handleRowOpen}
            editingId={editingId}
            editingInSummary={editingInSummary}
            editWeight={editWeight}
            saving={saving}
            error={error}
            weightRef={weightRef}
            onEdit={beginEdit}
            onEditWeight={setEditWeight}
            onSave={() => void saveSummaryEdit()}
            onAbandon={resetEdit}
            onDelete={(entry) => void cancelWeight(entry)}
          />
          <SummaryGroup
            title="FEMELLES"
            entries={females}
            onToggle={toggle}
            openRowId={openSummaryRowId}
            onOpenRow={handleRowOpen}
            editingId={editingId}
            editingInSummary={editingInSummary}
            editWeight={editWeight}
            saving={saving}
            error={error}
            weightRef={weightRef}
            onEdit={beginEdit}
            onEditWeight={setEditWeight}
            onSave={() => void saveSummaryEdit()}
            onAbandon={resetEdit}
            onDelete={(entry) => void cancelWeight(entry)}
          />

          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setOpenSummaryRowId(null);
                setSession({ ...session, summaryOpen: false });
              }}
              className="min-h-16 border-4 border-black bg-white px-4 text-xl font-black"
            >
              REPRENDRE LA SÉANCE
            </button>
            <button
              type="button"
              onClick={startNewSession}
              className="min-h-16 border-4 border-black bg-green-600 px-4 text-xl font-black"
            >
              NOUVELLE SÉANCE
            </button>
          </div>
          <p className="mt-4 text-center text-base font-extrabold">
            La sélection ne modifie et ne supprime aucun poids.
          </p>
        </main>
      )}
    </div>
  );
}

function SummaryGroup({
  title,
  entries,
  onToggle,
  openRowId,
  onOpenRow,
  editingId,
  editingInSummary,
  editWeight,
  saving,
  error,
  weightRef,
  onEdit,
  onEditWeight,
  onSave,
  onAbandon,
  onDelete,
}: {
  title: string;
  entries: FieldSessionEntry[];
  onToggle: (id: string) => void;
  openRowId: string | null;
  onOpenRow: (id: string, open: boolean) => void;
  editingId: string | null;
  editingInSummary: boolean;
  editWeight: string;
  saving: boolean;
  error: string;
  weightRef: RefObject<HTMLInputElement | null>;
  onEdit: (entry: FieldSessionEntry) => void;
  onEditWeight: (value: string) => void;
  onSave: () => void;
  onAbandon: () => void;
  onDelete: (entry: FieldSessionEntry) => void;
}) {
  const selectedEntries = entries.filter((entry) => entry.selected);
  const average = selectedAverage(selectedEntries);

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between border-b-4 border-black pb-2">
        <h2 className="text-2xl font-black">{title}</h2>
        <strong className="text-lg font-black">
          {selectedEntries.length} · {average === null ? "—" : `${average} kg`}
        </strong>
      </div>
      {entries.length === 0 ? (
        <p className="border-x-4 border-b-4 border-black p-4 text-lg font-black">AUCUN</p>
      ) : (
        entries.map((entry) => {
          const isEditing = editingInSummary && editingId === entry.id;
          return (
          <SummaryRow
            key={entry.id}
            entry={entry}
            open={openRowId === entry.id}
            disabled={saving || (editingId !== null && !isEditing)}
            isEditing={isEditing}
            editWeight={editWeight}
            error={isEditing ? error : ""}
            weightRef={isEditing ? weightRef : undefined}
            onOpenChange={(open) => onOpenRow(entry.id, open)}
            onToggle={() => onToggle(entry.id)}
            onEdit={() => onEdit(entry)}
            onEditWeight={onEditWeight}
            onSave={onSave}
            onAbandon={onAbandon}
            onDelete={() => onDelete(entry)}
          />
          );
        })
      )}
    </section>
  );
}

function SummaryRow({
  entry,
  open,
  disabled,
  isEditing,
  editWeight,
  error,
  weightRef,
  showDetails = false,
  showHint = false,
  onOpenChange,
  onToggle,
  onEdit,
  onEditWeight,
  onSave,
  onAbandon,
  onDelete,
}: {
  entry: FieldSessionEntry;
  open: boolean;
  disabled: boolean;
  isEditing: boolean;
  editWeight: string;
  error: string;
  weightRef?: RefObject<HTMLInputElement | null>;
  showDetails?: boolean;
  showHint?: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: () => void;
  onEdit: () => void;
  onEditWeight: (value: string) => void;
  onSave: () => void;
  onAbandon: () => void;
  onDelete: () => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pointerStartRef = useRef({ x: 0, offset: 0 });
  const offsetRef = useRef(open ? -SWIPE_ACTION_WIDTH : 0);
  const [offset, setOffset] = useState(offsetRef.current);
  const [dragging, setDragging] = useState(false);
  const age = fieldAgeInfo(entry.birthDate);
  const ageAlert = ageAlertLabel(age.alert);

  const updateOffset = useCallback((value: number) => {
    offsetRef.current = value;
    setOffset(value);
  }, []);

  useEffect(() => {
    updateOffset(open ? -SWIPE_ACTION_WIDTH : 0);
  }, [open, updateOffset]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) onOpenChange(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [open, onOpenChange]);

  function startSwipe(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled || isEditing) return;
    pointerStartRef.current = { x: event.clientX, offset: open ? -SWIPE_ACTION_WIDTH : 0 };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveSwipe(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    updateOffset(
      clampSwipeOffset(pointerStartRef.current.offset + event.clientX - pointerStartRef.current.x),
    );
  }

  function endSwipe(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
    const shouldOpen = settleSwipe(offsetRef.current, pointerStartRef.current.offset);
    updateOffset(shouldOpen ? -SWIPE_ACTION_WIDTH : 0);
    onOpenChange(shouldOpen);
  }

  return (
    <div ref={wrapperRef} className="border-x-4 border-b-4 border-black">
      <div className="relative overflow-hidden">
        <div className="absolute inset-y-0 right-0 flex w-48 md:hidden">
          <ActionButton type="edit" onClick={onEdit} disabled={disabled} />
          <ActionButton type="delete" onClick={onDelete} disabled={disabled} />
        </div>
        <div
          onPointerDown={startSwipe}
          onPointerMove={moveSwipe}
          onPointerUp={endSwipe}
          onPointerCancel={endSwipe}
          style={{
            transform: `translateX(${offset}px)`,
            touchAction: "pan-y",
            transition: dragging ? "none" : "transform 180ms ease-out",
          }}
          className="relative z-10 flex min-h-20 items-center gap-3 bg-white px-3 md:!translate-x-0"
          aria-expanded={open}
        >
          {!showDetails && (
            <input
              type="checkbox"
              checked={entry.selected}
              onChange={onToggle}
              onPointerDown={(event) => event.stopPropagation()}
              className="h-9 w-9 shrink-0 accent-black"
              aria-label={`Sélectionner ${entry.nutrav}`}
            />
          )}
          <div className="min-w-0 flex-1 py-2">
            <p className="text-xl font-black">{entry.nutrav} — {entry.poids} kg</p>
            <p className="text-sm font-bold">
              {motherNumberLabel(entry)} · {age.label}
              {ageAlert && (
                <> · <span className={age.alert === "approaching" ? "text-orange-700" : "bg-orange-200 px-1 text-black"}>{ageAlert}</span></>
              )} · {entry.gmq === null
                ? "Première pesée"
                : `GMQ ${entry.gmq.toFixed(1).replace(".", ",")} kg/j`}
            </p>
            {showHint && (
              <p className="mt-1 text-sm font-bold">Glisser pour modifier ou annuler</p>
            )}
          </div>
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onOpenChange(!open)}
            disabled={disabled}
            className="flex min-h-11 min-w-11 items-center justify-center md:hidden"
            aria-label={`Actions pour ${entry.nutrav}`}
          >
            <ChevronLeft size={24} strokeWidth={3} />
          </button>
          <div className="hidden shrink-0 gap-1.5 md:flex">
            <ActionButton type="edit" onClick={onEdit} disabled={disabled} compact />
            <ActionButton type="delete" onClick={onDelete} disabled={disabled} compact />
          </div>
        </div>
      </div>

      {isEditing && (
        <div className="border-t-4 border-black bg-yellow-100 p-3">
          <p className="mb-2 text-base font-black">Modifier {entry.nutrav}</p>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <input
              ref={weightRef}
              value={editWeight}
              onChange={(event) => onEditWeight(event.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              className="h-14 min-w-0 border-2 border-black bg-white px-3 text-center text-2xl font-black outline-none focus:ring-4 focus:ring-yellow-400"
              aria-label={`Nouveau poids de ${entry.nutrav}`}
            />
            <button
              type="button"
              onClick={onSave}
              disabled={disabled}
              className="min-h-14 border-2 border-black bg-green-600 px-4 text-base font-black"
            >
              ENREGISTRER
            </button>
          </div>
          {error && <p className="mt-2 font-black text-red-800">{error}</p>}
          <button type="button" onClick={onAbandon} className="mt-2 min-h-11 font-black underline">
            Abandonner la modification
          </button>
        </div>
      )}
    </div>
  );
}

function ActionButton({
  type,
  onClick,
  disabled,
  compact = false,
}: {
  type: "edit" | "delete";
  onClick: () => void;
  disabled: boolean;
  compact?: boolean;
}) {
  const edit = type === "edit";
  const Icon = edit ? Pencil : Trash2;
  const label = edit ? "Modifier" : "Annuler";
  return (
    <button
      type="button"
      onPointerDown={stopSwipeActionPointerDown}
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className={
        compact
          ? `flex min-h-11 items-center gap-1 border-2 border-black px-2 text-sm font-black ${edit ? "bg-white text-black" : "bg-red-700 text-white"}`
          : `flex w-24 flex-col items-center justify-center gap-1 text-base font-black ${edit ? "bg-neutral-200 text-black" : "bg-red-700 text-white"}`
      }
    >
      <Icon size={compact ? 18 : 26} strokeWidth={3} />
      {label}
    </button>
  );
}
