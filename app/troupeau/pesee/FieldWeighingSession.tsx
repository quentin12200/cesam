"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowLeft, Check, ChevronLeft, Lock, Pencil, RefreshCw, Scale, Sun, Trash2 } from "lucide-react";
import {
  averageWeight,
  formatWeightKg,
  fieldAgeAlertSummary,
  hydrateFieldSessionEntries,
  needsFieldAnimalDetails,
  nextOpenSwipeId,
  prependSessionEntry,
  replaceSessionEntry,
  selectedAverage,
  selectedWeightSummary,
  shouldShowSwipeHint,
  stopSwipeActionPointerDown,
  swipeToggleLabel,
} from "@/lib/field-weighing";
import type { FieldAnimalDetails, FieldSessionEntry } from "@/lib/field-weighing";
import { createFieldWeight, deleteFieldWeight, FieldWeightApiError, updateFieldWeight } from "@/lib/field-weighing-api";
import {
  addPendingWeight,
  canResumeFieldSession,
  canStartNewFieldSession,
  FIELD_SESSION_STORAGE_KEY,
  parseStoredFieldSession,
  removeFieldSessionEntry,
  resolvePendingWeight,
  type StoredFieldSession,
} from "@/lib/field-weighing-session";
import {
  attachLegacyFieldSession,
  FieldSessionApiError,
  getFieldSession,
  openActiveFieldSession,
  pendingWeightInput,
  saveFieldSessionMetadata,
  sessionFromServer,
  transitionFieldSession,
} from "@/lib/field-weighing-session-api";
import { sortEntriesByWeight } from "@/lib/price-simulation";
import PriceSimulation from "./PriceSimulation";
import WeighingAnimalDetails from "./WeighingAnimalDetails";
import { useSwipeActions } from "./useSwipeActions";

type WakeLockSentinel = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
};

const SWIPE_HINT_KEY = "cesam:field-weighing-swipe-hint-used";

function isNetworkFailure(error: unknown): boolean {
  return (typeof navigator !== "undefined" && navigator.onLine === false) || error instanceof TypeError;
}

function todayLocal() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export default function FieldWeighingSession() {
  const router = useRouter();
  const [session, setSession] = useState<StoredFieldSession | null>(null);
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
  const [sessionMessage, setSessionMessage] = useState("");
  const [abandonOpen, setAbandonOpen] = useState(false);
  const numberRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const syncingPendingRef = useRef(false);

  useEffect(() => {
    const cached = parseStoredFieldSession(localStorage.getItem(FIELD_SESSION_STORAGE_KEY));
    setSession(cached);
    setSwipeHintUsed(localStorage.getItem(SWIPE_HINT_KEY) === "true");

    let cancelled = false;
    async function reconcileServerSession() {
      try {
        if (cached.weighingSessionId) {
          try {
            const known = await getFieldSession(cached.weighingSessionId);
            if (cancelled) return;
            if (canResumeFieldSession(known.status)) {
              setSession(sessionFromServer(known, cached));
              return;
            }
            setSessionMessage("La séance précédente est terminée. Une nouvelle séance est prête.");
          } catch (caught) {
            if (cached.entries.length > 0 || cached.pendingWeights.length > 0) {
              setSessionMessage("La référence serveur de cette séance est devenue invalide. Le cache local est conservé sans être écrasé.");
              return;
            }
            if (!(caught instanceof FieldSessionApiError && caught.status === 404)) throw caught;
          }
        }

        const active = await openActiveFieldSession();
        if (cancelled) return;
        if (!cached.weighingSessionId && cached.entries.length > 0) {
          const attachment = await attachLegacyFieldSession(active.id, cached.entries.map((entry) => entry.id));
          if (attachment.ignored.length > 0) {
            setSessionMessage(`${attachment.ignored.length} référence locale invalide a été ignorée ; les autres pesées sont conservées.`);
          }
        }
        const canonical = await getFieldSession(active.id);
        if (!cancelled) {
          const localSessionForActive = !cached.weighingSessionId
            ? { ...cached, weighingSessionId: active.id, startedAt: active.startedAt }
            : undefined;
          setSession(sessionFromServer(canonical, localSessionForActive));
        }
      } catch {
        if (!cancelled) {
          setSessionMessage("Mode hors connexion : la séance reste conservée sur cet appareil.");
        }
      }
    }
    void reconcileServerSession();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (session) localStorage.setItem(FIELD_SESSION_STORAGE_KEY, JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    if (!session?.weighingSessionId) return;
    const timeout = window.setTimeout(() => {
      void saveFieldSessionMetadata(session).catch(() => {
        setSessionMessage("Les choix restent enregistrés sur cet appareil et seront resynchronisés.");
      });
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [session]);

  useEffect(() => {
    if (!session?.weighingSessionId || session.status !== "ACTIVE" || session.pendingWeights.length === 0) return;

    async function synchronizePending() {
      if (syncingPendingRef.current) return;
      syncingPendingRef.current = true;
      try {
        for (const pending of session!.pendingWeights) {
          let entry: FieldSessionEntry;
          try {
            entry = await createFieldWeight(pendingWeightInput(pending, session!));
          } catch (caught) {
            if (!(caught instanceof FieldWeightApiError && caught.status === 409)) throw caught;
            const canonical = await getFieldSession(session!.weighingSessionId!);
            const existing = canonical.fieldEntries.find((item) => item.nutrav === pending.nutrav);
            if (!existing) throw caught;
            entry = existing;
          }
          setSession((current) => current ? resolvePendingWeight(current, pending.localId, entry) : current);
        }
        setSessionMessage("Pesées hors connexion synchronisées.");
      } catch (caught) {
        if (!isNetworkFailure(caught)) {
          setSessionMessage(caught instanceof Error ? caught.message : "Une pesée en attente ne peut pas être synchronisée.");
        }
      } finally {
        syncingPendingRef.current = false;
      }
    }

    const onOnline = () => void synchronizePending();
    window.addEventListener("online", onOnline);
    if (navigator.onLine) void synchronizePending();
    return () => window.removeEventListener("online", onOnline);
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

  async function saveModification(activeSession: StoredFieldSession, id: string, numericWeight: number) {
    const currentEntry = activeSession.entries.find((entry) => entry.id === id);
    if (!currentEntry) throw new Error("Cette pesée n’est plus dans la séance.");
    const updatedEntry = await updateFieldWeight(
      currentEntry,
      numericWeight,
      activeSession.startedAt,
    );
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
    if (activeSession.status !== "ACTIVE") {
      setError("Cette séance est terminée. Démarrez une nouvelle séance pour ajouter une pesée.");
      return;
    }
    if (!activeSession.weighingSessionId) {
      setError("Connexion au serveur nécessaire avant la première pesée de cette séance.");
      return;
    }

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
    if (
      activeSession.entries.some((entry) => entry.nutrav === cleanNumber) ||
      activeSession.pendingWeights.some((entry) => entry.nutrav === cleanNumber)
    ) {
      setError(`L’animal ${cleanNumber} est déjà pesé dans cette séance.`);
      setNutrav("");
      setPoids("");
      numberRef.current?.focus();
      return;
    }

    setSaving(true);
    setError("");
    try {
      const entry = await createFieldWeight({
        nutrav: cleanNumber,
        poids: numericWeight,
        date: todayLocal(),
        sessionStartedAt: activeSession.startedAt,
        weighingSessionId: activeSession.weighingSessionId,
      });

      setSession((current) =>
        current
          ? {
              ...current,
              entries: prependSessionEntry(current.entries, entry),
            }
          : current,
      );
      resetForm();
    } catch (caught) {
      if (isNetworkFailure(caught)) {
        const pending = {
          localId: crypto.randomUUID(),
          nutrav: cleanNumber,
          poids: numericWeight,
          date: todayLocal(),
        };
        setSession((current) => current ? addPendingWeight(current, pending) : current);
        setSessionMessage("Pesée conservée hors connexion. Elle sera enregistrée automatiquement au retour du réseau.");
        resetForm();
      } else {
        setError(caught instanceof Error ? caught.message : "La pesée n’a pas pu être enregistrée.");
      }
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
      await deleteFieldWeight(entry.id);
      setSession((current) =>
        current ? removeFieldSessionEntry(current, entry.id) : current,
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

  async function finishSession() {
    const activeSession = session;
    if (!activeSession?.weighingSessionId || activeSession.status !== "ACTIVE") return;
    setSaving(true);
    setError("");
    try {
      await saveFieldSessionMetadata(activeSession);
      const finished = await transitionFieldSession(activeSession.weighingSessionId, "finish");
      setSession((current) => current ? {
        ...current,
        status: finished.status,
        summaryOpen: true,
        simulationOpen: false,
      } : current);
      setSessionMessage("Séance terminée et enregistrée");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La séance ne peut pas être terminée.");
    } finally {
      setSaving(false);
    }
  }

  async function sellSession() {
    const activeSession = session;
    if (!activeSession?.weighingSessionId || activeSession.entries.length === 0) return;
    if (activeSession.pendingWeights.length > 0) {
      setError("Attendez la synchronisation des pesées avant de vendre les animaux.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveFieldSessionMetadata(activeSession);
      if (canResumeFieldSession(activeSession.status)) {
        await transitionFieldSession(activeSession.weighingSessionId, "finish");
      }
      router.push(`/troupeau/pesee/sessions/${activeSession.weighingSessionId}/vente`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La vente groupée ne peut pas être ouverte.");
      setSaving(false);
    }
  }

  async function startNewSession() {
    if (!session || !canStartNewFieldSession(session.status)) {
      setError("Terminez ou abandonnez la séance active avant d’en démarrer une nouvelle.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const opened = await openActiveFieldSession();
      const canonical = await getFieldSession(opened.id);
      setSession(sessionFromServer(canonical));
      resetForm();
      setSessionMessage("Nouvelle séance démarrée.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La nouvelle séance ne peut pas être démarrée.");
    } finally {
      setSaving(false);
    }
  }

  async function abandonSession() {
    const activeSession = session;
    if (!activeSession?.weighingSessionId || activeSession.status !== "ACTIVE") return;
    setSaving(true);
    setError("");
    try {
      await saveFieldSessionMetadata(activeSession);
      const abandoned = await transitionFieldSession(activeSession.weighingSessionId, "abandon");
      setSession((current) => current ? {
        ...current,
        status: abandoned.status,
        summaryOpen: true,
        simulationOpen: false,
      } : current);
      setAbandonOpen(false);
      setSessionMessage("Séance abandonnée. Toutes les pesées enregistrées sont conservées.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La séance ne peut pas être abandonnée.");
    } finally {
      setSaving(false);
    }
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

      {sessionMessage && (
        <div role="status" className="mx-auto max-w-3xl border-x-4 border-b-4 border-black bg-yellow-200 px-3 py-2 text-center font-black">
          {sessionMessage}
        </div>
      )}

      {session.simulationOpen ? (
        <PriceSimulation
          entries={session.entries}
          groups={session.priceGroups}
          onGroupsChange={(priceGroups) =>
            setSession((current) => (current ? { ...current, priceGroups } : current))
          }
          onBack={() =>
            {
              setOpenSummaryRowId(null);
              setSession((current) => (current ? { ...current, simulationOpen: false } : current));
            }
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
            {session.pendingWeights.length > 0 && (
              <div className="border-x-4 border-b-4 border-black bg-yellow-200 p-3 font-black">
                <p className="flex items-center gap-2"><RefreshCw size={20} /> EN ATTENTE DE SYNCHRONISATION</p>
                {session.pendingWeights.map((pending) => (
                  <p key={pending.localId} className="mt-1">{pending.nutrav} — {pending.poids} kg</p>
                ))}
              </div>
            )}
          </section>

          <button
            type="button"
            disabled={session.entries.length === 0}
            onClick={() => {
              setOpenSummaryRowId(null);
              setSession({ ...session, summaryOpen: true });
            }}
            className="mt-6 min-h-16 w-full border-4 border-black bg-black px-4 text-xl font-black text-white disabled:border-neutral-500 disabled:bg-neutral-500"
          >
            VOIR LE RÉCAPITULATIF · {session.entries.length} PESÉ{session.entries.length > 1 ? "ES" : "E"}
          </button>
          {session.entries.length > 0 && (
            <button
              type="button"
              onClick={() => void sellSession()}
              disabled={saving || session.pendingWeights.length > 0}
              className="mt-3 min-h-16 w-full border-4 border-black bg-green-600 px-4 text-xl font-black disabled:bg-neutral-400"
            >
              VENDRE / SORTIR DES ANIMAUX
            </button>
          )}
          <button
            type="button"
            onClick={() => void finishSession()}
            disabled={saving || session.status !== "ACTIVE" || session.pendingWeights.length > 0}
            className="mt-3 min-h-12 w-full border-2 border-black bg-white px-4 text-base font-black disabled:bg-neutral-300"
          >
            TERMINER LA SÉANCE
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
            onClick={() => {
              setOpenSummaryRowId(null);
              setSession({ ...session, simulationOpen: true });
            }}
            className="mt-4 min-h-16 w-full border-4 border-black bg-green-600 px-4 text-xl font-black"
          >
            SIMULER UN PRIX DE VENTE
          </button>

          {session.entries.length > 0 && (
            <button
              type="button"
              onClick={() => void sellSession()}
              disabled={saving || session.pendingWeights.length > 0}
              className="mt-3 min-h-16 w-full border-4 border-black bg-black px-4 text-xl font-black text-white disabled:bg-neutral-400"
            >
              VENDRE / SORTIR DES ANIMAUX
            </button>
          )}

          {error && !editingInSummary && (
            <div role="alert" className="mt-4 border-4 border-red-700 bg-red-100 p-4 text-lg font-black text-red-900">
              {error}
            </div>
          )}

          <SummaryGroup
            title="MÂLES"
            sexe="M"
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
            sexe="F"
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
              disabled={session.status !== "ACTIVE"}
              onClick={() => {
                resetForm();
                setOpenSummaryRowId(null);
                setSession({ ...session, summaryOpen: false });
              }}
              className="min-h-16 border-4 border-black bg-white px-4 text-xl font-black disabled:bg-neutral-300"
            >
              {session.status === "ACTIVE" ? "REPRENDRE LA SÉANCE" : "SÉANCE EN LECTURE SEULE"}
            </button>
            <button
              type="button"
              onClick={() => void finishSession()}
              disabled={saving || session.status !== "ACTIVE" || session.pendingWeights.length > 0}
              className="min-h-16 border-4 border-black bg-green-600 px-4 text-xl font-black disabled:bg-neutral-400"
            >
              {session.status === "ACTIVE" ? "TERMINER LA SÉANCE" : "SÉANCE TERMINÉE"}
            </button>
          </div>
          {session.status === "ACTIVE" ? (
            <div className="mt-3">
              {!abandonOpen ? (
                <button type="button" onClick={() => setAbandonOpen(true)} className="min-h-12 w-full px-3 font-black underline">
                  Abandonner la séance
                </button>
              ) : (
                <div className="border-4 border-red-700 bg-red-50 p-4">
                  <p className="font-black">Les pesées déjà enregistrées seront conservées. Le récapitulatif de cette séance restera consultable comme séance abandonnée.</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setAbandonOpen(false)} className="min-h-12 border-2 border-black bg-white font-black">REVENIR</button>
                    <button type="button" onClick={() => void abandonSession()} disabled={saving || session.pendingWeights.length > 0} className="min-h-12 border-2 border-black bg-red-700 font-black text-white disabled:bg-neutral-400">CONFIRMER L’ABANDON</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button type="button" onClick={() => void startNewSession()} disabled={saving} className="mt-3 min-h-16 w-full border-4 border-black bg-green-600 px-4 text-xl font-black disabled:bg-neutral-400">
              DÉMARRER UNE NOUVELLE SÉANCE
            </button>
          )}
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
  sexe,
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
  sexe: "M" | "F";
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
      <div className="border-b-4 border-black pb-2">
        <h2 className="text-3xl font-black leading-none">{title}</h2>
        <p className="mt-1 text-xl font-black leading-tight">
          {selectedWeightSummary(selectedEntries.length, average, sexe)}
        </p>
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
  const { wrapperRef, offset, dragging, pointerHandlers } = useSwipeActions({
    open,
    disabled: disabled || isEditing,
    onOpenChange,
  });

  return (
    <div
      ref={wrapperRef}
      {...pointerHandlers}
      style={{ touchAction: "pan-y" }}
      className="border-x-4 border-b-4 border-black"
    >
      <div className="relative overflow-hidden">
        <div className="absolute inset-y-0 right-0 flex w-48 md:hidden">
          <ActionButton type="edit" onClick={onEdit} disabled={disabled} />
          <ActionButton type="delete" onClick={onDelete} disabled={disabled} />
        </div>
        <div
          style={{
            transform: `translateX(${offset}px)`,
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
            <p className="text-xl font-black">{entry.nutrav} — {formatWeightKg(entry.poids)}</p>
            <WeighingAnimalDetails entry={entry} />
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
            aria-label={swipeToggleLabel(open)}
          >
            <ChevronLeft
              size={24}
              strokeWidth={3}
              className={`transition-transform duration-150 ${open ? "rotate-180" : "rotate-0"}`}
            />
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
